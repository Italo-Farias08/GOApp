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

  return (dados.predictions || []).map((p) => ({
    id: p.place_id,
    placeId: p.place_id,
    descricao: p.description,
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
