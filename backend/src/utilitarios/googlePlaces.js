// Integração direta com a API REST do Google Places (Autocomplete + Place
// Details) — só usa o `fetch` nativo do Node, igual ao utilitarios/mercadoPago.js.
//
// A chave fica só aqui no backend (nunca no app), então o app nunca expõe
// a GOOGLE_PLACES_API_KEY dentro do bundle.
//
// Documentação usada como referência:
// https://developers.google.com/maps/documentation/places/web-service/autocomplete
// https://developers.google.com/maps/documentation/places/web-service/details

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Abaixo desse número de sugestões, também tenta a Geocoding API e/ou uma
// segunda versão da busca com o número reposicionado (ver
// gerarVarianteComNumeroNoFinal) — ambas custam uma chamada extra, então só
// valem a pena quando a busca "normal" veio fraca.
const MINIMO_SUGESTOES_SEM_FALLBACK = 3;

// Raio (em metros) usado pra enviesar a busca pro entorno do usuário. Era
// 50000 (50km, o máximo aceito pelo Google) — só que a própria documentação
// do Google avisa: "resultados de estabelecimento (comércios, negócios)
// geralmente não pontuam alto o suficiente pra aparecer quando a área de
// busca é grande. Use um raio menor." Era exatamente por isso que buscar
// "Mc Donalds" ou "Shopping X" não achava nada — a busca tratava o Brasil
// inteiro como "perto" o bastante pra empatar com endereços genéricos, e o
// estabelecimento local sempre perdia. Um raio de 15km ainda cobre uma
// cidade inteira e a região metropolitana ao redor, mas é apertado o
// suficiente pra estabelecimentos locais competirem de verdade — e também
// ajuda a ordenação geral (itens de fora desse raio precisam ser bem mais
// relevantes por texto pra aparecer antes dos próximos).
const RAIO_BUSCA_METROS = 15000;

function obterChave() {
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY não configurada no .env do backend. ' +
        'Crie uma chave em https://console.cloud.google.com/google/maps-apis/credentials ' +
        'com "Places API" e "Geocoding API" habilitadas (e billing ativo no projeto).'
    );
  }
  return chave;
}

// Distância em metros entre dois pontos (fórmula de Haversine) — usada pra
// dar uma distância de verdade pras sugestões que não vêm com
// `distance_meters` pronto (Geocoding API e Nominatim não têm esse campo).
function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (graus) => (graus * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function gerarVarianteComNumeroNoFinal(input) {
  const tokens = input.trim().split(/\s+/);
  const indiceNumero = tokens.findIndex((t, i) => /^\d+$/.test(t) && i !== tokens.length - 1);
  if (indiceNumero === -1) return null;

  const numero = tokens[indiceNumero];
  const resto = tokens.filter((_, i) => i !== indiceNumero);
  return `${resto.join(' ')}, ${numero}`;
}

// Roda o Autocomplete "cru" pra uma única string de busca.
async function autocompleteCru({ input, sessionToken, latitude, longitude }) {
  const params = new URLSearchParams({
    input,
    key: obterChave(),
    language: 'pt-BR',
    components: 'country:br',
    sessiontoken: sessionToken,
  });

  if (latitude != null && longitude != null) {
    params.set('location', `${latitude},${longitude}`);
    params.set('radius', String(RAIO_BUSCA_METROS));
    // `origin` faz o Google devolver `distance_meters` em cada sugestão —
    // sem isso a gente não tem NENHUM jeito de saber a distância real de
    // cada resultado, só confiar que o "bias" do location+radius ordenou
    // direito (e, como vimos, ele ordena fraco). Com `distance_meters` em
    // mãos, a gente reordena a lista final por conta própria (ver
    // ordenarPorDistancia), garantindo "mais perto primeiro" de verdade.
    params.set('origin', `${latitude},${longitude}`);
  }

  const resposta = await fetch(`${BASE_URL}/autocomplete/json?${params.toString()}`);
  const dados = await resposta.json();

  if (dados.status !== 'OK' && dados.status !== 'ZERO_RESULTS') {
    const erro = new Error(dados.error_message || `Falha na busca do Google Places (${dados.status}).`);
    erro.statusCode = 502;
    throw erro;
  }

  console.log(`[busca endereço] autocomplete "${input}" → status=${dados.status}, ${(dados.predictions || []).length} sugestão(ões)`);

  return (dados.predictions || []).map((p) => ({
    id: p.place_id,
    placeId: p.place_id,
    descricao: p.description,
    distanciaMetros: p.distance_meters ?? null,
  }));
}

async function nearbySearchComoSugestoes({ input, latitude, longitude }) {
  if (latitude == null || longitude == null) return [];

  const params = new URLSearchParams({
    keyword: input,
    key: obterChave(),
    language: 'pt-BR',
    location: `${latitude},${longitude}`,
    rankby: 'distance',
  });

  const resposta = await fetch(`${BASE_URL}/nearbysearch/json?${params.toString()}`);
  const dados = await resposta.json();

  console.log(`[busca endereço] nearby search "${input}" → status=${dados.status}, ${(dados.results || []).length} resultado(s)`);

  if (dados.status !== 'OK' && dados.status !== 'ZERO_RESULTS') {
    const erro = new Error(dados.error_message || `Falha na busca por perto (${dados.status}).`);
    erro.statusCode = 502;
    throw erro;
  }

  return (dados.results || []).map((r) => {
    const local = r.geometry?.location;
    return {
      id: r.place_id,
      placeId: r.place_id,
      descricao: r.vicinity ? `${r.name}, ${r.vicinity}` : r.name,
      distanciaMetros: local ? calcularDistanciaMetros(latitude, longitude, local.lat, local.lng) : null,
    };
  });
}

// Usa a Geocoding API (forward geocoding) como fonte alternativa de
// sugestões — não tem autocomplete "de verdade" (não é feito pra digitação
// parcial), mas costuma achar endereço específico que o Places Autocomplete
// sozinho não acha, então serve bem como complemento.
async function geocodeComoSugestoes({ input, latitude, longitude }) {
  const params = new URLSearchParams({
    address: input,
    key: obterChave(),
    language: 'pt-BR',
    region: 'br',
  });

  if (latitude != null && longitude != null) {
    // "bounds" só influencia a ordenação (não restringe de verdade),
    // igual o location+radius do Autocomplete.
    const delta = 0.5; // ~50km
    params.set(
      'bounds',
      `${latitude - delta},${longitude - delta}|${latitude + delta},${longitude + delta}`
    );
  }

  const resposta = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  const dados = await resposta.json();

  console.log(`[busca endereço] geocoding cru "${input}" → status=${dados.status}`);

  if (dados.status !== 'OK' && dados.status !== 'ZERO_RESULTS') {
    const erro = new Error(dados.error_message || `Falha na geocodificação (${dados.status}).`);
    erro.statusCode = 502;
    throw erro;
  }

  return (dados.results || []).map((r) => {
    const local = r.geometry?.location;
    const distanciaMetros =
      latitude != null && longitude != null && local
        ? calcularDistanciaMetros(latitude, longitude, local.lat, local.lng)
        : null;
    return {
      id: r.place_id,
      placeId: r.place_id,
      descricao: r.formatted_address,
      distanciaMetros,
    };
  });
}

// Último recurso, só quando nem o Autocomplete nem a Geocoding API do
// Google acham nada aproveitável: usa o Nominatim (OpenStreetMap), que às
// vezes tem ruas locais de cidades menores que o Google ainda não indexou
// bem. É gratuito, mas o uso público tem limite de 1 requisição/segundo —
// por isso só entra em último caso, nunca a cada tecla digitada.
async function nominatimComoSugestoes({ input, latitude, longitude }) {
  const params = new URLSearchParams({
    q: input,
    format: 'jsonv2',
    countrycodes: 'br',
    'accept-language': 'pt-BR',
    limit: '5',
  });

  const resposta = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: {
      // Exigido pela política de uso do Nominatim — requisições sem um
      // User-Agent identificável podem ser bloqueadas.
      // (https://operations.osmfoundation.org/policies/nominatim/)
      'User-Agent': 'GOApp/1.0 (app de transporte; contato: suporte@goapp.com.br)',
    },
  });

  if (!resposta.ok) {
    const erro = new Error(`Falha na busca do Nominatim (HTTP ${resposta.status}).`);
    erro.statusCode = 502;
    throw erro;
  }

  const resultados = await resposta.json();
  console.log(`[busca endereço] nominatim "${input}" → ${resultados.length} sugestão(ões)`);

  return resultados.map((r) => {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const distanciaMetros =
      latitude != null && longitude != null
        ? calcularDistanciaMetros(latitude, longitude, lat, lon)
        : null;
    return {
      // Nominatim não tem place_id do Google — usa o próprio osm_id como
      // identificador. resolverEndereco() sabe lidar com os dois formatos
      // (ver mais abaixo).
      id: `osm:${r.osm_type}:${r.osm_id}`,
      placeId: `osm:${r.osm_type}:${r.osm_id}`,
      descricao: r.display_name,
      latitude: lat,
      longitude: lon,
      distanciaMetros,
    };
  });
}

// Geocodificação REVERSA: transforma coordenadas (lat/lng) num endereço
// legível. Usada pra descobrir o endereço do PONTO DE EMBARQUE do
// passageiro (ele só escolhe manualmente o destino — o embarque normalmente
// é "onde ele está agora", só como coordenadas do GPS) — sem isso, o
// motorista recebia a corrida sem nenhum endereço de onde buscar o
// passageiro, só o pino no mapa.
async function enderecoReverso({ latitude, longitude }) {
  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key: obterChave(),
    language: 'pt-BR',
  });

  const resposta = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  const dados = await resposta.json();

  console.log(`[geocodificação reversa] ${latitude},${longitude} → status=${dados.status}`);

  if (dados.status !== 'OK' && dados.status !== 'ZERO_RESULTS') {
    const erro = new Error(dados.error_message || `Falha na geocodificação reversa (${dados.status}).`);
    erro.statusCode = 502;
    throw erro;
  }

  const primeiro = (dados.results || [])[0];
  if (!primeiro) return null;

  return {
    descricao: primeiro.formatted_address,
    latitude,
    longitude,
  };
}

// Junta uma lista nova de sugestões numa lista já existente, sem duplicar
// place_id repetido.
function mesclarSemDuplicar(basePrincipal, novasSugestoes) {
  const idsJaEncontrados = new Set(basePrincipal.map((s) => s.placeId));
  const complemento = novasSugestoes.filter((s) => !idsJaEncontrados.has(s.placeId));
  return [...basePrincipal, ...complemento];
}

// Reordena a lista final: quem tem distância conhecida vem primeiro,
// ordenado do mais perto pro mais longe; quem não tem (não deveria
// acontecer sem coordenadas do usuário, mas por segurança) fica no fim, na
// ordem em que chegou. Isso é o que de fato resolve "lugar longe aparecendo
// antes do perto" — em vez de confiar só no bias fraco do Google.
function ordenarPorDistancia(sugestoes) {
  return [...sugestoes].sort((a, b) => {
    if (a.distanciaMetros == null && b.distanciaMetros == null) return 0;
    if (a.distanciaMetros == null) return 1;
    if (b.distanciaMetros == null) return -1;
    return a.distanciaMetros - b.distanciaMetros;
  });
}

// Sugestões de endereço enquanto o usuário digita (GET /addresses/autocomplete).
// O `sessionToken` agrupa essa busca com a chamada de `detalhes` que vem
// depois, pra cobrança sair como UMA sessão (bem mais barato do que cobrar
// autocomplete + details como chamadas avulsas).
//
// Estratégia em camadas, só ativando a camada seguinte se a anterior veio
// fraca (evita gastar chamada extra à toa quando a busca normal já for boa):
//   1. Autocomplete com o texto exatamente como o usuário digitou.
//   2. Se número estiver no meio da frase, tenta de novo com o número
//      movido pro final (formato que o Google reconhece melhor).
//   3. Nearby Search (rankby=distance) — pega estabelecimentos pouco
//      conhecidos que o Autocomplete filtra por baixa "prominência".
//   4. Geocoding API como complemento pra endereços.
//   5. Nominatim (OpenStreetMap) como último recurso.
// No final, tudo reordenado por distância real (ver ordenarPorDistancia).
async function autocomplete({ input, sessionToken, latitude, longitude }) {
  let sugestoes = await autocompleteCru({ input, sessionToken, latitude, longitude });

  if (sugestoes.length < MINIMO_SUGESTOES_SEM_FALLBACK) {
    const variante = gerarVarianteComNumeroNoFinal(input);
    if (variante) {
      try {
        const sugestoesVariante = await autocompleteCru({
          input: variante,
          sessionToken,
          latitude,
          longitude,
        });
        sugestoes = mesclarSemDuplicar(sugestoes, sugestoesVariante);
      } catch (erroVariante) {
        console.log(`[busca endereço] variante "${variante}" → falhou: ${erroVariante.message}`);
      }
    }
  }

  if (sugestoes.length < MINIMO_SUGESTOES_SEM_FALLBACK) {
    try {
      const sugestoesPorPerto = await nearbySearchComoSugestoes({ input, latitude, longitude });
      sugestoes = mesclarSemDuplicar(sugestoes, sugestoesPorPerto);
    } catch (erroNearby) {
      console.log(`[busca endereço] nearby search fallback "${input}" → falhou: ${erroNearby.message}`);
    }
  }

  if (sugestoes.length < MINIMO_SUGESTOES_SEM_FALLBACK) {
    try {
      const sugestoesGeocode = await geocodeComoSugestoes({ input, latitude, longitude });
      sugestoes = mesclarSemDuplicar(sugestoes, sugestoesGeocode);
    } catch (erroFallback) {
      console.log(`[busca endereço] geocoding fallback "${input}" → falhou: ${erroFallback.message}`);
    }
  }

  if (sugestoes.length < MINIMO_SUGESTOES_SEM_FALLBACK) {
    try {
      const sugestoesNominatim = await nominatimComoSugestoes({ input, latitude, longitude });
      sugestoes = mesclarSemDuplicar(sugestoes, sugestoesNominatim);
    } catch (erroNominatim) {
      console.log(`[busca endereço] nominatim fallback "${input}" → falhou: ${erroNominatim.message}`);
    }
  }

  return ordenarPorDistancia(sugestoes).map(({ id, placeId, descricao }) => ({ id, placeId, descricao }));
}

// Resolve um place_id pra latitude/longitude reais — só é chamado quando o
// usuário TOCA numa sugestão, nunca a cada tecla digitada (é o que faz o
// sessionToken valer a pena).
async function detalhes({ placeId, sessionToken }) {
  // Sugestão veio do Nominatim (fallback final) — já temos lat/lng prontos
  // desde a busca, não precisa (nem dá, o Google não conhece esse ID) fazer
  // uma segunda chamada de "detalhes".
  if (placeId.startsWith('osm:')) {
    const [, osmType, osmId] = placeId.split(':');
    const params = new URLSearchParams({
      osm_type: osmType,
      osm_id: osmId,
      format: 'jsonv2',
    });
    const resposta = await fetch(`https://nominatim.openstreetmap.org/details?${params.toString()}`, {
      headers: { 'User-Agent': 'GOApp/1.0 (app de transporte; contato: suporte@goapp.com.br)' },
    });
    const dados = await resposta.json();
    return {
      id: placeId,
      placeId,
      descricao: dados.localname || dados.names?.name || placeId,
      latitude: Number(dados.centroid?.coordinates?.[1] ?? dados.geometry?.coordinates?.[1]),
      longitude: Number(dados.centroid?.coordinates?.[0] ?? dados.geometry?.coordinates?.[0]),
    };
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: obterChave(),
    language: 'pt-BR',
    fields: 'geometry,formatted_address',
    sessiontoken: sessionToken,
  });

  const resposta = await fetch(`${BASE_URL}/details/json?${params.toString()}`);
  const dados = await resposta.json();

  if (dados.status !== 'OK') {
    const erro = new Error(dados.error_message || `Falha ao buscar detalhes do endereço (${dados.status}).`);
    erro.statusCode = 502;
    throw erro;
  }

  const local = dados.result;
  return {
    id: placeId,
    placeId,
    descricao: local.formatted_address,
    latitude: local.geometry.location.lat,
    longitude: local.geometry.location.lng,
  };
}

module.exports = { autocomplete, detalhes, enderecoReverso };