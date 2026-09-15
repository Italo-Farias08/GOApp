import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';

// ATIVA O MAGNETÔMETRO NO ANDROID (bússola de verdade, sem o bug do
// watchHeadingAsync nesse SO). Só funciona DEPOIS de gerar um novo
// development build com expo-sensors incluído — este app usa um dev build
// customizado (Google Sign-In nativo, expo-task-manager etc.), então o
// módulo nativo só existe depois de rebuildar. Passo a passo ANTES de subir
// esse código pro celular (senão dá o mesmo erro "Cannot find native
// module" de antes):
//   1. rode `npx expo install expo-sensors`
//   2. gere um novo build: `eas build --profile development --platform android`
//      (ou `npx expo run:android`, se tiver o Android Studio configurado local)
//   3. reinstale o APK gerado no aparelho — só depois disso rode o app com
//      este arquivo
const USAR_MAGNETOMETRO_NO_ANDROID = true;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Magnetometer = USAR_MAGNETOMETRO_NO_ANDROID
  ? require('expo-sensors/build/Magnetometer').default
  : null;

// Converte a leitura bruta do magnetômetro (eixos x/y) num ângulo de rumo
// (0-360°, 0 = norte, sentido horário) — mesma convenção usada pelo
// watchHeadingAsync do expo-location no iOS. O offset (+90) pode precisar
// de ajuste fino dependendo do aparelho — teste girando o celular e
// comparando com uma bússola real.
function anguloDoMagnetometro({ x, y }: { x: number; y: number }): number {
  let angulo = Math.atan2(y, x) * (180 / Math.PI);
  angulo = angulo + 90;
  if (angulo < 0) angulo += 360;
  return angulo;
}

type LocationState = {
  coords: { latitude: number; longitude: number } | null;
  // Rumo/direção pra onde o aparelho está apontado (0° = norte, sentido
  // horário). No iOS vem do watchHeadingAsync (funciona bem nesse SO). No
  // Android, watchHeadingAsync tem um histórico real de não emitir NENHUM
  // evento em vários aparelhos — não é questão de calibração, é bug na
  // implementação nativa dele — por isso a opção de trocar pelo
  // magnetômetro cru via USAR_MAGNETOMETRO_NO_ANDROID acima.
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
// watchPositionAsync (posição contínua) + heading contínuo, do mesmo jeito
// que o useDriverLocationWatcher já fazia pro motorista.
export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({
    coords: null,
    heading: null,
    isLoading: true,
    errorMessage: null,
  });

  const posicaoSubRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const magnetometroSubRef = useRef<{ remove: () => void } | null>(null);

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

        if (Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync();
          } catch {
            // Se o usuário recusar ligar o GPS aqui, seguimos mesmo assim.
          }
        }

        // Posição contínua: atualiza sempre que o usuário anda pra outro
        // lugar (ou a cada ~4s), não só uma vez ao abrir a tela.
        posicaoSubRef.current = await Location.watchPositionAsync(
          {
            accuracy:
              Platform.OS === 'android'
                ? Location.Accuracy.BestForNavigation
                : Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 5,
          },
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

        // Rumo/bússola contínuo.
        if (Platform.OS === 'android' && USAR_MAGNETOMETRO_NO_ANDROID && Magnetometer) {
          Magnetometer.setUpdateInterval(150);
          magnetometroSubRef.current = Magnetometer.addListener((dados: { x: number; y: number }) => {
            if (cancelado) return;
            setState((atual) => ({ ...atual, heading: anguloDoMagnetometro(dados) }));
          });
        } else {
          headingSubRef.current = await Location.watchHeadingAsync((evento) => {
            if (cancelado) return;
            const rumo = evento.trueHeading >= 0 ? evento.trueHeading : evento.magHeading;
            setState((atual) => ({ ...atual, heading: rumo }));
          });
        }
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
      magnetometroSubRef.current?.remove();
      magnetometroSubRef.current = null;
    };
  }, []);

  return state;
}