import { api, saveTokens, clearTokens } from './api';
import type {
  LoginPayload,
  PhoneLoginPayload,
  RegisterPayload,
  RegisterResult,
  VerifyEmailPayload,
  UpdateAccountPayload,
  User,
  AuthTokens,
  ForgotPasswordResult,
  ResetPasswordPayload,
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
    await saveTokens({ accessToken: 'mock-token-123' });
    return mockDelay(fakeUser);
  }

  // Formato esperado do backend: POST /auth/login -> { user, tokens }
  const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
    '/auth/login',
    payload
  );
  await saveTokens(data.tokens);
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
    await saveTokens({ accessToken: 'mock-token-phone-123' });
    return mockDelay(fakeUser);
  }

  // Formato esperado do backend: POST /auth/login-phone -> { user, tokens }
  const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
    '/auth/login-phone',
    payload
  );
  await saveTokens(data.tokens);
  return data.user;
}

// Login com Google: o front já validou o usuário com o próprio Google e só
// manda o id_token pro backend confirmar (assinatura + audience) e criar ou
// achar a conta pelo email — que já vem confirmado, sem precisar do fluxo de
// código por email do cadastro normal.
export async function loginWithGoogle(idToken: string): Promise<User> {
  if (USE_MOCK) {
    const fakeUser: User = {
      id: 'mock-user-google',
      name: 'Usuário Google',
      email: 'usuario@gmail.com',
      emailVerificado: true,
    };
    await saveTokens({ accessToken: 'mock-token-google-123' });
    return mockDelay(fakeUser);
  }

  // Formato esperado do backend: POST /auth/google -> { user, tokens }
  const { data } = await api.post<{ user: User; tokens: AuthTokens }>('/auth/google', {
    idToken,
  });
  await saveTokens(data.tokens);
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
    await saveTokens({ accessToken: 'mock-token-123' });
    return mockDelay(fakeUser);
  }

  const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
    '/auth/verify-email',
    payload
  );
  await saveTokens(data.tokens);
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

// Usado quando o usuário percebe, ainda na tela de verificação, que digitou o
// email errado no cadastro. Troca o email da conta (ainda não verificada) e
// já reenvia o código de 6 dígitos pro endereço correto.
export async function changePendingEmail(email: string, newEmail: string): Promise<RegisterResult> {
  if (USE_MOCK) {
    return mockDelay({ needsVerification: true, email: newEmail }, 400);
  }
  const { data } = await api.post<RegisterResult>('/auth/change-pending-email', { email, newEmail });
  return data;
}

// Pede pro backend gerar e mandar um código de 6 dígitos pro email da conta,
// pra iniciar o fluxo de "Esqueci minha senha".
export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  if (USE_MOCK) {
    return mockDelay({ message: 'Enviamos um código para o seu email.', email }, 400);
  }
  const { data } = await api.post<ForgotPasswordResult>('/auth/forgot-password', { email });
  return data;
}

// Confirma o código recebido por email e já troca a senha na mesma chamada.
// Não loga o usuário automaticamente: por segurança, todas as sessões
// antigas são derrubadas no backend e a pessoa precisa entrar de novo.
export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  if (USE_MOCK) {
    if (payload.code !== '123456') {
      throw new Error('Código inválido.');
    }
    await mockDelay(undefined, 500);
    return;
  }
  await api.post('/auth/reset-password', payload);
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
  await clearTokens();
}

// DELETE /auth/me — o backend confere corrida ativa, pendências e saldo a
// receber antes de apagar (ver autenticacaoControlador.excluirConta); se
// alguma dessas checagens barrar, a API responde 409 com uma mensagem
// pronta pra mostrar na tela.
export async function deleteAccount(): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(undefined, 500);
    return;
  }
  await api.delete('/auth/me');
}