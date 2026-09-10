const usuarioModelo = require('../modelos/usuarioModelo');
const corridaModelo = require('../modelos/corridaModelo');

const VALOR_COMISSAO_POR_CORRIDA = 1;
const LIMITE_COMISSAO_DIARIA = 10;

// O Asaas cobra a taxa dele assim que a cobrança Pix é paga — descontada
// direto da conta da plataforma, ANTES de qualquer lógica nossa rodar.
// Hoje são duas linhas separadas no extrato do Asaas ("Taxa do Pix" +
// "Taxa de mensageria", R$0,99 cada = R$1,98). Sem descontar isso aqui, o
// saldo_a_receber do motorista fica prometendo mais dinheiro do que
// realmente sobrou na conta depois que o Asaas tira a taxa dele.
//
// Esses valores são os praticados na sua conta hoje — confira em
// Asaas > Menu do usuário > Taxas se o seu contrato mudar, e atualize aqui.
const TAXA_ASAAS_PIX = 0.99;
const TAXA_ASAAS_MENSAGERIA = 0.99;
const TAXA_ASAAS_RECEBIMENTO_PIX = TAXA_ASAAS_PIX + TAXA_ASAAS_MENSAGERIA;

async function aplicarComissao({ motoristaId, valorCorrida, foiPagoEmDinheiro }) {
  if (!motoristaId) return null; 

  const corridasPagasHoje = await corridaModelo.contarCorridasPagasHoje(motoristaId);

  const comissaoJaCobradaHoje = Math.min(
    Math.max(corridasPagasHoje - 1, 0) * VALOR_COMISSAO_POR_CORRIDA,
    LIMITE_COMISSAO_DIARIA
  );
  const comissao =
    comissaoJaCobradaHoje >= LIMITE_COMISSAO_DIARIA ? 0 : VALOR_COMISSAO_POR_CORRIDA;

  // Corrida em dinheiro nunca passa pelo Asaas — só a comissão da
  // plataforma vira dívida. Corrida por Pix passou pelo Asaas pra chegar
  // até aqui, então a taxa dele já foi embora antes da gente nem saber:
  // desconta comissão E taxa do Asaas do valor creditado ao motorista.
  const delta = foiPagoEmDinheiro
    ? -comissao
    : Number((Number(valorCorrida) - comissao - TAXA_ASAAS_RECEBIMENTO_PIX).toFixed(2));

  if (delta !== 0) {
    await usuarioModelo.ajustarSaldoAReceber(motoristaId, delta);
  }

  return { comissao, taxaAsaas: foiPagoEmDinheiro ? 0 : TAXA_ASAAS_RECEBIMENTO_PIX, delta };
}

module.exports = {
  aplicarComissao,
  VALOR_COMISSAO_POR_CORRIDA,
  LIMITE_COMISSAO_DIARIA,
  TAXA_ASAAS_RECEBIMENTO_PIX,
};