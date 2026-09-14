import React from 'react';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../theme/theme';

type Props = {
  size?: number;
};

// Indicador de "pra que lado você está virado", no estilo do próprio
// Google Maps/Waze: um pontinho sólido (sua posição) com um "facho" largo
// e suave atrás dele, esmaecendo nas bordas — em vez de uma seta com
// pontas duras. É a referência que você mandou.
//
// A rotação é feita por FORA (transform: rotate() na View pai, em
// HomeScreen.tsx); aqui é só o desenho, sempre apontando "pra cima".
export default function DirectionIndicator({ size = 60 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Defs>
        {/* Esmaece de dentro (perto do pontinho) pra fora (ponta do facho) */}
        <RadialGradient id="facho" cx="30" cy="30" r="26" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.55} />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Facho largo (leque), abertura de ~100°, borda externa arredondada */}
      <Path
        d="M30 30 L10.5 13.5 A26 26 0 0 1 49.5 13.5 Z"
        fill="url(#facho)"
      />

      {/* Pontinho sólido — sua posição exata */}
      <Circle cx="30" cy="30" r="9" fill={colors.primary} stroke={colors.background} strokeWidth={3} />
    </Svg>
  );
}