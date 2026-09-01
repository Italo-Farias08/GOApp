import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/theme';

type Props = {
  variant?: 'origem' | 'destino';
};

// Pin customizado pro mapa — substitui o marcador padrão (vermelho, fora do tema)
// por algo consistente com a identidade visual escura + verde neon do app.
export default function MapPin({ variant = 'destino' }: Props) {
  const isOrigem = variant === 'origem';

  return (
    <View style={styles.wrapper}>
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