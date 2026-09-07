const { consultar } = require('../configuracao/banco');

// Converte a linha do banco pro formato que o app espera.
function paraPagamentoPublico(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    status: linha.status, // 'pendente' | 'aprovado' | 'recusado' | 'expirado'
    valor: Number(linha.valor),
    qrCode: linha.qr_code, // código "copia e cola"
    qrCodeBase64: linha.qr_code_base64, // imagem do QR code em base64 (PNG)
    corridaId: linha.corrida_id || undefined, // só vem preenchido depois de aprovado
    expiraEm: linha.expira_em,
  };
}

// Cria o registro local da cobrança Pix — guarda os dados da corrida ainda
// NÃO criada em `dados_corrida`, porque a corrida só nasce de fato depois
// que o pagamento é aprovado.
async function criar({ passageiroId, mercadoPagoId, valor, qrCode, qrCodeBase64, dadosCorrida, expiraEm }) {
  const resultado = await consultar(
    `INSERT INTO pagamentos_pix
       (passageiro_id, mercado_pago_id, valor, qr_code, qr_code_base64, dados_corrida, expira_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [passageiroId, mercadoPagoId, valor, qrCode, qrCodeBase64, JSON.stringify(dadosCorrida), expiraEm]
  );
  return resultado.rows[0];
}

async function buscarPorId(id) {
  const resultado = await consultar('SELECT * FROM pagamentos_pix WHERE id = $1', [id]);
  return resultado.rows[0] || null;
}

async function buscarPorMercadoPagoId(mercadoPagoId) {
  const resultado = await consultar('SELECT * FROM pagamentos_pix WHERE mercado_pago_id = $1', [mercadoPagoId]);
  return resultado.rows[0] || null;
}

async function atualizarStatus(id, status) {
  const resultado = await consultar(
    `UPDATE pagamentos_pix SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return resultado.rows[0] || null;
}

// Só grava se ainda não tiver corrida vinculada — evita criar duas
// corridas se o webhook e o polling do app confirmarem o pagamento quase
// ao mesmo tempo.
async function vincularCorrida(id, corridaId) {
  const resultado = await consultar(
    `UPDATE pagamentos_pix SET corrida_id = $2 WHERE id = $1 AND corrida_id IS NULL RETURNING *`,
    [id, corridaId]
  );
  return resultado.rows[0] || buscarPorId(id);
}

module.exports = {
  paraPagamentoPublico,
  criar,
  buscarPorId,
  buscarPorMercadoPagoId,
  atualizarStatus,
  vincularCorrida,
};