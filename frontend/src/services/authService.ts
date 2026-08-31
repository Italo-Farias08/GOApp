import { api, saveToken, clearToken } from './api';
import type {
  LoginPayload,
  PhoneLoginPayload,
  RegisterPayload,
  UpdateAccountPayload,
  User,
  AuthTokens,
} from '../types';

// Flag simples: enquanto o backend não estiver pronto, usamos respostas mockadas
// pra não travar o desenvolvimento do front. Quando o backend subir, é só trocar pra false
// (ou ligar em uma env var, ex: EXPO_PUBLIC_USE_MOCK_API).
const USE_MOCK = false;

function mockDelay<T>(value: T, ms = 700): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function login(payload: LoginPayload): Promise<User> {
  if (USE_MOCK) {
    if (!payload.email || !payload.password) {
      throw new Error('Preencha email e senha.');
    }
    const fakeUser: User = {
      id: 'mock-user-1',
      name: 'Usuário Teste',
      email: payload.email,
    };
    await saveToken('mock-token-123');
    return mockDelay(fakeUser);
  }

  // Formato esperado do backend: POST /auth/login -> { user, tokens }
  const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
    '/auth/login',
    payload
  );
  await saveToken(data.tokens.accessToken);
  return data.user;
}

export async function loginWithPhone(payload: PhoneLoginPayload): Promise<User> {
  if (USE_MOCK) {
    if (!payload.phone || payload.phone.replace(/\D/g, '').length < 10) {
      throw new Error('Número de celular inválido.');
    }
    if (!payload.password) {
      throw new Error('Informe sua senha.');
    }
    const fakeUser: User = {
      id: 'mock-user-phone',
      name: 'Usuário Teste',
      email: '',
      phone: `${payload.countryCode}${payload.phone}`,
    };
    await saveToken('mock-token-phone-123');
    return mockDelay(fakeUser);
  }

  // Formato esperado do backend: POST /auth/login-phone -> { user, tokens }
  const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
    '/auth/login-phone',
    payload
  );
  await saveToken(data.tokens.accessToken);
  return data.user;
}

export async function register(payload: RegisterPayload): Promise<User> {
  if (USE_MOCK) {
    const fakeUser: User = {
      id: 'mock-user-new',
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
    };
    await saveToken('mock-token-123');
    return mockDelay(fakeUser);
  }

  // Formato esperado do backend: POST /auth/register -> { user, tokens }
  const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
    '/auth/register',
    payload
  );
  await saveToken(data.tokens.accessToken);
  return data.user;
}

export async function fetchMe(): Promise<User> {
  if (USE_MOCK) {
    return mockDelay({
      id: 'mock-user-1',
      name: 'Usuário Teste',
      email: 'teste@goapp.com',
    });
  }

  const { data } = await api.get<User>('/auth/me');
  return data;
}

// Usado na tela de Conta (dentro do modal de configurações) pra editar as
// credenciais do usuário. Ainda não valida nada — só deixa a estrutura pronta
// pro backend entrar depois.
export async function updateAccount(payload: UpdateAccountPayload): Promise<User> {
  if (USE_MOCK) {
    const current: User = {
      id: 'mock-user-1',
      name: 'Usuário Teste',
      email: 'teste@goapp.com',
    };
    const updated: User = {
      ...current,
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.phone ? { phone: payload.phone } : {}),
    };
    return mockDelay(updated);
  }

  // Formato esperado do backend: PUT /auth/me -> { user }
  const { data } = await api.put<{ user: User }>('/auth/me', payload);
  return data.user;
}

export async function logout(): Promise<void> {
  await clearToken();
}