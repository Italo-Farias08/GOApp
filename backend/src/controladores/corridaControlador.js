const corridaModelo = require('../modelos/corridaModelo');
const usuarioModelo = require('../modelos/usuarioModelo');
const motoristaModelo = require('../modelos/motoristaModelo');
const { ErroHttp } = require('../intermediarios/tratadorErros');
const soquete = require('../tempoReal/servidorSoquete');

const TIPOS_VALIDOS = ['carro', 'moto'];

// POST /rides
async function criar(req, res, next) {
  try {
    const { origem, destino, tipoVeiculo, preco, distanciaKm, duracaoMin } = req.body;

    if (!origem?.latitude || !origem?.longitude || !destino?.latitude || !destino?.longitude) {
      throw new ErroHttp(400, 'Origem e destino são obrigatórios.');
    }
    if (!TIPOS_VALIDOS.includes(tipoVeiculo)) {
      throw new ErroHttp(400, 'Tipo de veículo inválido.');
    }
    if (!preco || !distanciaKm || !duracaoMin) {
      throw new ErroHttp(400, 'Preço, distância e duração são obrigatórios.');
    }

    const corridaExistente = await corridaModelo.buscarAtivaPorPassageiro(req.usuarioId);
    if (corridaExistente) {
      throw new ErroHttp(409, 'Você já tem uma corrida em andamento.');
    }

    const corrida = await corridaModelo.criar({
      passageiroId: req.usuarioId,
      origem,
      destino,
      tipoVeiculo,
      preco,
      distanciaKm,
      duracaoMin,
    });

    const corridaPublica = corridaModelo.paraCorridaPublica(corrida);
    soquete.notificarNovaCorrida(corridaPublica, origem);

    return res.status(201).json(corridaPublica);
  } catch (erro) {
    next(erro);
  }
}

// GET /rides — corrida ativa do passageiro logado (procurando/aceita/em
// andamento), se existir. Usado pelo app pra RECUPERAR o estado da tela ao
// abrir/reconectar, em vez de simplesmente falhar com 409 toda vez que o
// passageiro tenta pedir uma corrida nova enquanto já tem uma em aberto.
async function buscarAtiva(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarAtivaPorPassageiro(req.usuarioId);
    if (!corrida) {
      return res.json(null);
    }

    let motorista;
    if (corrida.motorista_id) {
      const usuarioMotorista = await usuarioModelo.buscarPorId(corrida.motorista_id);
      if (usuarioMotorista) {
        const solicitacao = await motoristaModelo.buscarUltimaSolicitacaoPorUsuario(corrida.motorista_id);
        motorista = {
          id: usuarioMotorista.id,
          nome: usuarioMotorista.nome,
          telefone: usuarioMotorista.telefone || undefined,
          avatarUrl: usuarioMotorista.avatar_url || undefined,
          veiculoTipo: solicitacao?.veiculo_tipo,
          veiculoModelo: solicitacao?.veiculo_modelo,
          veiculoCor: solicitacao?.veiculo_cor,
          veiculoPlaca: solicitacao?.veiculo_placa,
          veiculoAno: solicitacao?.veiculo_ano || undefined,
        };
      }
    }

    return res.json({ corrida: corridaModelo.paraCorridaPublica(corrida), motorista });
  } catch (erro) {
    next(erro);
  }
}

// GET /rides/:id
async function detalhar(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');
    return res.json(corridaModelo.paraCorridaPublica(corrida));
  } catch (erro) {
    next(erro);
  }
}

// POST /rides/:id/accept
async function aceitar(req, res, next) {
  try {
    const motorista = await usuarioModelo.buscarPorId(req.usuarioId);
    if (!motorista || motorista.status_motorista !== 'approved') {
      throw new ErroHttp(403, 'Só motoristas aprovados podem aceitar corridas.');
    }

    const corridaAlvo = await corridaModelo.buscarPorId(req.params.id);
    if (!corridaAlvo) throw new ErroHttp(404, 'Corrida não encontrada.');

    // Revalida com dado FRESCO do banco (nunca confia em cache em memória)
    // que o veículo desse motorista é do mesmo tipo pedido na corrida —
    // segunda barreira além do filtro que já existe no radar (soquete).
    const solicitacao = await motoristaModelo.buscarUltimaSolicitacaoPorUsuario(req.usuarioId);
    if (!solicitacao || solicitacao.veiculo_tipo !== corridaAlvo.tipo_veiculo) {
      throw new ErroHttp(403, 'Seu veículo não é do tipo pedido nessa corrida.');
    }

    const corridaAceita = await corridaModelo.aceitar(req.params.id, req.usuarioId);
    if (!corridaAceita) {
      throw new ErroHttp(409, 'Essa corrida já foi aceita por outro motorista.');
    }

    const dadosMotorista = {
      id: motorista.id,
      nome: motorista.nome,
      telefone: motorista.telefone || undefined,
      avatarUrl: motorista.avatar_url || undefined,
      veiculoTipo: solicitacao.veiculo_tipo,
      veiculoModelo: solicitacao.veiculo_modelo,
      veiculoCor: solicitacao.veiculo_cor,
      veiculoPlaca: solicitacao.veiculo_placa,
      veiculoAno: solicitacao.veiculo_ano || undefined,
    };

    soquete.marcarMotoristaOcupado(req.usuarioId);
    soquete.notificarCorridaAceita({
      corridaId: corridaAceita.id,
      passageiroId: corridaAceita.passageiro_id,
      motoristaId: req.usuarioId,
      motorista: dadosMotorista,
    });

    // O motorista precisa saber o nome do passageiro pra identificar quem é
    // quem na tela de chat — busca à parte porque a linha da corrida só tem
    // o ID.
    const passageiro = await usuarioModelo.buscarPorId(corridaAceita.passageiro_id);

    return res.json({
      corrida: {
        ...corridaModelo.paraCorridaPublica(corridaAceita),
        passageiroNome: passageiro?.nome,
      },
      motorista: dadosMotorista,
    });
  } catch (erro) {
    next(erro);
  }
}

// GET /rides/history
//
// Corridas já encerradas (finalizadas ou canceladas) do passageiro logado
// que tiveram um motorista atribuído — alimenta a tela "Mensagens" das
// configurações, onde o passageiro pode reabrir o chat de uma viagem antiga
// pra falar com o motorista (ex: esqueceu algo no carro).
async function listarHistorico(req, res, next) {
  try {
    const linhas = await corridaModelo.listarFinalizadasComMotoristaPorPassageiro(req.usuarioId);
    const historico = linhas.map((linha) => ({
      corrida: corridaModelo.paraCorridaPublica(linha),
      motorista: {
        id: linha.motorista_id,
        nome: linha.motorista_nome,
        avatarUrl: linha.motorista_avatar_url || undefined,
      },
    }));
    return res.json(historico);
  } catch (erro) {
    next(erro);
  }
}

// POST /rides/:id/messages
//
// Manda uma mensagem pro outro lado da corrida (passageiro -> motorista ou
// motorista -> passageiro) por REST, funcionando mesmo com a corrida já
// finalizada — diferente do evento de soquete "chat:mensagem", que só existe
// enquanto a corrida está ativa. É o que permite a tela de "Mensagens"
// mandar um recado pro motorista depois que a viagem já acabou.
async function enviarMensagem(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');

    const ehPassageiro = corrida.passageiro_id === req.usuarioId;
    const ehMotorista = !!corrida.motorista_id && corrida.motorista_id === req.usuarioId;
    if (!ehPassageiro && !ehMotorista) {
      throw new ErroHttp(403, 'Você não pode mandar mensagem nessa corrida.');
    }

    const textoLimpo = typeof req.body?.texto === 'string' ? req.body.texto.trim().slice(0, 1000) : '';
    if (!textoLimpo) throw new ErroHttp(400, 'Digite uma mensagem.');

    const linhaSalva = await corridaModelo.salvarMensagem(req.params.id, req.usuarioId, textoLimpo);
    const mensagem = corridaModelo.paraMensagemPublica(linhaSalva);

    const destinatarioId = ehPassageiro ? corrida.motorista_id : corrida.passageiro_id;
    soquete.notificarMensagem({ destinatarioId, mensagem });

    return res.status(201).json(mensagem);
  } catch (erro) {
    next(erro);
  }
}

// GET /rides/:id/messages
//
// Histórico do chat da corrida. Só o passageiro ou o motorista atribuídos a
// ela podem ler — qualquer outra pessoa recebe 403. Usado pelo app pra
// recuperar as mensagens ao abrir/reconectar no meio de uma corrida (o
// socket sozinho só entrega mensagens novas, não o que já foi trocado).
async function listarMensagens(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');

    const ehPassageiro = corrida.passageiro_id === req.usuarioId;
    const ehMotorista = !!corrida.motorista_id && corrida.motorista_id === req.usuarioId;
    if (!ehPassageiro && !ehMotorista) {
      throw new ErroHttp(403, 'Você não pode ver o chat dessa corrida.');
    }

    const mensagens = await corridaModelo.listarMensagens(req.params.id);
    return res.json(mensagens.map(corridaModelo.paraMensagemPublica));
  } catch (erro) {
    next(erro);
  }
}

// POST /rides/:id/pickup
//
// Motorista confirma que pegou o passageiro no ponto de embarque. Só quem
// está atribuído à corrida (e enquanto ela ainda está "aceita") pode
// confirmar. A partir daqui a corrida vira "em_andamento" e o mapa do
// motorista (e o do passageiro) passam a apontar pro destino final, não mais
// pro ponto de embarque.
async function embarcar(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');
    if (corrida.motorista_id !== req.usuarioId) {
      throw new ErroHttp(403, 'Só o motorista dessa corrida pode confirmar o embarque.');
    }

    const corridaEmbarcada = await corridaModelo.embarcar(req.params.id, req.usuarioId);
    if (!corridaEmbarcada) {
      throw new ErroHttp(409, 'Essa corrida não pode ser embarcada agora.');
    }

    soquete.notificarEmbarque({
      corridaId: corridaEmbarcada.id,
      passageiroId: corridaEmbarcada.passageiro_id,
    });

    return res.json(corridaModelo.paraCorridaPublica(corridaEmbarcada));
  } catch (erro) {
    next(erro);
  }
}

// POST /rides/:id/cancel
//
// Regras de cancelamento:
// - Só o passageiro dono da corrida ou o motorista atribuído a ela podem
//   cancelar; qualquer outra pessoa recebe 403.
// - PASSAGEIRO: pode cancelar enquanto a corrida está "procurando", "aceita"
//   (motorista a caminho) ou "em_andamento" (já embarcou). Cancelar sempre
//   encerra a corrida de vez.
// - MOTORISTA: só pode cancelar uma corrida já "aceita" por ele, e ainda ANTES
//   do embarque (não dá pra cancelar depois que o passageiro já está no
//   veículo — nesse ponto ele deve finalizar a corrida normalmente).
//   Cancelar NÃO mata o pedido do passageiro na hora — a corrida volta pro
//   radar de outros motoristas (sem oferecer de novo pra quem já cancelou).
//   Só depois de alguns motoristas diferentes desistirem é que ela é
//   cancelada de vez.
async function cancelar(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');

    const ehPassageiro = corrida.passageiro_id === req.usuarioId;
    const ehMotorista = !!corrida.motorista_id && corrida.motorista_id === req.usuarioId;
    if (!ehPassageiro && !ehMotorista) {
      throw new ErroHttp(403, 'Você não pode cancelar essa corrida.');
    }

    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim().slice(0, 255) : null;

    if (ehPassageiro) {
      if (!['procurando', 'aceita', 'em_andamento'].includes(corrida.status)) {
        throw new ErroHttp(409, 'Essa corrida não pode mais ser cancelada.');
      }

      const corridaCancelada = await corridaModelo.cancelarPeloPassageiro(req.params.id, motivo);
      if (!corridaCancelada) {
        throw new ErroHttp(409, 'Essa corrida não pode mais ser cancelada.');
      }

      soquete.notificarCorridaCancelada({
        corridaId: corridaCancelada.id,
        passageiroId: corridaCancelada.passageiro_id,
        motoristaId: corridaCancelada.motorista_id,
        canceladoPor: 'passageiro',
        motivo,
      });

      return res.json(corridaModelo.paraCorridaPublica(corridaCancelada));
    }

    // A partir daqui, é o motorista cancelando.
    if (corrida.status !== 'aceita') {
      throw new ErroHttp(409, 'Você só pode cancelar antes de confirmar o embarque do passageiro.');
    }

    const resultado = await corridaModelo.cancelarPeloMotorista(req.params.id, req.usuarioId, motivo);
    if (!resultado) {
      throw new ErroHttp(409, 'Essa corrida não pode mais ser cancelada.');
    }

    // Libera o motorista pra voltar a receber corridas (ele precisa marcar
    // "ficar online" de novo no app pra aparecer no radar).
    soquete.marcarMotoristaOcupado(req.usuarioId);

    if (resultado.status === 'procurando') {
      soquete.notificarMotoristaCancelouReoferta({
        corridaId: resultado.id,
        passageiroId: resultado.passageiro_id,
      });
      soquete.notificarNovaCorrida(
        corridaModelo.paraCorridaPublica(resultado),
        {
          latitude: Number(resultado.origem_latitude),
          longitude: Number(resultado.origem_longitude),
        },
        resultado.motoristas_ignorados || []
      );
    } else {
      soquete.notificarCorridaCancelada({
        corridaId: resultado.id,
        passageiroId: resultado.passageiro_id,
        motoristaId: null,
        canceladoPor: 'sistema',
        motivo: resultado.motivo_cancelamento,
      });
    }

    return res.json(corridaModelo.paraCorridaPublica(resultado));
  } catch (erro) {
    next(erro);
  }
}

// POST /rides/:id/finish
async function finalizar(req, res, next) {
  try {
    const corrida = await corridaModelo.buscarPorId(req.params.id);
    if (!corrida) throw new ErroHttp(404, 'Corrida não encontrada.');
    if (corrida.motorista_id !== req.usuarioId) {
      throw new ErroHttp(403, 'Só o motorista da corrida pode finalizá-la.');
    }

    const corridaFinalizada = await corridaModelo.finalizar(req.params.id);
    if (!corridaFinalizada) {
      throw new ErroHttp(409, 'Essa corrida não pode ser finalizada agora. Confirme o embarque do passageiro primeiro.');
    }

    soquete.notificarCorridaFinalizada({
      corridaId: corridaFinalizada.id,
      passageiroId: corridaFinalizada.passageiro_id,
    });

    return res.json(corridaModelo.paraCorridaPublica(corridaFinalizada));
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  criar,
  buscarAtiva,
  detalhar,
  aceitar,
  embarcar,
  cancelar,
  finalizar,
  listarHistorico,
  listarMensagens,
  enviarMensagem,
};