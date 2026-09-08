const express = require('express');
const rotaControlador = require('../controladores/rotaControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

roteador.use(autenticacaoIntermediario);

roteador.get('/rota', rotaControlador.calcularRota);

module.exports = roteador;