import { useEffect, useRef, useState } from 'react';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

let configurado = false;
function garantirConfigurado() {
  if (configurado) return;
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
    disponivel: !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    resultado,
    promptAsync,
    resetar,
  };
}