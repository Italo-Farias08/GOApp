import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Troque essa URL quando o backend estiver no ar.
// Pode também vir de variável de ambiente (EXPO_PUBLIC_API_URL) via app.config.js.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'go_access_token';
const REFRESH_TOKEN_KEY = 'go_refresh_token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Injeta o token salvo em toda requisição autenticada
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Chamado quando a sessão não dá mais pra salvar (refresh falhou ou nunca
// existiu refresh token salvo). Quem registra isso é o AuthContext — ver
// AuthContext.tsx — que desloga o usuário e avisa na tela. Sem esse gancho
// o app só apagava o token localmente e ficava num estado quebrado, sem
// nunca voltar pra tela de login nem explicar o motivo.
let aoExpirarSessao: (() => void) | null = null;
export function registrarAoExpirarSessao(callback: () => void) {
  aoExpirarSessao = callback;
}

// Evita disparar várias renovações em paralelo quando mais de uma chamada
// cai com 401 ao mesmo tempo — todas esperam a MESMA promise de refresh em
// vez de cada uma tentar a sua (o que geraria refresh tokens rotacionando
// em corrida e derrubando um ao outro).
let promiseRenovacao: Promise<string | null> | null = null;

async function renovarSessao(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    // Usa axios "puro" (não a instância `api`) pra essa chamada não passar
    // pelos próprios interceptors de novo.
    const { data } = await axios.post<{ tokens: { accessToken: string; refreshToken: string } }>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken }
    );
    await saveTokens(data.tokens);
    return data.tokens.accessToken;
  } catch {
    return null;
  }
}

// Ponto único que trata erro 401 (token expirado): tenta renovar a sessão
// nos bastidores e repetir a requisição original — o usuário só percebe
// alguma coisa se o refresh token também já tiver vencido/sido revogado.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requisicaoOriginal = error?.config;
    const éErroDeAutenticacao = error?.response?.status === 401;
    // Nunca tenta renovar a própria chamada de /auth/refresh (senão entra
    // em loop infinito se o refresh também voltar 401).
    const éRotaDeRefresh = requisicaoOriginal?.url?.includes('/auth/refresh');

    if (
      éErroDeAutenticacao &&
      !éRotaDeRefresh &&
      requisicaoOriginal &&
      !requisicaoOriginal._jaTentouRenovar
    ) {
      requisicaoOriginal._jaTentouRenovar = true;

      if (!promiseRenovacao) {
        promiseRenovacao = renovarSessao().finally(() => {
          promiseRenovacao = null;
        });
      }

      const novoAccessToken = await promiseRenovacao;

      if (novoAccessToken) {
        requisicaoOriginal.headers.Authorization = `Bearer ${novoAccessToken}`;
        return api(requisicaoOriginal);
      }

      // Refresh falhou de vez — não tem mais jeito de salvar a sessão sem
      // pedir login de novo.
      await clearTokens();
      aoExpirarSessao?.();
    }

    return Promise.reject(error);
  }
);

export async function saveTokens(tokens: { accessToken: string; refreshToken?: string }) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function getToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}