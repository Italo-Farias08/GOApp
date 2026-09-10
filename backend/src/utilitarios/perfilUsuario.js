const { ErroHttp } = require('../intermediarios/tratadorErros');

function exigirPerfilCompleto(usuario) {
  const faltando = [];
  if (!usuario?.nome || !usuario.nome.trim()) faltando.push('name');
  if (!usuario?.email || !usuario.email.trim()) faltando.push('email');
  if (!usuario?.telefone || !usuario.telefone.trim()) faltando.push('phone');

  if (faltando.length > 0) {
    const erro = new ErroHttp(400, 'Complete seu cadastro (nome, email e telefone) antes de pedir uma corrida.');
    erro.perfilIncompleto = true;
    erro.camposFaltando = faltando;
    throw erro;
  }
}

module.exports = { exigirPerfilCompleto };