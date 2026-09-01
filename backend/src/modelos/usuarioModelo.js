const { consultar } = require('../configuracao/banco');

// Converte a linha do banco (snake_case) pro formato que o front espera (camelCase)
function paraUsuarioPublico(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.nome,
    email: linha.email || undefined,
    phone: linha.telefone || undefined,
    avatarUrl: linha.avatar_url || undefined,
    driverStatus: linha.status_motorista,
    emailVerificado: linha.email_verificado,
  };
}

async function buscarPorEmail(email) {
  const resultado = await consultar('SELECT * FROM usuarios WHERE email = $1', [email]);
  return resultado.rows[0] || null;
}

async function buscarPorTelefone(telefone) {
  const resultado = await consultar('SELECT * FROM usuarios WHERE telefone = $1', [telefone]);
  return resultado.rows[0] || null;
}

async function buscarPorId(id) {
  const resultado = await consultar('SELECT * FROM usuarios WHERE id = $1', [id]);
  return resultado.rows[0] || null;
}

async function criar({ nome, email, senhaHash, telefone }) {
  const resultado = await consultar(
    `INSERT INTO usuarios (nome, email, senha_hash, telefone)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nome, email || null, senhaHash || null, telefone || null]
  );
  return resultado.rows[0];
}

async function atualizar(id, { nome, email, telefone }) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       nome = COALESCE($2, nome),
       email = COALESCE($3, email),
       telefone = COALESCE($4, telefone),
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, nome || null, email || null, telefone || null]
  );
  return resultado.rows[0];
}

async function definirCodigoVerificacao(id, { codigo, expiraEm }) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       codigo_verificacao = $2,
       codigo_verificacao_expira = $3,
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, codigo, expiraEm]
  );
  return resultado.rows[0];
}

async function marcarEmailVerificado(id) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       email_verificado = TRUE,
       codigo_verificacao = NULL,
       codigo_verificacao_expira = NULL,
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return resultado.rows[0];
}

async function atualizarStatusMotorista(id, status) {
  const resultado = await consultar(
    `UPDATE usuarios SET status_motorista = $2, atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return resultado.rows[0];
}

module.exports = {
  paraUsuarioPublico,
  buscarPorEmail,
  buscarPorTelefone,
  buscarPorId,
  criar,
  atualizar,
  definirCodigoVerificacao,
  marcarEmailVerificado,
  atualizarStatusMotorista,
};