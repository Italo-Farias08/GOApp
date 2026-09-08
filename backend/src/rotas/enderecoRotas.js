const express = require('express');
const enderecoControlador = require('../controladores/enderecoControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

roteador.use(autenticacaoIntermediario);

roteador.get('/autocomplete', enderecoControlador.autocomplete);
roteador.get('/details', enderecoControlador.detalhes);

module.exports = roteador;
