import { api } from './api';
import type { DriverApplicationPayload, DriverProfile, DriverStatus, VehicleUpdatePayload } from '../types';

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

// Busca o cadastro completo (veículo + CNH) do motorista logado — usado no
// painel "Motorista" pra pré-preencher o formulário de edição.
export async function fetchMyDriverProfile(): Promise<DriverProfile> {
  if (USE_MOCK) {
    return mockDelay<DriverProfile>({
      status: 'approved',
      cnhNumber: '00000000000',
      cnhCategory: 'B',
      vehicleType: 'carro',
      vehiclePlate: 'ABC1D23',
      vehicleModel: 'Onix',
      vehicleColor: 'Prata',
      vehicleYear: '2020',
    });
  }

  // Formato esperado do backend: GET /driver/me -> DriverProfile
  const { data } = await api.get<DriverProfile>('/driver/me');
  return data;
}

// Motorista já aprovado edita os dados do próprio veículo/CNH.
export async function updateVehicle(payload: VehicleUpdatePayload): Promise<DriverProfile> {
  if (USE_MOCK) {
    return mockDelay<DriverProfile>({
      status: 'approved',
      cnhNumber: payload.cnhNumber ?? '00000000000',
      cnhCategory: payload.cnhCategory ?? 'B',
      vehicleType: payload.vehicleType ?? 'carro',
      vehiclePlate: payload.vehiclePlate ?? 'ABC1D23',
      vehicleModel: payload.vehicleModel ?? 'Onix',
      vehicleColor: payload.vehicleColor ?? 'Prata',
      vehicleYear: payload.vehicleYear ?? '2020',
    });
  }

  // Formato esperado do backend: PUT /driver/vehicle -> DriverProfile
  const { data } = await api.put<DriverProfile>('/driver/vehicle', payload);
  return data;
}