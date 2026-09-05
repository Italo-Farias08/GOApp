
export type TipoVeiculo = 'carro' | 'moto';

type Tarifa = {
  bandeirada: number; 
  porKm: number; 
  porMinuto: number; 
  minimo: number; 
};

const TARIFAS: Record<TipoVeiculo, Tarifa> = {
  carro: { bandeirada: 2.5, porKm: 1.9, porMinuto: 0.1, minimo: 7.10 },
  moto: { bandeirada: 2, porKm: 1.2, porMinuto: 0.08, minimo: 4.30 },
};

type FaixaHorario = {
  inicio: number;
  fim: number; 
  multiplicador: number; 
  label: string; 
};

const FAIXAS_HORARIO: FaixaHorario[] = [
  { inicio: 6, fim: 9, multiplicador: 1.2, label: 'Tarifa de pico (manhã)' },
  { inicio: 17, fim: 20, multiplicador: 1.3, label: 'Tarifa de pico (fim de tarde)' },
  { inicio: 22, fim: 5, multiplicador: 1.25, label: 'Tarifa noturna' },
];

function obterFaixaHorario(hora: number): { multiplicador: number; label: string | null } {
  for (const faixa of FAIXAS_HORARIO) {
    const dentroDaFaixa =
      faixa.inicio <= faixa.fim
        ? hora >= faixa.inicio && hora < faixa.fim // faixa normal, ex: 6h-9h
        : hora >= faixa.inicio || hora < faixa.fim; // faixa que cruza a meia-noite, ex: 22h-5h

    if (dentroDaFaixa) return { multiplicador: faixa.multiplicador, label: faixa.label };
  }
  return { multiplicador: 1, label: null };
}

export type EstimativaCorrida = {
  tipo: TipoVeiculo;
  preco: number;
  distanciaKm: number;
  duracaoMin: number;
  multiplicadorHorario: number;
  labelHorario: string | null;
};

export function calcularPreco(
  distanciaKm: number,
  duracaoMin: number,
  tipo: TipoVeiculo,
  hora: number = new Date().getHours()
): number {
  const tarifa = TARIFAS[tipo];
  const { multiplicador } = obterFaixaHorario(hora);

  const precoBase = tarifa.bandeirada + distanciaKm * tarifa.porKm + duracaoMin * tarifa.porMinuto;
  const precoComHorario = precoBase * multiplicador;

  return Math.max(precoComHorario, tarifa.minimo);
}

export function gerarEstimativas(
  distanciaKm: number,
  duracaoMin: number,
  hora: number = new Date().getHours()
): EstimativaCorrida[] {
  const { multiplicador, label } = obterFaixaHorario(hora);

  return (Object.keys(TARIFAS) as TipoVeiculo[]).map((tipo) => ({
    tipo,
    preco: calcularPreco(distanciaKm, duracaoMin, tipo, hora),
    distanciaKm,
    duracaoMin,
    multiplicadorHorario: multiplicador,
    labelHorario: label,
  }));
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDistancia(distanciaKm: number): string {
  if (distanciaKm < 1) return `${Math.round(distanciaKm * 1000)} m`;
  return `${distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

export function formatarDuracao(duracaoMin: number): string {
  const minutos = Math.round(duracaoMin);
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 ? `${horas} h ${resto} min` : `${horas} h`;
}