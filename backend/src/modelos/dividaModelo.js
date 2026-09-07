const { consultar } = require('../configuracao/banco');

// Converte a linha do banco pro formato que o front espera.
function paraDividaPublica(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    passageiroId: linha.passageiro_id,
    motoristaCredorId: linha.motorista_credor_id,
    corridaOrigemId: linha.corrida_origem_id,
    corridaQuitacaoId: linha.corrida_quitacao_id || undefined,
    valor: Number(linha.valor),
    status: linha.status, // 'pendente' | 'quitada'
    criadoEm: linha.criado_em,
    quitadoEm: linha.quitado_em || undefined,
  };
}

// Cria a dívida quando o motorista marca "não pagou" ao finalizar a
// corrida. `valor` é sempre o preço ORIGINAL desta corrida (sem contar
// nenhuma dívida antiga que já estivesse embutida nela) — se essa corrida já
// trazia uma dívida anterior embutida e o cliente não pagou de novo, aquela
// dívida antiga continua "pendente" sozinha (nunca é tocada aqui) e volta a
// ser cobrada na próxima corrida, exatamente como se nada tivesse mudado.
async function criar({ passageiroId, motoristaCredorId, corridaOrigemId, valor }) {
  const resultado = await consultar(
    `INSERT INTO dividas (passageiro_id, motorista_credor_id, corrida_origem_id, valor)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [passageiroId, motoristaCredorId, corridaOrigemId, valor]
  );
  return resultado.rows[0];
}

// Todas as dívidas ainda não quitadas de um passageiro — somadas ao preço da
// próxima corrida que ele pedir (ver corridaServico.criarEDespachar).
async function listarPendentesPorPassageiro(passageiroId) {
  const resultado = await consultar(
    `SELECT * FROM dividas WHERE passageiro_id = $1 AND status = 'pendente' ORDER BY criado_em ASC`,
    [passageiroId]
  );
  return resultado.rows;
}

async function buscarPorId(id) {
  const resultado = await consultar('SELECT * FROM dividas WHERE id = $1', [id]);
  return resultado.rows[0] || null;
}

// Quita uma dívida (a corrida que a incluía no preço acabou de ser paga) e
// devolve pro motorista credor original a parte que ele não tinha recebido
// — soma direto no saldo dele, dentro da mesma operação, pra nunca ficar
// "a dívida quitou mas o motorista não recebeu".
async function quitar(id, corridaQuitacaoId) {
  const resultado = await consultar(
    `WITH divida_quitada AS (
       UPDATE dividas
       SET status = 'quitada', quitado_em = NOW(), corrida_quitacao_id = $2
       WHERE id = $1 AND status = 'pendente'
       RETURNING *
     )
     UPDATE usuarios
     SET saldo_a_receber = saldo_a_receber + divida_quitada.valor
     FROM divida_quitada
     WHERE usuarios.id = divida_quitada.motorista_credor_id
     RETURNING divida_quitada.*`,
    [id, corridaQuitacaoId]
  );
  return resultado.rows[0] || null;
}

// Quita em lote as dívidas que uma corrida específica incluiu no preço —
// usado assim que essa corrida é confirmada como paga (dinheiro ou Pix).
async function quitarVarias(ids, corridaQuitacaoId) {
  const dividasQuitadas = [];
  for (const id of ids) {
    const quitada = await quitar(id, corridaQuitacaoId);
    if (quitada) dividasQuitadas.push(quitada);
  }
  return dividasQuitadas;
}

module.exports = {
  paraDividaPublica,
  criar,
  listarPendentesPorPassageiro,
  buscarPorId,
  quitar,
  quitarVarias,
};