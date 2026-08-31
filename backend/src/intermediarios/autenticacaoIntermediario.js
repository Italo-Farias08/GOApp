const { verificarToken } = require('../utilitarios/token');

// Protege rotas que exigem usuário logado.
// Espera o header: Authorization: Bearer <token>
function autenticacaoIntermediario(req, res, next) {
  const cabecalho = req.headers.authorization;

  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token de acesso não informado.' });
  }

  const token = cabecalho.split(' ')[1];

  try {
    const payload = verificarToken(token);
    req.usuarioId = payload.sub;
    next();
  } catch (erro) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}

module.exports = autenticacaoIntermediario;
