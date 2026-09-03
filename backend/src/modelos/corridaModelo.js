const { consultar } = require('../configuracao/banco');

// Converte a linha do banco (snake_case) pro formato que o front espera
function paraCorridaPublica(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    passageiroId: linha.passageiro_id,
    motoristaId: linha.motorista_id || undefined,
    origem: {
      latitude: Number(linha.origem_latitude),
      longitude: Number(linha.origem_longitude),
      endereco: linha.origem_endereco || undefined,
    },
    destino: {
      latitude: Number(linha.destino_latitude),
      longitude: Number(linha.destino_longitude),
      endereco: linha.destino_endereco || undefined,
    },
    tipoVeiculo: linha.tipo_veiculo,
    preco: Number(linha.preco),
    distanciaKm: Number(linha.distancia_km),
    duracaoMin: Number(linha.duracao_min),
    status: linha.status,
    criadoEm: linha.criado_em,
  };
}

async function criar({ passageiroId, origem, destino, tipoVeiculo, preco, distanciaKm, duracaoMin }) {
  const resultado = await consultar(
    `INSERT INTO corridas
       (passageiro_id, origem_latitude, origem_longitude, origem_endereco,
        destino_latitude, destino_longitude, destino_endereco,
        tipo_veiculo, preco, distancia_km, duracao_min)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      passageiroId,
      origem.latitude,
      origem.longitude,
      origem.endereco || null,
      destino.latitude,
      destino.longitude,
      destino.endereco || null,
      tipoVeiculo,
      preco,
      distanciaKm,
      duracaoMin,
    ]
  );
  return resultado.rows[0];
}

async function buscarPorId(id) {
  const resultado = await consultar('SELECT * FROM corridas WHERE id = $1', [id]);
  return resultado.rows[0] || null;
}

async function buscarAtivaPorPassageiro(passageiroId) {
  const resultado = await consultar(
    `SELECT * FROM corridas
     WHERE passageiro_id = $1 AND status IN ('procurando', 'aceita')
     ORDER BY criado_em DESC
     LIMIT 1`,
    [passageiroId]
  );
  return resultado.rows[0] || null;
}

// Só deixa aceitar se ainda estiver "procurando" — o próprio WHERE resolve a
// condição de corrida (dois motoristas aceitando ao mesmo tempo): quem
// chegar primeiro no banco ganha, o segundo recebe 0 linhas afetadas.
async function aceitar(id, motoristaId) {
  const resultado = await consultar(
    `UPDATE corridas SET
       motorista_id = $2,
       status = 'aceita',
       aceita_em = NOW()
     WHERE id = $1 AND status = 'procurando'
     RETURNING *`,
    [id, motoristaId]
  );
  return resultado.rows[0] || null;
}

async function cancelar(id) {
  const resultado = await consultar(
    `UPDATE corridas SET status = 'cancelada'
     WHERE id = $1 AND status IN ('procurando', 'aceita')
     RETURNING *`,
    [id]
  );
  return resultado.rows[0] || null;
}

async function finalizar(id) {
  const resultado = await consultar(
    `UPDATE corridas SET status = 'finalizada', finalizada_em = NOW()
     WHERE id = $1 AND status = 'aceita'
     RETURNING *`,
    [id]
  );
  return resultado.rows[0] || null;
}

module.exports = {
  paraCorridaPublica,
  criar,
  buscarPorId,
  buscarAtivaPorPassageiro,
  aceitar,
  cancelar,
  finalizar,
};
