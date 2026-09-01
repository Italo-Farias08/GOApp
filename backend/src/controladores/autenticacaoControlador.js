const bcrypt = require('bcryptjs');
const usuarioModelo = require('../modelos/usuarioModelo');
const { gerarToken } = require('../utilitarios/token');
const { normalizarTelefone } = require('../utilitarios/telefone');
const { gerarCodigo, gerarExpiracao } = require('../utilitarios/codigoVerificacao');
const { enviarEmailVerificacao } = require('../utilitarios/email');
const { ErroHttp } = require('../intermediarios/tratadorErros');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /auth/register
async function registrar(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      throw new ErroHttp(400, 'Nome, email e senha são obrigatórios.');
    }
    if (!REGEX_EMAIL.test(email)) {
      throw new ErroHttp(400, 'Email inválido.');
    }
    if (password.length < 6) {
      throw new ErroHttp(400, 'A senha precisa ter pelo menos 6 caracteres.');
    }

    const usuarioExistente = await usuarioModelo.buscarPorEmail(email);
    if (usuarioExistente) {
      throw new ErroHttp(409, 'Já existe uma conta com esse email.');
    }

    const telefoneNormalizado = phone ? normalizarTelefone(phone) : null;

    if (telefoneNormalizado) {
      const usuarioComEsseTelefone = await usuarioModelo.buscarPorTelefone(telefoneNormalizado);
      if (usuarioComEsseTelefone) {
        throw new ErroHttp(409, 'Já existe uma conta com esse telefone.');
      }
    }

    const senhaHash = await bcrypt.hash(password, 10);
    const novoUsuario = await usuarioModelo.criar({
      nome: name,
      email,
      senhaHash,
      telefone: telefoneNormalizado,
    });

    const codigo = gerarCodigo();
    const expiraEm = gerarExpiracao();
    await usuarioModelo.definirCodigoVerificacao(novoUsuario.id, { codigo, expiraEm });
    await enviarEmailVerificacao({ para: email, nome: name, codigo });

    // Não emitimos token ainda: o usuário só entra depois de confirmar o código
    // enviado por email (rota /auth/verify-email).
    return res.status(201).json({
      needsVerification: true,
      email: novoUsuario.email,
    });
  } catch (erro) {
    next(erro);
  }
}

// POST /auth/verify-email
async function verificarEmail(req, res, next) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      throw new ErroHttp(400, 'Email e código são obrigatórios.');
    }

    const usuario = await usuarioModelo.buscarPorEmail(email);
    if (!usuario) {
      throw new ErroHttp(404, 'Usuário não encontrado.');
    }

    if (usuario.email_verificado) {
      const accessToken = gerarToken(usuario.id);
      return res.json({ user: usuarioModelo.paraUsuarioPublico(usuario), tokens: { accessToken } });
    }

    if (!usuario.codigo_verificacao || usuario.codigo_verificacao !== code) {
      throw new ErroHttp(400, 'Código inválido.');
    }

    if (usuario.codigo_verificacao_expira && new Date(usuario.codigo_verificacao_expira) < new Date()) {
      throw new ErroHttp(400, 'Código expirado. Peça um novo.');
    }

    const usuarioVerificado = await usuarioModelo.marcarEmailVerificado(usuario.id);
    const accessToken = gerarToken(usuarioVerificado.id);

    return res.json({
      user: usuarioModelo.paraUsuarioPublico(usuarioVerificado),
      tokens: { accessToken },
    });
  } catch (erro) {
    next(erro);
  }
}

// POST /auth/resend-code
async function reenviarCodigo(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      throw new ErroHttp(400, 'Email é obrigatório.');
    }

    const usuario = await usuarioModelo.buscarPorEmail(email);
    if (!usuario) {
      throw new ErroHttp(404, 'Usuário não encontrado.');
    }
    if (usuario.email_verificado) {
      throw new ErroHttp(409, 'Este email já foi verificado.');
    }

    const codigo = gerarCodigo();
    const expiraEm = gerarExpiracao();
    await usuarioModelo.definirCodigoVerificacao(usuario.id, { codigo, expiraEm });
    await enviarEmailVerificacao({ para: usuario.email, nome: usuario.nome, codigo });

    return res.json({ message: 'Código reenviado.' });
  } catch (erro) {
    next(erro);
  }
}

// POST /auth/login
async function entrar(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ErroHttp(400, 'Email e senha são obrigatórios.');
    }

    const usuario = await usuarioModelo.buscarPorEmail(email);
    if (!usuario || !usuario.senha_hash) {
      throw new ErroHttp(401, 'Email ou senha inválidos.');
    }

    const senhaConfere = await bcrypt.compare(password, usuario.senha_hash);
    if (!senhaConfere) {
      throw new ErroHttp(401, 'Email ou senha inválidos.');
    }

    if (usuario.email && !usuario.email_verificado) {
      const erro = new ErroHttp(403, 'Confirme seu email antes de entrar.');
      erro.needsVerification = true;
      erro.email = usuario.email;
      throw erro;
    }

    const accessToken = gerarToken(usuario.id);

    return res.json({
      user: usuarioModelo.paraUsuarioPublico(usuario),
      tokens: { accessToken },
    });
  } catch (erro) {
    next(erro);
  }
}

// POST /auth/login-phone
// Exige telefone cadastrado E senha correta (mesma senha do cadastro).
async function entrarComTelefone(req, res, next) {
  try {
    const { countryCode, phone, password } = req.body;

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      throw new ErroHttp(400, 'Número de celular inválido.');
    }
    if (!password) {
      throw new ErroHttp(400, 'Senha é obrigatória.');
    }

    const telefoneNormalizado = normalizarTelefone(`${countryCode || ''}${phone}`);

    const usuario = await usuarioModelo.buscarPorTelefone(telefoneNormalizado);
    if (!usuario || !usuario.senha_hash) {
      throw new ErroHttp(401, 'Telefone ou senha inválidos.');
    }

    const senhaConfere = await bcrypt.compare(password, usuario.senha_hash);
    if (!senhaConfere) {
      throw new ErroHttp(401, 'Telefone ou senha inválidos.');
    }

    if (usuario.email && !usuario.email_verificado) {
      const erro = new ErroHttp(403, 'Confirme seu email antes de entrar.');
      erro.needsVerification = true;
      erro.email = usuario.email;
      throw erro;
    }

    const accessToken = gerarToken(usuario.id);

    return res.json({
      user: usuarioModelo.paraUsuarioPublico(usuario),
      tokens: { accessToken },
    });
  } catch (erro) {
    next(erro);
  }
}

// GET /auth/me
async function obterPerfil(req, res, next) {
  try {
    const usuario = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!usuario) {
      throw new ErroHttp(404, 'Usuário não encontrado.');
    }
    return res.json(usuarioModelo.paraUsuarioPublico(usuario));
  } catch (erro) {
    next(erro);
  }
}

// PUT /auth/me
async function atualizarPerfil(req, res, next) {
  try {
    const { name, email, phone } = req.body;

    if (email && !REGEX_EMAIL.test(email)) {
      throw new ErroHttp(400, 'Email inválido.');
    }

    if (email) {
      const outroUsuarioComEmail = await usuarioModelo.buscarPorEmail(email);
      if (outroUsuarioComEmail && outroUsuarioComEmail.id !== req.usuarioId) {
        throw new ErroHttp(409, 'Esse email já está em uso por outra conta.');
      }
    }

    const telefoneNormalizado = phone ? normalizarTelefone(phone) : undefined;
    const usuarioAtualizado = await usuarioModelo.atualizar(req.usuarioId, { nome: name, email, telefone: telefoneNormalizado });
    return res.json({ user: usuarioModelo.paraUsuarioPublico(usuarioAtualizado) });
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  registrar,
  verificarEmail,
  reenviarCodigo,
  entrar,
  entrarComTelefone,
  obterPerfil,
  atualizarPerfil,
};