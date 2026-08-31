const { Pool } = require('pg');

const urlBanco = process.env.URL_BANCO_DE_DADOS;

// Railway (e a maioria dos provedores de Postgres na nuvem) exige conexão
// criptografada (SSL). Em localhost isso não é necessário.
const precisaSSL = urlBanco && !urlBanco.includes('localhost') && !urlBanco.includes('127.0.0.1');

// Pool de conexões com o PostgreSQL, usando a URL definida no .env
const pool = new Pool({
  connectionString: urlBanco,
  ssl: precisaSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (erro) => {
  console.error('Erro inesperado no pool do PostgreSQL:', erro);
});

// Função auxiliar pra rodar queries sem precisar pegar/soltar client toda hora
async function consultar(texto, parametros) {
  return pool.query(texto, parametros);
}

module.exports = { pool, consultar };