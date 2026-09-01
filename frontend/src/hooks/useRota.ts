import { useCallback, useState } from 'react';

export type PontoRota = { latitude: number; longitude: number };

export type ResultadoRota = {
  distanciaKm: number;
  duracaoMin: number;
  coordenadas: PontoRota[];
};

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

// Calcula a rota real entre dois pontos usando o OSRM (Open Source Routing Machine)
// público — mesma filosofia do Nominatim no useAddressSearch: funciona sem precisar
// de chave de API. Pra produção com volume alto, considerar hospedar uma instância
// própria do OSRM ou trocar pela Google Directions API.
export function useRota() {
  const [rota, setRota] = useState<ResultadoRota | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const calcularRota = useCallback(async (origem: PontoRota, destino: PontoRota) => {
    setCarregando(true);
    setErro(null);

    try {
      const url =
        `${OSRM_URL}/${origem.longitude},${origem.latitude};` +
        `${destino.longitude},${destino.latitude}?overview=full&geometries=geojson`;

      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error('Falha ao calcular rota');

      const dados = await resposta.json();
      if (dados.code !== 'Ok' || !dados.routes?.length) {
        throw new Error('Rota não encontrada');
      }

      const rotaPrincipal = dados.routes[0];
      const coordenadas: PontoRota[] = rotaPrincipal.geometry.coordinates.map(
        ([longitude, latitude]: [number, number]) => ({ latitude, longitude })
      );

      const resultado: ResultadoRota = {
        distanciaKm: rotaPrincipal.distance / 1000,
        duracaoMin: rotaPrincipal.duration / 60,
        coordenadas,
      };

      setRota(resultado);
      return resultado;
    } catch (err: any) {
      setErro('Não foi possível calcular a rota agora. Tente novamente.');
      setRota(null);
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  function limparRota() {
    setRota(null);
    setErro(null);
  }

  return { rota, carregando, erro, calcularRota, limparRota };
}