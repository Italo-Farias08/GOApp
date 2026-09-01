const MINUTOS_PARA_EXPIRAR = 15;

// Gera um código numérico de 6 dígitos (com zero à esquerda quando necessário)
function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Retorna a data de expiração do código (agora + 15 minutos)
function gerarExpiracao() {
  return new Date(Date.now() + MINUTOS_PARA_EXPIRAR * 60 * 1000);
}

module.exports = { gerarCodigo, gerarExpiracao, MINUTOS_PARA_EXPIRAR };