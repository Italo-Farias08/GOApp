const usuarioModelo = require('../modelos/usuarioModelo');
const solicitacaoSaqueModelo = require('../modelos/solicitacaoSaqueModelo');
const { ErroHttp } = require('../intermediarios/tratadorErros');

// POST /payouts/sacar
//
// O motorista escolhe quanto quer sacar (até o saldo_a_receber dele) e
// informa o CPF de quem vai receber. Isso NÃO transfere dinheiro na hora —
// só registra o pedido e já desconta o valor do saldo, pra ele não pedir o
// mesmo saldo de novo enquanto o pedido ainda não foi pago. A transferência
// de verdade é feita manualmente por quem administra o #GO, olhando os
// pedidos pendentes (dá pra automatizar depois com uma API de pagamentos).
async function solicitar(req, res, next) {
  try {
    const { valor, cpf } = req.body;

    const valorNumero = Number(valor);
    if (!valorNumero || valorNumero <= 0) {
      throw new ErroHttp(400, 'Informe um valor de saque válido.');
    }

    const cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      throw new ErroHttp(400, 'Informe um CPF válido (11 dígitos).');
    }

    const usuario = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!usuario) throw new ErroHttp(404, 'Usuário não encontrado.');

    const saldo = Number(usuario.saldo_a_receber || 0);
    if (valorNumero > saldo) {
      throw new ErroHttp(400, 'O valor pedido é maior que o seu saldo disponível.');
    }

    // Desconta já na hora — evita que ele peça o mesmo saldo de novo
    // enquanto o pedido ainda não foi processado manualmente.
    await usuarioModelo.ajustarSaldoAReceber(req.usuarioId, -valorNumero);

    const solicitacao = await solicitacaoSaqueModelo.criar({
      motoristaId: req.usuarioId,
      valor: valorNumero,
      cpf: cpfLimpo,
    });

    return res.status(201).json(solicitacaoSaqueModelo.paraSolicitacaoPublica(solicitacao));
  } catch (erro) {
    next(erro);
  }
}

module.exports = { solicitar };