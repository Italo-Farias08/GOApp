import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import { useTheme } from '../theme/ThemeContext';

export type PontoRota = { latitude: number; longitude: number };

type Props = {
  coordenadas: PontoRota[];
};

const DURACAO_LOOP_MS = 3200;
const DURACAO_HALO_MS = 1100;
// Nº de paradas intermediárias calculadas entre cada dois pontos reais da
// rota. Com mais passos o pulso "desliza" em vez de pular de ponto em
// ponto quando os pontos da polyline estão longe um do outro — sem precisar
// de nenhum setState por frame (ver comentário mais abaixo).
const PASSOS_POR_TRECHO = 6;

// Distância aproximada (metros) entre dois pontos — projeção equirretangular,
// suficiente pra essa escala (achar posição ao longo da rota na tela).
function distanciaMetros(a: PontoRota, b: PontoRota): number {
  const METROS_POR_GRAU_LAT = 111320;
  const latMedia = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dx = (b.longitude - a.longitude) * METROS_POR_GRAU_LAT * Math.cos(latMedia);
  const dy = (b.latitude - a.latitude) * METROS_POR_GRAU_LAT;
  return Math.hypot(dx, dy);
}

type Trecho = { ponto: PontoRota; duracaoMs: number };

// Converte a lista de pontos da rota numa lista de "trechos" (ponto +
// duração até chegar nele), já subdividida em passos intermediários e com
// a duração de cada passo proporcional à distância percorrida — assim o
// pulso anda em velocidade constante ao longo de toda a rota, não só de
// ponto em ponto original da polyline.
function calcularTrechos(coordenadas: PontoRota[]): Trecho[] {
  if (coordenadas.length < 2) return [];

  const distancias: number[] = [];
  for (let i = 0; i < coordenadas.length - 1; i += 1) {
    distancias.push(distanciaMetros(coordenadas[i], coordenadas[i + 1]));
  }
  const distanciaTotal = distancias.reduce((soma, d) => soma + d, 0) || 1;

  const trechos: Trecho[] = [];
  for (let i = 0; i < coordenadas.length - 1; i += 1) {
    const a = coordenadas[i];
    const b = coordenadas[i + 1];
    const duracaoTrechoMs = (distancias[i] / distanciaTotal) * DURACAO_LOOP_MS;
    const passos = Math.max(1, Math.round(PASSOS_POR_TRECHO * (distancias[i] / distanciaTotal)) || 1);

    for (let passo = 1; passo <= passos; passo += 1) {
      const t = passo / passos;
      trechos.push({
        ponto: {
          latitude: a.latitude + (b.latitude - a.latitude) * t,
          longitude: a.longitude + (b.longitude - a.longitude) * t,
        },
        duracaoMs: duracaoTrechoMs / passos,
      });
    }
  }
  return trechos;
}

// Rota estilo 99/Uber: contorno de contraste (claro no mapa escuro, escuro
// no mapa claro — igual já era feito nas telas) + linha principal sólida
// por cima + um pulso que percorre o trajeto em loop contínuo pra indicar
// o sentido do caminho.
//
// O pulso é movido via `animateMarkerToCoordinate` (método imperativo do
// próprio Marker nativo) em vez de guardar a posição num estado do React
// atualizado a cada frame. A versão anterior usava um Animated.Value com
// useNativeDriver:false + addListener chamando setState ~60x por segundo —
// cada setState re-renderizava o componente, trocava a prop `coordinate`
// do <Marker> e, combinado com tracksViewChanges, forçava o mapa a
// recapturar o bitmap do marcador a cada frame. Isso é o que deixava o
// mapa "pesado"/travando sempre que uma rota estava na tela (praticamente
// o tempo todo: buscando corrida, corrida confirmada, corrida em
// andamento). Com animateMarkerToCoordinate a animação de posição roda
// inteira do lado nativo — zero setState, zero re-render do React por
// frame.
export default function AnimatedRoute({ coordenadas }: Props) {
  const { colors, scheme } = useTheme();
  const escalaHalo = useRef(new Animated.Value(0)).current;
  const marcadorRef = useRef<InstanceType<typeof Marker> | null>(null);

  const trechos = useMemo(() => calcularTrechos(coordenadas), [coordenadas]);
  const pontoInicial = coordenadas.length >= 2 ? coordenadas[0] : null;

  useEffect(() => {
    if (trechos.length === 0) return;

    let ativo = true;
    let indice = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function proximoPasso() {
      if (!ativo) return;
      const trecho = trechos[indice % trechos.length];
      marcadorRef.current?.animateMarkerToCoordinate(trecho.ponto, trecho.duracaoMs);
      indice += 1;
      timeoutId = setTimeout(proximoPasso, trecho.duracaoMs);
    }

    proximoPasso();

    const loopHalo = Animated.loop(
      Animated.timing(escalaHalo, {
        toValue: 1,
        duration: DURACAO_HALO_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loopHalo.start();

    return () => {
      ativo = false;
      if (timeoutId) clearTimeout(timeoutId);
      loopHalo.stop();
      escalaHalo.setValue(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trechos]);

  if (!pontoInicial) return null;

  const escala = escalaHalo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] });
  const opacidade = escalaHalo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <>
      {/* Contorno de contraste — o mesmo padrão que já existia nas telas,
          mantido pra rota continuar "flutuando" sobre ruas da mesma cor. */}
      <Polyline
        coordinates={coordenadas}
        strokeColor={scheme === 'claro' ? 'rgba(255,255,255,0.9)' : 'rgba(8,9,14,0.85)'}
        strokeWidth={8}
        zIndex={1}
      />
      {/* Linha principal, fina e sólida por cima do contorno */}
      <Polyline coordinates={coordenadas} strokeColor={colors.primary} strokeWidth={4} zIndex={2} />
      {/* Pulso animado percorrendo a rota em loop — indica o sentido do
          trajeto. `coordinate` só serve pra posicionar o marcador na
          PRIMEIRA renderização; depois disso quem move ele é
          animateMarkerToCoordinate no ref, então trocar de tema ou
          qualquer outro re-render do componente não faz o pulso "pular"
          de volta pro início. tracksViewChanges continua true só aqui
          (marcador pequeno) porque é o halo pulsando que precisa ser
          recapturado — mas agora é o ÚNICO custo de recaptura da rota,
          sem o re-render em cascata que existia antes. */}
      <Marker
        ref={marcadorRef}
        coordinate={pontoInicial}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges
        zIndex={3}
      >
        <View style={styles.wrapper}>
          <Animated.View
            style={[
              styles.halo,
              { backgroundColor: colors.primary, transform: [{ scale: escala }], opacity: opacidade },
            ]}
          />
          <View
            style={[styles.nucleo, { backgroundColor: colors.primary, borderColor: colors.background }]}
          />
        </View>
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  nucleo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});