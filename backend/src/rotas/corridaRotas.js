const express = require('express');
const corridaControlador = require('../controladores/corridaControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

roteador.use(autenticacaoIntermediario);

roteador.post('/', corridaControlador.criar);
roteador.get('/', corridaControlador.buscarAtiva);
// Precisa vir ANTES de '/:id' — senão o Express entende "history" como um
// valor de :id e essa rota nunca é alcançada.
roteador.get('/history', corridaControlador.listarHistorico);
roteador.get('/:id', corridaControlador.detalhar);
roteador.post('/:id/accept', corridaControlador.aceitar);
roteador.post('/:id/pickup', corridaControlador.embarcar);
roteador.post('/:id/cancel', corridaControlador.cancelar);
roteador.post('/:id/finish', corridaControlador.finalizar);
roteador.get('/:id/messages', corridaControlador.listarMensagens);
roteador.post('/:id/messages', corridaControlador.enviarMensagem);

module.exports = roteador;