const express = require('express');
const motoristaControlador = require('../controladores/motoristaControlador');
const autenticacaoIntermediario = require('../intermediarios/autenticacaoIntermediario');
const adminIntermediario = require('../intermediarios/adminIntermediario');
const { limitadorAdmin } = require('../intermediarios/limitadorTaxa');
const { upload } = require('../configuracao/armazenamento');

const roteador = express.Router();

roteador.post('/apply', autenticacaoIntermediario, motoristaControlador.solicitarCadastro);
roteador.get('/status', autenticacaoIntermediario, motoristaControlador.consultarStatus);
roteador.get('/me', autenticacaoIntermediario, motoristaControlador.consultarMeuCadastro);
roteador.put('/vehicle', autenticacaoIntermediario, motoristaControlador.atualizarVeiculo);
// autenticacaoIntermediario vem ANTES do multer de propósito: o nome do
// arquivo salvo usa req.usuarioId, que só existe depois do token ser validado.
roteador.post('/photo', autenticacaoIntermediario, upload.single('photo'), motoristaControlador.enviarFoto);
roteador.post('/location', autenticacaoIntermediario, motoristaControlador.atualizarLocalizacao);
roteador.get('/today-summary', autenticacaoIntermediario, motoristaControlador.resumoHoje);

// Rotas administrativas — aprovar/reprovar cadastro de motorista.
// Sem painel de admin ainda: chame com o header x-admin-secret.
roteador.get('/pending', limitadorAdmin, adminIntermediario, motoristaControlador.listarPendentes);
roteador.post('/:usuarioId/approve', limitadorAdmin, adminIntermediario, motoristaControlador.aprovar);

module.exports = roteador;