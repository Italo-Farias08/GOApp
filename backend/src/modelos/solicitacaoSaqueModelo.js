const { consultar } = require('../configuracao/banco');

// Converte a linha do banco pro formato que o app espera.
function paraSolicitacaoPublica(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    valor: Number(linha.valor),
    cpf: linha.cpf,
    status: linha.status, // 'pendente' | 'pago' | 'cancelado'
    criadoEm: linha.criado_em,
  };
}

// Registra o pedido de saque do motorista — NÃO transfere dinheiro nenhum,
// só guarda o pedido pra ser processado manualmente (por enquanto).
async function criar({ motoristaId, valor, cpf }) {
  const resultado = await consultar(
    `INSERT INTO solicitacoes_saque (motorista_id, valor, cpf)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [motoristaId, valor, cpf]
  );
  return resultado.rows[0];
}

// Lista os pedidos pendentes — usado pela página de admin, onde quem
// administra o #GO vê e marca como pago manualmente.
async function listarPendentes() {
  const resultado = await consultar(
    `SELECT s.*, u.nome AS motorista_nome, u.telefone AS motorista_telefone
       FROM solicitacoes_saque s
       JOIN usuarios u ON u.id = s.motorista_id
      WHERE s.status = 'pendente'
      ORDER BY s.criado_em ASC`
  );
  return resultado.rows;
}

// Marca um pedido como pago (ou cancelado) — chamado pela página de admin
// depois que a transferência de verdade já foi feita na mão.
async function atualizarStatus(id, status) {
  const resultado = await consultar(
    `UPDATE solicitacoes_saque SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return resultado.rows[0] || null;
}

// Formato usado na página de admin — inclui nome/telefone do motorista pra
// quem está processando o saque saber pra quem (e por onde) falar.
function paraSolicitacaoAdmin(linha) {
  if (!linha) return null;
  return {
    ...paraSolicitacaoPublica(linha),
    motoristaNome: linha.motorista_nome,
    motoristaTelefone: linha.motorista_telefone,
  };
}

module.exports = {
  criar,
  listarPendentes,
  atualizarStatus,
  paraSolicitacaoPublica,
  paraSolicitacaoAdmin,
};