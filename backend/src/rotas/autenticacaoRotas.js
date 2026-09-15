const express = require('express');
const autenticacaoControlador = require('../controladores/autenticacaoControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');
const { limitadorLogin, limitadorCodigoVerificacao, limitadorRefresh, limitadorRecuperacaoSenha } = require('../intermediarios/limitadorTaxa');

const roteador = express.Router();

// Rotas públicas
roteador.post('/register', autenticacaoControlador.registrar);
roteador.post('/verify-email', limitadorCodigoVerificacao, autenticacaoControlador.verificarEmail);
roteador.post('/resend-code', limitadorCodigoVerificacao, autenticacaoControlador.reenviarCodigo);
roteador.post('/change-pending-email', autenticacaoControlador.alterarEmailPendente);
roteador.post('/login', limitadorLogin, autenticacaoControlador.entrar);
roteador.post('/login-phone', limitadorLogin, autenticacaoControlador.entrarComTelefone);
roteador.post('/forgot-password', limitadorRecuperacaoSenha, autenticacaoControlador.esqueciSenha);
roteador.post('/reset-password', limitadorRecuperacaoSenha, autenticacaoControlador.redefinirSenha);
roteador.post('/google', limitadorLogin, autenticacaoControlador.entrarComGoogle);
// Renova a sessão usando o refresh token guardado no dispositivo — não
// exige o access token (ele já pode ter expirado, é exatamente pra isso
// que essa rota existe). O logout também não exige: a pessoa pode estar
// chamando isso com o access token já vencido.
roteador.post('/refresh', limitadorRefresh, autenticacaoControlador.renovarToken);
roteador.post('/logout', autenticacaoControlador.sair);

// Rotas protegidas (exigem token)
roteador.get('/me', autenticacaoIntermediario, autenticacaoControlador.obterPerfil);
roteador.put('/me', autenticacaoIntermediario, autenticacaoControlador.atualizarPerfil);
roteador.put('/push-token', autenticacaoIntermediario, autenticacaoControlador.atualizarPushToken);

module.exports = roteador;