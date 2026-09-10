const crypto = require('crypto');
const corridaModelo = require('../modelos/corridaModelo');
const usuarioModelo = require('../modelos/usuarioModelo');
const pagamentoPixModelo = require('../modelos/pagamentoPixModelo');
const corridaServico = require('../servicos/corridaServico');
const mercadoPago = require('../utilitarios/mercadoPago');
const { ErroHttp } = require('../intermediarios/tratadorErros');
const { exigirPerfilCompleto } = require('../utilitarios/perfilUsuario');
const soquete = require('../tempoReal/servidorSoquete');

// Quanto tempo o QR code fica válido antes do app desistir de esperar.
const MINUTOS_EXPIRACAO_PIX = 15;

function traduzirStatusMercadoPago(statusMp) {
  if (statusMp === 'approved') return 'aprovado';
  if (['rejected', 'cancelled'].includes(statusMp)) return 'recusado';
  return 'pendente';
}

// Nem todo usuário tem email cadastrado (quem entrou com telefone, por
// exemplo), mas o Mercado Pago exige um payer.email pra gerar o Pix — então
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
    exigirPerfilCompleto(passageiro);

    const pagamentoMp = await mercadoPago.criarPagamentoPix({
      valor: preco,
      descricao: `Corrida #GO (${tipoVeiculo})`,
      emailPagador: obterEmailPagador(passageiro),
      referenciaExterna: req.usuarioId,
      idempotencyKey: crypto.randomUUID(),
    });

    const dadosPix = pagamentoMp.point_of_interaction?.transaction_data;
    if (!dadosPix?.qr_code) {
      throw new ErroHttp(502, 'O Mercado Pago não retornou o QR code do Pix.');
    }

    const expiraEm = new Date(Date.now() + MINUTOS_EXPIRACAO_PIX * 60 * 1000);

    const pagamento = await pagamentoPixModelo.criar({
      passageiroId: req.usuarioId,
      mercadoPagoId: String(pagamentoMp.id),
      valor: preco,
      qrCode: dadosPix.qr_code,
      qrCodeBase64: dadosPix.qr_code_base64,
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
        const pagamentoMp = await mercadoPago.consultarPagamento(pagamento.mercado_pago_id);
        const statusTraduzido = traduzirStatusMercadoPago(pagamentoMp.status);
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
// Notificação assíncrona do Mercado Pago, avisando que o status de um
// pagamento mudou — chega mais rápido que o próximo polling do app. Sempre
// responde 200 (mesmo se der erro internamente), porque o Mercado Pago
// reenvia a notificação sem parar enquanto não receber 200.
async function webhook(req, res) {
  try {
    const tipo = req.body?.type || req.query.type;
    const mercadoPagoId = req.body?.data?.id || req.query['data.id'];

    if (tipo === 'payment' && mercadoPagoId) {
      const pagamentoLocal = await pagamentoPixModelo.buscarPorMercadoPagoId(String(mercadoPagoId));
      if (pagamentoLocal && pagamentoLocal.status === 'pendente') {
        const pagamentoMp = await mercadoPago.consultarPagamento(mercadoPagoId);
        const statusTraduzido = traduzirStatusMercadoPago(pagamentoMp.status);
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
    console.error('[webhook mercado pago] falha ao processar notificação:', erro);
  }

  res.sendStatus(200);
}

module.exports = { criarPix, status, webhook };