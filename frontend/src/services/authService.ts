import { api, saveToken, clearToken } from './api';
import type {
  LoginPayload,
  PhoneLoginPayload,
  RegisterPayload,
  RegisterResult,
  VerifyEmailPayload,
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

// Cadastro nunca loga direto: o backend manda um código de 6 dígitos por email
// e só libera o token depois que esse código é confirmado (ver verifyEmail abaixo).
export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  if (USE_MOCK) {
    return mockDelay({ needsVerification: true, email: payload.email });
  }

  // Formato esperado do backend: POST /auth/register -> { needsVerification, email }
  const { data } = await api.post<RegisterResult>('/auth/register', payload);
  return data;
}

// Confirma o código enviado por email e, se estiver certo, já retorna o usuário logado.
export async function verifyEmail(payload: VerifyEmailPayload): Promise<User> {
  if (USE_MOCK) {
    if (payload.code !== '123456') {
      throw new Error('Código inválido.');
    }
    const fakeUser: User = {
      id: 'mock-user-new',
      name: 'Usuário Teste',
      email: payload.email,
      emailVerificado: true,
    };
    await saveToken('mock-token-123');
    return mockDelay(fakeUser);
  }

  const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
    '/auth/verify-email',
    payload
  );
  await saveToken(data.tokens.accessToken);
  return data.user;
}

// Pede pro backend gerar e mandar um novo código (ex: o usuário deixou expirar).
export async function resendCode(email: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(undefined, 400);
    return;
  }
  await api.post('/auth/resend-code', { email });
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