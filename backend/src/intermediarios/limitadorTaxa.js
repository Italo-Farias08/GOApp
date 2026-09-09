const rateLimit = require('express-rate-limit');

// Resposta padronizada, no mesmo formato que o resto da API já usa
// ({ message }) — assim o frontend não precisa tratar esse caso diferente.
function respostaPadrao(mensagem) {
  return (req, res) => {
    res.status(429).json({ message: mensagem });
  };
}

// Limite geral, aplicado em TODAS as rotas — rede de segurança contra
// abuso genérico (scraping, bot batendo sem parar, etc). Generoso o
// suficiente pra não incomodar uso normal do app.
const limitadorGeral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respostaPadrao('Muitas requisições vindas do mesmo lugar. Espera um pouco e tenta de novo.'),
});

// Login (email ou telefone) — o alvo clássico de força bruta. 10 tentativas
// a cada 15 min por IP é suficiente pra um usuário que errou a senha
// algumas vezes, mas trava quem está tentando adivinhar.
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // só conta as tentativas que falharam
  handler: respostaPadrao('Muitas tentativas de login. Espera 15 minutos e tenta de novo.'),
});

// Código de verificação (verify-email / resend-code) — sem isso, dá pra
// tentar as ~1 milhão de combinações do código de 6 dígitos dentro dos
// 15 minutos em que ele é válido. 10 tentativas por janela mata esse ataque
// sem incomodar quem só errou de digitar.
const limitadorCodigoVerificacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respostaPadrao('Muitas tentativas com esse código. Espera 15 minutos e tenta de novo.'),
});

// Rotas administrativas protegidas só por um segredo fixo (x-admin-secret).
// Enquanto não existir um painel de admin de verdade, isso reduz o risco de
// alguém tentar adivinhar o segredo por tentativa e erro.
const limitadorAdmin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respostaPadrao('Muitas tentativas nessa rota administrativa. Espera 15 minutos.'),
});

module.exports = {
  limitadorGeral,
  limitadorLogin,
  limitadorCodigoVerificacao,
  limitadorAdmin,
};