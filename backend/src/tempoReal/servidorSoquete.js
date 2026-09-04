const { Server } = require('socket.io');
const { verificarToken } = require('../utilitarios/token');
const motoristaModelo = require('../modelos/motoristaModelo');
const corridaModelo = require('../modelos/corridaModelo');

let io = null;

// Motoristas com o app aberto e marcados como "disponíveis", com a última
// localização que mandaram e o tipo de veículo — usado pra decidir a quem
// oferecer uma corrida nova.
const motoristasDisponiveis = new Map(); // usuarioId -> { latitude, longitude, socketId, tipoVeiculo }

// Corridas aceitas — guarda quem é o passageiro de cada uma, pra saber pra
// qual sala repassar a localização ao vivo do motorista.
const corridasAtivas = new Map(); // corridaId -> { passageiroId, motoristaId }

const RAIO_NOTIFICACAO_KM = 8;

// Distância em linha reta entre dois pontos (Haversine) — só pra filtrar
// quais motoristas disponíveis estão perto o bastante da corrida nova.
function calcularDistanciaKm(a, b) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function configurarSoquete(servidorHttp) {
  io = new Server(servidorHttp, {
    cors: { origin: '*' },
  });

  // Autentica cada conexão usando o mesmo JWT do REST — o cliente manda o
  // token em socket.handshake.auth.token ao conectar.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Token não informado.'));
      const payload = verificarToken(token);
      socket.usuarioId = payload.sub;
      next();
    } catch (erro) {
      next(new Error('Token inválido ou expirado.'));
    }
  });

  io.on('connection', (socket) => {
    // Sala pessoal — permite mandar evento pra um usuário específico de
    // qualquer lugar do backend, sem guardar o socketId dele manualmente.
    socket.join(`usuario:${socket.usuarioId}`);

    socket.on('motorista:disponivel', async ({ latitude, longitude }) => {
      try {
        // Busca o veículo cadastrado (e aprovado) do motorista direto no
        // banco — nunca confia no que o app do motorista possa mandar aqui,
        // pra ninguém conseguir se marcar como "carro" e "moto" ao mesmo
        // tempo só pra receber tudo.
        const solicitacao = await motoristaModelo.buscarUltimaSolicitacaoPorUsuario(socket.usuarioId);
        const tipoVeiculo = solicitacao?.veiculo_tipo;
        if (!tipoVeiculo) return;

        motoristasDisponiveis.set(socket.usuarioId, {
          latitude,
          longitude,
          socketId: socket.id,
          tipoVeiculo,
        });
        socket.join('motoristas-online');

        // Corridas que já estavam "procurando" ANTES desse motorista ficar
        // online também precisam chegar pra ele agora — sem isso, só quem já
        // estava online no exato momento da criação recebia o pedido, e
        // corridas legítimas ficavam "perdidas" no radar pra sempre.
        try {
          const corridasPendentes = await corridaModelo.buscarProcurandoPorTipo(tipoVeiculo);
          for (const corrida of corridasPendentes) {
            if ((corrida.motoristas_ignorados || []).includes(socket.usuarioId)) continue;

            const origemCorrida = {
              latitude: Number(corrida.origem_latitude),
              longitude: Number(corrida.origem_longitude),
            };
            if (calcularDistanciaKm(origemCorrida, { latitude, longitude }) <= RAIO_NOTIFICACAO_KM) {
              socket.emit('corrida:nova', corridaModelo.paraCorridaPublica(corrida));
            }
          }
        } catch (erroBusca) {
          // Não deixa um erro aqui derrubar a conexão do motorista — mas
          // precisa aparecer no log, senão vira um bug invisível de novo.
          console.error('[radar] falha ao buscar corridas pendentes pra reoferecer:', erroBusca);
        }
      } catch (erro) {
        // Se der erro na consulta, não deixa o motorista entrar no radar
        // sem tipo de veículo definido.
        console.error('[radar] falha ao marcar motorista como disponível:', erro);
      }
    });

    socket.on('motorista:indisponivel', () => {
      motoristasDisponiveis.delete(socket.usuarioId);
      socket.leave('motoristas-online');
    });

    socket.on('motorista:atualizar_localizacao', ({ corridaId, latitude, longitude }) => {
      const existente = motoristasDisponiveis.get(socket.usuarioId);
      if (existente) {
        motoristasDisponiveis.set(socket.usuarioId, { ...existente, latitude, longitude });
      }

      const corrida = corridasAtivas.get(corridaId);
      if (corrida && corrida.motoristaId === socket.usuarioId) {
        io.to(`usuario:${corrida.passageiroId}`).emit('corrida:localizacao_motorista', {
          corridaId,
          latitude,
          longitude,
        });
      }
    });

    // Chat da corrida — passageiro e motorista mandam mensagem pro mesmo
    // evento, o servidor só decide pra quem repassar (o "outro lado" da
    // corrida) e salva no banco pra sobreviver a reconexões.
    socket.on('chat:mensagem', async ({ corridaId, texto }) => {
      try {
        const textoLimpo = typeof texto === 'string' ? texto.trim().slice(0, 1000) : '';
        if (!corridaId || !textoLimpo) return;

        const corrida = corridasAtivas.get(corridaId);
        if (!corrida) return; // corrida não está mais ativa (ou nunca foi aceita)

        const { passageiroId, motoristaId } = corrida;
        if (socket.usuarioId !== passageiroId && socket.usuarioId !== motoristaId) return;

        const linhaSalva = await corridaModelo.salvarMensagem(corridaId, socket.usuarioId, textoLimpo);
        const mensagem = corridaModelo.paraMensagemPublica(linhaSalva);

        io.to(`usuario:${passageiroId}`).to(`usuario:${motoristaId}`).emit('corrida:mensagem', mensagem);
      } catch (erro) {
        console.error('[chat] falha ao processar mensagem:', erro);
      }
    });

    socket.on('disconnect', () => {
      motoristasDisponiveis.delete(socket.usuarioId);
    });
  });

  return io;
}

// Chamado assim que uma corrida nova é criada (ou volta pro radar depois de
// um motorista cancelar) — avisa só os motoristas disponíveis, do MESMO
// TIPO DE VEÍCULO pedido na corrida, que estão dentro do raio configurado.
// idsIgnorados é a lista de motoristas que já desistiram dessa mesma corrida
// e não devem recebê-la de novo.
function notificarNovaCorrida(corrida, origem, idsIgnorados = []) {
  if (!io) return;
  for (const [usuarioId, dados] of motoristasDisponiveis.entries()) {
    if (idsIgnorados.includes(usuarioId)) continue;
    if (dados.tipoVeiculo !== corrida.tipoVeiculo) continue;
    if (calcularDistanciaKm(origem, dados) <= RAIO_NOTIFICACAO_KM) {
      io.to(dados.socketId).emit('corrida:nova', corrida);
    }
  }
}

// Tira o motorista da lista de disponíveis assim que ele aceita uma corrida
// (pra não receber corrida nova enquanto está em atendimento).
function marcarMotoristaOcupado(usuarioId) {
  const dados = motoristasDisponiveis.get(usuarioId);
  motoristasDisponiveis.delete(usuarioId);
  if (dados?.socketId) {
    io?.sockets.sockets.get(dados.socketId)?.leave('motoristas-online');
  }
}

// Avisa o passageiro (com os dados do motorista) e tira a corrida da tela
// dos outros motoristas que ainda estavam vendo o pedido.
function notificarCorridaAceita({ corridaId, passageiroId, motoristaId, motorista }) {
  if (!io) return;
  corridasAtivas.set(corridaId, { passageiroId, motoristaId });
  io.to(`usuario:${passageiroId}`).emit('corrida:aceita', { corridaId, motorista });
  io.to('motoristas-online').emit('corrida:indisponivel', { corridaId });
}

// Motorista confirmou que pegou o passageiro — o mapa do passageiro (e do
// motorista) passa a apontar pro destino final a partir daqui.
function notificarEmbarque({ corridaId, passageiroId }) {
  if (!io) return;
  io.to(`usuario:${passageiroId}`).emit('corrida:embarque', { corridaId });
}

function notificarCorridaFinalizada({ corridaId, passageiroId }) {
  if (!io) return;
  corridasAtivas.delete(corridaId);
  io.to(`usuario:${passageiroId}`).emit('corrida:finalizada', { corridaId });
}

function notificarCorridaCancelada({ corridaId, passageiroId, motoristaId, canceladoPor, motivo }) {
  if (!io) return;
  corridasAtivas.delete(corridaId);
  const payload = { corridaId, canceladoPor, motivo };
  if (passageiroId) io.to(`usuario:${passageiroId}`).emit('corrida:cancelada', payload);
  if (motoristaId) io.to(`usuario:${motoristaId}`).emit('corrida:cancelada', payload);
}

// Motorista cancelou uma corrida que já tinha aceito, mas ela ainda tem
// chance de ser pega por outro motorista (não passou do limite de
// tentativas) — avisa só o passageiro, sem "matar" a tela dele: ele continua
// esperando, só que procurando de novo.
function notificarMotoristaCancelouReoferta({ corridaId, passageiroId }) {
  if (!io) return;
  corridasAtivas.delete(corridaId);
  io.to(`usuario:${passageiroId}`).emit('corrida:motorista_cancelou', { corridaId });
}

function notificarMotoristaAprovado(usuarioId) {
  if (!io) return;
  io.to(`usuario:${usuarioId}`).emit('motorista:aprovado');
}

module.exports = {
  configurarSoquete,
  notificarNovaCorrida,
  marcarMotoristaOcupado,
  notificarCorridaAceita,
  notificarEmbarque,
  notificarCorridaFinalizada,
  notificarCorridaCancelada,
  notificarMotoristaCancelouReoferta,
  notificarMotoristaAprovado,
};