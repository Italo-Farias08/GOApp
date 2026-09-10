const crypto = require('crypto');
const corridaModelo = require('../modelos/corridaModelo');
const usuarioModelo = require('../modelos/usuarioModelo');
const pagamentoPixModelo = require('../modelos/pagamentoPixModelo');
const corridaServico = require('../servicos/corridaServico');
const asaas = require('../utilitarios/asaas');
const comissaoServico = require('../servicos/comissaoServico');
const { ErroHttp } = require('../intermediarios/tratadorErros');
const soquete = require('../tempoReal/servidorSoquete');

// Quanto tempo o QR code fica válido antes do app desistir de esperar.
const MINUTOS_EXPIRACAO_PIX = 15;

// Status do Asaas que contam como "pagamento aprovado" — Pix costuma
// chegar como RECEIVED (dinheiro já caiu na conta); CONFIRMED é o
// equivalente pra outros meios, mas deixamos aqui também por segurança.
const STATUS_ASAAS_APROVADO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const STATUS_ASAAS_RECUSADO = ['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'DELETED'];

function traduzirStatusAsaas(statusAsaas) {
  if (STATUS_ASAAS_APROVADO.includes(statusAsaas)) return 'aprovado';
  if (STATUS_ASAAS_RECUSADO.includes(statusAsaas)) return 'recusado';
  return 'pendente';
}

// Nem todo usuário tem email cadastrado (quem entrou com telefone, por
// exemplo), mas o Asaas exige um email pra criar o cliente/cobrança — então
// sintetiza um email válido a partir do ID quando faltar, sem bloquear o
// pagamento por causa disso.
function obterEmailPagador(usuario) {
  return usuario.email || `${usuario.id}@passageiro.goapp.com`;
}

// POST /payments/pix
//
// Gera a cobrança Pix no Mercado Pago pelo valor da corrida, mas NÃO cria a
// corrida ainda — ela só nasce de fato (e é despachada pros motoristas)
// depois que o pagamento é confirmado, em `confirmarCorridaSePago` abaixo.
async function criarPix(req, res, next) {
  try {
    const { origem, destino, tipoVeiculo, preco, distanciaKm, duracaoMin } = req.body;
    corridaServico.validarDadosCorrida({ origem, destino, tipoVeiculo, preco, distanciaKm, duracaoMin });

    const corridaExistente = await corridaModelo.buscarAtivaPorPassageiro(req.usuarioId);
    if (corridaExistente) {
      throw new ErroHttp(409, 'Você já tem uma corrida em andamento.');
    }

    const passageiro = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!passageiro) throw new ErroHttp(404, 'Usuário não encontrado.');

    const pagamentoAsaas = await asaas.criarPagamentoPix({
      valor: preco,
      descricao: `Corrida #GO (${tipoVeiculo})`,
      nomePagador: passageiro.nome,
      emailPagador: obterEmailPagador(passageiro),
      cpfPagador: passageiro.cpf,
      referenciaExterna: req.usuarioId,
    });

    if (!pagamentoAsaas.qrCode) {
      throw new ErroHttp(502, 'O Asaas não retornou o QR code do Pix.');
    }

    const expiraEm = new Date(Date.now() + MINUTOS_EXPIRACAO_PIX * 60 * 1000);

    const pagamento = await pagamentoPixModelo.criar({
      passageiroId: req.usuarioId,
      idPagamentoPsp: String(pagamentoAsaas.id),
      valor: preco,
      qrCode: pagamentoAsaas.qrCode,
      qrCodeBase64: pagamentoAsaas.qrCodeBase64,
      dadosCorrida: {
        origem,
        destino,
        tipoVeiculo,
        preco,
        distanciaKm,
        duracaoMin,
        formaPagamento: 'pix_prepago',
      },
      expiraEm,
    });

    return res.status(201).json(pagamentoPixModelo.paraPagamentoPublico(pagamento));
  } catch (erro) {
    next(erro);
  }
}

// Cria a corrida a partir de um pagamento já aprovado, de forma IDEMPOTENTE
// — chamado tanto pelo polling de status quanto pelo webhook, então precisa
// ser seguro mesmo se os dois chegarem quase ao mesmo tempo.
async function confirmarCorridaSePago(pagamento) {
  if (pagamento.status !== 'aprovado' || pagamento.corrida_id) {
    return pagamento;
  }

  const dadosCorrida = pagamento.dados_corrida;
  let corridaId;
  try {
    const corridaPublica = await corridaServico.criarEDespachar({
      passageiroId: pagamento.passageiro_id,
      ...dadosCorrida,
    });
    corridaId = corridaPublica.id;
  } catch (erro) {
    // "Já tem corrida em andamento" aqui quase sempre significa que o
    // webhook e o polling confirmaram o mesmo pagamento quase juntos, e o
    // outro já criou a corrida — só acha ela e vincula, em vez de falhar.
    if (erro.statusCode === 409) {
      const corridaAtiva = await corridaModelo.buscarAtivaPorPassageiro(pagamento.passageiro_id);
      if (!corridaAtiva) throw erro;
      corridaId = corridaAtiva.id;
    } else {
      throw erro;
    }
  }

  return pagamentoPixModelo.vincularCorrida(pagamento.id, corridaId);
}

// Espelho de confirmarCorridaSePago, mas pro Pix POS-pago (gerado pelo
// motorista ao finalizar uma corrida que já existe): em vez de CRIAR a
// corrida, FINALIZA a que já está em andamento, quita as dívidas antigas
// que porventura estivessem embutidas no preço e avisa o passageiro em
// tempo real — igual acontece pros outros dois jeitos de finalizar
// (dinheiro / não pagou). Também é idempotente: se a corrida dessa cobrança
// já estiver finalizada, não faz nada de novo.
async function confirmarFinalizacaoSePago(pagamento) {
  if (pagamento.status !== 'aprovado' || !pagamento.corrida_id) {
    return pagamento;
  }

  const corridaAtual = await corridaModelo.buscarPorId(pagamento.corrida_id);
  if (!corridaAtual || corridaAtual.status !== 'em_andamento') {
    // Já foi finalizada antes (webhook e polling confirmando quase juntos)
    // — nada a fazer, só devolve o pagamento como está.
    return pagamento;
  }

  const corridaFinalizada = await corridaModelo.finalizarComPixAprovado(pagamento.corrida_id);
  if (corridaFinalizada) {
    await corridaServico.quitarDividasDaCorrida(corridaFinalizada);

    // Dinheiro caiu na conta da plataforma (foi Pix) — credita o motorista
    // com o valor já líquido de comissão.
    await comissaoServico.aplicarComissao({
      motoristaId: corridaFinalizada.motorista_id,
      valorCorrida: corridaFinalizada.preco,
      foiPagoEmDinheiro: false,
    });

    soquete.notificarCorridaFinalizada({
      corridaId: corridaFinalizada.id,
      passageiroId: corridaFinalizada.passageiro_id,
    });
  }

  return pagamento;
}

// GET /payments/pix/:id
//
// O app fica chamando essa rota enquanto mostra o QR code. Além de devolver
// o status já salvo, ela também consulta o Mercado Pago de novo enquanto
// ainda estiver "pendente" — segurança extra caso o webhook demore ou não
// esteja configurado ainda. Serve tanto pro Pix pré-pago (cria a corrida
// quando aprova) quanto pro Pix gerado pelo motorista ao finalizar
// (finaliza a corrida já existente quando aprova) — o campo `tipo` do
// pagamento decide qual dos dois acontece.
async function status(req, res, next) {
  try {
    let pagamento = await pagamentoPixModelo.buscarPorId(req.params.id);
    if (!pagamento || pagamento.passageiro_id !== req.usuarioId) {
      throw new ErroHttp(404, 'Pagamento não encontrado.');
    }

    if (pagamento.status === 'pendente') {
      if (new Date(pagamento.expira_em) < new Date()) {
        pagamento = await pagamentoPixModelo.atualizarStatus(pagamento.id, 'expirado');
      } else {
        const pagamentoAsaas = await asaas.consultarPagamento(pagamento.mercado_pago_id);
        const statusTraduzido = traduzirStatusAsaas(pagamentoAsaas.status);
        if (statusTraduzido !== 'pendente') {
          pagamento = await pagamentoPixModelo.atualizarStatus(pagamento.id, statusTraduzido);
        }
      }
    }

    pagamento = pagamento.tipo === 'pos_pago'
      ? await confirmarFinalizacaoSePago(pagamento)
      : await confirmarCorridaSePago(pagamento);

    return res.json(pagamentoPixModelo.paraPagamentoPublico(pagamento));
  } catch (erro) {
    next(erro);
  }
}

// POST /payments/webhook
//
// Notificação assíncrona do Asaas, avisando que o status de uma cobrança
// mudou — chega mais rápido que o próximo polling do app. Sempre responde
// 200 (mesmo se der erro internamente), porque o Asaas reenvia a
// notificação sem parar enquanto não receber 200 — e se falhar 15 vezes
// seguidas, ele para de tentar de vez.
//
// Formato do corpo que o Asaas manda:
// { "event": "PAYMENT_RECEIVED", "payment": { "id": "pay_...", ... } }
const EVENTOS_RELEVANTES = [
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
];

async function webhook(req, res) {
  try {
    // Se você configurou um token de autenticação no painel do Asaas
    // (Integrações > Webhooks), toda notificação real vem com ele nesse
    // header — confere antes de confiar em qualquer coisa do corpo.
    const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
    if (tokenEsperado && req.headers['asaas-access-token'] !== tokenEsperado) {
      console.warn('[webhook asaas] token inválido ou ausente — ignorando notificação.');
      return res.sendStatus(200);
    }

    const evento = req.body?.event;
    const idPagamentoAsaas = req.body?.payment?.id;

    if (EVENTOS_RELEVANTES.includes(evento) && idPagamentoAsaas) {
      const pagamentoLocal = await pagamentoPixModelo.buscarPorIdPagamentoPsp(String(idPagamentoAsaas));
      if (pagamentoLocal && pagamentoLocal.status === 'pendente') {
        // Nunca confia só no que o webhook diz — consulta de novo na API
        // do Asaas pra confirmar o status real antes de dar como aprovado.
        const pagamentoAsaas = await asaas.consultarPagamento(idPagamentoAsaas);
        const statusTraduzido = traduzirStatusAsaas(pagamentoAsaas.status);
        if (statusTraduzido !== 'pendente') {
          const atualizado = await pagamentoPixModelo.atualizarStatus(pagamentoLocal.id, statusTraduzido);
          if (atualizado.tipo === 'pos_pago') {
            await confirmarFinalizacaoSePago(atualizado);
          } else {
            await confirmarCorridaSePago(atualizado);
          }
        }
      }
    }
  } catch (erro) {
    console.error('[webhook asaas] falha ao processar notificação:', erro);
  }

  res.sendStatus(200);
}

module.exports = { criarPix, status, webhook };