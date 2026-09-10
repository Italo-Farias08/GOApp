const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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

// O Railway coloca a aplicação atrás de um proxy reverso, que adiciona o
// header X-Forwarded-For com o IP real de quem fez a requisição. Sem essa
// linha, o Express (e por tabela o rate limit) não confia nesse header e
// não consegue saber o IP de verdade de cada requisição — 1 = confia em 1
// "salto" de proxy na frente (é o caso do Railway).
app.set('trust proxy', 1);

const origensPermitidas = (process.env.ORIGENS_PERMITIDAS || '*')
  .split(',')
  .map((origem) => origem.trim());

// Em produção, deixar CORS aberto (*) pra qualquer site chamar sua API é um
// risco real — qualquer página poderia bater nas suas rotas usando o token
// de quem estiver logado. Isso só é aceitável em desenvolvimento.
if (origensPermitidas.includes('*') && process.env.NODE_ENV === 'production') {
  console.warn(
    '[AVISO] ORIGENS_PERMITIDAS não configurado em produção — CORS está aberto pra ' +
    'qualquer origem. Configure essa variável no Railway com o domínio real do app.'
  );
}

app.use(helmet());
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