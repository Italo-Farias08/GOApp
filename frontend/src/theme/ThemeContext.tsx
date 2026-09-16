import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { darkColors, lightColors, type ColorScheme, type ThemeColors } from './theme';

const CHAVE_TEMA = 'go_tema_preferencia';

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: ThemeColors;
  // true enquanto ainda não terminou de ler a preferência salva — evita um
  // "flash" trocando de tema logo que o app abre.
  carregando: boolean;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Fica em volta do app inteiro (ver App.tsx) e decide, pra cada componente
// que chamar `useTheme()`, se as cores são as do tema escuro ou claro. A
// preferência escolhida na tela de Configurações fica salva no dispositivo
// (SecureStore, igual o token de login) — assim que o app abre de novo, já
// nasce no tema certo.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>('escuro');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    SecureStore.getItemAsync(CHAVE_TEMA)
      .then((salvo) => {
        if (ativo && (salvo === 'claro' || salvo === 'escuro')) {
          setSchemeState(salvo);
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function setScheme(novo: ColorScheme) {
    setSchemeState(novo);
    SecureStore.setItemAsync(CHAVE_TEMA, novo).catch(() => {
      // Não conseguir salvar a preferência não é motivo pra travar a troca
      // de tema na tela — só significa que na próxima abertura do app ele
      // volta pro padrão.
    });
  }

  function toggleScheme() {
    setScheme(scheme === 'escuro' ? 'claro' : 'escuro');
  }

  const valor = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: scheme === 'claro' ? lightColors : darkColors,
      carregando,
      setScheme,
      toggleScheme,
    }),
    [scheme, carregando]
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const contexto = useContext(ThemeContext);
  if (!contexto) {
    throw new Error('useTheme precisa ser usado dentro de um <ThemeProvider>.');
  }
  return contexto;
}
