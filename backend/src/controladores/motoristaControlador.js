const usuarioModelo = require('../modelos/usuarioModelo');
const motoristaModelo = require('../modelos/motoristaModelo');
const { ErroHttp } = require('../intermediarios/tratadorErros');
const soquete = require('../tempoReal/servidorSoquete');

// POST /driver/apply
async function solicitarCadastro(req, res, next) {
  try {
    const {
      cnhNumber,
      cnhCategory,
      vehiclePlate,
      vehicleModel,
      vehicleColor,
      vehicleYear,
    } = req.body;

    if (!cnhNumber || !vehiclePlate) {
      throw new ErroHttp(400, 'Preencha ao menos a CNH e a placa do veículo.');
    }
    if (!cnhCategory || !vehicleModel || !vehicleColor || !vehicleYear) {
      throw new ErroHttp(400, 'Preencha todos os dados do veículo e da CNH.');
    }

    await motoristaModelo.criarSolicitacao({
      usuarioId: req.usuarioId,
      cnhNumero: cnhNumber,
      cnhCategoria: cnhCategory,
      veiculoPlaca: vehiclePlate,
      veiculoModelo: vehicleModel,
      veiculoCor: vehicleColor,
      veiculoAno: vehicleYear,
    });

    await usuarioModelo.atualizarStatusMotorista(req.usuarioId, 'pending');

    return res.status(201).json({ status: 'pending' });
  } catch (erro) {
    next(erro);
  }
}

// GET /driver/status
async function consultarStatus(req, res, next) {
  try {
    const usuario = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!usuario) {
      throw new ErroHttp(404, 'Usuário não encontrado.');
    }
    return res.json({ status: usuario.status_motorista });
  } catch (erro) {
    next(erro);
  }
}

// GET /driver/pending (admin)
async function listarPendentes(req, res, next) {
  try {
    const pendentes = await motoristaModelo.listarPendentes();
    return res.json(pendentes);
  } catch (erro) {
    next(erro);
  }
}

// POST /driver/:usuarioId/approve (admin) — body: { aprovado: boolean }
async function aprovar(req, res, next) {
  try {
    const { usuarioId } = req.params;
    const { aprovado } = req.body;
    const novoStatus = aprovado ? 'approved' : 'rejected';

    const usuarioAtualizado = await usuarioModelo.atualizarStatusMotorista(usuarioId, novoStatus);
    if (!usuarioAtualizado) {
      throw new ErroHttp(404, 'Usuário não encontrado.');
    }
    await motoristaModelo.atualizarStatusPorUsuario(usuarioId, novoStatus);

    if (novoStatus === 'approved') {
      soquete.notificarMotoristaAprovado(usuarioId);
    }

    return res.json({ status: novoStatus });
  } catch (erro) {
    next(erro);
  }
}

module.exports = { solicitarCadastro, consultarStatus, listarPendentes, aprovar };
