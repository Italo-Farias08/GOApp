const { consultar } = require('../configuracao/banco');

// Depois de quantos cancelamentos de motoristas diferentes a corrida desiste
// de procurar outro e é cancelada de vez, avisando o passageiro.
const LIMITE_CANCELAMENTOS_MOTORISTA = 2;

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
    embarqueEm: linha.embarque_em || undefined,
    canceladoPor: linha.cancelado_por || undefined,
    motivoCancelamento: linha.motivo_cancelamento || undefined,
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
     WHERE passageiro_id = $1 AND status IN ('procurando', 'aceita', 'em_andamento')
     ORDER BY criado_em DESC
     LIMIT 1`,
    [passageiroId]
  );
  return resultado.rows[0] || null;
}

// Todas as corridas ainda "procurando" motorista de um tipo de veículo —
// usado pra reoferecer corridas pendentes assim que um motorista fica online
// (sem isso, só quem já estava online no instante da criação recebia).
async function buscarProcurandoPorTipo(tipoVeiculo) {
  const resultado = await consultar(
    `SELECT * FROM corridas
     WHERE status = 'procurando' AND tipo_veiculo = $1
     ORDER BY criado_em ASC`,
    [tipoVeiculo]
  );
  return resultado.rows;
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

// Motorista confirma que pegou o passageiro — só é aceito se a corrida
// estiver "aceita" e for desse mesmo motorista. Depois disso o mapa passa a
// guiar até o destino final, não mais até o ponto de embarque.
async function embarcar(id, motoristaId) {
  const resultado = await consultar(
    `UPDATE corridas SET
       status = 'em_andamento',
       embarque_em = NOW()
     WHERE id = $1 AND motorista_id = $2 AND status = 'aceita'
     RETURNING *`,
    [id, motoristaId]
  );
  return resultado.rows[0] || null;
}

// Cancelamento pelo PASSAGEIRO — regra: só enquanto a corrida ainda está
// "procurando", "aceita" (motorista a caminho) ou "em_andamento" (já embarcou).
async function cancelarPeloPassageiro(id, motivo) {
  const resultado = await consultar(
    `UPDATE corridas SET
       status = 'cancelada',
       cancelado_por = 'passageiro',
       motivo_cancelamento = $2
     WHERE id = $1 AND status IN ('procurando', 'aceita', 'em_andamento')
     RETURNING *`,
    [id, motivo || null]
  );
  return resultado.rows[0] || null;
}

// Cancelamento pelo MOTORISTA — regra: só pode cancelar uma corrida que ele
// mesmo aceitou e AINDA NÃO embarcou (status 'aceita'; depois de
// 'em_andamento' o passageiro já está no veículo, então cancelar aqui deixa
// de fazer sentido — nesse caso ele deve finalizar a corrida normalmente).
// Em vez de matar o pedido na hora, a corrida VOLTA pro radar de outros
// motoristas (status volta a 'procurando'), perde o motorista atual, e o
// motorista que cancelou entra numa lista de ignorados pra não receber a
// mesma corrida de novo. Só depois de LIMITE_CANCELAMENTOS_MOTORISTA
// motoristas diferentes desistirem é que a corrida é cancelada de vez, com
// cancelado_por = 'sistema'.
async function cancelarPeloMotorista(id, motoristaId, motivo) {
  const resultado = await consultar(
    `UPDATE corridas SET
       status = CASE
         WHEN motorista_cancelamentos + 1 >= $3 THEN 'cancelada'
         ELSE 'procurando'
       END,
       cancelado_por = CASE
         WHEN motorista_cancelamentos + 1 >= $3 THEN 'sistema'
         ELSE NULL
       END,
       motivo_cancelamento = CASE
         WHEN motorista_cancelamentos + 1 >= $3 THEN 'Não encontramos outro motorista disponível.'
         ELSE $4
       END,
       motorista_id = NULL,
       aceita_em = NULL,
       motorista_cancelamentos = motorista_cancelamentos + 1,
       motoristas_ignorados = array_append(motoristas_ignorados, $2::uuid)
     WHERE id = $1 AND motorista_id = $2 AND status = 'aceita'
     RETURNING *`,
    [id, motoristaId, LIMITE_CANCELAMENTOS_MOTORISTA, motivo || null]
  );
  return resultado.rows[0] || null;
}

async function finalizar(id) {
  const resultado = await consultar(
    `UPDATE corridas SET status = 'finalizada', finalizada_em = NOW()
     WHERE id = $1 AND status = 'em_andamento'
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
  buscarProcurandoPorTipo,
  aceitar,
  embarcar,
  cancelarPeloPassageiro,
  cancelarPeloMotorista,
  finalizar,
};
