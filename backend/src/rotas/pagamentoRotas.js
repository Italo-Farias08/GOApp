const express = require('express');
const pagamentoControlador = require('../controladores/pagamentoControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

// O Mercado Pago chama essa rota sem o token do usuário logado — por isso
// ela fica ANTES do middleware de autenticação, fora dele.
roteador.post('/webhook', pagamentoControlador.webhook);

roteador.use(autenticacaoIntermediario);

roteador.post('/pix', pagamentoControlador.criarPix);
roteador.get('/pix/:id', pagamentoControlador.status);

module.exports = roteador;