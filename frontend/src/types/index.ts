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

// Cadastro completo do motorista já aprovado — usado no painel "Motorista"
// pra mostrar e editar os dados do veículo/CNH.
export type DriverProfile = {
  status: DriverStatus;
  cnhNumber: string;
  cnhCategory: string;
  vehicleType: TipoVeiculo;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: string;
};

// Edição do veículo/CNH — todos os campos opcionais, só manda o que mudou.
export type VehicleUpdatePayload = Partial<DriverApplicationPayload>;

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
  avatarUrl?: string;
  veiculoTipo?: TipoVeiculo;
  veiculoModelo?: string;
  veiculoCor?: string;
  veiculoPlaca?: string;
  veiculoAno?: string;
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
  // Só vem preenchido na resposta de aceitar a corrida — é o único momento
  // em que o motorista precisa saber o nome do passageiro (pra identificar
  // quem é quem no chat).
  passageiroNome?: string;
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

// --- Chat da corrida ---

export type MensagemChat = {
  id: string;
  corridaId: string;
  remetenteId: string;
  texto: string;
  criadoEm: string;
};

// Tipos de navegação — adicionar novas telas aqui conforme o app crescer
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
  Home: undefined;
  DriverHome: undefined;
};