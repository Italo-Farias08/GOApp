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

// Resumo do dia do motorista logado — corridas finalizadas hoje e quanto ele
// lucrou nelas. Alimenta o "Painel do Motoboy" nas configurações do app.
export type ResumoMotoboyHoje = {
  corridasHoje: number;
  valorHoje: number;
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

// 'dinheiro'    -> paga em espécie direto com o motorista
// 'pix'         -> combina o Pix direto com o motorista (chave na hora)
// 'pix_prepago' -> paga por QR code ANTES da corrida ser despachada
export type FormaPagamento = 'dinheiro' | 'pix' | 'pix_prepago';

// Pagamento da corrida em si (separado do status da corrida) — uma corrida
// pode estar "finalizada" e mesmo assim continuar 'nao_pago', se o
// motorista marcou que o passageiro não pagou.
export type StatusPagamentoCorrida = 'pendente' | 'pago' | 'nao_pago';

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
  formaPagamento: FormaPagamento;
  status: StatusCorrida;
  statusPagamento: StatusPagamentoCorrida;
  pagoEm?: string;
  // Tarifa desta corrida sem nenhuma dívida de corrida anterior embutida.
  precoOriginal: number;
  // Valor de dívida antiga (de uma corrida não paga) que foi somado ao
  // `preco` desta corrida — 0 quando não há nenhuma dívida pendente.
  dividaAplicada: number;
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

// Item da lista de "Mensagens" nas configurações — uma corrida já encerrada
// (finalizada ou cancelada) junto com quem foi o motorista dela, pra o
// passageiro poder reabrir a conversa e mandar um recado mesmo depois que a
// viagem já acabou (ex: esqueceu algo no carro).
export type HistoricoCorridaItem = {
  corrida: Corrida;
  motorista: {
    id: string;
    nome: string;
    avatarUrl?: string;
  };
};

// Espelho de HistoricoCorridaItem pro lado do motorista: mesma ideia, só que
// traz os dados do PASSAGEIRO em vez do motorista — alimenta a tela
// "Mensagens" do app do motorista.
export type HistoricoCorridaMotoristaItem = {
  corrida: Corrida;
  passageiro: {
    id: string;
    nome: string;
    avatarUrl?: string;
  };
};

// --- Pagamento Pix pré-pago ---

export type StatusPagamentoPix = 'pendente' | 'aprovado' | 'recusado' | 'expirado';

export type PagamentoPix = {
  id: string;
  status: StatusPagamentoPix;
  valor: number;
  qrCode: string; // código "copia e cola"
  qrCodeBase64: string; // imagem do QR code (PNG em base64)
  // 'prepago'  -> gerado ANTES da corrida existir (tela do passageiro);
  //               corridaId só vem preenchido quando status === 'aprovado'.
  // 'pos_pago' -> gerado pelo motorista ao FINALIZAR a corrida; corridaId
  //               já vem preenchido desde a criação.
  tipo: 'prepago' | 'pos_pago';
  corridaId?: string;
  expiraEm: string;
};

// Tipos de navegação — adicionar novas telas aqui conforme o app crescer
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
  Home: undefined;
  DriverHome: undefined;
  MotoboyPanel: undefined;
};