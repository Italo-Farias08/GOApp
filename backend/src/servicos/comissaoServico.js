const usuarioModelo = require('../modelos/usuarioModelo');

// Comissão da plataforma: R$0,50 fixos em TODA corrida paga, sem limite
// diário (antes era R$1 por corrida, com um teto de R$8/dia — depois disso
// o motorista ficava sem cobrança pro resto do dia).
const VALOR_COMISSAO_POR_CORRIDA = 0.5;

async function aplicarComissao({ motoristaId, valorCorrida, foiPagoEmDinheiro }) {
  if (!motoristaId) return null;

  const comissao = VALOR_COMISSAO_POR_CORRIDA;

  const delta = foiPagoEmDinheiro ? -comissao : Number(valorCorrida) - comissao;

  if (delta !== 0) {
    await usuarioModelo.ajustarSaldoAReceber(motoristaId, delta);
  }

  return { comissao, delta };
}

module.exports = {
  aplicarComissao,
  VALOR_COMISSAO_POR_CORRIDA,
};