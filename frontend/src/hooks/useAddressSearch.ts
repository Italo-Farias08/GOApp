import { useEffect, useRef, useState } from 'react';

export type EnderecoSugerido = {
  id: string;
  descricao: string;
  latitude: number;
  longitude: number;
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Busca endereços reais via OpenStreetMap Nominatim (sem precisar de chave de API).
// Para produção com volume alto, revisar a política de uso do Nominatim
// (https://operations.osmfoundation.org/policies/nominatim/) e considerar
// trocar pelo Google Places Autocomplete quando tiver uma googleMapsApiKey real.
export function useAddressSearch(
  termo: string,
  coordsUsuario?: { latitude: number; longitude: number } | null
) {
  const [sugestoes, setSugestoes] = useState<EnderecoSugerido[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const termoLimpo = termo.trim();
    if (termoLimpo.length < 3) {
      setSugestoes([]);
      setBuscando(false);
      setErro(null);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setBuscando(true);
      setErro(null);

      try {
        const params = new URLSearchParams({
          q: termoLimpo,
          format: 'json',
          addressdetails: '0',
          limit: '5',
        });

        // Prioriza resultados perto de onde o usuário está agora, se souber.
        if (coordsUsuario) {
          const delta = 0.5; // ~50km de raio de prioridade
          params.set(
            'viewbox',
            [
              coordsUsuario.longitude - delta,
              coordsUsuario.latitude + delta,
              coordsUsuario.longitude + delta,
              coordsUsuario.latitude - delta,
            ].join(',')
          );
          params.set('bounded', '0');
        }

        const resposta = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
          signal: controller.signal,
          headers: {
            // Nominatim exige um User-Agent identificável pra uso não-comercial.
            'User-Agent': 'GOApp/1.0 (contato@seudominio.com)',
          },
        });

        if (!resposta.ok) throw new Error('Falha na busca');

        const dados = await resposta.json();

        setSugestoes(
          dados.map((item: any) => ({
            id: String(item.place_id),
            descricao: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
          }))
        );
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setErro('Não foi possível buscar endereços agora.');
          setSugestoes([]);
        }
      } finally {
        setBuscando(false);
      }
    }, 400);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [termo, coordsUsuario]);

  return { sugestoes, buscando, erro };
}