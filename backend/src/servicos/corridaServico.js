const corridaModelo = require('../modelos/corridaModelo');
const usuarioModelo = require('../modelos/usuarioModelo');
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

// Ponto único que cria a corrida no banco e avisa os motoristas disponíveis
// por perto — usado tanto pela criação direta (dinheiro/Pix na mão) quanto
// pela confirmação de um Pix pré-pago, assim que o pagamento é aprovado.
async function criarEDespachar({ passageiroId, origem, destino, tipoVeiculo, preco, distanciaKm, duracaoMin, formaPagamento }) {
  const corridaExistente = await corridaModelo.buscarAtivaPorPassageiro(passageiroId);
  if (corridaExistente) {
    throw new ErroHttp(409, 'Você já tem uma corrida em andamento.');
  }

  const corrida = await corridaModelo.criar({
    passageiroId,
    origem,
    destino,
    tipoVeiculo,
    preco,
    distanciaKm,
    duracaoMin,
    formaPagamento: formaPagamento || 'dinheiro',
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

module.exports = { validarDadosCorrida, criarEDespachar, FORMAS_PAGAMENTO_VALIDAS };