const express = require('express');
const corridaControlador = require('../controladores/corridaControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

roteador.use(autenticacaoIntermediario);

roteador.post('/', corridaControlador.criar);
roteador.get('/', corridaControlador.buscarAtiva);
roteador.get('/:id', corridaControlador.detalhar);
roteador.post('/:id/accept', corridaControlador.aceitar);
roteador.post('/:id/pickup', corridaControlador.embarcar);
roteador.post('/:id/cancel', corridaControlador.cancelar);
roteador.post('/:id/finish', corridaControlador.finalizar);
roteador.get('/:id/messages', corridaControlador.listarMensagens);

module.exports = roteador;