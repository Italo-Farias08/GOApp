import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
// Precisa ser importado aqui (fora de qualquer componente) pra registrar o
// TaskManager.defineTask assim que o bundle carrega — inclusive quando o SO
// "acorda" o app só pra rodar a tarefa em segundo plano, sem montar
// nenhuma tela. Ver src/services/backgroundLocationTask.ts.
import './src/services/backgroundLocationTask';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}