import { api } from './api';
import type { TipoVeiculo } from '../utils/precoCorrida';
import type { Corrida, MotoristaInfo, PontoCorrida } from '../types';

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