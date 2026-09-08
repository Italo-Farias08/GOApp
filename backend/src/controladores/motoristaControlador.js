const usuarioModelo = require('../modelos/usuarioModelo');
const motoristaModelo = require('../modelos/motoristaModelo');
const corridaModelo = require('../modelos/corridaModelo');
const { ErroHttp } = require('../intermediarios/tratadorErros');
const soquete = require('../tempoReal/servidorSoquete');

const TIPOS_VEICULO_VALIDOS = ['carro', 'moto'];

// Converte a linha da tabela `motoristas` (snake_case) pro formato camelCase
// que o front já usa no formulário de cadastro.
function paraMotoristaPublico(linha) {
  if (!linha) return null;
  return {
    status: linha.status,
    cnhNumber: linha.cnh_numero,
    cnhCategory: linha.cnh_categoria,
    vehicleType: linha.veiculo_tipo,
    vehiclePlate: linha.veiculo_placa,
    vehicleModel: linha.veiculo_modelo,
    vehicleColor: linha.veiculo_cor,
    vehicleYear: linha.veiculo_ano,
  };
}

// POST /driver/apply
async function solicitarCadastro(req, res, next) {
  try {
    const {
      cnhNumber,
      cnhCategory,
      vehicleType,
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
    if (!TIPOS_VEICULO_VALIDOS.includes(vehicleType)) {
      throw new ErroHttp(400, 'Informe se o veículo é carro ou moto.');
    }

    await motoristaModelo.criarSolicitacao({
      usuarioId: req.usuarioId,
      cnhNumero: cnhNumber,
      cnhCategoria: cnhCategory,
      veiculoTipo: vehicleType,
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

// GET /driver/me — dados completos do cadastro de motorista do usuário logado
// (veículo + CNH), usados no painel "Motorista" pra editar as informações.
async function consultarMeuCadastro(req, res, next) {
  try {
    const solicitacao = await motoristaModelo.buscarUltimaSolicitacaoPorUsuario(req.usuarioId);
    if (!solicitacao) {
      throw new ErroHttp(404, 'Nenhum cadastro de motorista encontrado.');
    }
    return res.json(paraMotoristaPublico(solicitacao));
  } catch (erro) {
    next(erro);
  }
}

// PUT /driver/vehicle — motorista aprovado edita os dados do próprio veículo/CNH.
// Todos os campos são opcionais: só atualiza o que vier preenchido.
async function atualizarVeiculo(req, res, next) {
  try {
    const usuario = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!usuario || usuario.status_motorista !== 'approved') {
      throw new ErroHttp(403, 'Só motoristas aprovados podem editar os dados do veículo.');
    }

    const {
      cnhNumber,
      cnhCategory,
      vehicleType,
      vehiclePlate,
      vehicleModel,
      vehicleColor,
      vehicleYear,
    } = req.body;

    if (vehicleType && !TIPOS_VEICULO_VALIDOS.includes(vehicleType)) {
      throw new ErroHttp(400, 'Informe se o veículo é carro ou moto.');
    }

    const atualizado = await motoristaModelo.atualizarVeiculoPorUsuario(req.usuarioId, {
      cnhNumero: cnhNumber,
      cnhCategoria: cnhCategory,
      veiculoTipo: vehicleType,
      veiculoPlaca: vehiclePlate,
      veiculoModelo: vehicleModel,
      veiculoCor: vehicleColor,
      veiculoAno: vehicleYear,
    });

    if (!atualizado) {
      throw new ErroHttp(404, 'Nenhum cadastro de motorista encontrado.');
    }

    return res.json(paraMotoristaPublico(atualizado));
  } catch (erro) {
    next(erro);
  }
}

// GET /driver/today-summary
//
// Resumo do dia do motorista logado: quantas corridas ele já finalizou hoje
// e quanto ele lucrou nelas — alimenta o "Painel do Motoboy" nas
// configurações do app. Exclusivo pra motoristas aprovados com veículo do
// tipo moto (é isso que faz o app tratar o usuário como "motoboy" ou não).
async function resumoHoje(req, res, next) {
  try {
    const usuario = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!usuario || usuario.status_motorista !== 'approved') {
      throw new ErroHttp(403, 'Só motoristas aprovados têm painel do motoboy.');
    }

    const solicitacao = await motoristaModelo.buscarUltimaSolicitacaoPorUsuario(req.usuarioId);
    if (!solicitacao || solicitacao.veiculo_tipo !== 'moto') {
      throw new ErroHttp(403, 'Este painel é exclusivo para motoboys (veículo do tipo moto).');
    }

    const resumo = await corridaModelo.resumoHojePorMotorista(req.usuarioId);
    // Dinheiro que caiu pra ele de dívidas antigas quitadas (passageiros que
    // não pagaram em corridas dele, e depois pagaram numa corrida com outro
    // motorista) — creditado em dividaModelo.quitar, mostrado aqui separado
    // do que ele ganhou hoje pra não confundir os dois valores.
    return res.json({ ...resumo, saldoAReceber: Number(usuario.saldo_a_receber || 0) });
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

module.exports = {
  solicitarCadastro,
  consultarStatus,
  consultarMeuCadastro,
  atualizarVeiculo,
  resumoHoje,
  listarPendentes,
  aprovar,
};