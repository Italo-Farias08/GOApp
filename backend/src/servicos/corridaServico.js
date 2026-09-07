const corridaModelo = require('../modelos/corridaModelo');
const usuarioModelo = require('../modelos/usuarioModelo');
const dividaModelo = require('../modelos/dividaModelo');
const { ErroHttp } = require('../intermediarios/tratadorErros');
const soquete = require('../tempoReal/servidorSoquete');

const TIPOS_VALIDOS = ['carro', 'moto'];
const FORMAS_PAGAMENTO_VALIDAS = ['dinheiro', 'pix', 'pix_prepago'];

// Validação básica dos dados de uma corrida nova — usada tanto na criação
// direta (POST /rides, pra dinheiro/Pix na mão) quanto na criação da
// cobrança Pix pré-pago (POST /payments/pix), já que os dois recebem
// basicamente o mesmo payload.
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
  };

  soquete.notificarNovaCorrida(corridaPublica, origem);

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

module.exports = {
  validarDadosCorrida,
  criarEDespachar,
  quitarDividasDaCorrida,
  FORMAS_PAGAMENTO_VALIDAS,
};