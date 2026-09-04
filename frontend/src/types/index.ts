export type DriverStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  driverStatus?: DriverStatus;
  emailVerificado?: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type PhoneLoginPayload = {
  countryCode: string; // ex: "+55"
  phone: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

// Resposta do /auth/register: nunca vem token direto, precisa confirmar o email antes.
export type RegisterResult = {
  needsVerification: true;
  email: string;
};

export type VerifyEmailPayload = {
  email: string;
  code: string;
};

// Edição de credenciais na tela de Conta — todos os campos opcionais
// pra permitir salvar só o que o usuário alterou.
export type UpdateAccountPayload = {
  name?: string;
  email?: string;
  phone?: string;
};

// Dados do formulário "virar motorista"
export type TipoVeiculo = 'carro' | 'moto';

export type DriverApplicationPayload = {
  cnhNumber: string;
  cnhCategory: string;
  vehicleType: TipoVeiculo;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: string;
};

// --- Corridas / tempo real ---

export type PontoCorrida = {
  latitude: number;
  longitude: number;
  endereco?: string;
};

export type MotoristaInfo = {
  id: string;
  nome: string;
  telefone?: string;
  veiculoTipo?: TipoVeiculo;
  veiculoModelo?: string;
  veiculoCor?: string;
  veiculoPlaca?: string;
};

// 'aceita'       -> motorista aceitou e está indo até o passageiro
// 'em_andamento' -> motorista confirmou o embarque, indo até o destino final
export type StatusCorrida = 'procurando' | 'aceita' | 'em_andamento' | 'finalizada' | 'cancelada';

// Quem foi responsável pelo cancelamento — usado pra escolher a mensagem
// certa na tela (ex: "você cancelou" vs "o motorista cancelou").
export type CanceladoPor = 'passageiro' | 'motorista' | 'sistema';

export type Corrida = {
  id: string;
  passageiroId: string;
  motoristaId?: string;
  origem: PontoCorrida;
  destino: PontoCorrida;
  tipoVeiculo: TipoVeiculo;
  preco: number;
  distanciaKm: number;
  duracaoMin: number;
  status: StatusCorrida;
  criadoEm: string;
  embarqueEm?: string;
  canceladoPor?: CanceladoPor;
  motivoCancelamento?: string;
};

// Tipos de navegação — adicionar novas telas aqui conforme o app crescer
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
  Home: undefined;
  DriverHome: undefined;
};
