const express = require('express');
const rotaControlador = require('../controladores/rotaControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

roteador.use(autenticacaoIntermediario);

// GET /routing/rota?origemLat=...&origemLng=...&destinoLat=...&destinoLng=...
roteador.get('/rota', rotaControlador.calcularRota);

module.exports = roteador;