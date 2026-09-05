import { api } from './api';
import type { TipoVeiculo } from '../utils/precoCorrida';
import type { Corrida, HistoricoCorridaItem, MensagemChat, MotoristaInfo, PontoCorrida } from '../types';

type CriarCorridaPayload = {
  origem: PontoCorrida;
  destino: PontoCorrida;
  tipoVeiculo: TipoVeiculo;
  preco: number;
  distanciaKm: number;
  duracaoMin: number;
};

export async function criarCorrida(payload: CriarCorridaPayload): Promise<Corrida> {
  const { data } = await api.post<Corrida>('/rides', payload);
  return data;
}

export async function buscarCorrida(id: string): Promise<Corrida> {
  const { data } = await api.get<Corrida>(`/rides/${id}`);
  return data;
}

// Corrida ativa do passageiro logado (procurando/aceita/em andamento), se
// existir. Usado ao abrir a Home pra RETOMAR o estado da tela em vez de só
// falhar com 409 quando já existe uma corrida em aberto.
export async function buscarCorridaAtiva(): Promise<{ corrida: Corrida; motorista?: MotoristaInfo } | null> {
  const { data } = await api.get<{ corrida: Corrida; motorista?: MotoristaInfo } | null>('/rides');
  return data;
}

export async function aceitarCorrida(
  id: string
): Promise<{ corrida: Corrida; motorista: MotoristaInfo }> {
  const { data } = await api.post(`/rides/${id}/accept`);
  return data;
}

// Motorista confirma que pegou o passageiro no ponto de embarque — a partir
// daqui a corrida vira "em_andamento" e o mapa passa a guiar até o destino.
export async function embarcarCorrida(id: string): Promise<Corrida> {
  const { data } = await api.post<Corrida>(`/rides/${id}/pickup`);
  return data;
}

export async function cancelarCorrida(id: string, motivo?: string): Promise<Corrida> {
  const { data } = await api.post<Corrida>(`/rides/${id}/cancel`, { motivo });
  return data;
}

export async function finalizarCorrida(id: string): Promise<Corrida> {
  const { data } = await api.post<Corrida>(`/rides/${id}/finish`);
  return data;
}

// Histórico do chat da corrida — usado pra carregar as mensagens já
// trocadas ao abrir a tela de conversa (o socket sozinho só entrega
// mensagens novas a partir de quando conecta).
export async function listarMensagens(id: string): Promise<MensagemChat[]> {
  const { data } = await api.get<MensagemChat[]>(`/rides/${id}/messages`);
  return data;
}

// Manda uma mensagem por REST em vez de socket — funciona mesmo com a
// corrida já encerrada, ao contrário do evento "chat:mensagem" (que só
// entrega enquanto a corrida está ativa). Usado pela tela de "Mensagens"
// das configurações, pra falar com o motorista de uma viagem que já acabou.
export async function enviarMensagemCorrida(id: string, texto: string): Promise<MensagemChat> {
  const { data } = await api.post<MensagemChat>(`/rides/${id}/messages`, { texto });
  return data;
}

// Corridas já encerradas que tiveram motorista atribuído, com os dados dele
// — alimenta a lista da tela "Mensagens".
export async function listarHistoricoCorridas(): Promise<HistoricoCorridaItem[]> {
  const { data } = await api.get<HistoricoCorridaItem[]>('/rides/history');
  return data;
}