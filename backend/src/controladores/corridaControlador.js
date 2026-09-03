const corridaModelo = require('../modelos/corridaModelo');
const usuarioModelo = require('../modelos/usuarioModelo');
const motoristaModelo = require('../modelos/motoristaModelo');
const { ErroHttp } = require('../intermediarios/tratadorErros');
const soquete = require('../tempoReal/servidorSoquete');

const TIPOS_VALIDOS = ['carro', 'moto'];

// POST /rides
async function criar(req, res, next) {
  try {
    const { origem, destino, tipoVeiculo, preco, distanciaKm, duracaoMin } = req.body;

    if (!origem?.latitude || !origem?.longitude || !destino?.latitude || !destino?.longitude) {
      throw new ErroHttp(400, 'Origem e destino são obrigatórios.');
    }
    if (!TIPOS_VALIDOS.includes(tipoVeiculo)) {
      throw new ErroHttp(400, 'Tipo de veículo inválido.');
    }
    if (!preco || !distanciaKm || !duracaoMin) {
      throw new ErroHttp(400, 'Preço, distância e duração são obrigatórios.');
    }

    const corridaExistente = await corridaModelo.buscarAtivaPorPassageiro(req.usuarioId);
    if (corridaExistente) {
      throw new ErroHttp(409, 'Você já tem uma corrida em andamento.');
    }

    const corrida = await corridaModelo.criar({
      passageiroId: req.usuarioId,
      origem,
      destino,
      tipoVeiculo,
      preco,
      distanciaKm,
      duracaoMin,
    });

    const corridaPublica = corridaModelo.paraCorridaPublica(corrida);
    soquete.notificarNovaCorrida(corridaPublica, origem);

    return res.status(201).json(corridaPublica);
  } catch (erro) {
    next(erro);
  }
}

// GET /rides/:id
async function detalhar(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');
    return res.json(corridaModelo.paraCorridaPublica(corrida));
  } catch (erro) {
    next(erro);
  }
}

// POST /rides/:id/accept
async function aceitar(req, res, next) {
  try {
    const motorista = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!motorista || motorista.status_motorista !== 'approved') {
      throw new ErroHttp(403, 'Só motoristas aprovados podem aceitar corridas.');
    }

    const corridaAceita = await corridaModelo.aceitar(req.params.id, req.usuarioId);
    if (!corridaAceita) {
      throw new ErroHttp(409, 'Essa corrida já foi aceita por outro motorista.');
    }

    const solicitacao = await motoristaModelo.buscarUltimaSolicitacaoPorUsuario(req.usuarioId);

    const dadosMotorista = {
      id: motorista.id,
      nome: motorista.nome,
      telefone: motorista.telefone || undefined,
      veiculoModelo: solicitacao?.veiculo_modelo,
      veiculoCor: solicitacao?.veiculo_cor,
      veiculoPlaca: solicitacao?.veiculo_placa,
    };

    soquete.marcarMotoristaOcupado(req.usuarioId);
    soquete.notificarCorridaAceita({
      corridaId: corridaAceita.id,
      passageiroId: corridaAceita.passageiro_id,
      motoristaId: req.usuarioId,
      motorista: dadosMotorista,
    });

    return res.json({
      corrida: corridaModelo.paraCorridaPublica(corridaAceita),
      motorista: dadosMotorista,
    });
  } catch (erro) {
    next(erro);
  }
}

// POST /rides/:id/cancel
//
// Regras de cancelamento:
// - Só o passageiro dono da corrida ou o motorista atribuído a ela podem
//   cancelar; qualquer outra pessoa recebe 403.
// - PASSAGEIRO: pode cancelar enquanto a corrida está "procurando" ou
//   "aceita" (motorista a caminho). Cancelar sempre encerra a corrida de
//   vez.
// - MOTORISTA: só pode cancelar uma corrida já "aceita" por ele (não dá pra
//   cancelar uma corrida que nem é sua). Cancelar NÃO mata o pedido do
//   passageiro na hora — a corrida volta pro radar de outros motoristas
//   (sem oferecer de novo pra quem já cancelou). Só depois de alguns
//   motoristas diferentes desistirem é que ela é cancelada de vez.
async function cancelar(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');

    const ehPassageiro = corrida.passageiro_id === req.usuarioId;
    const ehMotorista = !!corrida.motorista_id && corrida.motorista_id === req.usuarioId;
    if (!ehPassageiro && !ehMotorista) {
      throw new ErroHttp(403, 'Você não pode cancelar essa corrida.');
    }

    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim().slice(0, 255) : null;

    if (ehPassageiro) {
      if (!['procurando', 'aceita'].includes(corrida.status)) {
        throw new ErroHttp(409, 'Essa corrida não pode mais ser cancelada.');
      }

      const corridaCancelada = await corridaModelo.cancelarPeloPassageiro(req.params.id, motivo);
      if (!corridaCancelada) {
        throw new ErroHttp(409, 'Essa corrida não pode mais ser cancelada.');
      }

      soquete.notificarCorridaCancelada({
        corridaId: corridaCancelada.id,
        passageiroId: corridaCancelada.passageiro_id,
        motoristaId: corridaCancelada.motorista_id,
        canceladoPor: 'passageiro',
        motivo,
      });

      return res.json(corridaModelo.paraCorridaPublica(corridaCancelada));
    }

    // A partir daqui, é o motorista cancelando.
    if (corrida.status !== 'aceita') {
      throw new ErroHttp(409, 'Você só pode cancelar uma corrida que já aceitou.');
    }

    const resultado = await corridaModelo.cancelarPeloMotorista(req.params.id, req.usuarioId, motivo);
    if (!resultado) {
      throw new ErroHttp(409, 'Essa corrida não pode mais ser cancelada.');
    }

    // Libera o motorista pra voltar a receber corridas (ele precisa marcar
    // "ficar online" de novo no app pra aparecer no radar).
    soquete.marcarMotoristaOcupado(req.usuarioId);

    if (resultado.status === 'procurando') {
      soquete.notificarMotoristaCancelouReoferta({
        corridaId: resultado.id,
        passageiroId: resultado.passageiro_id,
      });
      soquete.notificarNovaCorrida(
        corridaModelo.paraCorridaPublica(resultado),
        {
          latitude: Number(resultado.origem_latitude),
          longitude: Number(resultado.origem_longitude),
        },
        resultado.motoristas_ignorados || []
      );
    } else {
      soquete.notificarCorridaCancelada({
        corridaId: resultado.id,
        passageiroId: resultado.passageiro_id,
        motoristaId: null,
        canceladoPor: 'sistema',
        motivo: resultado.motivo_cancelamento,
      });
    }

    return res.json(corridaModelo.paraCorridaPublica(resultado));
  } catch (erro) {
    next(erro);
  }
}

// POST /rides/:id/finish
async function finalizar(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');
    if (corrida.motorista_id !== req.usuarioId) {
      throw new ErroHttp(403, 'Só o motorista da corrida pode finalizá-la.');
    }

    const corridaFinalizada = await corridaModelo.finalizar(req.params.id);
    if (!corridaFinalizada) {
      throw new ErroHttp(409, 'Essa corrida não pode ser finalizada agora.');
    }

    soquete.notificarCorridaFinalizada({
      corridaId: corridaFinalizada.id,
      passageiroId: corridaFinalizada.passageiro_id,
    });

    return res.json(corridaModelo.paraCorridaPublica(corridaFinalizada));
  } catch (erro) {
    next(erro);
  }
}

module.exports = { criar, detalhar, aceitar, cancelar, finalizar };