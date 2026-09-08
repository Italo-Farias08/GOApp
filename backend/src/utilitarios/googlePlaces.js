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

// Abaixo desse número de sugestões do Autocomplete, também consulta a
// Geocoding API — ela puxa de uma base de endereços diferente (mais "crua",
// vinda de cadastros oficiais) e às vezes acha rua/bairro que o Autocomplete
// sozinho não encontra.
const MINIMO_SUGESTOES_SEM_FALLBACK = 3;

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

// Sugestões de endereço enquanto o usuário digita (POST /addresses/autocomplete).
// O `sessionToken` agrupa essa busca com a chamada de `detalhes` que vem
// depois, pra cobrança sair como UMA sessão (bem mais barato do que cobrar
// autocomplete + details como chamadas avulsas).
async function autocomplete({ input, sessionToken, latitude, longitude }) {
  const params = new URLSearchParams({
    input,
    key: obterChave(),
    language: 'pt-BR',
    components: 'country:br',
    sessiontoken: sessionToken,
  });

  if (latitude != null && longitude != null) {
    params.set('location', `${latitude},${longitude}`);
    params.set('radius', '50000'); // ~50km, só pra priorizar por perto sem travar o resto do Brasil
  }

  const resposta = await fetch(`${BASE_URL}/autocomplete/json?${params.toString()}`);
  const dados = await resposta.json();

  if (dados.status !== 'OK' && dados.status !== 'ZERO_RESULTS') {
    const erro = new Error(dados.error_message || `Falha na busca do Google Places (${dados.status}).`);
    erro.statusCode = 502;
    throw erro;
  }

  const sugestoesAutocomplete = (dados.predictions || []).map((p) => ({
    id: p.place_id,
    placeId: p.place_id,
    descricao: p.description,
  }));

  console.log(
    `[busca endereço] autocomplete "${input}" → status=${dados.status}, ${sugestoesAutocomplete.length} sugestão(ões)`
  );

  if (sugestoesAutocomplete.length >= MINIMO_SUGESTOES_SEM_FALLBACK) {
    return sugestoesAutocomplete;
  }

  // Poucas (ou nenhuma) sugestão do Autocomplete — tenta complementar com a
  // Geocoding API antes de devolver, sem interromper a busca se ela falhar.
  try {
    const sugestoesGeocode = await geocodeComoSugestoes({ input, latitude, longitude });
    const idsJaEncontrados = new Set(sugestoesAutocomplete.map((s) => s.placeId));
    const complemento = sugestoesGeocode.filter((s) => !idsJaEncontrados.has(s.placeId));
    console.log(
      `[busca endereço] geocoding fallback "${input}" → ${sugestoesGeocode.length} resultado(s), ${complemento.length} novo(s)`
    );
    return [...sugestoesAutocomplete, ...complemento];
  } catch (erroFallback) {
    console.log(`[busca endereço] geocoding fallback "${input}" → falhou: ${erroFallback.message}`);
    return sugestoesAutocomplete;
  }
}

// Usa a Geocoding API (forward geocoding) como fonte alternativa de
// sugestões — não tem autocomplete "de verdade" (não é feito pra digitação
// parcial), mas costuma achar endereço específico que o Places Autocomplete
// não acha, então serve bem como complemento pra quem já digitou bastante.
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

  return (dados.results || []).map((r) => ({
    id: r.place_id,
    placeId: r.place_id,
    descricao: r.formatted_address,
  }));
}

// Resolve um place_id pra latitude/longitude reais — só é chamado quando o
// usuário TOCA numa sugestão, nunca a cada tecla digitada (é o que faz o
// sessionToken valer a pena).
async function detalhes({ placeId, sessionToken }) {
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

module.exports = { autocomplete, detalhes };