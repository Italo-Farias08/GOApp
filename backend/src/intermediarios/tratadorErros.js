// Middleware final: captura qualquer erro não tratado nas rotas/controladores
// e devolve uma resposta JSON padronizada em vez de derrubar o servidor.
function tratadorErros(erro, req, res, next) {
  console.error(erro);

  const statusCode = erro.statusCode || 500;
  const mensagem = erro.statusCode
    ? erro.message
    : 'Erro interno no servidor.';

  const corpo = { message: mensagem };
  if (erro.needsVerification) {
    corpo.needsVerification = true;
    corpo.email = erro.email;
  }

  res.status(statusCode).json(corpo);
}

// Classe simples pra lançar erros com status HTTP definido
class ErroHttp extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { tratadorErros, ErroHttp };