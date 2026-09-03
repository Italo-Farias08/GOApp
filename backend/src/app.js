const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const autenticacaoRotas = require('./rotas/autenticacaoRotas');
const motoristaRotas = require('./rotas/motoristaRotas');
const corridaRotas = require('./rotas/corridaRotas');
const { tratadorErros } = require('./intermediarios/tratadorErros');

const app = express();

const origensPermitidas = (process.env.ORIGENS_PERMITIDAS || '*')
  .split(',')
  .map((origem) => origem.trim());

app.use(cors({
  origin: origensPermitidas.includes('*') ? '*' : origensPermitidas,
}));
app.use(express.json());
app.use(morgan('dev'));

// Rota simples pra checar se o servidor está no ar
app.get('/saude', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', autenticacaoRotas);
app.use('/driver', motoristaRotas);
app.use('/rides', corridaRotas);

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Tratador de erros (sempre por último)
app.use(tratadorErros);

module.exports = app;
