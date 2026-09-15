const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SEGREDO = process.env.JWT_SEGREDO;
const EXPIRA_EM = process.env.JWT_EXPIRA_EM || '30m';

// Gera o token de acesso (curta duração) a partir do id do usuário
function gerarToken(usuarioId) {
  return jwt.sign({ sub: usuarioId }, SEGREDO, { expiresIn: EXPIRA_EM });
}

function verificarToken(token) {
  return jwt.verify(token, SEGREDO);
}

function gerarRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { gerarToken, verificarToken, gerarRefreshToken, hashToken };