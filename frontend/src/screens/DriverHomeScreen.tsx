import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import type { Socket } from 'socket.io-client';
import Button from '../components/Button';
import CancelRideModal from '../components/CancelRideModal';
import MapPin from '../components/MapPin';
import StatusToast, { StatusToastTone } from '../components/StatusToast';
import { CarIcon, CheckIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useDriverLocationWatcher } from '../hooks/useDriverLocationWatcher';
import { useRota } from '../hooks/useRota';
import * as rideService from '../services/rideService';
import { conectarSoquete } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { Corrida, RootStackParamList } from '../types';
import { formatarDistancia, formatarDuracao, formatarMoeda } from '../utils/precoCorrida';
import { STADIA_TILE_URL } from '../utils/mapaConfig';

// Motivos pré-definidos pro motorista escolher ao cancelar uma corrida já
// aceita — curtos e específicos o bastante pra dar sinal real do que houve.
const MOTIVOS_CANCELAMENTO_MOTORISTA = [
  'O passageiro não apareceu',
  'Endereço muito longe do combinado',
  'Problema com o veículo',
  'Emergência pessoal',
  'Outro motivo',
];

export default function DriverHomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [disponivel, setDisponivel] = useState(false);
  const [corridaRecebida, setCorridaRecebida] = useState<Corrida | null>(null);
  const [corridaAtiva, setCorridaAtiva] = useState<Corrida | null>(null);
  // Etapa dentro da corrida ativa: false = ainda indo buscar o passageiro no
  // ponto de embarque; true = já confirmou o embarque, indo pro destino final.
  const [embarcado, setEmbarcado] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [embarcando, setEmbarcando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelamentoVisivel, setCancelamentoVisivel] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);
  const [toastTom, setToastTom] = useState<StatusToastTone>('info');

  const { coords } = useDriverLocationWatcher(disponivel || !!corridaAtiva);
  const { rota, calcularRota, limparRota } = useRota();
  const mapRef = useRef<MapView>(null);
  const soqueteRef = useRef<Socket | null>(null);

  const avisoContadorRef = useRef(0);
  function avisar(mensagem: string, tom: StatusToastTone = 'info') {
    avisoContadorRef.current += 1;
    setToastTom(tom);
    setToastMensagem(mensagem + '\u200B'.repeat(avisoContadorRef.current % 2));
  }

  // --- "Nova corrida" nasce com um pulinho (scale) em vez de simplesmente
  // aparecer — ajuda a chamar atenção do motorista pra decidir rápido. ---
  const novaCorridaAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (corridaRecebida) {
      novaCorridaAnim.setValue(0);
      Animated.spring(novaCorridaAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 60,
      }).start();
    }
  }, [corridaRecebida?.id]);

  // --- Ponto de status (online) pulsando devagar enquanto o motorista está
  // disponível ou em corrida — dá a sensação de "app vivo" no topo. ---
  const statusPulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (disponivel || corridaAtiva) {
      statusPulseAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(statusPulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(statusPulseAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [disponivel, !!corridaAtiva]);

  // Conecta ao socket assim que a tela abre e escuta os eventos de corrida.
  useEffect(() => {
    let ativo = true;

    (async () => {
      const soquete = await conectarSoquete();
      soqueteRef.current = soquete;

      soquete.on('corrida:nova', (corrida: Corrida) => {
        if (!ativo) return;
        setCorridaRecebida((atual) => atual ?? corrida);
      });

      soquete.on('corrida:indisponivel', ({ corridaId }: { corridaId: string }) => {
        if (!ativo) return;
        setCorridaRecebida((atual) => (atual?.id === corridaId ? null : atual));
      });

      // Regra: se foi o PASSAGEIRO que cancelou, a corrida acaba de vez pro
      // motorista também (não tem mais ninguém pra buscar). Isso pode
      // acontecer tanto numa oferta ainda não aceita quanto numa corrida já
      // em andamento — em qualquer caso a tela volta pro estado anterior.
      soquete.on('corrida:cancelada', ({ corridaId, canceladoPor }: { corridaId: string; canceladoPor?: string }) => {
        if (!ativo) return;
        setCorridaAtiva((atual) => {
          if (atual?.id !== corridaId) return atual;
          if (canceladoPor === 'passageiro') {
            avisar('O passageiro cancelou a corrida.', 'warning');
          }
          return null;
        });
        setCorridaRecebida((atual) => (atual?.id === corridaId ? null : atual));
      });
    })();

    return () => {
      ativo = false;
      soqueteRef.current?.off('corrida:nova');
      soqueteRef.current?.off('corrida:indisponivel');
      soqueteRef.current?.off('corrida:cancelada');
    };
  }, []);

  // Avisa o servidor que está disponível (e a localização atual) enquanto
  // não tem corrida nenhuma em andamento.
  useEffect(() => {
    if (!coords || corridaAtiva) return;
    (async () => {
      const soquete = await conectarSoquete();
      if (disponivel) {
        soquete.emit('motorista:disponivel', coords);
      } else {
        soquete.emit('motorista:indisponivel');
      }
    })();
  }, [disponivel, coords, corridaAtiva]);

  // Com uma corrida aceita, manda a localização ao vivo pro passageiro.
  useEffect(() => {
    if (!corridaAtiva || !coords) return;
    (async () => {
      const soquete = await conectarSoquete();
      soquete.emit('motorista:atualizar_localizacao', {
        corridaId: corridaAtiva.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    })();
  }, [corridaAtiva, coords]);

  // Sempre que a corrida ativa termina (finalizada, cancelada ou nunca
  // chegou a existir), a etapa de embarque volta pro início.
  useEffect(() => {
    if (!corridaAtiva) setEmbarcado(false);
  }, [corridaAtiva]);

  // Calcula a rota até o próximo ponto: enquanto não embarcou, até o
  // passageiro (origem); depois de confirmar o embarque, até o destino
  // final. Recalcula sempre que a etapa muda.
  useEffect(() => {
    if (corridaAtiva && coords) {
      const alvo = embarcado ? corridaAtiva.destino : corridaAtiva.origem;
      calcularRota(coords, alvo);
      mapRef.current?.fitToCoordinates(
        [coords, alvo],
        { edgePadding: { top: 100, right: 60, bottom: 280, left: 60 }, animated: true }
      );
    } else {
      limparRota();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corridaAtiva?.id, embarcado]);

  async function aceitarCorridaRecebida() {
    if (!corridaRecebida) return;
    setAceitando(true);
    setErro(null);
    try {
      const { corrida } = await rideService.aceitarCorrida(corridaRecebida.id);
      setCorridaAtiva(corrida);
      setEmbarcado(false);
      setCorridaRecebida(null);
      setDisponivel(false);
      avisar('Corrida aceita! Siga até o passageiro.', 'success');
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Essa corrida já foi aceita por outro motorista.');
      setCorridaRecebida(null);
    } finally {
      setAceitando(false);
    }
  }

  function recusarCorridaRecebida() {
    setCorridaRecebida(null);
  }

  // Motorista confirma que pegou o passageiro no ponto de embarque — a
  // partir daqui o mapa passa a guiar até o destino final.
  async function confirmarEmbarque() {
    if (!corridaAtiva) return;
    setEmbarcando(true);
    setErro(null);
    try {
      const corridaAtualizada = await rideService.embarcarCorrida(corridaAtiva.id);
      setCorridaAtiva(corridaAtualizada);
      setEmbarcado(true);
      avisar('Embarque confirmado! Siga até o destino.', 'success');
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível confirmar o embarque agora.');
    } finally {
      setEmbarcando(false);
    }
  }

  async function finalizarCorridaAtiva() {
    if (!corridaAtiva) return;
    setFinalizando(true);
    try {
      await rideService.finalizarCorrida(corridaAtiva.id);
      avisar('Corrida finalizada com sucesso!', 'success');
    } catch {
      // segue liberando a tela mesmo se a chamada falhar
    } finally {
      setCorridaAtiva(null);
      setFinalizando(false);
    }
  }

  // Regra: o motorista só pode cancelar uma corrida que ele mesmo aceitou e
  // AINDA ANTES de confirmar o embarque (corridaAtiva && !embarcado já
  // garante isso — depois do embarque o passageiro já está no veículo, então
  // a opção de cancelar nem aparece, só finalizar). Cancelar aqui NÃO
  // finaliza o pedido do passageiro — o backend devolve a corrida pro radar
  // de outros motoristas, a não ser que já tenha estourado o limite de
  // cancelamentos.
  function abrirCancelamentoAtiva() {
    if (!corridaAtiva || embarcado) return;
    setCancelamentoVisivel(true);
  }

  async function confirmarCancelamentoAtiva(motivo: string) {
    if (!corridaAtiva) return;
    setCancelando(true);
    try {
      const resultado = await rideService.cancelarCorrida(corridaAtiva.id, motivo);
      if (resultado.status === 'procurando') {
        avisar('Corrida cancelada. Ela volta pro radar de outros motoristas.', 'info');
      } else {
        avisar('Corrida cancelada.', 'info');
      }
    } catch {
      avisar('Corrida cancelada.', 'info');
    } finally {
      setCorridaAtiva(null);
      setDisponivel(false); // precisa ficar online de novo pra voltar a receber corridas
      setCancelando(false);
      setCancelamentoVisivel(false);
    }
  }

  if (user?.driverStatus !== 'approved') {
    return (
      <View style={styles.bloqueado}>
        <Text style={styles.bloqueadoTitulo}>Modo motorista indisponível</Text>
        <Text style={styles.bloqueadoTexto}>Seu cadastro de motorista ainda não foi aprovado.</Text>
        <Button label="Voltar" onPress={() => navigation.goBack()} style={styles.bloqueadoBotao} />
      </View>
    );
  }

  // Ponto que o mapa deve destacar: enquanto não embarcou, o passageiro;
  // depois do embarque, o destino final.
  const alvoAtual = corridaAtiva ? (embarcado ? corridaAtiva.destino : corridaAtiva.origem) : null;

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} showsUserLocation showsMyLocationButton={false}>
        <UrlTile urlTemplate={STADIA_TILE_URL} maximumZ={20} flipY={false} />

        {coords && (
          <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }} title="Você">
            <View style={styles.marcadorMotorista}>
              <CarIcon size={16} color={colors.background} />
            </View>
          </Marker>
        )}

        {corridaAtiva && alvoAtual && (
          <>
            <Marker
              coordinate={alvoAtual}
              anchor={{ x: 0.5, y: 0.85 }}
              title={embarcado ? 'Destino' : 'Passageiro'}
            >
              <MapPin variant="destino" />
            </Marker>
            {rota && (
              <Polyline coordinates={rota.coordenadas} strokeColor={colors.primary} strokeWidth={4} />
            )}
          </>
        )}
      </MapView>

      <View pointerEvents="none" style={styles.mapBrightener} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={!!corridaAtiva}
          style={({ pressed }) => [
            styles.voltarBotao,
            !!corridaAtiva && styles.voltarBotaoDesabilitado,
            pressed && styles.pressedFeedback,
          ]}
        >
          <Text style={styles.voltarTexto}>‹ Modo passageiro</Text>
        </Pressable>

        <View style={[styles.statusPill, disponivel && styles.statusPillOnline]}>
          <Animated.View
            style={[
              styles.statusPonto,
              disponivel && styles.statusPontoOnline,
              (disponivel || !!corridaAtiva) && {
                transform: [
                  {
                    scale: statusPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }),
                  },
                ],
                opacity: statusPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
              },
            ]}
          />
          <Text style={styles.statusTexto}>
            {corridaAtiva ? 'Em corrida' : disponivel ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {!corridaAtiva && !corridaRecebida && (
        <View style={styles.painelInferior}>
          {!!erro && <Text style={styles.erroTexto}>{erro}</Text>}
          <Text style={styles.painelTitulo}>
            {disponivel ? 'Procurando corridas perto de você...' : 'Você está offline'}
          </Text>
          <Text style={styles.painelSubtitulo}>
            {disponivel
              ? 'Assim que uma corrida aparecer por perto, ela chega aqui na hora.'
              : 'Fique online pra começar a receber pedidos de corrida.'}
          </Text>
          <Button
            label={disponivel ? 'Ficar offline' : 'Ficar online'}
            variant={disponivel ? 'secondary' : 'primary'}
            onPress={() => setDisponivel((atual) => !atual)}
            style={styles.painelBotao}
          />
        </View>
      )}

      {corridaRecebida && (
        <Animated.View
          style={[
            styles.painelInferior,
            {
              opacity: novaCorridaAnim,
              transform: [
                {
                  translateY: novaCorridaAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
                },
                {
                  scale: novaCorridaAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.novaCorridaTitulo}>Nova corrida</Text>
          <View style={styles.novaCorridaLinha}>
            <View style={[styles.pontoRota, styles.pontoOrigem]} />
            <Text style={styles.novaCorridaEndereco} numberOfLines={1}>
              {corridaRecebida.origem.endereco ?? 'Ponto de partida'}
            </Text>
          </View>
          <View style={styles.novaCorridaLinha}>
            <View style={[styles.pontoRota, styles.pontoDestino]} />
            <Text style={styles.novaCorridaEndereco} numberOfLines={1}>
              {corridaRecebida.destino.endereco ?? 'Destino'}
            </Text>
          </View>
          <View style={styles.novaCorridaResumo}>
            <Text style={styles.novaCorridaPreco}>{formatarMoeda(corridaRecebida.preco)}</Text>
            <Text style={styles.novaCorridaDetalhe}>
              {formatarDistancia(corridaRecebida.distanciaKm)} · {formatarDuracao(corridaRecebida.duracaoMin)}
            </Text>
          </View>
          <View style={styles.novaCorridaBotoes}>
            <Button
              label="Recusar"
              variant="secondary"
              onPress={recusarCorridaRecebida}
              disabled={aceitando}
              style={styles.novaCorridaBotaoRecusar}
            />
            <Button
              label="Aceitar"
              onPress={aceitarCorridaRecebida}
              loading={aceitando}
              style={styles.novaCorridaBotaoMetade}
            />
          </View>
        </Animated.View>
      )}

      {corridaAtiva && !embarcado && (
        <View style={styles.painelInferior}>
          <View style={styles.corridaAtivaTopo}>
            <View style={styles.corridaAtivaBadge}>
              <CheckIcon size={11} color={colors.background} />
            </View>
            <Text style={styles.corridaAtivaTexto}>Corrida aceita</Text>
          </View>
          <Text style={styles.novaCorridaTitulo}>A caminho do passageiro</Text>
          <View style={styles.novaCorridaLinha}>
            <View style={[styles.pontoRota, styles.pontoOrigem]} />
            <Text style={styles.novaCorridaEndereco} numberOfLines={1}>
              {corridaAtiva.origem.endereco ?? 'Buscar passageiro'}
            </Text>
          </View>
          {rota && (
            <Text style={styles.painelSubtitulo}>
              {formatarDistancia(rota.distanciaKm)} até o passageiro · aproximadamente{' '}
              {formatarDuracao(rota.duracaoMin)}
            </Text>
          )}
          <Button
            label="Cheguei · Confirmar embarque"
            onPress={confirmarEmbarque}
            loading={embarcando}
            disabled={cancelando}
            style={styles.painelBotao}
          />
          <Button
            label="Cancelar corrida"
            variant="ghost"
            onPress={abrirCancelamentoAtiva}
            disabled={embarcando || cancelando}
            style={styles.cancelarCorridaBotao}
          />
        </View>
      )}

      {corridaAtiva && embarcado && (
        <View style={styles.painelInferior}>
          <View style={styles.corridaAtivaTopo}>
            <View style={styles.corridaAtivaBadge}>
              <CheckIcon size={11} color={colors.background} />
            </View>
            <Text style={styles.corridaAtivaTexto}>Passageiro a bordo</Text>
          </View>
          <Text style={styles.novaCorridaTitulo}>A caminho do destino</Text>
          <View style={styles.novaCorridaLinha}>
            <View style={[styles.pontoRota, styles.pontoDestino]} />
            <Text style={styles.novaCorridaEndereco} numberOfLines={1}>
              {corridaAtiva.destino.endereco ?? 'Destino final'}
            </Text>
          </View>
          {rota && (
            <Text style={styles.painelSubtitulo}>
              {formatarDistancia(rota.distanciaKm)} até o destino · aproximadamente{' '}
              {formatarDuracao(rota.duracaoMin)}
            </Text>
          )}
          <Button
            label="Finalizar corrida"
            onPress={finalizarCorridaAtiva}
            loading={finalizando}
            style={styles.painelBotao}
          />
        </View>
      )}

      <StatusToast message={toastMensagem} tone={toastTom} topOffset={spacing.xxl + spacing.xl + spacing.md} />

      <CancelRideModal
        visible={cancelamentoVisivel}
        titulo="Cancelar essa corrida?"
        subtitulo="Ela pode ser oferecida a outro motorista — o passageiro não perde o pedido."
        motivos={MOTIVOS_CANCELAMENTO_MOTORISTA}
        carregando={cancelando}
        onConfirmar={confirmarCancelamentoAtiva}
        onFechar={() => setCancelamentoVisivel(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { ...StyleSheet.absoluteFill },
  mapBrightener: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 25, 63, 0.25)',
  },
  marcadorMotorista: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  topBar: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voltarBotao: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  voltarBotaoDesabilitado: { opacity: 0.4 },
  voltarTexto: { ...typography.caption, color: colors.text },
  pressedFeedback: { opacity: 0.65 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  statusPillOnline: { borderWidth: 1, borderColor: colors.primary },
  statusPonto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    marginRight: spacing.xs,
  },
  statusPontoOnline: { backgroundColor: colors.primary },
  statusTexto: { ...typography.caption, color: colors.text },
  painelInferior: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  erroTexto: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  painelTitulo: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  painelSubtitulo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  painelBotao: { marginTop: spacing.xs },
  cancelarCorridaBotao: { marginTop: spacing.xs },
  corridaAtivaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  corridaAtivaBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  corridaAtivaTexto: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  novaCorridaTitulo: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
  novaCorridaLinha: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  pontoRota: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  pontoOrigem: { backgroundColor: colors.primary },
  pontoDestino: { backgroundColor: colors.danger },
  novaCorridaEndereco: { ...typography.body, color: colors.text, flex: 1 },
  novaCorridaResumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  novaCorridaPreco: { ...typography.h2, color: colors.primary },
  novaCorridaDetalhe: { ...typography.caption, color: colors.textSecondary },
  novaCorridaBotoes: { flexDirection: 'row' },
  novaCorridaBotaoMetade: { flex: 1 },
  novaCorridaBotaoRecusar: { flex: 1, marginRight: spacing.sm },
  bloqueado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  bloqueadoTitulo: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  bloqueadoTexto: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  bloqueadoBotao: { minWidth: 160 },
});
