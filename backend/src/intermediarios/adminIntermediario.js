// Protege rotas administrativas simples (aprovar motorista, etc.) com um
// segredo fixo, enquanto o app não tem um painel de admin de verdade.
// Manda o header: x-admin-secret: <SEGREDO_ADMIN do .env>
function adminIntermediario(req, res, next) {
  const segredoRecebido = req.headers['x-admin-secret'];
  const segredoEsperado = process.env.SEGREDO_ADMIN;

  if (!segredoEsperado) {
    return res.status(500).json({ message: 'SEGREDO_ADMIN não configurado no servidor.' });
  }
  if (segredoRecebido !== segredoEsperado) {
    return res.status(403).json({ message: 'Acesso administrativo negado.' });
  }
  next();
}

module.exports = adminIntermediario;
