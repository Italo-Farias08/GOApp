import { api } from './api';
import type { PagamentoPix, PontoCorrida, ResumoPendencias } from '../types';
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

// --- Pendências (tela "Pendências" nas configurações) ---

// Lista as pendências do passageiro logado — corridas anteriores que ele
// ficou devendo — e o total delas somado.
export async function listarDividas(): Promise<ResumoPendencias> {
  const { data } = await api.get<ResumoPendencias>('/payments/dividas');
  return data;
}

// Gera a cobrança Pix pelo total das pendências. Uma vez aprovado (ver
// consultarPagamentoPix, que também serve pra esse tipo de pagamento), o
// backend quita todas as dívidas incluídas sozinho.
export async function criarPagamentoPixDivida(): Promise<PagamentoPix> {
  const { data } = await api.post<PagamentoPix>('/payments/pix-divida');
  return data;
}