const express = require('express');
const autenticacaoControlador = require('../controladores/autenticacaoControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

// Rotas públicas
roteador.post('/register', autenticacaoControlador.registrar);
roteador.post('/verify-email', autenticacaoControlador.verificarEmail);
roteador.post('/resend-code', autenticacaoControlador.reenviarCodigo);
roteador.post('/login', autenticacaoControlador.entrar);
roteador.post('/login-phone', autenticacaoControlador.entrarComTelefone);

// Rotas protegidas (exigem token)
roteador.get('/me', autenticacaoIntermediario, autenticacaoControlador.obterPerfil);
roteador.put('/me', autenticacaoIntermediario, autenticacaoControlador.atualizarPerfil);

module.exports = roteador;