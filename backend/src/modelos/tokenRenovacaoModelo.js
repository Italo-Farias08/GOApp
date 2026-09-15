const { consultar } = require('../configuracao/banco');

// Salva o HASH do refresh token recém-gerado (o valor puro nunca chega aqui).
async function criar({ usuarioId, tokenHash, expiraEm }) {
  const resultado = await consultar(
    `INSERT INTO tokens_renovacao (usuario_id, token_hash, expira_em)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [usuarioId, tokenHash, expiraEm]
  );
  return resultado.rows[0];
}

// Busca um refresh token pelo hash, mas só considera "achado" se ele ainda
// não expirou e não foi revogado — um token expirado/revogado que existe na
// tabela deve se comportar exatamente como se não existisse.
async function buscarValidoPorHash(tokenHash) {
  const resultado = await consultar(
    `SELECT * FROM tokens_renovacao
     WHERE token_hash = $1 AND revogado_em IS NULL AND expira_em > NOW()`,
    [tokenHash]
  );
  return resultado.rows[0] || null;
}

// Revoga um único refresh token (usado na rotação: cada refresh emite um
// token novo e mata o antigo, então um token roubado só serve uma vez).
async function revogarPorHash(tokenHash) {
  await consultar(
    `UPDATE tokens_renovacao SET revogado_em = NOW()
     WHERE token_hash = $1 AND revogado_em IS NULL`,
    [tokenHash]
  );
}

// Revoga todos os refresh tokens de um usuário — pensado pra "sair de todos
// os dispositivos" ou pra invalidar sessões antigas numa troca de senha.
// Não é usado ainda em nenhuma rota, mas fica pronto pra quando precisar.
async function revogarTodosDoUsuario(usuarioId) {
  await consultar(
    `UPDATE tokens_renovacao SET revogado_em = NOW()
     WHERE usuario_id = $1 AND revogado_em IS NULL`,
    [usuarioId]
  );
}

module.exports = { criar, buscarValidoPorHash, revogarPorHash, revogarTodosDoUsuario };