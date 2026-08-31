export type DriverStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  driverStatus?: DriverStatus;
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

// Edição de credenciais na tela de Conta — todos os campos opcionais
// pra permitir salvar só o que o usuário alterou.
export type UpdateAccountPayload = {
  name?: string;
  email?: string;
  phone?: string;
};

// Dados do formulário "virar motorista"
export type DriverApplicationPayload = {
  cnhNumber: string;
  cnhCategory: string;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: string;
};

// Tipos de navegação — adicionar novas telas aqui conforme o app crescer
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};