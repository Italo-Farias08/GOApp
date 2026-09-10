const usuarioModelo = require('../modelos/usuarioModelo');
const corridaModelo = require('../modelos/corridaModelo');

const VALOR_COMISSAO_POR_CORRIDA = 1;
const LIMITE_COMISSAO_DIARIA = 10;
async function aplicarComissao({ motoristaId, valorCorrida, foiPagoEmDinheiro }) {
  if (!motoristaId) return null; 

  const corridasPagasHoje = await corridaModelo.contarCorridasPagasHoje(motoristaId);

  const comissaoJaCobradaHoje = Math.min(
    Math.max(corridasPagasHoje - 1, 0) * VALOR_COMISSAO_POR_CORRIDA,
    LIMITE_COMISSAO_DIARIA
  );
  const comissao =
    comissaoJaCobradaHoje >= LIMITE_COMISSAO_DIARIA ? 0 : VALOR_COMISSAO_POR_CORRIDA;

  const delta = foiPagoEmDinheiro ? -comissao : Number(valorCorrida) - comissao;

  if (delta !== 0) {
    await usuarioModelo.ajustarSaldoAReceber(motoristaId, delta);
  }

  return { comissao, delta };
}

module.exports = {
  aplicarComissao,
  VALOR_COMISSAO_POR_CORRIDA,
  LIMITE_COMISSAO_DIARIA,
};