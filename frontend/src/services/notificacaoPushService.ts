import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Enquanto o app está aberto (primeiro plano), mostra a notificação mesmo
// assim — sem isso o expo-notifications engole silenciosamente qualquer
// push que chegue com o app em uso.
Notifications.setNotificationHandler({
  handleNotification: async (notificacao) => {
    // Corrida nova com o app ABERTO: a tela do motorista já mostra a oferta
    // e toca o som em loop (somCorridaService). Deixar o push também
    // tocar/mostrar banner duplicaria o aviso.
    const ehCorridaNova = notificacao.request.content.data?.tipo === 'corrida_nova';
    return {
      shouldShowAlert: !ehCorridaNova,
      shouldShowBanner: !ehCorridaNova,
      shouldShowList: !ehCorridaNova,
      shouldPlaySound: !ehCorridaNova,
      shouldSetBadge: false,
    };
  },
});

// Canal usado por toda notificação mandada pelo backend (ver channelId em
// backend/src/utilitarios/pushNotificacoes.js). No Android 8+, sem um canal
// configurado a notificação chega sem som/vibração e com prioridade baixa.
async function configurarCanalAndroid() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Corridas e mensagens',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    // Cor do ícone pequeno na barra de status — mesma cor de marca usada em
    // app.config.js (expo.notification.color).
    lightColor: '#001566',
    sound: 'default',
  });

  // Canal exclusivo de corrida nova: som próprio (assets/sounds/corrida_nova.wav,
  // registrado em app.config.js), prioridade máxima e vibração longa. O som
  // de um canal Android NÃO pode ser alterado depois de criado — por isso é
  // um canal novo ('corridas') em vez de mexer no 'default'. O backend usa
  // esse mesmo id (ver backend/src/utilitarios/pushNotificacoes.js).
  await Notifications.setNotificationChannelAsync('corridas', {
    name: 'Corridas novas',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 300, 500, 300, 500],
    lightColor: '#001566',
    sound: 'corrida_nova.wav',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// Pede permissão (se ainda não foi concedida/negada) e devolve o token da
// Expo pra esse dispositivo, ou null se a pessoa negou ou está rodando num
// simulador/emulador (push não funciona lá).
export async function registrarParaNotificacoes(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      // Simulador/emulador não recebe push de verdade — evita gastar uma
      // chamada de permissão à toa em ambiente de desenvolvimento.
      return null;
    }

    await configurarCanalAndroid();

    const permissaoAtual = await Notifications.getPermissionsAsync();
    let status = permissaoAtual.status;

    if (status !== 'granted') {
      const resultado = await Notifications.requestPermissionsAsync();
      status = resultado.status;
    }

    if (status !== 'granted') {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    return pushToken;
  } catch (erro) {
    // Nunca deixa uma falha de push travar o login/uso do app — notificação
    // é um "extra".
    console.warn('[push] não foi possível registrar o dispositivo:', erro);
    return null;
  }
}

// Manda o token pro backend salvar, associado ao usuário logado.
export async function enviarTokenParaBackend(pushToken: string) {
  await api.put('/auth/push-token', { pushToken });
}

// Ponto único chamado depois de qualquer login bem-sucedido: pede
// permissão, pega o token da Expo e já registra no backend. Todo o processo
// é "best effort" — qualquer falha só fica no console, nunca interrompe o
// fluxo de login.
export async function configurarNotificacoesPush() {
  const token = await registrarParaNotificacoes();
  if (!token) return;

  try {
    await enviarTokenParaBackend(token);
  } catch (erro) {
    console.warn('[push] não foi possível salvar o token no backend:', erro);
  }
}