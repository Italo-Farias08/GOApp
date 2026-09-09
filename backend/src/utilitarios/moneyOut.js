

const crypto = require('crypto');

const BASE_URL = 'https://api.mercadopago.com';

function obterAccessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado no .env do backend.');
  }
  return token;
}

function assinarCorpo(corpoString) {
  const chavePrivadaPem = process.env.MERCADO_PAGO_SIGNATURE_PRIVATE_KEY;
  if (!chavePrivadaPem) {
    throw new Error(
      'MERCADO_PAGO_SIGNATURE_PRIVATE_KEY não configurada. Necessária pra assinar transferências em produção (ver documentação de Payouts do Mercado Pago).'
    );
  }

  const pem = chavePrivadaPem.includes('\\n')
    ? chavePrivadaPem.replace(/\\n/g, '\n')
    : chavePrivadaPem;

  const chavePrivada = crypto.createPrivateKey(pem)
  const assinatura = crypto.sign(null, Buffer.from(corpoString), chavePrivada);
  return assinatura.toString('base64');
}

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

  const corpoString = JSON.stringify(corpo);

  const cabecalhos = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${obterAccessToken()}`,
    'X-Idempotency-Key': idempotencyKey,
  };

  if (ehTeste) {
    cabecalhos['X-test-token'] = 'true';
    cabecalhos['X-enforce-signature'] = 'false';
  } else {

    cabecalhos['X-enforce-signature'] = 'true';
    cabecalhos['X-signature'] = assinarCorpo(corpoString);
  }

  const resposta = await fetch(`${BASE_URL}/v1/transaction-intents/process`, {
    method: 'POST',
    headers: cabecalhos,
    body: corpoString,
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