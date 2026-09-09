const crypto = require('crypto');
const usuarioModelo = require('../modelos/usuarioModelo');
const moneyOut = require('../utilitarios/moneyOut');
const { ErroHttp } = require('../intermediarios/tratadorErros');

const TIPOS_VALIDOS = ['EMAIL', 'PHONE', 'CPF', 'CNPJ', 'PIX_CODE'];

// PUT /payouts/chave-pix — motorista cadastra/atualiza a chave Pix dele
async function atualizarChavePix(req, res, next) {
  try {
    const { chavePix, chavePixTipo, cpf } = req.body;

    if (!chavePix || !chavePixTipo || !cpf) {
      throw new ErroHttp(400, 'chavePix, chavePixTipo e cpf são obrigatórios.');
    }
    if (!TIPOS_VALIDOS.includes(chavePixTipo)) {
      throw new ErroHttp(400, `chavePixTipo deve ser um de: ${TIPOS_VALIDOS.join(', ')}`);
    }

    const cpfLimpo = String(cpf).replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      throw new ErroHttp(400, 'cpf deve ter 11 dígitos.');
    }

    const usuario = await usuarioModelo.atualizarChavePix(req.usuarioId, {
      chavePix,
      chavePixTipo,
      cpf: cpfLimpo,
    });

    return res.json(usuarioModelo.paraUsuarioPublico(usuario));
  } catch (erro) {
    next(erro);
  }
}

// POST /payouts/sacar — transfere o saldo_a_receber do motorista pra chave Pix dele
async function sacar(req, res, next) {
  let usuario;
  let saldoAnterior = 0;

  try {
    usuario = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!usuario) throw new ErroHttp(404, 'Usuário não encontrado.');

    if (!usuario.chave_pix || !usuario.chave_pix_tipo || !usuario.cpf) {
      throw new ErroHttp(400, 'Cadastre sua chave Pix antes de sacar.');
    }

    const saldo = Number(usuario.saldo_a_receber || 0);
    if (saldo <= 0) {
      throw new ErroHttp(400, 'Você não tem saldo disponível pra sacar agora.');
    }

    // Zera o saldo ANTES de chamar o Mercado Pago — evita clique duplo
    // disparando duas transferências. Se a chamada falhar, devolvemos.
    const zerado = await usuarioModelo.zerarSaldoAReceber(req.usuarioId);
    saldoAnterior = Number(zerado.saldo_anterior || 0);

    if (saldoAnterior <= 0) {
      throw new ErroHttp(400, 'Você não tem saldo disponível pra sacar agora.');
    }

    const idempotencyKey = crypto.randomUUID();

    const resultado = await moneyOut.transferirPix({
      valor: saldoAnterior,
      chavePixTipo: usuario.chave_pix_tipo,
      chavePixValor: usuario.chave_pix,
      idempotencyKey,
    });

    return res.json({ ok: true, valorTransferido: saldoAnterior, resultado });
  } catch (erro) {
    // Se já tínhamos zerado o saldo e a chamada ao Mercado Pago falhou,
    // devolve o dinheiro pro motorista antes de propagar o erro.
    if (saldoAnterior > 0) {
      await usuarioModelo.devolverSaldoAReceber(req.usuarioId, saldoAnterior).catch(() => {});
    }
    next(erro);
  }
}

module.exports = { atualizarChavePix, sacar };