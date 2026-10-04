// Chama o OSRM (Open Source Routing Machine) público a partir do BACKEND,
// não do app. Alguns servidores Android/OkHttp têm incompatibilidade de TLS
// com o servidor de demonstração do OSRM (funciona no Chrome, mas falha com
// SSLHandshakeException dentro de apps React Native) — rodando pelo Node
// isso não acontece, então o app passa a falar só com o NOSSO backend, igual
// já faz com o Google Places.

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

// --- Instruções de curva em português -----------------------------------
// O OSRM devolve cada manobra como { type, modifier } (ex.: turn + right).
// Aqui viram um texto curto pro banner de navegação do motorista
// ("Vire à direita", "Faça o retorno"...). O nome da rua vem separado
// (`nome`) pro app montar "Vire à direita na Rua X".
const MODIFICADORES = {
  'uturn': 'Faça o retorno',
  'sharp right': 'Faça uma curva fechada à direita',
  'right': 'Vire à direita',
  'slight right': 'Siga levemente à direita',
  'straight': 'Siga em frente',
  'slight left': 'Siga levemente à esquerda',
  'left': 'Vire à esquerda',
  'sharp left': 'Faça uma curva fechada à esquerda',
};

function montarInstrucao(manobra) {
  const { type, modifier, exit } = manobra;

  if (type === 'depart') return 'Siga em frente';
  if (type === 'arrive') return 'Você chegou ao destino';

  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') {
    return exit ? `Na rotatória, pegue a ${exit}ª saída` : 'Entre na rotatória';
  }
  if (type === 'exit roundabout' || type === 'exit rotary') return 'Saia da rotatória';
  if (type === 'fork') {
    if (modifier?.includes('left')) return 'Mantenha-se à esquerda na bifurcação';
    if (modifier?.includes('right')) return 'Mantenha-se à direita na bifurcação';
    return 'Siga na bifurcação';
  }
  if (type === 'merge') return 'Entre na via';
  if (type === 'continue' || type === 'new name') {
    return MODIFICADORES[modifier] && modifier !== 'straight'
      ? MODIFICADORES[modifier]
      : 'Siga em frente';
  }
  // turn, end of road, on ramp, off ramp, etc.
  return MODIFICADORES[modifier] ?? 'Siga em frente';
}

async function calcularRota({ origemLat, origemLng, destinoLat, destinoLng }) {
  const url =
    `${OSRM_URL}/${origemLng},${origemLat};${destinoLng},${destinoLat}` +
    '?overview=full&geometries=geojson&steps=true';

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

  // Cada passo = um trecho até a PRÓXIMA manobra. `manobra` é a curva que
  // acontece no INÍCIO do passo (location), então "o que fazer a seguir" é
  // sempre a manobra do passo seguinte ao que o motorista está percorrendo.
  const passos = (rotaPrincipal.legs ?? [])
    .flatMap((leg) => leg.steps ?? [])
    .map((passo) => ({
      instrucao: montarInstrucao(passo.maneuver ?? {}),
      tipo: passo.maneuver?.type ?? null,
      nome: passo.name || null,
      distanciaM: passo.distance,
      duracaoS: passo.duration,
      latitude: passo.maneuver?.location?.[1],
      longitude: passo.maneuver?.location?.[0],
    }))
    .filter((p) => p.latitude != null && p.longitude != null);

  return {
    distanciaKm: rotaPrincipal.distance / 1000,
    duracaoMin: rotaPrincipal.duration / 60,
    coordenadas,
    passos,
  };
}

module.exports = { calcularRota };