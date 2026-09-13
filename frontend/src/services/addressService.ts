import { api } from './api';

export type SugestaoEndereco = {
  id: string;
  placeId: string;
  descricao: string;
};

export type EnderecoResolvido = {
  id: string;
  placeId?: string;
  descricao: string;
  latitude: number;
  longitude: number;
};

export async function buscarSugestoes(
  input: string,
  sessionToken: string,
  coordsUsuario?: { latitude: number; longitude: number } | null
): Promise<SugestaoEndereco[]> {
  const { data } = await api.get<{ sugestoes: SugestaoEndereco[] }>('/addresses/autocomplete', {
    params: {
      input,
      sessiontoken: sessionToken,
      latitude: coordsUsuario?.latitude,
      longitude: coordsUsuario?.longitude,
    },
  });
  return data.sugestoes;
}

// Geocodificação reversa: pega o endereço legível de um ponto (lat/lng).
// Usada pra descobrir o endereço do PONTO DE EMBARQUE (o passageiro só
// escolhe o destino digitando/buscando — o embarque é a localização atual
// dele, que só existe como coordenadas até passar por aqui). Sem isso, o
// motorista recebia a corrida sem saber o endereço de onde buscar o
// passageiro, só a posição no mapa.
export async function buscarEnderecoReverso(
  latitude: number,
  longitude: number
): Promise<{ descricao: string; latitude: number; longitude: number } | null> {
  const { data } = await api.get<{ descricao: string; latitude: number; longitude: number } | null>(
    '/addresses/reverse',
    { params: { latitude, longitude } }
  );
  return data;
}

export async function resolverEndereco(
  placeId: string,
  sessionToken: string
): Promise<EnderecoResolvido> {
  const { data } = await api.get<EnderecoResolvido>('/addresses/details', {
    params: { placeId, sessiontoken: sessionToken },
  });
  return data;
}