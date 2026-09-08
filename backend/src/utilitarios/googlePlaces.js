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

// Abaixo desse número de sugestões, também tenta a Geocoding API e/ou uma
// segunda versão da busca com o número reposicionado (ver
// gerarVarianteComNumeroNoFinal) — ambas custam uma chamada extra, então só
// valem a pena quando a busca "normal" veio fraca.
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

// Gera uma segunda versão da consulta com o número do endereço movido pro
// FINAL, no formato "nome da rua, número" — é assim que o Google reconhece
// melhor. Resolve casos tipo "Rua 3 caic" (o Google acha que "Rua 3" é o
// nome, quando na real é "Rua Caic, nº 3") virando "Rua caic, 3".
//
// Só mexe quando o número está no MEIO da frase — se já estiver no fim
// (ou não tiver número nenhum), não tem o que melhorar, então devolve null.
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
    params.set('radius', '50000'); // ~50km, só pra priorizar por perto sem travar o resto do Brasil
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
  }));
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

  return (dados.results || []).map((r) => ({
    id: r.place_id,
    placeId: r.place_id,
    descricao: r.formatted_address,
  }));
}

// Junta uma lista nova de sugestões numa lista já existente, sem duplicar
// place_id repetido.
function mesclarSemDuplicar(basePrincipal, novasSugestoes) {
  const idsJaEncontrados = new Set(basePrincipal.map((s) => s.placeId));
  const complemento = novasSugestoes.filter((s) => !idsJaEncontrados.has(s.placeId));
  return [...basePrincipal, ...complemento];
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
//   3. Geocoding API como último complemento.
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
      const sugestoesGeocode = await geocodeComoSugestoes({ input, latitude, longitude });
      sugestoes = mesclarSemDuplicar(sugestoes, sugestoesGeocode);
    } catch (erroFallback) {
      console.log(`[busca endereço] geocoding fallback "${input}" → falhou: ${erroFallback.message}`);
    }
  }

  return sugestoes;
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