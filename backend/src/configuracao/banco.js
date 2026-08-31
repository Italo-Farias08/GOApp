const { Pool } = require('pg');

// Pool de conexões com o PostgreSQL, usando a URL definida no .env
const pool = new Pool({
  connectionString: process.env.URL_BANCO_DE_DADOS,
});

pool.on('error', (erro) => {
  console.error('Erro inesperado no pool do PostgreSQL:', erro);
});

// Função auxiliar pra rodar queries sem precisar pegar/soltar client toda hora
async function consultar(texto, parametros) {
  return pool.query(texto, parametros);
}

module.exports = { pool, consultar };
