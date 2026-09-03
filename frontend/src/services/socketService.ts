import { io, Socket } from 'socket.io-client';
import { getToken, API_BASE_URL } from './api';

let soquete: Socket | null = null;

// Conecta (ou reaproveita a conexão já aberta) o socket autenticado com o
// mesmo token JWT usado nas chamadas REST.
export async function conectarSoquete(): Promise<Socket> {
  if (soquete?.connected) return soquete;

  const token = await getToken();
  soquete = io(API_BASE_URL, {
    auth: { token },
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
