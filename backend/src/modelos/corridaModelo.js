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
    formaPagamento: linha.forma_pagamento || 'dinheiro',
    status: linha.status,
    // Pagamento em si — separado do status da corrida porque uma corrida
    // "finalizada" pode não ter sido paga (motorista marcou "não pagou").
    statusPagamento: linha.status_pagamento || 'pendente',
    pagoEm: linha.pago_em || undefined,
    // Tarifa desta corrida sem nenhuma dívida de corrida anterior embutida.
    precoOriginal: linha.preco_original != null ? Number(linha.preco_original) : Number(linha.preco),
    // Diferença entre `preco` e `precoOriginal` — é o valor de dívida(s)
    // antiga(s) que foi somado ao preço desta corrida, se houver.
    dividaAplicada:
      linha.preco_original != null && Number(linha.preco) > Number(linha.preco_original)
        ? Number((Number(linha.preco) - Number(linha.preco_original)).toFixed(2))
        : 0,
    criadoEm: linha.criado_em,
    embarqueEm: linha.embarque_em || undefined,
    canceladoPor: linha.cancelado_por || undefined,
    motivoCancelamento: linha.motivo_cancelamento || undefined,
    // Só vem preenchido quando a linha veio de uma consulta com JOIN em
    // `usuarios` (ex: buscarProcurandoPorTipo) — sem isso undefined mesmo.
    passageiroNome: linha.passageiro_nome || undefined,
  };
}

async function criar({
  passageiroId,
  origem,
  destino,
  tipoVeiculo,
  preco,
  precoOriginal,
  distanciaKm,
  duracaoMin,
  formaPagamento,
  dividasIncluidas,
}) {
  const resultado = await consultar(
    `INSERT INTO corridas
       (passageiro_id, origem_latitude, origem_longitude, origem_endereco,
        destino_latitude, destino_longitude, destino_endereco,
        tipo_veiculo, preco, preco_original, distancia_km, duracao_min,
        forma_pagamento, dividas_incluidas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      // Se não vier explícito, assume que o preço já é "limpo" (sem dívida).
      precoOriginal != null ? precoOriginal : preco,
      distanciaKm,
      duracaoMin,
      formaPagamento || 'dinheiro',
      JSON.stringify(dividasIncluidas || []),
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
    `SELECT c.*, u.nome AS passageiro_nome
     FROM corridas c
     JOIN usuarios u ON u.id = c.passageiro_id
     WHERE c.status = 'procurando' AND c.tipo_veiculo = $1
     ORDER BY c.criado_em ASC`,
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

// Finaliza recebendo o pagamento em DINHEIRO na hora — motorista confirmou
// que já embolsou o valor, então marca paga e encerra tudo de uma vez.
// Só quem está atribuído à corrida pode chamar (checado no controlador).
async function finalizarComDinheiro(id) {
  const resultado = await consultar(
    `UPDATE corridas SET
       status = 'finalizada',
       finalizada_em = NOW(),
       status_pagamento = 'pago',
       pago_em = NOW()
     WHERE id = $1 AND status = 'em_andamento'
     RETURNING *`,
    [id]
  );
  return resultado.rows[0] || null;
}

// Finaliza marcando que o passageiro NÃO pagou — a corrida encerra mesmo
// assim (o motorista fica livre pra receber outras), e a cobrança vira uma
// dívida que será somada na próxima corrida desse passageiro (ver
// dividaModelo + corridaServico.criarEDespachar).
async function finalizarComoNaoPago(id) {
  const resultado = await consultar(
    `UPDATE corridas SET
       status = 'finalizada',
       finalizada_em = NOW(),
       status_pagamento = 'nao_pago'
     WHERE id = $1 AND status = 'em_andamento'
     RETURNING *`,
    [id]
  );
  return resultado.rows[0] || null;
}

// Finaliza depois que o Pix gerado ao término da corrida foi APROVADO —
// chamado pelo polling/webhook do Mercado Pago, então não recebe motoristaId
// (quem confirma é o gateway de pagamento, não uma ação direta do usuário).
async function finalizarComPixAprovado(id) {
  const resultado = await consultar(
    `UPDATE corridas SET
       status = 'finalizada',
       finalizada_em = NOW(),
       status_pagamento = 'pago',
       pago_em = NOW()
     WHERE id = $1 AND status = 'em_andamento'
     RETURNING *`,
    [id]
  );
  return resultado.rows[0] || null;
}

// Mantida por compatibilidade — finaliza sem mexer no status de pagamento
// (não é mais chamada pelo fluxo normal, que agora sempre passa por uma das
// três funções acima, mas fica disponível caso algo externo dependa dela).
async function finalizar(id) {
  const resultado = await consultar(
    `UPDATE corridas SET status = 'finalizada', finalizada_em = NOW()
     WHERE id = $1 AND status = 'em_andamento'
     RETURNING *`,
    [id]
  );
  return resultado.rows[0] || null;
}

// Corridas já finalizadas (ou canceladas) que tiveram um motorista
// atribuído — é a lista que alimenta a tela "Mensagens" das configurações,
// pra o passageiro conseguir escrever pro motorista de uma viagem antiga
// caso tenha esquecido algo. Só corridas com motorista fazem sentido aqui
// (sem motorista não tem com quem conversar).
async function listarFinalizadasComMotoristaPorPassageiro(passageiroId) {
  const resultado = await consultar(
    `SELECT c.*,
            u.nome AS motorista_nome,
            u.avatar_url AS motorista_avatar_url
     FROM corridas c
     JOIN usuarios u ON u.id = c.motorista_id
     WHERE c.passageiro_id = $1
       AND c.motorista_id IS NOT NULL
       AND c.status IN ('finalizada', 'cancelada')
     ORDER BY c.criado_em DESC
     LIMIT 30`,
    [passageiroId]
  );
  return resultado.rows;
}

// Espelho de listarFinalizadasComMotoristaPorPassageiro, só que do lado do
// motorista: corridas encerradas dele, trazendo os dados do PASSAGEIRO (não
// do motorista) — alimenta a tela "Mensagens" do app do motorista.
async function listarFinalizadasComPassageiroPorMotorista(motoristaId) {
  const resultado = await consultar(
    `SELECT c.*,
            u.nome AS passageiro_nome,
            u.avatar_url AS passageiro_avatar_url
     FROM corridas c
     JOIN usuarios u ON u.id = c.passageiro_id
     WHERE c.motorista_id = $1
       AND c.status IN ('finalizada', 'cancelada')
     ORDER BY c.criado_em DESC
     LIMIT 30`,
    [motoristaId]
  );
  return resultado.rows;
}

// Resumo do dia do motorista logado: quantas corridas ele já finalizou hoje
// e quanto ele lucrou nelas (soma do `preco`) — alimenta o "Painel do
// Motoboy" nas configurações do app. Considera o dia pela data de criação da
// corrida (não existe coluna de "finalizado_em" na tabela).
async function resumoHojePorMotorista(motoristaId) {
  const resultado = await consultar(
    `SELECT COUNT(*)::int AS total_corridas,
            COALESCE(SUM(preco), 0) AS total_valor
     FROM corridas
     WHERE motorista_id = $1
       AND status = 'finalizada'
       AND criado_em::date = CURRENT_DATE`,
    [motoristaId]
  );
  const linha = resultado.rows[0];
  return {
    corridasHoje: Number(linha.total_corridas),
    valorHoje: Number(linha.total_valor),
  };
}

// Converte uma linha de mensagens_corrida pro formato que o front espera.
function paraMensagemPublica(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    corridaId: linha.corrida_id,
    remetenteId: linha.remetente_id,
    texto: linha.texto,
    criadoEm: linha.criado_em,
  };
}

// Salva uma mensagem do chat da corrida (passageiro <-> motorista).
async function salvarMensagem(corridaId, remetenteId, texto) {
  const resultado = await consultar(
    `INSERT INTO mensagens_corrida (corrida_id, remetente_id, texto)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [corridaId, remetenteId, texto]
  );
  return resultado.rows[0];
}

// Histórico completo do chat de uma corrida, em ordem cronológica — usado
// pra recuperar a conversa quando o app reabre no meio de uma corrida.
async function listarMensagens(corridaId) {
  const resultado = await consultar(
    `SELECT * FROM mensagens_corrida WHERE corrida_id = $1 ORDER BY criado_em ASC`,
    [corridaId]
  );
  return resultado.rows;
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
  finalizarComDinheiro,
  finalizarComoNaoPago,
  finalizarComPixAprovado,
  listarFinalizadasComMotoristaPorPassageiro,
  listarFinalizadasComPassageiroPorMotorista,
  resumoHojePorMotorista,
  paraMensagemPublica,
  salvarMensagem,
  listarMensagens,
};