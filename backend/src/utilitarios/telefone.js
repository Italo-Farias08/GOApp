
function normalizarTelefone(valor) {
  const apenasDigitos = String(valor || '').replace(/\D/g, '');
  return apenasDigitos.slice(-11);
}

module.exports = { normalizarTelefone };