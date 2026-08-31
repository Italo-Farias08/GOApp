const { consultar } = require('../configuracao/banco');

async function criarSolicitacao({
  usuarioId,
  cnhNumero,
  cnhCategoria,
  veiculoPlaca,
  veiculoModelo,
  veiculoCor,
  veiculoAno,
}) {
  const resultado = await consultar(
    `INSERT INTO motoristas
       (usuario_id, cnh_numero, cnh_categoria, veiculo_placa, veiculo_modelo, veiculo_cor, veiculo_ano)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [usuarioId, cnhNumero, cnhCategoria, veiculoPlaca, veiculoModelo, veiculoCor, veiculoAno]
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

module.exports = { criarSolicitacao, buscarUltimaSolicitacaoPorUsuario };
