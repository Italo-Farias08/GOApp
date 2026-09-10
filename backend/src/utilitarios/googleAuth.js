// Verifica o id_token que o app manda depois do usuário logar com o Google.
//
// O front tem 3 Client IDs (Android, iOS, Web) — todos do mesmo app no
// Google Cloud — mas o token pode ter sido emitido pra qualquer um deles
// dependendo da plataforma que o usuário está usando. Por isso o
// verifyIdToken abaixo aceita todos os 3 como "audience" válida: a lib do
// Google confere se o token foi assinado pelo Google E se o campo "aud"
// bate com algum desses IDs (sem isso, qualquer id_token do Google — de
// qualquer app — passaria na validação).
const { OAuth2Client } = require('google-auth-library');

const CLIENT_IDS = [
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
].filter(Boolean);

const client = new OAuth2Client();

// Retorna os dados básicos do usuário (email, nome, foto) já validados,
// ou lança erro se o token for inválido/expirado/de outro app.
async function verificarIdTokenGoogle(idToken) {
  if (!idToken) {
    throw new Error('idToken não informado.');
  }
  if (CLIENT_IDS.length === 0) {
    throw new Error(
      'Login com Google não configurado no servidor (faltam as variáveis GOOGLE_WEB_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID / GOOGLE_IOS_CLIENT_ID).'
    );
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_IDS,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Não foi possível obter o email da conta Google.');
  }

  return {
    email: payload.email,
    emailVerificado: !!payload.email_verified,
    nome: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture || null,
    googleId: payload.sub,
  };
}

module.exports = { verificarIdTokenGoogle };
