// Tema do #GO — fundo escuro estilo "corrida noturna" + verde "sinal aberto" como cor de ação.
// Tudo centralizado aqui: pra trocar a identidade visual do app, mexe só neste arquivo.

export const colors = {
  background: '#0B0B0F',      // preto grafite (fundo principal)
  surface: '#16161D',         // cards, inputs, containers
  surfaceAlt: '#1F1F29',      // hover / pressed states
  border: '#2A2A35',

  primary: '#39FF6A',         // verde neon "GO" — botões e ações principais
  primaryPressed: '#2ED95C',

  text: '#F5F5F7',
  textSecondary: '#9A9AA5',
  textMuted: '#5C5C66',

  danger: '#FF4D4D',
  warning: '#FFB020',
  success: '#39FF6A',

  overlay: 'rgba(0,0,0,0.6)',
};

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
