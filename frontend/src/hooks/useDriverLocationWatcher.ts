import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

type Coords = { latitude: number; longitude: number };

// Assim como o useCurrentLocation, mas fica observando a posição continuamente
// (watchPositionAsync) em vez de pegar só uma vez — necessário pro motorista,
// já que a localização dele precisa ser atualizada ao vivo enquanto dirige.
export function useDriverLocationWatcher(ativo: boolean) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const assinaturaRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!ativo) {
      assinaturaRef.current?.remove();
      assinaturaRef.current = null;
      return;
    }

    let cancelado = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelado) setErrorMessage('Permissão de localização negada.');
        return;
      }

      assinaturaRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 15 },
        (posicao) => {
          if (cancelado) return;
          setCoords({
            latitude: posicao.coords.latitude,
            longitude: posicao.coords.longitude,
          });
        }
      );
    })();

    return () => {
      cancelado = true;
      assinaturaRef.current?.remove();
      assinaturaRef.current = null;
    };
  }, [ativo]);

  return { coords, errorMessage };
}
