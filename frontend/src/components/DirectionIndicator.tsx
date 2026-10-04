import React from 'react';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  size?: number;
  // 'facho': pontinho + leque suave esmaecendo nas bordas — bom pra
  // indicar "pra que lado você está olhando" sobre um mapa parado/norte
  // pra cima (uso original, no HomeScreen do passageiro).
  //
  // 'seta': seta sólida, cheia, com contorno de contraste — pensada pro
  // modo navegação do motorista (mapa já girado na direção do rumo, ver
  // DriverHomeScreen). Ali o "facho" suave é fácil de perder de vista
  // olhando rápido pro celular guiando; a seta cheia é o padrão que
  // Google Maps/Waze usam nesse mesmo cenário — mais fácil de identificar
  // num relance porque tem uma forma nítida em vez de um gradiente.
  variant?: 'facho' | 'seta';
};

// Indicador de "pra que lado você está virado".
//
// A rotação é feita por FORA (transform: rotate() na View pai — ver
// UserDirectionIndicator.tsx); aqui é só o desenho, sempre apontando "pra
// cima" antes da rotação.
export default function DirectionIndicator({ size = 60, variant = 'facho' }: Props) {
  const { colors } = useTheme();

  if (variant === 'seta') {
    return (
      <Svg width={size} height={size} viewBox="0 0 60 60">
        {/* Halo atrás da seta — garante contraste em cima de qualquer cor
            de mapa por baixo (rua clara, parque verde, água azul etc.),
            do mesmo jeito que o "pontinho" do facho já tinha sua própria
            borda de contraste. */}
        <Circle cx="30" cy="32" r="19" fill={colors.background} opacity={0.55} />

        {/* Seta cheia: ponta em cima, "cauda" recortada embaixo (forma de
            avião de papel/bússola) — silhueta reconhecível mesmo pequena,
            ao contrário de um triângulo simples que pode parecer só uma
            mancha em baixa resolução. */}
        <Path
          d="M30 10 L47 46 L30 38 L13 46 Z"
          fill={colors.primary}
          stroke={colors.background}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

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