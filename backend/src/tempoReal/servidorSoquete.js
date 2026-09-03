const { Server } = require('socket.io');
const { verificarToken } = require('../utilitarios/token');

let io = null;

// Motoristas com o app aberto e marcados como "disponíveis", com a última
// localização que mandaram — usado pra decidir a quem oferecer uma corrida nova.
const motoristasDisponiveis = new Map(); // usuarioId -> { latitude, longitude, socketId }

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

    socket.on('motorista:disponivel', ({ latitude, longitude }) => {
      motoristasDisponiveis.set(socket.usuarioId, { latitude, longitude, socketId: socket.id });
      socket.join('motoristas-online');
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

    socket.on('disconnect', () => {
      motoristasDisponiveis.delete(socket.usuarioId);
    });
  });

  return io;
}

// Chamado assim que uma corrida nova é criada — avisa só os motoristas
// disponíveis dentro do raio configurado.
function notificarNovaCorrida(corrida, origem) {
  if (!io) return;
  for (const [, dados] of motoristasDisponiveis.entries()) {
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

function notificarCorridaFinalizada({ corridaId, passageiroId }) {
  if (!io) return;
  corridasAtivas.delete(corridaId);
  io.to(`usuario:${passageiroId}`).emit('corrida:finalizada', { corridaId });
}

function notificarCorridaCancelada({ corridaId, passageiroId, motoristaId }) {
  if (!io) return;
  corridasAtivas.delete(corridaId);
  if (passageiroId) io.to(`usuario:${passageiroId}`).emit('corrida:cancelada', { corridaId });
  if (motoristaId) io.to(`usuario:${motoristaId}`).emit('corrida:cancelada', { corridaId });
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
  notificarCorridaFinalizada,
  notificarCorridaCancelada,
  notificarMotoristaAprovado,
};
