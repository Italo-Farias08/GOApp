async function criarPagamentoPix({ valor, descricao, emailPagador, referenciaExterna, idempotencyKey, cpfPagador }) {
  const payer = { email: emailPagador };
  if (cpfPagador) {
    payer.identification = { type: 'CPF', number: String(cpfPagador).replace(/\D/g, '') };
  }

  const resposta = await fetch(`${BASE_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${obterAccessToken()}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: Number(Number(valor).toFixed(2)),
      description: descricao,
      payment_method_id: 'pix',
      payer,
      external_reference: referenciaExterna,
    }),
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    console.error('[mercadoPago] resposta de erro completa:', JSON.stringify(dados));
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