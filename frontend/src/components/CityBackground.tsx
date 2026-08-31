import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/theme';

// Horizonte de prédios estilizado + estrada com brilho neon, tudo em SVG.
// Sem depender de nenhuma imagem — fácil de ajustar mexendo nos valores abaixo.

const BUILDINGS = [
  { x: 0, w: 26, h: 70 },
  { x: 24, w: 18, h: 110 },
  { x: 40, w: 30, h: 60 },
  { x: 68, w: 22, h: 140 },
  { x: 88, w: 16, h: 90 },
  { x: 102, w: 26, h: 120 },
  { x: 126, w: 20, h: 75 },
  { x: 144, w: 34, h: 150 },
  { x: 176, w: 18, h: 95 },
  { x: 192, w: 24, h: 65 },
  { x: 214, w: 20, h: 130 },
  { x: 232, w: 30, h: 85 },
  { x: 260, w: 18, h: 115 },
  { x: 276, w: 26, h: 70 },
  { x: 300, w: 22, h: 145 },
  { x: 320, w: 18, h: 90 },
  { x: 336, w: 30, h: 65 },
  { x: 364, w: 20, h: 105 },
  { x: 382, w: 18, h: 75 },
];

export default function CityBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width="100%" height={220} viewBox="0 0 400 220" preserveAspectRatio="none">
        {/* Lua */}
        <Circle cx={350} cy={30} r={12} fill="#2A3A66" opacity={0.7} />

        {/* Prédios */}
        {BUILDINGS.map((b, i) => (
          <Rect
            key={i}
            x={b.x}
            y={220 - b.h}
            width={b.w}
            height={b.h}
            fill="#101733"
            opacity={0.9}
          />
        ))}

        {/* Estrada com brilho (camada larga e transparente = "glow") */}
        <Path
          d="M -10 210 Q 100 190 200 205 T 410 195"
          stroke={colors.primary}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
          opacity={0.18}
        />
        {/* Estrada (linha nítida por cima) */}
        <Path
          d="M -10 210 Q 100 190 200 205 T 410 195"
          stroke={colors.primary}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          opacity={0.9}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});