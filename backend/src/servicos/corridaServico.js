const corridaModelo = require('../modelos/corridaModelo');
const usuarioModelo = require('../modelos/usuarioModelo');
const dividaModelo = require('../modelos/dividaModelo');
const pagamentoPixModelo = require('../modelos/pagamentoPixModelo');
const mercadoPago = require('../utilitarios/mercadoPago');
const { ErroHttp } = require('../intermediarios/tratadorErros');
const soquete = require('../tempoReal/servidorSoquete');

const TIPOS_VALIDOS = ['carro', 'moto'];
const FORMAS_PAGAMENTO_VALIDAS = ['dinheiro', 'pix', 'pix_prepago'];

// Validação básica dos dados de uma corrida nova — usada tanto na criação
// direta (POST /rides, pra dinheiro/Pix na mão) quanto na criação da
// cobrança Pix pré-pago (POST /payments/pix), já que os dois recebem
// basicamente o mesmo payload.
// O Mercado Pago não aceita cobrança Pix abaixo desse valor — sem essa
// checagem aqui, a corrida nasceria normal e só ia quebrar (com erro feio
// do Mercado Pago) na hora de gerar o QR code pra pagar ou pra finalizar.
const VALOR_MINIMO_CORRIDA = 4.3;

function validarDadosCorrida({ origem, destino, tipoVeiculo, preco, distanciaKm, duracaoMin, formaPagamento }) {
  if (!origem?.latitude || !origem?.longitude || !destino?.latitude || !destino?.longitude) {
    throw new ErroHttp(400, 'Origem e destino são obrigatórios.');
  }
  if (!TIPOS_VALIDOS.includes(tipoVeiculo)) {
    throw new ErroHttp(400, 'Tipo de veículo inválido.');
  }
  if (!preco || !distanciaKm || !duracaoMin) {
    throw new ErroHttp(400, 'Preço, distância e duração são obrigatórios.');
  }
  if (preco < VALOR_MINIMO_CORRIDA) {
    throw new ErroHttp(400, `O valor mínimo de uma corrida é R$${VALOR_MINIMO_CORRIDA.toFixed(2)}.`);
  }
  if (formaPagamento && !FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
    throw new ErroHttp(400, 'Forma de pagamento inválida.');
  }
}

// Se o passageiro tem alguma corrida anterior não paga ("não pagou" na
// hora de finalizar), soma todas elas no preço da corrida nova — é assim
// que a dívida é cobrada: na próxima viagem que ele pedir, o valor sai
// maior (tarifa desta corrida + o que ficou devendo antes).
async function calcularPrecoComDividasPendentes(passageiroId, precoOriginal) {
  const dividasPendentes = await dividaModelo.listarPendentesPorPassageiro(passageiroId);
  const valorDividas = dividasPendentes.reduce((soma, d) => soma + Number(d.valor), 0);
  const precoFinal = Number((Number(precoOriginal) + valorDividas).toFixed(2));
  return { precoFinal, dividasIncluidas: dividasPendentes.map((d) => d.id) };
}

// Ponto único que cria a corrida no banco e avisa os motoristas disponíveis
// por perto — usado tanto pela criação direta (dinheiro/Pix na mão) quanto
// pela confirmação de um Pix pré-pago, assim que o pagamento é aprovado.
async function criarEDespachar({ passageiroId, origem, destino, tipoVeiculo, preco, distanciaKm, duracaoMin, formaPagamento }) {
  const corridaExistente = await corridaModelo.buscarAtivaPorPassageiro(passageiroId);
  if (corridaExistente) {
    throw new ErroHttp(409, 'Você já tem uma corrida em andamento.');
  }

  const { precoFinal, dividasIncluidas } = await calcularPrecoComDividasPendentes(passageiroId, preco);

  // Checagem feita ANTES de despachar: se não tem nenhum motorista do tipo
  // pedido disponível agora (dentro do raio de notificação), o passageiro
  // precisa saber disso na hora — pra o app mostrar um aviso em vez de só
  // ficar com o anel de "procurando" girando sem explicação nenhuma. A
  // corrida é criada e a busca continua normalmente de qualquer jeito: se
  // um motorista ficar disponível depois, a reoferta em
  // 'motorista:disponivel' ainda alcança essa corrida.
  const semMotoristasDisponiveis = !soquete.existeMotoristaDisponivelPara(tipoVeiculo, origem);

  const corrida = await corridaModelo.criar({
    passageiroId,
    origem,
    destino,
    tipoVeiculo,
    preco: precoFinal,
    precoOriginal: preco,
    distanciaKm,
    duracaoMin,
    formaPagamento: formaPagamento || 'dinheiro',
    dividasIncluidas,
  });

  // O motorista precisa saber o nome do passageiro já na tela de "nova
  // corrida" — antes disso só aparecia depois de aceitar, o que deixava o
  // motorista decidindo "no escuro" quem ele ia buscar.
  const passageiro = await usuarioModelo.buscarPorId(passageiroId);
  const corridaPublica = {
    ...corridaModelo.paraCorridaPublica(corrida),
    passageiroNome: passageiro?.nome,
    // Campo só de resposta (não persistido) — informa o estado do radar
    // no exato instante da criação, pro app decidir se mostra o aviso.
    semMotoristasDisponiveis,
  };

  soquete.notificarNovaCorrida(corridaPublica, origem);
  if (semMotoristasDisponiveis) {
    soquete.notificarSemMotoristas({ corridaId: corrida.id, passageiroId, tipoVeiculo });
  }

  return corridaPublica;
}

// Chamado assim que uma corrida é confirmada como PAGA (dinheiro na hora ou
// Pix aprovado) — quita, uma a uma, as dívidas antigas que tinham sido
// somadas no preço dela, e credita cada motorista credor com o que ele
// tinha ficado sem receber. Se a corrida não tinha nenhuma dívida embutida,
// não faz nada.
async function quitarDividasDaCorrida(corridaFinalizada) {
  const idsDividas = corridaFinalizada.dividas_incluidas || [];
  if (!Array.isArray(idsDividas) || idsDividas.length === 0) return [];
  return dividaModelo.quitarVarias(idsDividas, corridaFinalizada.id);
}

// Chamado sempre que uma corrida é cancelada DE VEZ (pelo passageiro, ou
// pelo sistema depois que motoristas demais desistem dela) — ponto único
// pra decidir se tem dinheiro pra devolver.
//
// Só corridas pagas com Pix PRÉ-pago retêm dinheiro antes de cancelar: o
// Pix é aprovado ANTES da corrida nascer (ver pagamentoControlador.
// confirmarCorridaSePago), então cancelar depois disso deixa o valor
// parado no Mercado Pago sem nenhuma corrida pra "consumir" ele. Dinheiro
// na mão e Pix pós-pago (gerado só na finalização) nunca chegam a reter
// nada antes disso, então não têm o que estornar.
async function estornarPixSeNecessario(corrida) {
  if (corrida.forma_pagamento !== 'pix_prepago') return null;

  const pagamento = await pagamentoPixModelo.buscarPrepagoAprovadoPorCorrida(corrida.id);
  if (!pagamento) return null; // nada retido (pago em dinheiro/pix na mão, ou já estornado antes)

  try {
    await mercadoPago.estornarPagamento(pagamento.mercado_pago_id, pagamento.valor);
    return pagamentoPixModelo.atualizarStatus(pagamento.id, 'estornado');
  } catch (erro) {
    // A corrida já foi cancelada nesse ponto — não faz sentido derrubar o
    // cancelamento por causa de uma falha no estorno. Mas não pode passar
    // batido: marca como pendente (pra alguém correr atrás manualmente no
    // Mercado Pago) e grita bem alto no log.
    console.error(
      `[estorno pix] FALHA ao estornar pagamento ${pagamento.id} (corrida ${corrida.id}, ` +
        `mercado_pago_id ${pagamento.mercado_pago_id}, valor R$${pagamento.valor}):`,
      erro
    );
    try {
      return await pagamentoPixModelo.atualizarStatus(pagamento.id, 'estorno_pendente');
    } catch (erroSecundario) {
      console.error(`[estorno pix] falha até ao marcar estorno_pendente pra ${pagamento.id}:`, erroSecundario);
      return null;
    }
  }
}

module.exports = {
  validarDadosCorrida,
  criarEDespachar,
  quitarDividasDaCorrida,
  estornarPixSeNecessario,
  FORMAS_PAGAMENTO_VALIDAS,
};