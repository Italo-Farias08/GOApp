import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

type LocationState = {
  coords: { latitude: number; longitude: number } | null;
  isLoading: boolean;
  errorMessage: string | null;
};

// Hook simples: pede permissão e devolve a localização atual do usuário.
// Reaproveitável em qualquer tela que precise da posição (Home, corrida em andamento, etc).
export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({
    coords: null,
    isLoading: true,
    errorMessage: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setState({
            coords: null,
            isLoading: false,
            errorMessage: 'Permissão de localização negada.',
          });
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setState({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          isLoading: false,
          errorMessage: null,
        });
      } catch (err: any) {
        setState({
          coords: null,
          isLoading: false,
          errorMessage: err?.message ?? 'Não foi possível obter sua localização.',
        });
      }
    })();
  }, []);

  return state;
}