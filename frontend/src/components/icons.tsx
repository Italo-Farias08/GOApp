import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

// Ícone de carro (visão lateral, estilo outline minimalista).
export function CarIcon({ size = 24, color = '#F5F5F7', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 11 L8 6.6 Q8.5 6 9.2 6 H14.8 Q15.5 6 16 6.6 L18 11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.5 11H20.5A1.5 1.5 0 0 1 22 12.5V15A1.5 1.5 0 0 1 20.5 16.5H3.5A1.5 1.5 0 0 1 2 15V12.5A1.5 1.5 0 0 1 3.5 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="7" cy="16.7" r="1.8" fill={color} />
      <Circle cx="17" cy="16.7" r="1.8" fill={color} />
    </Svg>
  );
}

// Ícone de moto (visão lateral, mesma linguagem visual do carro).
export function MotoIcon({ size = 24, color = '#F5F5F7', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="5.5" cy="17" r="2.8" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="18.5" cy="17" r="2.8" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M5.5 17 H9.2 L11.2 12.3 H15.6 L18.5 17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.2 12.3 L9.6 8.2 H12.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="14" cy="14.6" r="1.5" fill={color} />
    </Svg>
  );
}

// Ícone de configurações (sliders horizontais) — substitui o emoji ⚙️.
export function SettingsIcon({ size = 20, color = '#F5F5F7', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="9" cy="7" r="2.1" fill="#0B0B0F" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="4" y1="13" x2="20" y2="13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="15" cy="13" r="2.1" fill="#0B0B0F" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="4" y1="19" x2="20" y2="19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="11" cy="19" r="2.1" fill="#0B0B0F" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

// Ícone de fechar (X) — substitui o "✕" em texto puro.
export function CloseIcon({ size = 16, color = '#9A9AA5', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// Ícone de check (✓) — usado pra marcar a opção selecionada no modal de corrida.
export function CheckIcon({ size = 14, color = '#0B0B0F', strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12.5 L9.5 18 L20 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}