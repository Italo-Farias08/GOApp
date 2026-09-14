import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  definirCorridaAtivaParaSegundoPlano,
  iniciarRastreamentoSegundoPlano,
  pararRastreamentoSegundoPlano,
} from '../services/backgroundLocationTask';

type Coords = { latitude: number; longitude: number };

// Distância mínima (em metros) que o motorista precisa ter percorrido entre
// duas leituras de GPS pra calcularmos o rumo por conta própria — sem esse
// piso, pequenas variações de precisão do GPS com o veículo PARADO fariam a
// seta de direção "tremer" girando pra qualquer lado à toa.
const DISTANCIA_MINIMA_PARA_RUMO_METROS = 5;

// Bearing (0-360°, 0 = norte, sentido horário) do ponto A até o ponto B —
// mesma fórmula usada em HomeScreen.tsx pra girar o carrinho do motorista
// na tela do passageiro.
function calcularRumo(anterior: Coords, atual: Coords): number {
  const lat1 = (anterior.latitude * Math.PI) / 180;
  const lat2 = (atual.latitude * Math.PI) / 180;
  const deltaLon = ((atual.longitude - anterior.longitude) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const rumoGraus = (Math.atan2(y, x) * 180) / Math.PI;
  return (rumoGraus + 360) % 360;
}

// Distância em metros entre dois pontos (fórmula de Haversine).
function distanciaMetros(a: Coords, b: Coords): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Assim como o useCurrentLocation, mas fica observando a posição continuamente
// (watchPositionAsync) em vez de pegar só uma vez — necessário pro motorista,
// já que a localização dele precisa ser atualizada ao vivo enquanto dirige.
//
// Além da posição, agora também expõe o RUMO (heading): pra que lado o
// motorista está de fato virado/se movendo (0° = norte, 90° = leste, e assim
// por diante). Isso é o que permite o app girar a setinha do motorista no
// mapa — sem isso, o app não tinha nenhuma noção de "pra que lado ele tá
// indo", só a posição isolada.
export function useDriverLocationWatcher(ativo: boolean, corridaId: string | null = null) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const assinaturaRef = useRef<Location.LocationSubscription | null>(null);
  // Assinatura da bússola do aparelho (magnetômetro) — cobre o caso do
  // motorista PARADO (ex.: esperando corrida, sinal fechado) e simplesmente
  // girando o carro/corpo no lugar. Antes, o rumo só era recalculado a
  // partir de duas posições de GPS OU do heading de GPS quando a velocidade
  // passava de 0.5 m/s — ou seja, girando parado ("dar um 360") a setinha
  // do motorista não se mexia, porque nenhuma dessas duas fontes dispara
  // sem deslocamento.
  const bussolaRef = useRef<Location.LocationSubscription | null>(null);
  const posicaoAnteriorRef = useRef<Coords | null>(null);
  const velocidadeAtualRef = useRef(0);

  // Mantém a tarefa de segundo plano sabendo qual corrida está ativa agora,
  // pra que o POST feito de dentro do TaskManager (backgroundLocationTask)
  // saiba pra qual corrida repassar a localização — sem depender do socket
  // nem de nenhum estado de componente React estar vivo naquele momento.
  useEffect(() => {
    definirCorridaAtivaParaSegundoPlano(corridaId);
  }, [corridaId]);

  // Liga/desliga o rastreamento em SEGUNDO PLANO junto com o mesmo `ativo`
  // que controla o watcher em primeiro plano logo abaixo. É esse
  // rastreamento (via expo-task-manager + serviço em primeiro plano no
  // Android) que continua entregando localização — e mantendo o processo
  // vivo, então o socket também não cai — quando o motorista minimiza o
  // app ou trava a tela. Sem isso, watchPositionAsync sozinho para assim
  // que o app perde o foco.
  useEffect(() => {
    if (!ativo) {
      pararRastreamentoSegundoPlano();
      return;
    }
    iniciarRastreamentoSegundoPlano().then((concedida) => {
      if (!concedida) {
        setErrorMessage(
          'Ative a localização "Permitir sempre" pro #GO nas configurações do aparelho pra continuar recebendo corridas com o app minimizado ou a tela travada.'
        );
      }
    });
  }, [ativo]);

  useEffect(() => {
    if (!ativo) {
      assinaturaRef.current?.remove();
      assinaturaRef.current = null;
      bussolaRef.current?.remove();
      bussolaRef.current = null;
      posicaoAnteriorRef.current = null;
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

          const novaPosicao: Coords = {
            latitude: posicao.coords.latitude,
            longitude: posicao.coords.longitude,
          };
          setCoords(novaPosicao);
          velocidadeAtualRef.current = posicao.coords.speed ?? 0;
          const rumoDoAparelho = posicao.coords.heading;
          if (rumoDoAparelho != null && rumoDoAparelho >= 0 && (posicao.coords.speed ?? 0) > 0.5) {
            setHeading(rumoDoAparelho);
          } else {
            const anterior = posicaoAnteriorRef.current;
            if (anterior && distanciaMetros(anterior, novaPosicao) >= DISTANCIA_MINIMA_PARA_RUMO_METROS) {
              setHeading(calcularRumo(anterior, novaPosicao));
            }
          }
          posicaoAnteriorRef.current = novaPosicao;
        }
      );

      // Bússola: só usamos essa leitura pra girar a setinha quando o
      // motorista está parado (sem velocidade relevante) — em movimento, o
      // rumo do GPS/bearing entre pontos é mais confiável que o
      // magnetômetro (que sofre interferência do metal do carro).
      bussolaRef.current = await Location.watchHeadingAsync((evento) => {
        if (cancelado) return;
        if (velocidadeAtualRef.current > 0.5) return;
        const rumo = evento.trueHeading >= 0 ? evento.trueHeading : evento.magHeading;
        setHeading(rumo);
      });
    })();

    return () => {
      cancelado = true;
      assinaturaRef.current?.remove();
      assinaturaRef.current = null;
      bussolaRef.current?.remove();
      bussolaRef.current = null;
      posicaoAnteriorRef.current = null;
    };
  }, [ativo]);

  return { coords, heading, errorMessage };
}