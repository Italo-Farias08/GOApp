// Integração com a API REST do Asaas (v3) — substitui o Mercado Pago tanto
// pra cobrar o passageiro (Pix) quanto pra pagar o motoboy (transferência).
//
// Documentação usada como referência:
// https://docs.asaas.com/docs/autenticacao
// https://docs.asaas.com/docs/cobrancas-via-pix
// https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix
// https://docs.asaas.com/docs/sobre-os-webhooks

const BASE_URL = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';

function obterApiKey() {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) {
    throw new Error(
      'ASAAS_API_KEY não configurada no .env do backend. Pegue a chave em ' +
        'Asaas > Menu do usuário > Integrações > Chaves de API.'
    );
  }
  return chave;
}

// Todas as chamadas usam esse header — diferente do Mercado Pago, o Asaas
// NÃO usa "Authorization: Bearer", usa um header próprio chamado access_token.
function cabecalhosPadrao() {
  return {
    'Content-Type': 'application/json',
    access_token: obterApiKey(),
  };
}

async function chamarAsaas(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhosPadrao(), ...(opcoes.headers || {}) },
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    console.error(`[asaas] resposta de erro em ${caminho}:`, JSON.stringify(dados));
    const mensagem =
      dados?.errors?.[0]?.description || dados?.message || 'Falha ao chamar a API do Asaas.';
    const erro = new Error(mensagem);
    erro.statusCode = 502;
    throw erro;
  }

  return dados;
}

// O Asaas cobra em nome de um "cliente" cadastrado — diferente do Mercado
// Pago, que aceitava os dados do pagador direto na cobrança. Criamos um
// cliente novo a cada cobrança (simples e funcional); se o volume crescer,
// dá pra guardar o ID do cliente Asaas no usuário pra reaproveitar.
async function criarCliente({ nome, email, cpfCnpj, referenciaExterna }) {
  const corpo = {
    name: nome || email,
    email,
    externalReference: referenciaExterna,
  };
  if (cpfCnpj) {
    corpo.cpfCnpj = String(cpfCnpj).replace(/\D/g, '');
  }
  return chamarAsaas('/customers', { method: 'POST', body: JSON.stringify(corpo) });
}

function dataDeHoje() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Cria uma cobrança Pix e já devolve o QR code pronto pra pagar — mantém a
// mesma "forma" de resposta que o resto do backend já espera
// ({ id, qrCode, qrCodeBase64 }), pra não precisar mexer em mais nada além
// de quem chama essa função.
async function criarPagamentoPix({
  valor,
  descricao,
  nomePagador,
  emailPagador,
  cpfPagador,
  referenciaExterna,
}) {
  const cliente = await criarCliente({
    nome: nomePagador,
    email: emailPagador,
    cpfCnpj: cpfPagador,
    referenciaExterna,
  });

  const cobranca = await chamarAsaas('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: cliente.id,
      billingType: 'PIX',
      value: Number(Number(valor).toFixed(2)),
      dueDate: dataDeHoje(),
      description: descricao,
      externalReference: referenciaExterna,
    }),
  });

  const qrCode = await chamarAsaas(`/payments/${cobranca.id}/pixQrCode`);

  return {
    id: cobranca.id,
    qrCode: qrCode.payload, // código "copia e cola"
    qrCodeBase64: qrCode.encodedImage, // imagem do QR code em base64 (PNG)
  };
}

// Consulta o status atual de uma cobrança — usado no polling (enquanto o
// app espera o Pix ser pago) e no webhook, pra confirmar o que a
// notificação está avisando (nunca confiamos só no corpo do webhook).
async function consultarPagamento(idPagamento) {
  return chamarAsaas(`/payments/${idPagamento}`);
}

// Manda dinheiro da conta Asaas pra uma chave Pix qualquer — usado pro
// saque do motoboy. Diferente do Mercado Pago Money Out, não precisa de
// assinatura ed25519 nem de aprovação prévia de chave pra funcionar.
async function transferirPix({ chavePix, tipoChavePix, valor, idempotencyKey }) {
  return chamarAsaas('/transfers', {
    method: 'POST',
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    body: JSON.stringify({
      value: Number(Number(valor).toFixed(2)),
      pixAddressKey: chavePix,
      pixAddressKeyType: tipoChavePix,
    }),
  });
}

module.exports = {
  criarPagamentoPix,
  consultarPagamento,
  transferirPix,
};