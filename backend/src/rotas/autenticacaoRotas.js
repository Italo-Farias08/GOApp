const express = require('express');
const autenticacaoControlador = require('../controladores/autenticacaoControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');
const { limitadorLogin, limitadorCodigoVerificacao } = require('../intermediarios/limitadorTaxa');

const roteador = express.Router();

// Rotas públicas
roteador.post('/register', autenticacaoControlador.registrar);
roteador.post('/verify-email', limitadorCodigoVerificacao, autenticacaoControlador.verificarEmail);
roteador.post('/resend-code', limitadorCodigoVerificacao, autenticacaoControlador.reenviarCodigo);
roteador.post('/change-pending-email', autenticacaoControlador.alterarEmailPendente);
roteador.post('/login', limitadorLogin, autenticacaoControlador.entrar);
roteador.post('/login-phone', limitadorLogin, autenticacaoControlador.entrarComTelefone);
roteador.post('/google', limitadorLogin, autenticacaoControlador.entrarComGoogle);

// Rotas protegidas (exigem token)
roteador.get('/me', autenticacaoIntermediario, autenticacaoControlador.obterPerfil);
roteador.put('/me', autenticacaoIntermediario, autenticacaoControlador.atualizarPerfil);
roteador.put('/push-token', autenticacaoIntermediario, autenticacaoControlador.atualizarPushToken);

module.exports = roteador;