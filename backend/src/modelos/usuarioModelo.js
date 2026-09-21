const { consultar } = require('../configuracao/banco');

// Converte a linha do banco (snake_case) pro formato que o front espera (camelCase)
function paraUsuarioPublico(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.nome,
    email: linha.email || undefined,
    phone: linha.telefone || undefined,
    avatarUrl: linha.avatar_url || undefined,
    driverStatus: linha.status_motorista,
    emailVerificado: linha.email_verificado,
  };
}

async function buscarPorEmail(email) {
  const resultado = await consultar('SELECT * FROM usuarios WHERE email = $1', [email]);
  return resultado.rows[0] || null;
}

async function buscarPorTelefone(telefone) {
  const resultado = await consultar('SELECT * FROM usuarios WHERE telefone = $1', [telefone]);
  return resultado.rows[0] || null;
}

async function buscarPorId(id) {
  const resultado = await consultar('SELECT * FROM usuarios WHERE id = $1', [id]);
  return resultado.rows[0] || null;
}

async function criar({ nome, email, senhaHash, telefone }) {
  const resultado = await consultar(
    `INSERT INTO usuarios (nome, email, senha_hash, telefone)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nome, email || null, senhaHash || null, telefone || null]
  );
  return resultado.rows[0];
}

async function atualizar(id, { nome, email, telefone }) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       nome = COALESCE($2, nome),
       email = COALESCE($3, email),
       telefone = COALESCE($4, telefone),
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, nome || null, email || null, telefone || null]
  );
  return resultado.rows[0];
}

// Usada quando o usuário ainda não verificou o email e digitou o email errado
// no cadastro: troca o email e já gera um novo código de verificação pro
// endereço correto (o antigo código fica inválido).
async function alterarEmailPendente(id, { email, codigo, expiraEm }) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       email = $2,
       codigo_verificacao = $3,
       codigo_verificacao_expira = $4,
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, email, codigo, expiraEm]
  );
  return resultado.rows[0];
}

async function definirCodigoVerificacao(id, { codigo, expiraEm }) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       codigo_verificacao = $2,
       codigo_verificacao_expira = $3,
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, codigo, expiraEm]
  );
  return resultado.rows[0];
}

async function marcarEmailVerificado(id) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       email_verificado = TRUE,
       codigo_verificacao = NULL,
       codigo_verificacao_expira = NULL,
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return resultado.rows[0];
}

// Grava o código de 6 dígitos + validade pro fluxo de "Esqueci minha senha"
// (POST /auth/forgot-password).
async function definirCodigoRecuperacaoSenha(id, { codigo, expiraEm }) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       codigo_recuperacao_senha = $2,
       codigo_recuperacao_senha_expira = $3,
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, codigo, expiraEm]
  );
  return resultado.rows[0];
}

// Troca a senha (já em hash) e limpa o código de recuperação, pra ele não
// poder ser reaproveitado numa segunda tentativa depois de já ter servido.
async function redefinirSenha(id, senhaHash) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       senha_hash = $2,
       codigo_recuperacao_senha = NULL,
       codigo_recuperacao_senha_expira = NULL,
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, senhaHash]
  );
  return resultado.rows[0];
}

async function atualizarStatusMotorista(id, status) {
  const resultado = await consultar(
    `UPDATE usuarios SET status_motorista = $2, atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return resultado.rows[0];
}

// Salva a URL da foto (selfie do motorista, ou avatar em geral) — nunca o
// arquivo em si, só o link pra onde ele está guardado.
async function atualizarAvatar(id, avatarUrl) {
  const resultado = await consultar(
    `UPDATE usuarios SET avatar_url = $2, atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, avatarUrl]
  );
  return resultado.rows[0];
}

async function atualizarChavePix(id, { chavePix, chavePixTipo, cpf }) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       chave_pix = $2,
       chave_pix_tipo = $3,
       cpf = $4,
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, chavePix, chavePixTipo, cpf]
  );
  return resultado.rows[0];
}

// Zera o saldo_a_receber do usuário de forma atômica e devolve o valor que
// havia ANTES de zerar. Usa isso pra evitar que dois cliques no botão
// "Receber" disparem duas transferências: o segundo clique sempre vê o
// saldo já em 0 e nem chega a chamar o Mercado Pago.
async function zerarSaldoAReceber(id) {
  const resultado = await consultar(
    `WITH antes AS (
       SELECT saldo_a_receber FROM usuarios WHERE id = $1 FOR UPDATE
     )
     UPDATE usuarios SET saldo_a_receber = 0, atualizado_em = NOW()
     FROM antes
     WHERE usuarios.id = $1
     RETURNING antes.saldo_a_receber AS saldo_anterior`,
    [id]
  );
  return resultado.rows[0];
}

// Se a transferência falhar DEPOIS de já termos zerado o saldo, devolve o
// valor pro usuário (não pode simplesmente sumir com o dinheiro dele).
async function devolverSaldoAReceber(id, valor) {
  const resultado = await consultar(
    `UPDATE usuarios SET saldo_a_receber = saldo_a_receber + $2, atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, valor]
  );
  return resultado.rows[0];
}

// Ajusta o saldo_a_receber por um valor qualquer (positivo ou negativo) —
// usado pela comissão da plataforma: soma o líquido de corridas pagas por
// Pix (a plataforma já está com o dinheiro), ou subtrai só a comissão de
// corridas pagas em dinheiro (o motorista já embolsou o valor cheio na
// hora, então só a taxa da plataforma vira "dívida" dele — automaticamente
// abatida do próximo crédito de Pix que ele receber).
async function ajustarSaldoAReceber(id, delta) {
  const resultado = await consultar(
    `UPDATE usuarios SET saldo_a_receber = saldo_a_receber + $2, atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, delta]
  );
  return resultado.rows[0];
}

// Salva (ou substitui) o token de push notification do dispositivo atual do
// usuário. Chamado pelo app assim que o usuário loga e a permissão de
// notificação é concedida — um usuário só guarda UM token por vez (o do
// último dispositivo em que logou), então logar num celular novo
// naturalmente "desativa" as notificações no antigo.
async function atualizarPushToken(id, pushToken) {
  const resultado = await consultar(
    `UPDATE usuarios SET push_token = $2, atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, pushToken]
  );
  return resultado.rows[0];
}

async function buscarPushTokenPorId(id) {
  const resultado = await consultar('SELECT push_token FROM usuarios WHERE id = $1', [id]);
  return resultado.rows[0]?.push_token || null;
}

// Busca os tokens de vários usuários de uma vez (ex: todos os motoristas
// disponíveis perto de uma corrida nova) — evita uma query por usuário.
async function buscarPushTokensPorIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const resultado = await consultar(
    'SELECT push_token FROM usuarios WHERE id = ANY($1) AND push_token IS NOT NULL',
    [ids]
  );
  return resultado.rows.map((linha) => linha.push_token);
}

// Exclusão de conta — NÃO apaga a linha do usuário de verdade. Um DELETE de
// verdade quebraria (ou arrastaria junto) o histórico de corridas, dívidas e
// pagamentos ligado a esse usuário — inclusive de OUTRAS pessoas (ex: o
// motorista que tem uma corrida antiga com esse passageiro). Em vez disso,
// apaga só os dados pessoais (nome, email, telefone, senha, foto, chave
// Pix) e marca `deletado_em`, preservando o id e o histórico ligado a ele.
// E-mail/telefone viram NULL (não colidem com o UNIQUE constraint, Postgres
// permite múltiplos NULLs), então ficam livres pra alguém cadastrar de novo
// com esses mesmos dados no futuro.
async function excluirConta(id) {
  const resultado = await consultar(
    `UPDATE usuarios SET
       nome = 'Usuário excluído',
       email = NULL,
       telefone = NULL,
       senha_hash = NULL,
       avatar_url = NULL,
       push_token = NULL,
       chave_pix = NULL,
       chave_pix_tipo = NULL,
       cpf = NULL,
       deletado_em = NOW(),
       atualizado_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return resultado.rows[0];
}

module.exports = {
  paraUsuarioPublico,
  buscarPorEmail,
  buscarPorTelefone,
  buscarPorId,
  criar,
  atualizar,
  alterarEmailPendente,
  definirCodigoVerificacao,
  marcarEmailVerificado,
  definirCodigoRecuperacaoSenha,
  redefinirSenha,
  atualizarStatusMotorista,
  atualizarAvatar,
  atualizarChavePix,
  zerarSaldoAReceber,
  devolverSaldoAReceber,
  ajustarSaldoAReceber,
  atualizarPushToken,
  buscarPushTokenPorId,
  buscarPushTokensPorIds,
  excluirConta,
};