const express = require('express');
const saqueControlador = require('../controladores/saqueControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

roteador.use(autenticacaoIntermediario);

roteador.post('/sacar', saqueControlador.solicitar);

module.exports = roteador;