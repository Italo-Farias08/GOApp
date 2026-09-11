import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken } from '../services/api';
import * as authService from '../services/authService';
import { configurarNotificacoesPush } from '../services/notificacaoPushService';
import type {
  DriverStatus,
  LoginPayload,
  PhoneLoginPayload,
  RegisterPayload,
  RegisterResult,
  UpdateAccountPayload,
  User,
} from '../types';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // true quando falta nome, email ou telefone no perfil — acontece sobretudo
  // com quem entrou pelo Google, que nunca passa pela tela de Cadastro (onde
  // o telefone é coletado). Enquanto isso for true, o app não deve deixar a
  // pessoa chamar uma corrida.
  precisaCompletarCadastro: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  signInWithPhone: (payload: PhoneLoginPayload) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<RegisterResult>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  changePendingEmail: (email: string, newEmail: string) => Promise<RegisterResult>;
  signOut: () => Promise<void>;
  updateAccount: (payload: UpdateAccountPayload) => Promise<void>;
  updateDriverStatus: (status: DriverStatus) => void;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const precisaCompletarCadastro =
    !!user && (!user.name?.trim() || !user.email?.trim() || !user.phone?.trim());

  // Ao abrir o app, verifica se já existe um token salvo (mantém o usuário logado)
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await authService.fetchMe();
          setUser(me);
          // Fire-and-forget: garante que o token de push continua atualizado
          // mesmo quando o usuário já estava logado (não passou por
          // signIn/signInWithGoogle nesta sessão do app).
          configurarNotificacoesPush();
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function signIn(payload: LoginPayload) {
    setError(null);
    try {
      const loggedUser = await authService.login(payload);
      setUser(loggedUser);
      configurarNotificacoesPush();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Erro ao entrar.');
      throw err;
    }
  }

  async function signInWithPhone(payload: PhoneLoginPayload) {
    setError(null);
    try {
      const loggedUser = await authService.loginWithPhone(payload);
      setUser(loggedUser);
      configurarNotificacoesPush();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Erro ao entrar.');
      throw err;
    }
  }

  async function signInWithGoogle(idToken: string) {
    setError(null);
    try {
      const loggedUser = await authService.loginWithGoogle(idToken);
      setUser(loggedUser);
      configurarNotificacoesPush();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Erro ao entrar com Google.');
      throw err;
    }
  }

  // Não loga o usuário aqui: só dispara o código por email e devolve o email
  // pra tela de Cadastro navegar pra tela de verificação.
  async function signUp(payload: RegisterPayload) {
    setError(null);
    try {
      return await authService.register(payload);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Erro ao cadastrar.');
      throw err;
    }
  }

  async function verifyEmail(email: string, code: string) {
    setError(null);
    try {
      const verifiedUser = await authService.verifyEmail({ email, code });
      setUser(verifiedUser);
      configurarNotificacoesPush();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Código inválido.');
      throw err;
    }
  }

  async function resendCode(email: string) {
    setError(null);
    try {
      await authService.resendCode(email);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Não foi possível reenviar o código.');
      throw err;
    }
  }

  async function changePendingEmail(email: string, newEmail: string) {
    setError(null);
    try {
      return await authService.changePendingEmail(email, newEmail);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Não foi possível trocar o email.');
      throw err;
    }
  }

  async function signOut() {
    await authService.logout();
    setUser(null);
  }

  // Chamado pela tela de Conta (dentro do modal de configurações).
  // Ainda não valida nada — só deixa a estrutura pronta pro backend.
  async function updateAccount(payload: UpdateAccountPayload) {
    setError(null);
    try {
      const updated = await authService.updateAccount(payload);
      setUser((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Erro ao atualizar conta.');
      throw err;
    }
  }

  // Atualiza localmente o status de motorista depois que o cadastro é enviado
  // (a chamada de fato pro backend fica em src/services/driverService.ts).
  function updateDriverStatus(status: DriverStatus) {
    setUser((prev) => (prev ? { ...prev, driverStatus: status } : prev));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        precisaCompletarCadastro,
        signIn,
        signInWithPhone,
        signInWithGoogle,
        signUp,
        verifyEmail,
        resendCode,
        changePendingEmail,
        signOut,
        updateAccount,
        updateDriverStatus,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return ctx;
}