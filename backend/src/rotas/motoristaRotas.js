const express = require('express');
const motoristaControlador = require('../controladores/motoristaControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

// Todas as rotas de motorista exigem usuário logado
roteador.post('/apply', autenticacaoIntermediario, motoristaControlador.solicitarCadastro);
roteador.get('/status', autenticacaoIntermediario, motoristaControlador.consultarStatus);

module.exports = roteador;
