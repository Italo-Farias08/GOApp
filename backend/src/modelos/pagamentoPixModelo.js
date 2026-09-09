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
    corridaId: linha.corrida_id || undefined, // pré-pago: só vem depois de aprovado. pós-pago: vem desde a criação.
    // 'prepago'  -> gerado ANTES da corrida existir (tela do passageiro)
    // 'pos_pago' -> gerado pelo motorista ao FINALIZAR uma corrida já existente
    tipo: linha.tipo || 'prepago',
    expiraEm: linha.expira_em,
  };
}

// Cria o registro local da cobrança Pix PRÉ-paga — guarda os dados da
// corrida ainda NÃO criada em `dados_corrida`, porque a corrida só nasce de
// fato depois que o pagamento é aprovado.
//
// Nota: a coluna no banco ainda se chama `mercado_pago_id` (era o nome
// original, de quando só existia o Mercado Pago) mas agora guarda o ID do
// pagamento no Asaas — renomear a coluna precisaria de uma migração no
// banco, então só deixamos o nome mais genérico aqui no código.
async function criar({ passageiroId, idPagamentoPsp, valor, qrCode, qrCodeBase64, dadosCorrida, expiraEm }) {
  const resultado = await consultar(
    `INSERT INTO pagamentos_pix
       (passageiro_id, mercado_pago_id, valor, qr_code, qr_code_base64, dados_corrida, expira_em, tipo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'prepago')
     RETURNING *`,
    [passageiroId, idPagamentoPsp, valor, qrCode, qrCodeBase64, JSON.stringify(dadosCorrida), expiraEm]
  );
  return resultado.rows[0];
}

// Cria o registro local da cobrança Pix PÓS-corrida — o motorista gerou ao
// finalizar uma corrida que JÁ EXISTE, então `corrida_id` já vem preenchido
// desde a criação (diferente do pré-pago, que só vincula depois de aprovado).
async function criarPosPago({ passageiroId, corridaId, idPagamentoPsp, valor, qrCode, qrCodeBase64, expiraEm }) {
  const resultado = await consultar(
    `INSERT INTO pagamentos_pix
       (passageiro_id, mercado_pago_id, valor, qr_code, qr_code_base64, dados_corrida, expira_em, tipo, corrida_id)
     VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6, 'pos_pago', $7)
     RETURNING *`,
    [passageiroId, idPagamentoPsp, valor, qrCode, qrCodeBase64, expiraEm, corridaId]
  );
  return resultado.rows[0];
}

async function buscarPorId(id) {
  const resultado = await consultar('SELECT * FROM pagamentos_pix WHERE id = $1', [id]);
  return resultado.rows[0] || null;
}

async function buscarPorIdPagamentoPsp(idPagamentoPsp) {
  const resultado = await consultar('SELECT * FROM pagamentos_pix WHERE mercado_pago_id = $1', [idPagamentoPsp]);
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
  criarPosPago,
  buscarPorId,
  buscarPorIdPagamentoPsp,
  atualizarStatus,
  vincularCorrida,
};