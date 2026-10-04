import { useMemo, useRef } from 'react';
import type { PassoRota, PontoRota, ResultadoRota } from './useRota';

export type { PassoRota };

// Navegação "estilo 99/Uber/Waze" em cima da rota que o servidor já calculou.
//
// Em vez de a câmera/seta seguirem o ponto CRU do GPS (que treme, anda pra
// fora da rua e só atualiza de tempos em tempos), este hook "gruda" o
// motorista na rota (map matching simples) e devolve:
//
//  - pontoProjetado   onde ele está EM CIMA da rota (usado pra centrar a câmera)
//  - rumoAFrente      pra que lado a rota segue logo à frente (usado pra girar
//                     a câmera — estável, sem o tremido da bússola)
//  - restante         só o trecho da rota que ainda falta (o já percorrido
//                     some do mapa, como nos apps de navegação)
//  - distanciaRestanteM / duracaoRestanteMin   ETA ao vivo
//  - proximoPasso     próxima curva ("Vire à direita"), e a distância até ela
//
// Se o motorista se afastar da rota (mais de DISTANCIA_MAXIMA_NA_ROTA_M),
// `naRota` fica false e a tela volta a usar o GPS cru — o recálculo por
// desvio (já existente em DriverHomeScreen) cuida de traçar o caminho novo.

type RotaComPassos = ResultadoRota;

export type EstadoNavegacao = {
  naRota: boolean;
  pontoProjetado: PontoRota | null;
  rumoAFrente: number | null;
  restante: PontoRota[];
  distanciaRestanteM: number | null;
  duracaoRestanteMin: number | null;
  proximoPasso: PassoRota | null;
  distanciaProximoPassoM: number | null;
};

const DISTANCIA_MAXIMA_NA_ROTA_M = 40;
// Quanto à frente (em metros) olhamos pra decidir pra onde a câmera aponta.
const LOOKAHEAD_M = 35;
// Só redesenha o início da linha restante quando o motorista andou isso
// (evita atualizar o Polyline nativo a cada leitura de GPS).
const PASSO_REDESENHO_M = 8;
// Janela de busca à frente do último segmento conhecido (em nº de segmentos).
const JANELA_SEGMENTOS = 80;

const METROS_POR_GRAU = 111320;

function paraXY(p: PontoRota, cosLat: number) {
  return { x: p.longitude * METROS_POR_GRAU * cosLat, y: p.latitude * METROS_POR_GRAU };
}

function distanciaM(a: PontoRota, b: PontoRota): number {
  const cosLat = Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  const pa = paraXY(a, cosLat);
  const pb = paraXY(b, cosLat);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

// Rumo (0-360°, 0 = norte, horário) de A até B.
function rumoEntre(a: PontoRota, b: PontoRota): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

type Projecao = { indice: number; t: number; distancia: number; ponto: PontoRota };

// Projeta `p` no segmento i..i+1 da rota.
function projetarNoSegmento(p: PontoRota, a: PontoRota, b: PontoRota) {
  const cosLat = Math.cos((a.latitude * Math.PI) / 180);
  const P = paraXY(p, cosLat);
  const A = paraXY(a, cosLat);
  const B = paraXY(b, cosLat);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const compQuadrado = dx * dx + dy * dy;
  let t = compQuadrado === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / compQuadrado;
  t = Math.max(0, Math.min(1, t));
  return {
    t,
    distancia: Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy)),
    ponto: {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    },
  };
}

function melhorProjecao(
  p: PontoRota,
  coords: PontoRota[],
  de: number,
  ate: number
): Projecao | null {
  let melhor: Projecao | null = null;
  const inicio = Math.max(0, de);
  const fim = Math.min(coords.length - 2, ate);
  for (let i = inicio; i <= fim; i += 1) {
    const r = projetarNoSegmento(p, coords[i], coords[i + 1]);
    if (!melhor || r.distancia < melhor.distancia) {
      melhor = { indice: i, t: r.t, distancia: r.distancia, ponto: r.ponto };
    }
  }
  return melhor;
}

// Distâncias acumuladas (m) ao longo da rota: acumulada[i] = metros do início
// até o vértice i.
export function calcularAcumuladas(coords: PontoRota[]): number[] {
  const acumulada = [0];
  for (let i = 1; i < coords.length; i += 1) {
    acumulada.push(acumulada[i - 1] + distanciaM(coords[i - 1], coords[i]));
  }
  return acumulada;
}

// Quantos metros do início da rota o ponto `p` está (projetando na rota toda).
function progressoDoPonto(p: PontoRota, coords: PontoRota[], acumulada: number[]): number {
  const r = melhorProjecao(p, coords, 0, coords.length - 2);
  if (!r) return 0;
  const compSegmento = acumulada[r.indice + 1] - acumulada[r.indice];
  return acumulada[r.indice] + r.t * compSegmento;
}

// Ponto da rota que fica `metros` à frente de (indice, ponto).
function pontoAFrente(
  coords: PontoRota[],
  acumulada: number[],
  indice: number,
  ponto: PontoRota,
  metros: number
): PontoRota {
  let faltam = metros - distanciaM(ponto, coords[indice + 1]);
  if (faltam <= 0) return coords[indice + 1];
  for (let i = indice + 1; i < coords.length - 1; i += 1) {
    const seg = acumulada[i + 1] - acumulada[i];
    if (faltam <= seg) {
      const t = seg === 0 ? 0 : faltam / seg;
      return {
        latitude: coords[i].latitude + (coords[i + 1].latitude - coords[i].latitude) * t,
        longitude: coords[i].longitude + (coords[i + 1].longitude - coords[i].longitude) * t,
      };
    }
    faltam -= seg;
  }
  return coords[coords.length - 1];
}

const ESTADO_VAZIO: EstadoNavegacao = {
  naRota: false,
  pontoProjetado: null,
  rumoAFrente: null,
  restante: [],
  distanciaRestanteM: null,
  duracaoRestanteMin: null,
  proximoPasso: null,
  distanciaProximoPassoM: null,
};

export function useNavegacaoRota(
  rota: RotaComPassos | null,
  posicao: PontoRota | null,
  ativo: boolean
): EstadoNavegacao {
  const indiceRef = useRef(0);
  const ultimoRestanteRef = useRef<{ rota: RotaComPassos; indice: number; ponto: PontoRota; lista: PontoRota[] } | null>(null);

  // Pré-cálculo por rota (não muda a cada leitura de GPS).
  const preparada = useMemo(() => {
    if (!rota || rota.coordenadas.length < 2) return null;
    indiceRef.current = 0;
    ultimoRestanteRef.current = null;
    const acumulada = calcularAcumuladas(rota.coordenadas);
    const progressoPassos = (rota.passos ?? []).map((p) =>
      progressoDoPonto({ latitude: p.latitude, longitude: p.longitude }, rota.coordenadas, acumulada)
    );
    return { acumulada, total: acumulada[acumulada.length - 1], progressoPassos };
  }, [rota]);

  return useMemo(() => {
    if (!ativo || !rota || !preparada || !posicao) return ESTADO_VAZIO;
    const { coordenadas } = rota;
    const { acumulada, total, progressoPassos } = preparada;

    // 1) Busca perto do último segmento conhecido (o motorista só avança);
    //    se não achar nada perto, olha a rota inteira (ex.: rota que faz
    //    "laço" ou GPS que ficou um tempo sem atualizar).
    const base = indiceRef.current;
    let proj = melhorProjecao(posicao, coordenadas, base - 2, base + JANELA_SEGMENTOS);
    if (!proj || proj.distancia > DISTANCIA_MAXIMA_NA_ROTA_M) {
      proj = melhorProjecao(posicao, coordenadas, 0, coordenadas.length - 2);
    }
    if (!proj || proj.distancia > DISTANCIA_MAXIMA_NA_ROTA_M) {
      return { ...ESTADO_VAZIO };
    }
    indiceRef.current = proj.indice;

    const progressoM =
      acumulada[proj.indice] + proj.t * (acumulada[proj.indice + 1] - acumulada[proj.indice]);
    const restanteM = Math.max(total - progressoM, 0);

    // 2) Rumo: do ponto atual até ~35 m à frente na rota.
    const alvo = pontoAFrente(coordenadas, acumulada, proj.indice, proj.ponto, LOOKAHEAD_M);
    const rumoAFrente =
      distanciaM(proj.ponto, alvo) > 1 ? rumoEntre(proj.ponto, alvo) : null;

    // 3) Linha restante (reaproveita a lista anterior enquanto o motorista
    //    não andou o suficiente pra valer um redesenho).
    let lista: PontoRota[];
    const ult = ultimoRestanteRef.current;
    if (
      ult &&
      ult.rota === rota &&
      ult.indice === proj.indice &&
      distanciaM(ult.ponto, proj.ponto) < PASSO_REDESENHO_M
    ) {
      lista = ult.lista;
    } else {
      lista = [proj.ponto, ...coordenadas.slice(proj.indice + 1)];
      ultimoRestanteRef.current = { rota, indice: proj.indice, ponto: proj.ponto, lista };
    }

    // 4) Próxima curva: primeiro passo (ignorando o "depart" do começo) cuja
    //    manobra ainda está à frente do motorista.
    let proximoPasso: PassoRota | null = null;
    let distanciaProximoPassoM: number | null = null;
    const passos = rota.passos ?? [];
    for (let i = 0; i < passos.length; i += 1) {
      if (passos[i].tipo === 'depart') continue;
      const faltaM = progressoPassos[i] - progressoM;
      if (faltaM > 8) {
        proximoPasso = passos[i];
        distanciaProximoPassoM = faltaM;
        break;
      }
    }

    return {
      naRota: true,
      pontoProjetado: proj.ponto,
      rumoAFrente,
      restante: lista,
      distanciaRestanteM: restanteM,
      duracaoRestanteMin: total > 0 ? rota.duracaoMin * (restanteM / total) : rota.duracaoMin,
      proximoPasso,
      distanciaProximoPassoM,
    };
  }, [ativo, rota, preparada, posicao?.latitude, posicao?.longitude]);
}