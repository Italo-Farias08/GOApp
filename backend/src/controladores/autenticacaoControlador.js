const bcrypt = require('bcryptjs');
const usuarioModelo = require('../modelos/usuarioModelo');
const { gerarToken } = require('../utilitarios/token');
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

    const senhaHash = await bcrypt.hash(password, 10);
    const novoUsuario = await usuarioModelo.criar({ nome: name, email, senhaHash, telefone: phone });

    const accessToken = gerarToken(novoUsuario.id);

    return res.status(201).json({
      user: usuarioModelo.paraUsuarioPublico(novoUsuario),
      tokens: { accessToken },
    });
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
// Fluxo simplificado (sem envio real de SMS/OTP): se o telefone já tem conta, loga;
// se não tem, cria uma conta nova automaticamente com esse telefone.
async function entrarComTelefone(req, res, next) {
  try {
    const { countryCode, phone } = req.body;

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      throw new ErroHttp(400, 'Número de celular inválido.');
    }

    const telefoneCompleto = `${countryCode || ''}${phone}`;

    let usuario = await usuarioModelo.buscarPorTelefone(telefoneCompleto);
    if (!usuario) {
      usuario = await usuarioModelo.criar({
        nome: 'Usuário',
        telefone: telefoneCompleto,
      });
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

    const usuarioAtualizado = await usuarioModelo.atualizar(req.usuarioId, { nome: name, email, telefone: phone });
    return res.json({ user: usuarioModelo.paraUsuarioPublico(usuarioAtualizado) });
  } catch (erro) {
    next(erro);
  }
}

module.exports = { registrar, entrar, entrarComTelefone, obterPerfil, atualizarPerfil };
