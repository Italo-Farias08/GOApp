// Chama o OSRM (Open Source Routing Machine) público a partir do BACKEND,
// não do app. Alguns servidores Android/OkHttp têm incompatibilidade de TLS
// com o servidor de demonstração do OSRM (funciona no Chrome, mas falha com
// SSLHandshakeException dentro de apps React Native) — rodando pelo Node
// isso não acontece, então o app passa a falar só com o NOSSO backend, igual
// já faz com o Google Places.

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

async function calcularRota({ origemLat, origemLng, destinoLat, destinoLng }) {
  const url =
    `${OSRM_URL}/${origemLng},${origemLat};${destinoLng},${destinoLat}` +
    '?overview=full&geometries=geojson';

  const resposta = await fetch(url);
  if (!resposta.ok) {
    const erro = new Error(`Falha ao calcular rota (HTTP ${resposta.status}).`);
    erro.statusCode = 502;
    throw erro;
  }

  const dados = await resposta.json();
  if (dados.code !== 'Ok' || !dados.routes?.length) {
    const erro = new Error(`Rota não encontrada (code: ${dados.code}).`);
    erro.statusCode = 422;
    throw erro;
  }

  const rotaPrincipal = dados.routes[0];
  const coordenadas = rotaPrincipal.geometry.coordinates.map(
    ([longitude, latitude]) => ({ latitude, longitude })
  );

  return {
    distanciaKm: rotaPrincipal.distance / 1000,
    duracaoMin: rotaPrincipal.duration / 60,
    coordenadas,
  };
}

module.exports = { calcularRota };