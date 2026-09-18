export const DARK_MAP_STYLE = [
  // Fundo mais escuro que antes — é essa distância de tom em relação à cor
  // das ruas (bem mais clara agora, ver `road` abaixo) que faz a malha
  // viária ficar legível. Antes as duas cores quase se encostavam.
  { elementType: 'geometry', stylers: [{ color: '#181a24' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8d93a6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0e14' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  // Nomes de comércio (mercado, loja, restaurante...) escondidos — deixa só
  // parques e estações de transporte, que ajudam de fato a se orientar.
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#20222e' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b7189' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#182119' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#454b66' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a2d3f' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a3a8ba' }],
  },
  // Arteriais (avenidas) um degrau acima da rua comum na hierarquia visual.
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#525970' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#6b7094' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a2d3f' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#20222e' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0a0e1a' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4b5173' }],
  },
];

// Mesma ideia do estilo escuro acima, só que com a paleta clara — pro mapa
// não ficar "com uma cara" diferente do resto do app quando o modo claro
// tá ativo (ver theme/ThemeContext.tsx). Segue a mesma estrutura, feature
// por feature, só trocando as cores pra tons claros/pastel.
export const LIGHT_MAP_STYLE = [
  // Base um pouco mais escura (era quase idêntica ao branco das ruas —
  // mesmo problema do tema escuro, só que invertido).
  { elementType: 'geometry', stylers: [{ color: '#e7e7ec' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7189' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#dedee5' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8d93a6' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#cfe6cf' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#c7c7d1' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b7189' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#fdf6e3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#f5cf7d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e0b968' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#dedee5' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#bcd7ec' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7a8699' }],
  },
];