const usuarioModelo = require('../modelos/usuarioModelo');

// Endpoint público da Expo que recebe notificações e repassa pro FCM (Android)
// ou APNs (iOS) — não precisa de credencial nenhuma pra chamar, só o(s)
// "ExponentPushToken[...]" de quem vai receber.
const URL_PUSH_EXPO = 'https://exp.host/--/api/v2/push/send';

// Expo aceita até 100 notificações por requisição — na prática o raio de
// busca de motoristas (8km) deve manter os lotes bem menores que isso, mas
// divide de qualquer jeito pra não estourar caso a base cresça.
const TAMANHO_LOTE = 100;

function ehTokenExpoValido(token) {
  return typeof token === 'string' && token.startsWith('ExponentPushToken');
}

// Monta o payload de uma notificação no formato que a Expo espera.
// channelId precisa bater com o canal Android criado no app
// (ver src/services/notificacaoPushService.ts no frontend) — sem isso o
// Android usa um canal genérico sem som/vibração configurados.
function montarMensagem(pushToken, { titulo, corpo, dados }) {
  return {
    to: pushToken,
    title: titulo,
    body: corpo,
    data: dados || {},
    sound: 'default',
    channelId: 'default',
    // O ícone que aparece na barra de status/notificação vem da configuração
    // nativa do app (app.config.js -> expo.notification.icon), não é
    // possível (nem necessário) mandar por aqui.
    priority: 'high',
  };
}

async function enviarLote(mensagens) {
  const validas = mensagens.filter((m) => ehTokenExpoValido(m.to));
  if (validas.length === 0) return;

  try {
    const resposta = await fetch(URL_PUSH_EXPO, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validas),
    });

    if (!resposta.ok) {
      const textoErro = await resposta.text().catch(() => '');
      console.error('[push] Expo respondeu com erro HTTP:', resposta.status, textoErro);
      return;
    }

    const dadosResposta = await resposta.json();
    // A Expo devolve um "ticket" por notificação — tickets com erro
    // DeviceNotRegistered indicam token morto (app desinstalado, por
    // exemplo). Só loga por enquanto; limpar esses tokens do banco fica
    // como próximo passo caso o volume justifique.
    const tickets = Array.isArray(dadosResposta?.data) ? dadosResposta.data : [];
    tickets.forEach((ticket, indice) => {
      if (ticket?.status === 'error') {
        console.warn('[push] falha ao entregar notificação:', ticket.message, 'token:', validas[indice]?.to);
      }
    });
  } catch (erro) {
    // Nunca deixa uma falha de push derrubar o fluxo principal (aceitar
    // corrida, finalizar, etc.) — notificação é um "extra", não pode
    // quebrar a ação real do usuário.
    console.error('[push] falha ao chamar a API da Expo:', erro);
  }
}

// Manda uma notificação pra UM usuário específico, buscando o token dele no
// banco na hora. Não faz nada (silenciosamente) se ele nunca registrou um
// dispositivo ou se o token salvo não é um token válido da Expo.
async function enviarParaUsuario(usuarioId, { titulo, corpo, dados }) {
  if (!usuarioId) return;
  const pushToken = await usuarioModelo.buscarPushTokenPorId(usuarioId);
  if (!ehTokenExpoValido(pushToken)) return;
  await enviarLote([montarMensagem(pushToken, { titulo, corpo, dados })]);
}

// Mesma coisa, só que pra uma lista de usuários (ex: todos os motoristas
// disponíveis perto de uma corrida nova) — busca todos os tokens numa
// query só, em vez de uma por usuário.
async function enviarParaUsuarios(usuarioIds, { titulo, corpo, dados }) {
  if (!Array.isArray(usuarioIds) || usuarioIds.length === 0) return;

  const tokens = await usuarioModelo.buscarPushTokensPorIds(usuarioIds);
  const mensagens = tokens
    .filter(ehTokenExpoValido)
    .map((token) => montarMensagem(token, { titulo, corpo, dados }));

  for (let i = 0; i < mensagens.length; i += TAMANHO_LOTE) {
    await enviarLote(mensagens.slice(i, i + TAMANHO_LOTE));
  }
}

module.exports = {
  enviarParaUsuario,
  enviarParaUsuarios,
};