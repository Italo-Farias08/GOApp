const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const autenticacaoRotas = require('./rotas/autenticacaoRotas');
const motoristaRotas = require('./rotas/motoristaRotas');
const corridaRotas = require('./rotas/corridaRotas');
const pagamentoRotas = require('./rotas/pagamentoRotas');
const enderecoRotas = require('./rotas/enderecoRotas');
const rotaRotas = require('./rotas/rotaRotas');
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

// TEMPORÁRIO — só pra debugar o erro do Pix. Remove depois.
app.get('/teste-pix', async (req, res) => {
  const mercadoPago = require('./utilitarios/mercadoPago');
  try {
    const resultado = await mercadoPago.criarPagamentoPix({
      valor: 10.5,
      descricao: 'Teste manual Pix',
      emailPagador: 'TESTUSER994276180976866424',
      referenciaExterna: 'teste-manual',
      idempotencyKey: require('crypto').randomUUID(),
      cpfPagador: '19119119100',
    });
    res.json({ ok: true, resultado });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: erro.message, statusCode: erro.statusCode });
  }
});

app.use('/auth', autenticacaoRotas);
app.use('/driver', motoristaRotas);
app.use('/rides', corridaRotas);
app.use('/payments', pagamentoRotas);
app.use('/addresses', enderecoRotas);
app.use('/routing', rotaRotas);

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Tratador de erros (sempre por último)
app.use(tratadorErros);

module.exports = app;