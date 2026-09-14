import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

type LocationState = {
  coords: { latitude: number; longitude: number } | null;
  // Rumo/direção pra onde o aparelho está apontado (0° = norte, sentido
  // horário). Vem do sensor de bússola do celular via watchHeadingAsync,
  // então acompanha o usuário girando no lugar (o "360") mesmo parado,
  // e não só quando ele anda.
  heading: number | null;
  isLoading: boolean;
  errorMessage: string | null;
};

// Hook: pede permissão e mantém a localização (e o rumo/bússola) do usuário
// sempre atualizados.
//
// ANTES este hook usava getCurrentPositionAsync, que faz UMA leitura só e
// nunca mais atualiza — por isso o app "não notava" quando a pessoa andava
// pra outro lugar ou girava (o marcador "Você está aqui" e a região do mapa
// ficavam congelados na primeira posição capturada). Agora ele assina
// watchPositionAsync (posição contínua) + watchHeadingAsync (bússola
// contínua), do mesmo jeito que o useDriverLocationWatcher já fazia pro
// motorista.
export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({
    coords: null,
    heading: null,
    isLoading: true,
    errorMessage: null,
  });

  const posicaoSubRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelado) {
            setState({
              coords: null,
              heading: null,
              isLoading: false,
              errorMessage: 'Permissão de localização negada.',
            });
          }
          return;
        }

        // Posição contínua: atualiza sempre que o usuário anda pra outro
        // lugar (ou a cada ~4s), não só uma vez ao abrir a tela.
        posicaoSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 5 },
          (posicao) => {
            if (cancelado) return;
            setState((atual) => ({
              ...atual,
              coords: {
                latitude: posicao.coords.latitude,
                longitude: posicao.coords.longitude,
              },
              isLoading: false,
              errorMessage: null,
            }));
          }
        );

        // Rumo/bússola contínuo: atualiza quando o usuário gira no lugar
        // (o "360"), independente de ele estar se deslocando ou não.
        headingSubRef.current = await Location.watchHeadingAsync((evento) => {
          if (cancelado) return;
          const rumo = evento.trueHeading >= 0 ? evento.trueHeading : evento.magHeading;
          setState((atual) => ({ ...atual, heading: rumo }));
        });
      } catch (err: any) {
        if (!cancelado) {
          setState({
            coords: null,
            heading: null,
            isLoading: false,
            errorMessage: err?.message ?? 'Não foi possível obter sua localização.',
          });
        }
      }
    })();

    return () => {
      cancelado = true;
      posicaoSubRef.current?.remove();
      posicaoSubRef.current = null;
      headingSubRef.current?.remove();
      headingSubRef.current = null;
    };
  }, []);

  return state;
}