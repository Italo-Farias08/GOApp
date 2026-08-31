require('dotenv').config();

const app = require('./app');

const porta = process.env.PORTA || process.env.PORT || 3000;

app.listen(porta, () => {
  console.log(`Servidor do #GO rodando na porta ${porta}`);
});