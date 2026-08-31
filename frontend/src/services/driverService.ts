import { api } from './api';
import type { DriverApplicationPayload, DriverStatus } from '../types';

// Mesmo esquema do authService: enquanto o backend não existe, mockamos a
// resposta pra não travar o front. Trocar pra false (ou ligar em env var)
// quando as rotas de motorista estiverem no ar.
const USE_MOCK = false;

function mockDelay<T>(value: T, ms = 900): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Cliente cadastrado envia os dados pra virar motorista do app.
export async function applyToBeDriver(
  payload: DriverApplicationPayload
): Promise<{ status: DriverStatus }> {
  if (USE_MOCK) {
    if (!payload.cnhNumber || !payload.vehiclePlate) {
      throw new Error('Preencha ao menos a CNH e a placa do veículo.');
    }
    return mockDelay({ status: 'pending' as DriverStatus });
  }

  // Formato esperado do backend: POST /driver/apply -> { status }
  // (o backend deve validar CNH/placa e disparar a análise do cadastro)
  const { data } = await api.post<{ status: DriverStatus }>('/driver/apply', payload);
  return data;
}

// Consulta o status atual do cadastro de motorista do usuário logado.
export async function fetchDriverStatus(): Promise<DriverStatus> {
  if (USE_MOCK) {
    return mockDelay<DriverStatus>('none');
  }

  // Formato esperado do backend: GET /driver/status -> { status }
  const { data } = await api.get<{ status: DriverStatus }>('/driver/status');
  return data.status;
}