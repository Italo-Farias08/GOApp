const express = require('express');
const saqueControlador = require('../controladores/saqueControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

roteador.use(autenticacaoIntermediario);

roteador.put('/chave-pix', saqueControlador.atualizarChavePix);
roteador.post('/sacar', saqueControlador.sacar);

module.exports = roteador;