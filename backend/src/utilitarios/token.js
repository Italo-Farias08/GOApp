const jwt = require('jsonwebtoken');

const SEGREDO = process.env.JWT_SEGREDO;
const EXPIRA_EM = process.env.JWT_EXPIRA_EM || '7d';

// Gera o token de acesso a partir do id do usuário
function gerarToken(usuarioId) {
  return jwt.sign({ sub: usuarioId }, SEGREDO, { expiresIn: EXPIRA_EM });
}

// Verifica o token e retorna o payload decodificado (ou lança erro se inválido/expirado)
function verificarToken(token) {
  return jwt.verify(token, SEGREDO);
}

module.exports = { gerarToken, verificarToken };
