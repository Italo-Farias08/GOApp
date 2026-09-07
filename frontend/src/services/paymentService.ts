import { api } from './api';
import type { PagamentoPix, PontoCorrida } from '../types';
import type { TipoVeiculo } from '../utils/precoCorrida';

type CriarPagamentoPixPayload = {
  origem: PontoCorrida;
  destino: PontoCorrida;
  tipoVeiculo: TipoVeiculo;
  preco: number;
  distanciaKm: number;
  duracaoMin: number;
};

// Gera a cobrança Pix no Mercado Pago (com o QR code pronto pra mostrar) —
// a corrida ainda NÃO existe nesse momento, só é criada de fato depois que
// o pagamento é confirmado (ver consultarPagamentoPix).
export async function criarPagamentoPix(payload: CriarPagamentoPixPayload): Promise<PagamentoPix> {
  const { data } = await api.post<PagamentoPix>('/payments/pix', payload);
  return data;
}

// Usado no polling enquanto o QR code está na tela — quando `status` vier
// 'aprovado', `corridaId` já vem preenchido e a corrida já foi despachada
// pros motoristas.
export async function consultarPagamentoPix(id: string): Promise<PagamentoPix> {
  const { data } = await api.get<PagamentoPix>(`/payments/pix/${id}`);
  return data;
}