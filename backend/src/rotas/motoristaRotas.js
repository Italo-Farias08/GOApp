const express = require('express');
const motoristaControlador = require('../controladores/motoristaControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');
const adminIntermediario = require('../intermediarios/adminIntermediario');

const roteador = express.Router();

roteador.post('/apply', autenticacaoIntermediario, motoristaControlador.solicitarCadastro);
roteador.get('/status', autenticacaoIntermediario, motoristaControlador.consultarStatus);
roteador.get('/me', autenticacaoIntermediario, motoristaControlador.consultarMeuCadastro);
roteador.put('/vehicle', autenticacaoIntermediario, motoristaControlador.atualizarVeiculo);

// Rotas administrativas — aprovar/reprovar cadastro de motorista.
// Sem painel de admin ainda: chame com o header x-admin-secret.
roteador.get('/pending', adminIntermediario, motoristaControlador.listarPendentes);
roteador.post('/:usuarioId/approve', adminIntermediario, motoristaControlador.aprovar);

module.exports = roteador;