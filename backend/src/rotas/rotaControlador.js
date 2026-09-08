const osrm = require('../utilitarios/osrm');
const { ErroHttp } = require('../intermediarios/tratadorErros');

// GET /routing/rota?origemLat=...&origemLng=...&destinoLat=...&destinoLng=...
async function calcularRota(req, res, next) {
  try {
    const { origemLat, origemLng, destinoLat, destinoLng } = req.query;

    if (!origemLat || !origemLng || !destinoLat || !destinoLng) {
      throw new ErroHttp(400, 'origemLat, origemLng, destinoLat e destinoLng são obrigatórios.');
    }

    const resultado = await osrm.calcularRota({
      origemLat: Number(origemLat),
      origemLng: Number(origemLng),
      destinoLat: Number(destinoLat),
      destinoLng: Number(destinoLng),
    });

    return res.json(resultado);
  } catch (erro) {
    next(erro);
  }
}

module.exports = { calcularRota };