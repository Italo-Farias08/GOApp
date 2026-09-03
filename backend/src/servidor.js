require('dotenv').config();

const http = require('http');
const app = require('./app');
const { configurarSoquete } = require('./tempoReal/servidorSoquete');

const porta = process.env.PORTA || process.env.PORT || 3000;

const servidorHttp = http.createServer(app);
configurarSoquete(servidorHttp);

servidorHttp.listen(porta, () => {
  console.log(`Servidor do #GO rodando na porta ${porta}`);
});
