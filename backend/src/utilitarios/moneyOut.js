// Integração com o Money Out do Mercado Pago — manda dinheiro DA conta da
// plataforma PRA uma chave Pix de terceiro (o motorista). É um produto
// diferente do Checkout API que já usamos pra receber Pix dos passageiros.
//
// Documentação usada como referência:
// https://www.mercadopago.com.br/developers/en/docs/payouts/integration-configuration/money-transfers

const BASE_URL = 'https://api.mercadopago.com';

function obterAccessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado no .env do backend.');
  }
  return token;
}

// Transfere `valor` da conta da plataforma pra chave Pix informada.
//
// IMPORTANTE: em produção, o Mercado Pago exige o header X-signature (corpo
// assinado com chave pública/privada do integrador) — ver seção "Segurança"
// da documentação de Payouts. Enquanto isso não estiver configurado, essa
// chamada só funciona em ambiente de TESTE (X-test-token: true).
async function transferirPix({
  valor,
  chavePixTipo,
  chavePixValor,
  cpfTitular,
  idempotencyKey,
  ehTeste = false,
}) {
  const corpo = {
    external_reference: idempotencyKey.slice(0, 60),
    point_of_interaction: '{"type":"PSP_TRANSFER"}',
    transaction: {
      from: { accounts: [{ amount: valor }] },
      to: {
        accounts: [
          {
            type: 'current',
            amount: valor,
            chave: { type: chavePixTipo, value: chavePixValor },
            owner: { identification: { type: 'CPF', number: cpfTitular } },
          },
        ],
      },
      total_amount: valor,
    },
  };

  const cabecalhos = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${obterAccessToken()}`,
    'X-Idempotency-Key': idempotencyKey,
    'X-enforce-signature': 'false',
  };

  if (ehTeste) {
    cabecalhos['X-test-token'] = 'true';
  }

  const resposta = await fetch(`${BASE_URL}/v1/transaction-intents/process`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify(corpo),
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    console.error('[moneyOut] resposta de erro completa:', JSON.stringify(dados));
    const mensagem = dados?.message || 'Falha ao transferir o Pix pro motorista.';
    const erro = new Error(mensagem);
    erro.statusCode = 502;
    throw erro;
  }

  return dados;
}

module.exports = { transferirPix };