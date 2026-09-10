const express = require('express');
const saqueControlador = require('../controladores/saqueControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');

const roteador = express.Router();

// Rotas da página de admin — SEM senha/login, de propósito (pedido seu).
// Ficam ANTES do middleware de autenticação, que é só pro motorista.
roteador.get('/admin/pendentes', saqueControlador.listarPendentesAdmin);
roteador.post('/admin/:id/pago', saqueControlador.marcarComoPago);

roteador.use(autenticacaoIntermediario);

roteador.post('/sacar', saqueControlador.solicitar);

module.exports = roteador;