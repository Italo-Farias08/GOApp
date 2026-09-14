import { useCallback, useState } from 'react';
import { api } from '../services/api';

export type PontoRota = { latitude: number; longitude: number };

export type ResultadoRota = {
  distanciaKm: number;
  duracaoMin: number;
  coordenadas: PontoRota[];
};

// Distância (em metros) de um ponto até o segmento de reta AB mais próximo —
// usa uma projeção simples em coordenadas planas (equirretangular), precisa
// o bastante pra essa escala (poucas centenas de metros) e muito mais barata
// que geodésia exata.
function distanciaAoSegmentoMetros(ponto: PontoRota, a: PontoRota, b: PontoRota): number {
  const METROS_POR_GRAU_LAT = 111320;
  const latMedia = (a.latitude * Math.PI) / 180;
  const metrosPorGrauLon = METROS_POR_GRAU_LAT * Math.cos(latMedia);

  const px = ponto.longitude * metrosPorGrauLon;
  const py = ponto.latitude * METROS_POR_GRAU_LAT;
  const ax = a.longitude * metrosPorGrauLon;
  const ay = a.latitude * METROS_POR_GRAU_LAT;
  const bx = b.longitude * metrosPorGrauLon;
  const by = b.latitude * METROS_POR_GRAU_LAT;

  const dx = bx - ax;
  const dy = by - ay;
  const comprimentoQuadrado = dx * dx + dy * dy;

  let t = comprimentoQuadrado === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / comprimentoQuadrado;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

// Calcula a menor distância entre um ponto e a rota inteira — dá a "distância
// de desvio" do motorista em relação ao trajeto calculado. Usada pra saber
// se ele saiu da rota (entrou na rua errada, perdeu uma conversão etc.) e
// precisa de um recálculo, sem depender de nada além dos pontos que o OSRM
// já devolveu.
function distanciaAteRotaMetros(ponto: PontoRota, coordenadas: PontoRota[]): number {
  if (coordenadas.length === 0) return Infinity;
  if (coordenadas.length === 1) {
    return distanciaAoSegmentoMetros(ponto, coordenadas[0], coordenadas[0]);
  }

  let menor = Infinity;
  for (let i = 0; i < coordenadas.length - 1; i += 1) {
    const distancia = distanciaAoSegmentoMetros(ponto, coordenadas[i], coordenadas[i + 1]);
    if (distancia < menor) menor = distancia;
  }
  return menor;
}

// Calcula a rota real entre dois pontos chamando o NOSSO backend (que por sua
// vez consulta o OSRM). Antes o app chamava o OSRM direto — mas alguns
// Android têm incompatibilidade de TLS com o servidor público do OSRM
// (SSLHandshakeException dentro do app, mesmo o domínio funcionando normal
// no Chrome), então centralizamos essa chamada no backend, igual já é feito
// com o Google Places em addressService.ts.
export function useRota() {
  const [rota, setRota] = useState<ResultadoRota | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const calcularRota = useCallback(async (origem: PontoRota, destino: PontoRota) => {
    setCarregando(true);
    setErro(null);

    try {
      const { data } = await api.get<ResultadoRota>('/routing/rota', {
        params: {
          origemLat: origem.latitude,
          origemLng: origem.longitude,
          destinoLat: destino.latitude,
          destinoLng: destino.longitude,
        },
      });

      setRota(data);
      return data;
    } catch (err: any) {
      console.error('[useRota] falha ao calcular rota:', err?.message ?? err);
      setErro('Não foi possível calcular a rota agora. Tente novamente.');
      setRota(null);
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  // Quanto (em metros) um ponto está longe da rota atual — null se ainda não
  // tem rota calculada. Usada pra detectar quando o motorista saiu do
  // trajeto (entrou na rua errada) e a rota em tela ficou desatualizada.
  const distanciaAteRota = useCallback(
    (ponto: PontoRota): number | null => {
      if (!rota || rota.coordenadas.length === 0) return null;
      return distanciaAteRotaMetros(ponto, rota.coordenadas);
    },
    [rota]
  );

  function limparRota() {
    setRota(null);
    setErro(null);
  }

  return { rota, carregando, erro, calcularRota, limparRota, distanciaAteRota };
}