import { io, Socket } from 'socket.io-client';
import { getToken, API_BASE_URL } from './api';

let soquete: Socket | null = null;

// Conecta (ou reaproveita a conexão já aberta) o socket autenticado com o
// mesmo token JWT usado nas chamadas REST.
//
// `auth` é passado como FUNÇÃO (não um objeto fixo) de propósito: o
// socket.io chama essa função de novo a cada tentativa de conexão,
// inclusive nas reconexões automáticas (rede caiu, app voltou de segundo
// plano). Como o access token agora dura pouco (ver JWT_EXPIRA_EM no
// backend), um objeto fixo reenviaria sempre o token capturado na primeira
// conexão — já vencido — e toda reconexão cairia de novo por token
// inválido.
export async function conectarSoquete(): Promise<Socket> {
  if (soquete?.connected) return soquete;

  if (soquete) {
    soquete.connect();
    return soquete;
  }

  soquete = io(API_BASE_URL, {
    auth: async (callback) => {
      const token = await getToken();
      callback({ token });
    },
    transports: ['websocket'],
    reconnection: true,
  });

  return soquete;
}

export function obterSoquete(): Socket | null {
  return soquete;
}

export function desconectarSoquete() {
  soquete?.disconnect();
  soquete = null;
}