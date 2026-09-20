
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0d' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#84858c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  // Nada de ícone/nome de comércio — só o essencial pra se orientar.
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0e130f' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#28282d' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#19191c' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7d7e85' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#3a3a41' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#55555f' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1c1c1f' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#c4c4cc' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d3d45' }],
  },
];

// Estilo claro: bem mais "cheio" de detalhe, tipo o mapa do 99 de dia —
// fundo quente (não branco puro), quarteirão e comércio visíveis com
// ícones pequenos, avenidas e vias principais num tom amarelo/laranja
// (a cor histórica de táxi que o 99 herda), água e parques bem marcados.
export const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f4f1ea' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#63666f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  // Comércio de volta (com ícone pequeno) — é esse tipo de detalhe que dá
  // a sensação de mapa "vivo" tipo 99/Uber, em vez de um mapa genérico.
  {
    featureType: 'poi.business',
    elementType: 'geometry',
    stylers: [{ color: '#ece6d8' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#ece6d8' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8d8f78' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#c8e6c9' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e0d9c5' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b6d5e' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#fff3d6' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#ffc93c' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e8a90f' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5c4a06' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#ece6d8' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#a9dcf5' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4f8aa8' }],
  },
];