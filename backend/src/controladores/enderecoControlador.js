const googlePlaces = require('../utilitarios/googlePlaces');
const { ErroHttp } = require('../intermediarios/tratadorErros');

// GET /addresses/autocomplete?input=...&sessiontoken=...&latitude=...&longitude=...
async function autocomplete(req, res, next) {
  try {
    const { input, sessiontoken, latitude, longitude } = req.query;

    if (!input || String(input).trim().length < 3) {
      return res.json({ sugestoes: [] });
    }
    if (!sessiontoken) {
      throw new ErroHttp(400, 'sessiontoken é obrigatório.');
    }

    const sugestoes = await googlePlaces.autocomplete({
      input: String(input).trim(),
      sessionToken: String(sessiontoken),
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
    });

    return res.json({ sugestoes });
  } catch (erro) {
    next(erro);
  }
}

// GET /addresses/details?placeId=...&sessiontoken=...
async function detalhes(req, res, next) {
  try {
    const { placeId, sessiontoken } = req.query;

    if (!placeId) throw new ErroHttp(400, 'placeId é obrigatório.');
    if (!sessiontoken) throw new ErroHttp(400, 'sessiontoken é obrigatório.');

    const endereco = await googlePlaces.detalhes({
      placeId: String(placeId),
      sessionToken: String(sessiontoken),
    });

    return res.json(endereco);
  } catch (erro) {
    next(erro);
  }
}

module.exports = { autocomplete, detalhes };
