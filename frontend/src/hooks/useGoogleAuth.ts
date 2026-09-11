import { useEffect, useRef, useState } from 'react';
import { NativeModules } from 'react-native';

// O Google Sign-In é um módulo NATIVO — só existe dentro de um app
// buildado (EAS build / dev client), nunca dentro do Expo Go. Se a gente
// simplesmente importasse '@react-native-google-signin/google-signin' lá
// em cima como um import normal, o próprio carregamento do arquivo já
// travava o app inteiro no Expo Go (é o erro "TurboModuleRegistry
// could not be found" que apareceu).
//
// Pra rodar em Expo Go sem quebrar o resto do app, primeiro checamos se o
// módulo nativo existe de verdade no aparelho, e só chamamos `require`
// (que roda na hora, diferente de `import` que roda antes de tudo) quando
// ele existe. Assim, no Expo Go, a gente nunca chega a carregar essa
// biblioteca — o app roda normal, só o botão do Google fica desabilitado.
const nativoDisponivel = !!NativeModules.RNGoogleSignin;

let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin;
let isErrorWithCode: typeof import('@react-native-google-signin/google-signin').isErrorWithCode;
let isSuccessResponse: typeof import('@react-native-google-signin/google-signin').isSuccessResponse;
let statusCodes: typeof import('@react-native-google-signin/google-signin').statusCodes;

if (nativoDisponivel) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const lib = require('@react-native-google-signin/google-signin');
  GoogleSignin = lib.GoogleSignin;
  isErrorWithCode = lib.isErrorWithCode;
  isSuccessResponse = lib.isSuccessResponse;
  statusCodes = lib.statusCodes;
}

// Precisa do Web Client ID pra conseguir o id_token (é ele quem o backend
// valida) e do iOS Client ID pra identificar o app no iOS. O Android usa
// só o Web Client ID mesmo (webClientId funciona como "server client id"
// pros dois SDKs).
let configurado = false;
function garantirConfigurado() {
  if (configurado || !nativoDisponivel) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configurado = true;
}

type ResultadoGoogle =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; idToken: string }
  | { status: 'error'; message: string }
  | { status: 'cancelled' };

// Hook reaproveitável: devolve uma função pra abrir a tela nativa de login
// do Google e o resultado (id_token pronto pra mandar pro backend, ou
// erro). Mantém a mesma "forma" (disponivel/resultado/promptAsync/resetar)
// que a tela de login já espera.
export function useGoogleAuth() {
  const [resultado, setResultado] = useState<ResultadoGoogle>({ status: 'idle' });
  const emAndamento = useRef(false);

  useEffect(() => {
    garantirConfigurado();
  }, []);

  async function promptAsync() {
    if (emAndamento.current) return;

    if (!nativoDisponivel) {
      // Testando pelo Expo Go — não crasha o app, só avisa que esse
      // login específico precisa do app buildado (EAS build / dev client).
      setResultado({
        status: 'error',
        message: 'Login com Google não funciona testando pelo Expo Go. Abra pelo app buildado (EAS build) pra testar isso.',
      });
      return;
    }

    emAndamento.current = true;
    setResultado({ status: 'loading' });
    try {
      garantirConfigurado();
      // No Android, confere se o Google Play Services está disponível e
      // atualizado antes de abrir a tela — sem isso o signIn() só falha
      // com um erro genérico.
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const resposta = await GoogleSignin.signIn();

      if (isSuccessResponse(resposta)) {
        const idToken = resposta.data.idToken;
        if (!idToken) {
          throw new Error('O Google não devolveu o id_token esperado.');
        }
        setResultado({ status: 'success', idToken });
      } else {
        // resposta.type === 'noSavedCredentialFound' (Android) ou o
        // usuário fechou a tela sem escolher uma conta.
        setResultado({ status: 'cancelled' });
      }
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          setResultado({ status: 'cancelled' });
          return;
        }
        if (err.code === statusCodes.IN_PROGRESS) {
          // já tem um login rolando, ignora esse clique extra
          return;
        }
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setResultado({
            status: 'error',
            message: 'O Google Play Services não está disponível ou está desatualizado neste aparelho.',
          });
          return;
        }
      }
      setResultado({
        status: 'error',
        message: err?.message || 'Não foi possível entrar com o Google.',
      });
    } finally {
      emAndamento.current = false;
    }
  }

  // Deixa a tela resetar o estado depois de mostrar um erro, por exemplo.
  function resetar() {
    setResultado({ status: 'idle' });
  }

  return {
    disponivel: nativoDisponivel && !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    resultado,
    promptAsync,
    resetar,
  };
}