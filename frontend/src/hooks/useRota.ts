import { useCallback, useState } from 'react';
import { api } from '../services/api';

export type PontoRota = { latitude: number; longitude: number };

export type ResultadoRota = {
  distanciaKm: number;
  duracaoMin: number;
  coordenadas: PontoRota[];
};

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

  function limparRota() {
    setRota(null);
    setErro(null);
  }

  return { rota, carregando, erro, calcularRota, limparRota };
}