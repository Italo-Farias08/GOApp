import { useEffect, useRef, useState } from 'react';
import * as addressService from '../services/addressService';
import type { EnderecoResolvido, SugestaoEndereco } from '../services/addressService';

export type { SugestaoEndereco, EnderecoResolvido };

// Mantido com esse nome por compatibilidade com quem já importava daqui
// (ex: HomeScreen.tsx) — é o endereço já RESOLVIDO, com coordenadas.
export type EnderecoSugerido = EnderecoResolvido;

// Gera um token de sessão simples (não precisa ser criptograficamente
// seguro, só único o bastante pra agrupar autocomplete + details no Google
// como UMA sessão pra fins de cobrança).
function gerarSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Busca endereços via Google Places (Autocomplete), passando pelo NOSSO
// backend — a chave da Google fica só lá, nunca no app. Foi trocado do
// Nominatim (OpenStreetMap) pro Google porque o Nominatim não encontrava
// ruas e lugares mais específicos.
export function useAddressSearch(
  termo: string,
  coordsUsuario?: { latitude: number; longitude: number } | null
) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Um token novo por "sessão de busca": nasce quando o campo fica vazio e
  // se mantém até o usuário escolher uma sugestão (ou limpar tudo de novo).
  const sessionTokenRef = useRef<string>(gerarSessionToken());

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const termoLimpo = termo.trim();
    if (termoLimpo.length < 3) {
      setSugestoes([]);
      setBuscando(false);
      setErro(null);
      if (termoLimpo.length === 0) {
        // Campo zerado = fim (ou início) de uma sessão de busca.
        sessionTokenRef.current = gerarSessionToken();
      }
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setBuscando(true);
      setErro(null);

      try {
        const resultado = await addressService.buscarSugestoes(
          termoLimpo,
          sessionTokenRef.current,
          coordsUsuario
        );
        setSugestoes(resultado);
      } catch (err) {
        setErro('Não foi possível buscar endereços agora.');
        setSugestoes([]);
      } finally {
        setBuscando(false);
      }
    }, 400);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [termo, coordsUsuario]);

  // Chamado só quando o usuário TOCA numa sugestão — resolve o place_id pra
  // latitude/longitude reais e encerra a sessão de busca atual.
  async function resolverDestino(sugestao: SugestaoEndereco): Promise<EnderecoResolvido | null> {
    setResolvendo(true);
    try {
      const resolvido = await addressService.resolverEndereco(
        sugestao.placeId,
        sessionTokenRef.current
      );
      return resolvido;
    } catch {
      setErro('Não foi possível obter esse endereço.');
      return null;
    } finally {
      setResolvendo(false);
      sessionTokenRef.current = gerarSessionToken();
    }
  }

  return { sugestoes, buscando, erro, resolvendo, resolverDestino };
}
