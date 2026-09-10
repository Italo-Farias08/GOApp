import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Fecha o popup/aba do navegador automaticamente quando o Google devolve o
// controle pro app — sem isso a tela do navegador fica aberta parada.
WebBrowser.maybeCompleteAuthSession();

// Endpoints fixos do Google — não precisam de "descoberta" automática
// (autoDiscovery), então evitamos uma requisição extra toda vez que a tela
// de login abre.
const DESCOBERTA_GOOGLE = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// O Google exige um Client ID diferente por plataforma (Android, iOS, Web) —
// mesmo sendo tudo o mesmo app do lado do Google Cloud.
function obterClientId() {
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
}

type ResultadoGoogle =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; idToken: string }
  | { status: 'error'; message: string }
  | { status: 'cancelled' };

// Hook reaproveitável: devolve uma função pra abrir a tela de login do
// Google e o resultado (id_token pronto pra mandar pro backend, ou erro).
export function useGoogleAuth() {
  const clientId = obterClientId();
  const [resultado, setResultado] = useState<ResultadoGoogle>({ status: 'idle' });

  // Guarda a promessa da troca do código pelo token, pra "esperar" ela
  // terminar dentro de promptAsync (ver mais abaixo).
  const trocaEmAndamento = useRef<Promise<void> | null>(null);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'goapp' });

  const [request, response, promptAsyncOriginal] = AuthSession.useAuthRequest(
    {
      clientId: clientId || '',
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      usePKCE: true,
    },
    DESCOBERTA_GOOGLE
  );

  useEffect(() => {
    if (!response) return;

    if (response.type === 'cancel' || response.type === 'dismiss') {
      setResultado({ status: 'cancelled' });
      return;
    }

    if (response.type === 'error') {
      setResultado({
        status: 'error',
        message: response.error?.message || 'Não foi possível entrar com o Google.',
      });
      return;
    }

    if (response.type === 'success') {
      const { code } = response.params;
      const codeVerifier = request?.codeVerifier;

      trocaEmAndamento.current = (async () => {
        try {
          setResultado({ status: 'loading' });
          // Troca o "code" (que só prova que o usuário confirmou o login)
          // pelo id_token de verdade — essa etapa não precisa de client
          // secret porque os clients Android/iOS/Web usados aqui são do
          // tipo "público" (o Google não emite secret pra eles).
          const tokenResponse = await AuthSession.exchangeCodeAsync(
            {
              clientId: clientId || '',
              code,
              redirectUri,
              extraParams: codeVerifier ? { code_verifier: codeVerifier } : undefined,
            },
            DESCOBERTA_GOOGLE
          );

          const idToken = (tokenResponse as any).idToken;
          if (!idToken) {
            throw new Error('O Google não devolveu o id_token esperado.');
          }
          setResultado({ status: 'success', idToken });
        } catch (err: any) {
          setResultado({
            status: 'error',
            message: err?.message || 'Não foi possível concluir o login com o Google.',
          });
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  async function promptAsync() {
    if (!clientId) {
      setResultado({
        status: 'error',
        message: 'Login com Google não configurado (falta o Client ID nessa plataforma).',
      });
      return;
    }
    setResultado({ status: 'loading' });
    await promptAsyncOriginal();
  }

  // Deixa a tela resetar o estado depois de mostrar um erro, por exemplo.
  function resetar() {
    setResultado({ status: 'idle' });
  }

  return {
    disponivel: !!clientId && !!request,
    resultado,
    promptAsync,
    resetar,
  };
}
