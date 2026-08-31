import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Troque essa URL quando o backend estiver no ar.
// Pode também vir de variável de ambiente (EXPO_PUBLIC_API_URL) via app.config.js.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'go_access_token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Injeta o token salvo em toda requisição autenticada
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Ponto único para tratar erro 401 (token expirado) no futuro:
// deslogar o usuário, tentar refresh token, etc.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      // TODO: disparar logout global / navegação pra tela de Login
    }
    return Promise.reject(error);
  }
);

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
