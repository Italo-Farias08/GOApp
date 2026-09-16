import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
// Precisa ser importado aqui (fora de qualquer componente) pra registrar o
// TaskManager.defineTask assim que o bundle carrega — inclusive quando o SO
// "acorda" o app só pra rodar a tarefa em segundo plano, sem montar
// nenhuma tela. Ver src/services/backgroundLocationTask.ts.
import './src/services/backgroundLocationTask';

// Separado do `App` só porque precisa estar DENTRO do <ThemeProvider> pra
// poder chamar `useTheme()` e decidir o estilo da StatusBar (ícones claros
// no tema escuro, escuros no tema claro).
function AppConteudo() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'claro' ? 'dark' : 'light'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppConteudo />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}