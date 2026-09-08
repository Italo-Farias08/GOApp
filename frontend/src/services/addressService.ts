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

export async function resolverEndereco(
  placeId: string,
  sessionToken: string
): Promise<EnderecoResolvido> {
  const { data } = await api.get<EnderecoResolvido>('/addresses/details', {
    params: { placeId, sessiontoken: sessionToken },
  });
  return data;
}
