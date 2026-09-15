const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

// Pasta onde os arquivos ficam salvos. Em produção no Railway, configure a
// variável PASTA_UPLOADS apontando pro caminho do Volume que você criar lá
// (ex: /data/uploads) — assim os arquivos sobrevivem a cada novo deploy, já
// que o resto do sistema de arquivos do container é apagado a cada deploy.
// Em desenvolvimento local, sem essa variável, ele salva numa pasta comum
// dentro do próprio backend.
const PASTA_UPLOADS = process.env.PASTA_UPLOADS || path.join(__dirname, '..', '..', 'uploads');
const PASTA_FOTOS_MOTORISTA = path.join(PASTA_UPLOADS, 'motoristas');

fs.mkdirSync(PASTA_FOTOS_MOTORISTA, { recursive: true });

const TIPOS_AVATAR_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

// Guarda o arquivo só na memória (não escreve nada em disco ainda) — a gente
// só grava a versão já comprimida, depois de passar pelo sharp. Assim nunca
// fica um arquivo cru e pesado no volume, não importa o que o celular mandou.
const armazenamentoEmMemoria = multer.memoryStorage();

// Middleware pronto pra usar na rota: upload.single('photo')
const upload = multer({
  storage: armazenamentoEmMemoria,
  limits: { fileSize: 8 * 1024 * 1024 }, // limite generoso do que o CELULAR pode mandar; o que fica salvo é bem menor
  fileFilter(req, arquivo, callback) {
    if (!TIPOS_AVATAR_PERMITIDOS.includes(arquivo.mimetype)) {
      return callback(new Error('Envie uma imagem JPEG, PNG ou WebP.'));
    }
    callback(null, true);
  },
});

// Redimensiona pra um tamanho fixo de selfie (não precisa de mais que isso
// pro passageiro reconhecer o motorista) e recomprime sempre em JPEG numa
// qualidade que fica leve sem ficar borrada. Isso deixa cada foto na faixa
// de ~20-60 KB, não importa se o celular mandou um arquivo de 8 MB.
const LADO_MAXIMO_PX = 640;
const QUALIDADE_JPEG = 75;

async function comprimirEsalvarFoto(usuarioId, bufferOriginal) {
  const bufferComprimido = await sharp(bufferOriginal)
    .rotate() // corrige orientação com base no EXIF antes de descartar o EXIF
    .resize({
      width: LADO_MAXIMO_PX,
      height: LADO_MAXIMO_PX,
      fit: 'cover', // a selfie já vem quadrada (crop no app), então só garante o teto de tamanho
      withoutEnlargement: true, // nunca aumenta uma foto pequena, só reduz as grandes
    })
    .jpeg({ quality: QUALIDADE_JPEG, mozjpeg: true })
    .toBuffer();

  const nomeArquivo = `${usuarioId}-${Date.now()}.jpg`;
  const caminho = path.join(PASTA_FOTOS_MOTORISTA, nomeArquivo);
  await fs.promises.writeFile(caminho, bufferComprimido);

  return nomeArquivo;
}

// Monta a URL pública completa a partir do nome do arquivo salvo.
// URL_PUBLICA_BACKEND precisa ser o domínio público do backend (no Railway:
// Settings > Networking > Public Domain, algo como
// https://seuapp.up.railway.app). Sem essa variável configurada, a URL sai
// relativa (só "/uploads/..."), o que não funciona no app — configure-a
// antes de publicar.
function montarUrlPublica(nomeArquivo) {
  const base = (process.env.URL_PUBLICA_BACKEND || '').replace(/\/$/, '');
  return `${base}/uploads/motoristas/${nomeArquivo}`;
}

// Apaga a foto antiga do disco quando o motorista manda uma nova — evita
// acumular arquivo órfão no volume a cada atualização. Só mexe em arquivos
// que a gente mesmo serve (prefixo /uploads/motoristas/); se o avatar antigo
// veio de outro lugar (ex: Google, no login social), ignora e não tenta apagar.
function apagarFotoAntiga(avatarUrlAntiga) {
  if (!avatarUrlAntiga) return;
  const marcador = '/uploads/motoristas/';
  const indice = avatarUrlAntiga.indexOf(marcador);
  if (indice === -1) return;

  const nomeArquivo = avatarUrlAntiga.slice(indice + marcador.length);
  const caminho = path.join(PASTA_FOTOS_MOTORISTA, nomeArquivo);
  fs.unlink(caminho, (erro) => {
    if (erro && erro.code !== 'ENOENT') {
      console.warn('[armazenamento] Não consegui apagar foto antiga:', erro.message);
    }
  });
}

module.exports = {
  PASTA_UPLOADS,
  upload,
  comprimirEsalvarFoto,
  montarUrlPublica,
  apagarFotoAntiga,
};