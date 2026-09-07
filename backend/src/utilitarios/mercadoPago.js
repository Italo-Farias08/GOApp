// Integração direta com a API REST do Mercado Pago (sem SDK) — só usa o
// `fetch` nativo do Node, então não precisa instalar nenhuma dependência
// nova no backend.
//
// Documentação usada como referência:
// https://www.mercadopago.com.br/developers/pt/docs/checkout-api/payment-methods/pix

const BASE_URL = 'https://api.mercadopago.com';

function obterAccessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'MERCADO_PAGO_ACCESS_TOKEN não configurado no .env do backend. ' +
        'Pegue o Access Token em https://www.mercadopago.com.br/developers/panel/app'
    );
  }
  return token;
}

// Cria uma cobrança Pix (um "payment" com payment_method_id "pix"). A
// resposta do Mercado Pago já vem com o QR code pronto dentro de
// `point_of_interaction.transaction_data` — não precisa gerar nada à parte.
async function criarPagamentoPix({ valor, descricao, emailPagador, referenciaExterna, idempotencyKey }) {
  const resposta = await fetch(`${BASE_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${obterAccessToken()}`,
      // Evita cobrar duas vezes se a requisição for repetida por causa de
      // timeout/retry — o Mercado Pago devolve o mesmo pagamento de antes
      // em vez de criar um novo.
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: Number(Number(valor).toFixed(2)),
      description: descricao,
      payment_method_id: 'pix',
      payer: { email: emailPagador },
      external_reference: referenciaExterna,
    }),
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    const mensagem =
      dados?.message ||
      dados?.cause?.[0]?.description ||
      'Falha ao criar a cobrança Pix no Mercado Pago.';
    const erro = new Error(mensagem);
    erro.statusCode = 502;
    throw erro;
  }

  return dados;
}

// Consulta o status atual de um pagamento pelo ID do Mercado Pago — usado
// tanto no polling (enquanto o app espera o QR code ser pago) quanto no
// webhook, pra confirmar o que a notificação está avisando.
async function consultarPagamento(mercadoPagoId) {
  const resposta = await fetch(`${BASE_URL}/v1/payments/${mercadoPagoId}`, {
    headers: { Authorization: `Bearer ${obterAccessToken()}` },
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    const mensagem = dados?.message || 'Falha ao consultar o pagamento no Mercado Pago.';
    const erro = new Error(mensagem);
    erro.statusCode = 502;
    throw erro;
  }

  return dados;
}

module.exports = { criarPagamentoPix, consultarPagamento };