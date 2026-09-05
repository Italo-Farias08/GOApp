const { consultar } = require('../configuracao/banco');

async function criarSolicitacao({
  usuarioId,
  cnhNumero,
  cnhCategoria,
  veiculoTipo,
  veiculoPlaca,
  veiculoModelo,
  veiculoCor,
  veiculoAno,
}) {
  const resultado = await consultar(
    `INSERT INTO motoristas
       (usuario_id, cnh_numero, cnh_categoria, veiculo_tipo, veiculo_placa, veiculo_modelo, veiculo_cor, veiculo_ano)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [usuarioId, cnhNumero, cnhCategoria, veiculoTipo, veiculoPlaca, veiculoModelo, veiculoCor, veiculoAno]
  );
  return resultado.rows[0];
}

async function buscarUltimaSolicitacaoPorUsuario(usuarioId) {
  const resultado = await consultar(
    `SELECT * FROM motoristas
     WHERE usuario_id = $1
     ORDER BY criado_em DESC
     LIMIT 1`,
    [usuarioId]
  );
  return resultado.rows[0] || null;
}

async function listarPendentes() {
  const resultado = await consultar(
    `SELECT m.*, u.nome, u.email, u.telefone
     FROM motoristas m
     JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.status = 'pending'
     ORDER BY m.criado_em ASC`
  );
  return resultado.rows;
}

async function atualizarStatusPorUsuario(usuarioId, status) {
  const resultado = await consultar(
    `UPDATE motoristas SET status = $2
     WHERE usuario_id = $1
     RETURNING *`,
    [usuarioId, status]
  );
  return resultado.rows[0];
}

// Atualiza os dados de veículo/CNH da própria solicitação (a mais recente)
// do motorista já aprovado. COALESCE mantém o valor antigo em qualquer
// campo que não vier no corpo da requisição.
async function atualizarVeiculoPorUsuario(usuarioId, {
  cnhNumero,
  cnhCategoria,
  veiculoTipo,
  veiculoPlaca,
  veiculoModelo,
  veiculoCor,
  veiculoAno,
}) {
  const resultado = await consultar(
    `UPDATE motoristas SET
       cnh_numero = COALESCE($2, cnh_numero),
       cnh_categoria = COALESCE($3, cnh_categoria),
       veiculo_tipo = COALESCE($4, veiculo_tipo),
       veiculo_placa = COALESCE($5, veiculo_placa),
       veiculo_modelo = COALESCE($6, veiculo_modelo),
       veiculo_cor = COALESCE($7, veiculo_cor),
       veiculo_ano = COALESCE($8, veiculo_ano)
     WHERE usuario_id = $1
     RETURNING *`,
    [
      usuarioId,
      cnhNumero || null,
      cnhCategoria || null,
      veiculoTipo || null,
      veiculoPlaca || null,
      veiculoModelo || null,
      veiculoCor || null,
      veiculoAno || null,
    ]
  );
  return resultado.rows[0];
}

module.exports = {
  criarSolicitacao,
  buscarUltimaSolicitacaoPorUsuario,
  listarPendentes,
  atualizarStatusPorUsuario,
  atualizarVeiculoPorUsuario,
};