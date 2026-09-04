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
