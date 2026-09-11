const bcrypt = require('bcryptjs');
const usuarioModelo = require('../modelos/usuarioModelo');
const { gerarToken } = require('../utilitarios/token');
const { normalizarTelefone } = require('../utilitarios/telefone');
const { gerarCodigo, gerarExpiracao } = require('../utilitarios/codigoVerificacao');
const { enviarEmailVerificacao } = require('../utilitarios/email');
const { verificarIdTokenGoogle } = require('../utilitarios/googleAuth');
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

// POST /auth/change-pending-email
// Usada na tela de verificação quando o usuário percebe que digitou o email
// errado no cadastro. Só funciona enquanto a conta ainda não foi verificada.
async function alterarEmailPendente(req, res, next) {
  try {
    const { email, newEmail } = req.body;

    if (!email || !newEmail) {
      throw new ErroHttp(400, 'Email atual e novo email são obrigatórios.');
    }
    if (!REGEX_EMAIL.test(newEmail)) {
      throw new ErroHttp(400, 'Novo email inválido.');
    }

    const usuario = await usuarioModelo.buscarPorEmail(email);
    if (!usuario) {
      throw new ErroHttp(404, 'Usuário não encontrado.');
    }
    if (usuario.email_verificado) {
      throw new ErroHttp(409, 'Este email já foi verificado. Faça login normalmente.');
    }

    if (newEmail !== email) {
      const outroUsuarioComEmail = await usuarioModelo.buscarPorEmail(newEmail);
      if (outroUsuarioComEmail) {
        throw new ErroHttp(409, 'Já existe uma conta com esse email.');
      }
    }

    const codigo = gerarCodigo();
    const expiraEm = gerarExpiracao();
    const usuarioAtualizado = await usuarioModelo.alterarEmailPendente(usuario.id, {
      email: newEmail,
      codigo,
      expiraEm,
    });
    await enviarEmailVerificacao({ para: newEmail, nome: usuarioAtualizado.nome, codigo });

    return res.json({ needsVerification: true, email: usuarioAtualizado.email });
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

// POST /auth/google
//
// O front manda o id_token que recebeu do Google depois do usuário fazer
// login por lá. A gente valida esse token direto com o Google (não confia
// em nada que vem no corpo além do token em si) e, se for válido, encontra
// ou cria a conta pelo email — que já vem confirmado pelo próprio Google,
// então não precisa passar pelo fluxo de código por email.
async function entrarComGoogle(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      throw new ErroHttp(400, 'idToken é obrigatório.');
    }

    const dadosGoogle = await verificarIdTokenGoogle(idToken);

    let usuario = await usuarioModelo.buscarPorEmail(dadosGoogle.email);

    if (!usuario) {
      usuario = await usuarioModelo.criar({
        nome: dadosGoogle.nome,
        email: dadosGoogle.email,
        senhaHash: null,
        telefone: null,
      });
    }

    if (!usuario.email_verificado) {
      usuario = await usuarioModelo.marcarEmailVerificado(usuario.id);
    }

    const accessToken = gerarToken(usuario.id);

    return res.json({
      user: usuarioModelo.paraUsuarioPublico(usuario),
      tokens: { accessToken },
    });
  } catch (erro) {
    if (erro instanceof ErroHttp) return next(erro);
    // Erros de verificação do token do Google (assinatura inválida, expirado,
    // audience errada) chegam aqui como erro genérico — tratamos como 401
    // em vez de deixar virar 500, já que é uma falha de autenticação.
    next(new ErroHttp(401, erro.message || 'Não foi possível validar o login com Google.'));
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

    if (telefoneNormalizado) {
      const outroUsuarioComTelefone = await usuarioModelo.buscarPorTelefone(telefoneNormalizado);
      if (outroUsuarioComTelefone && outroUsuarioComTelefone.id !== req.usuarioId) {
        throw new ErroHttp(409, 'Esse telefone já está em uso por outra conta.');
      }
    }

    const usuarioAtualizado = await usuarioModelo.atualizar(req.usuarioId, { nome: name, email, telefone: telefoneNormalizado });
    return res.json({ user: usuarioModelo.paraUsuarioPublico(usuarioAtualizado) });
  } catch (erro) {
    // Segunda trava de segurança: se duas requisições caírem ao mesmo tempo
    // (raro, mas possível), a checagem acima pode não pegar e o banco
    // recusa direto com esse código — traduzimos pra uma mensagem normal
    // em vez de deixar virar erro 500.
    if (erro.code === '23505' && erro.constraint === 'usuarios_telefone_key') {
      return next(new ErroHttp(409, 'Esse telefone já está em uso por outra conta.'));
    }
    if (erro.code === '23505' && erro.constraint === 'usuarios_email_key') {
      return next(new ErroHttp(409, 'Esse email já está em uso por outra conta.'));
    }
    next(erro);
  }
}

// PUT /auth/push-token
//
// Chamado pelo app assim que o usuário loga (e sempre que a Expo gerar um
// token novo pro dispositivo) — salva o token pra esse usuário poder receber
// notificação de corrida nova, corrida aceita, chat, etc. mesmo com o app
// fechado. Sem isso o backend não tem "endereço" nenhum pra mandar push.
async function atualizarPushToken(req, res, next) {
  try {
    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== 'string') {
      throw new ErroHttp(400, 'Token de notificação inválido.');
    }

    await usuarioModelo.atualizarPushToken(req.usuarioId, pushToken);
    return res.status(204).send();
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  registrar,
  verificarEmail,
  reenviarCodigo,
  alterarEmailPendente,
  entrar,
  entrarComTelefone,
  entrarComGoogle,
  obterPerfil,
  atualizarPerfil,
  atualizarPushToken,
};