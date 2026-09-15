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

// Tela de "Pendências" (configurações do passageiro): ver o que está
// devendo de corridas anteriores não pagas e quitar tudo na hora via Pix,
// sem precisar esperar a próxima corrida embutir o valor.
roteador.get('/dividas', pagamentoControlador.listarDividas);
roteador.post('/pix-divida', pagamentoControlador.criarPixDivida);

module.exports = roteador;