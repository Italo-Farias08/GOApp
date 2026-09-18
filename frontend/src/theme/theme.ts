

export const darkColors = {
  background: '#0B0B0F',      // preto grafite (fundo principal)
  surface: '#16161D',         // cards, inputs, containers
  surfaceAlt: '#1F1F29',      // hover / pressed states
  border: '#2A2A35',

  primary: '#39FF6A',         // verde neon "GO" — botões e ações principais
  primaryPressed: '#2ED95C',
  onPrimary: '#0B0B0F',       // texto/ícone em cima de um fundo `primary`

  text: '#F5F5F7',
  textSecondary: '#9A9AA5',
  textMuted: '#5C5C66',

  danger: '#FF4D4D',
  warning: '#FFB020',
  success: '#39FF6A',

  overlay: 'rgba(0,0,0,0.6)',
};

export const lightColors = {
  background: '#2c2a2a',      // branco levemente acinzentado
  surface: '#111010',         // cards, inputs, containers
  surfaceAlt: '#1b1a1a',      // hover / pressed states
  border: '#141415',

  primary: '#1FAE4D',         // mesmo verde "GO", ajustado pra ter contraste
  primaryPressed: '#178F3F',  // no fundo claro (o neon puro "estoura" no claro)
  onPrimary: '#FFFFFF',       // texto/ícone em cima de um fundo `primary`

  text: '#f5f5f5',
  textSecondary: '#5C5C66',
  textMuted: '#9A9AA5',

  danger: '#D93636',
  warning: '#B5750E',
  success: '#1FAE4D',

  overlay: 'rgba(0,0,0,0.4)',
};

export type ThemeColors = typeof darkColors;
export type ColorScheme = 'escuro' | 'claro';

// Mantido por compatibilidade com qualquer import antigo de `colors` —
// sempre o escuro (era o único tema antes). Prefira `useTheme().colors`
// pra pegar a cor certa do tema atual.
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const },
  h2: { fontSize: 24, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  button: { fontSize: 16, fontWeight: '700' as const },
};

const theme = { colors, spacing, radius, typography };
export default theme;
