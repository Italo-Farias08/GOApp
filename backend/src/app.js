const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const autenticacaoRotas = require('./rotas/autenticacaoRotas');
const motoristaRotas = require('./rotas/motoristaRotas');
const corridaRotas = require('./rotas/corridaRotas');
const pagamentoRotas = require('./rotas/pagamentoRotas');
const enderecoRotas = require('./rotas/enderecoRotas');
const rotaRotas = require('./rotas/rotaRotas');
const saqueRotas = require('./rotas/saqueRotas');
const { tratadorErros } = require('./intermediarios/tratadorErros');
const { limitadorGeral } = require('./intermediarios/limitadorTaxa');

const app = express();

const origensPermitidas = (process.env.ORIGENS_PERMITIDAS || '*')
  .split(',')
  .map((origem) => origem.trim());

app.use(cors({
  origin: origensPermitidas.includes('*') ? '*' : origensPermitidas,
}));
app.use(express.json());
app.use(morgan('dev'));
// Rate limit geral em tudo — cada rota sensível (login, código de
// verificação, admin) ainda tem o próprio limite mais apertado por cima.
app.use(limitadorGeral);

// Rota simples pra checar se o servidor está no ar
app.get('/saude', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', autenticacaoRotas);
app.use('/driver', motoristaRotas);
app.use('/rides', corridaRotas);
app.use('/payments', pagamentoRotas);
app.use('/addresses', enderecoRotas);
app.use('/routing', rotaRotas);
app.use('/payouts', saqueRotas);

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Tratador de erros (sempre por último)
app.use(tratadorErros);

module.exports = app;