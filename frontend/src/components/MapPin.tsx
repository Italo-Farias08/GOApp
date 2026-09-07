import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme/theme';

type Props = {
  variant?: 'origem' | 'destino';
};

// Pin customizado pro mapa — substitui o marcador padrão (vermelho, fora do tema)
// por algo consistente com a identidade visual escura + verde neon do app.
export default function MapPin({ variant = 'destino' }: Props) {
  const isOrigem = variant === 'origem';

  // "Você está aqui" ganha um halo pulsando (mesma linguagem visual do
  // radar de "procurando motorista" na tela de corrida) — sinaliza que o
  // ponto é uma posição ao vivo, não um pin estático.
  const pulso = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isOrigem) return;
    pulso.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pulso, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isOrigem]);

  return (
    <View style={styles.wrapper}>
      {isOrigem && (
        <Animated.View
          style={[
            styles.pulso,
            {
              opacity: pulso.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.45, 0.12, 0] }),
              transform: [
                { scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) },
              ],
            },
          ]}
        />
      )}
      <View style={[styles.halo, isOrigem && styles.haloOrigem]} />
      <View style={[styles.nucleo, isOrigem ? styles.nucleoOrigem : styles.nucleoDestino]} />
      {!isOrigem && <View style={styles.haste} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulso: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
  },
  halo: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(57, 255, 106, 0.18)',
  },
  haloOrigem: {
    backgroundColor: 'rgba(57, 255, 106, 0.25)',
  },
  nucleo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: colors.background,
  },
  nucleoOrigem: {
    borderColor: colors.primary,
  },
  nucleoDestino: {
    borderColor: colors.text,
  },
  haste: {
    width: 2,
    height: 10,
    backgroundColor: colors.text,
    marginTop: -1,
  },
});