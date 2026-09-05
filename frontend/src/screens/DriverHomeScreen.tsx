import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import type { Socket } from 'socket.io-client';
import Button from '../components/Button';
import CancelRideModal from '../components/CancelRideModal';
import ChatModal from '../components/ChatModal';
import MapPin from '../components/MapPin';
import StatusToast, { StatusToastTone } from '../components/StatusToast';
import SwipeButton from '../components/SwipeButton';
import {
  AlertIcon,
  CarIcon,
  ChatIcon,
  CheckIcon,
  ChevronLeftIcon,
  LocationIcon,
  MotoIcon,
} from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useDriverLocationWatcher } from '../hooks/useDriverLocationWatcher';
import { useRota } from '../hooks/useRota';
import * as rideService from '../services/rideService';
import { conectarSoquete } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { Corrida, MensagemChat, RootStackParamList } from '../types';
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

// Sombra padrão dos elementos que "flutuam" sobre o mapa (pills do topo,
// botão de recentralizar) — sem ela, esses elementos pareciam colados na
// tela em vez de flutuando por cima do mapa.
const sombraFlutuante = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 6,
  elevation: 6,
} as const;

// Switch animado de "ficar online" — troca o botão de texto cheio por um
// controle compacto, do jeito que apps de motorista de verdade fazem.
function ToggleOnline({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      friction: 7,
      tension: 70,
    }).start();
  }, [value]);

  const corTrilha = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceAlt, colors.primary],
  });
  const deslocamentoThumb = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <Pressable onPress={onToggle} hitSlop={10}>
      <Animated.View style={[toggleStyles.trilha, { backgroundColor: corTrilha }]}>
        <Animated.View style={[toggleStyles.thumb, { transform: [{ translateX: deslocamentoThumb }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const toggleStyles = StyleSheet.create({
  trilha: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
});

export default function DriverHomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  // Primeiro nome só, pra caber bem na saudação do painel offline.
  const primeiroNome = user?.name?.trim().split(/\s+/)[0] || 'motorista';

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

  // Altura real do painel inferior (varia conforme o estado: offline, nova
  // corrida, corrida ativa) — usada só pra posicionar o botão flutuante de
  // recentralizar sempre coladinho acima dele, sem sobrepor nada.
  const [alturaPainel, setAlturaPainel] = useState(0);
  function medirPainel(evento: LayoutChangeEvent) {
    const altura = evento.nativeEvent.layout.height;
    setAlturaPainel((atual) => (Math.abs(atual - altura) > 0.5 ? altura : atual));
  }

  // Desde quando o motorista está online nessa sessão de busca — só pra
  // mostrar "Online há X min" no painel. Puramente local/visual, não muda
  // nenhuma regra de negócio.
  const [inicioSessao, setInicioSessao] = useState<number | null>(null);
  const [, forcarRelogio] = useState(0);
  useEffect(() => {
    if (!disponivel) {
      setInicioSessao(null);
      return;
    }
    setInicioSessao(Date.now());
    const intervalo = setInterval(() => forcarRelogio((n) => n + 1), 30000);
    return () => clearInterval(intervalo);
  }, [disponivel]);
  const minutosOnline = inicioSessao ? Math.round((Date.now() - inicioSessao) / 60000) : 0;

  function recentralizarMapa() {
    if (!coords) return;
    mapRef.current?.animateToRegion(
      { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      450
    );
  }

  const avisoContadorRef = useRef(0);
  function avisar(mensagem: string, tom: StatusToastTone = 'info') {
    avisoContadorRef.current += 1;
    setToastTom(tom);
    setToastMensagem(mensagem + '\u200B'.repeat(avisoContadorRef.current % 2));
  }

  // --- Trava de segurança: com uma corrida ativa, o motorista NÃO pode sair
  // da tela por acidente. Antes, só o botão "Modo passageiro" ficava
  // desabilitado — mas o gesto nativo de arrastar da borda pra voltar (iOS)
  // e o botão físico de voltar (Android) continuavam funcionando por fora
  // dele. Um arrasto mal feito no SwipeButton perto da borda esquerda podia
  // disparar esse gesto e jogar o motorista de volta pra tela de passageiro
  // no meio da corrida. Aqui a gente desliga o gesto e barra qualquer
  // tentativa de navegação pra fora enquanto `corridaAtiva` existir.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !corridaAtiva });
  }, [corridaAtiva, navigation]);

  useEffect(() => {
    const cancelarSaida = navigation.addListener('beforeRemove', (evento) => {
      if (!corridaAtiva) return;
      evento.preventDefault();
      avisar('Finalize ou cancele a corrida atual antes de sair.', 'warning');
    });
    return cancelarSaida;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, corridaAtiva]);

  useEffect(() => {
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!corridaAtiva) return false;
      avisar('Finalize ou cancele a corrida atual antes de sair.', 'warning');
      return true; // consome o back físico do Android, não deixa sair da tela
    });
    return () => assinatura.remove();
  }, [corridaAtiva]);

  // --- Chat com o passageiro ---
  const [chatVisivel, setChatVisivel] = useState(false);
  const [mensagensChat, setMensagensChat] = useState<MensagemChat[]>([]);
  const [carregandoHistoricoChat, setCarregandoHistoricoChat] = useState(false);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState(0);
  const corridaAtivaIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);
  useEffect(() => {
    corridaAtivaIdRef.current = corridaAtiva?.id ?? null;
  }, [corridaAtiva?.id]);

  // Busca o histórico assim que a corrida é aceita — sem isso o chat abriria
  // vazio de novo se o motorista fechar e reabrir a conversa.
  useEffect(() => {
    if (!corridaAtiva) {
      setMensagensChat([]);
      setMensagensNaoLidas(0);
      return;
    }
    let ativo = true;
    setCarregandoHistoricoChat(true);
    rideService
      .listarMensagens(corridaAtiva.id)
      .then((mensagens) => {
        if (ativo) setMensagensChat(mensagens);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregandoHistoricoChat(false);
      });
    return () => {
      ativo = false;
    };
  }, [corridaAtiva?.id]);

  function abrirChat() {
    setMensagensNaoLidas(0);
    setChatVisivel(true);
  }

  function enviarMensagemChat(texto: string) {
    if (!corridaAtiva) return;
    soqueteRef.current?.emit('chat:mensagem', { corridaId: corridaAtiva.id, texto });
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

      // Mensagem nova do chat — só aceita se for da corrida ativa. Se o chat
      // estiver fechado no momento, conta como "não lida".
      soquete.on('corrida:mensagem', (mensagem: MensagemChat) => {
        if (!ativo || mensagem.corridaId !== corridaAtivaIdRef.current) return;
        setMensagensChat((atual) => [...atual, mensagem]);
        setChatVisivel((visivelAtual) => {
          if (!visivelAtual && mensagem.remetenteId !== userIdRef.current) {
            setMensagensNaoLidas((n) => n + 1);
          }
          return visivelAtual;
        });
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
      soqueteRef.current?.off('corrida:mensagem');
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
        <View style={styles.bloqueadoIconWrap}>
          <AlertIcon size={26} color={colors.warning} />
        </View>
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

      {coords && (
        <Pressable
          onPress={recentralizarMapa}
          style={({ pressed }) => [
            styles.recentralizarBotao,
            { bottom: alturaPainel + spacing.md },
            pressed && styles.pressedFeedback,
          ]}
        >
          <LocationIcon size={20} color={colors.text} />
        </Pressable>
      )}

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={!!corridaAtiva}
          style={({ pressed }) => [
            styles.voltarBotao,
            !!corridaAtiva && styles.voltarBotaoDesabilitado,
            pressed && styles.pressedFeedback,
          ]}
        >
          <ChevronLeftIcon size={14} color={colors.text} />
          <Text style={styles.voltarTexto}>Modo passageiro</Text>
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
        <View
          style={[styles.painelInferior, { paddingBottom: spacing.xl + insets.bottom }]}
          onLayout={medirPainel}
        >
          <View style={styles.grabber} />
          {!!erro && (
            <View style={styles.erroLinha}>
              <AlertIcon size={14} color={colors.danger} />
              <Text style={styles.erroTexto}>{erro}</Text>
            </View>
          )}
          <View style={styles.statusHeaderRow}>
            <View style={styles.statusHeaderTextos}>
              <Text style={styles.painelTitulo}>
                {disponivel ? 'Você está online' : `Olá, ${primeiroNome}`}
              </Text>
              <Text style={styles.painelSubtitulo}>
                {disponivel
                  ? 'Procurando corridas perto de você...'
                  : 'Fique online pra começar a receber pedidos de corrida.'}
              </Text>
            </View>
            <View style={styles.toggleColuna}>
              <ToggleOnline value={disponivel} onToggle={() => setDisponivel((atual) => !atual)} />
              <Text style={styles.toggleLegenda}>{disponivel ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
          {disponivel && (
            <View style={styles.sessaoPill}>
              <View style={styles.sessaoPonto} />
              <Text style={styles.sessaoTexto}>Online há {formatarDuracao(minutosOnline)}</Text>
            </View>
          )}
        </View>
      )}

      {corridaRecebida && (
        <Animated.View
          onLayout={medirPainel}
          style={[
            styles.painelInferior,
            { paddingBottom: spacing.xl + insets.bottom },
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
          <View style={styles.grabber} />
          <View style={styles.painelHeaderComIcone}>
            <View style={styles.veiculoAvatar}>
              {corridaRecebida.tipoVeiculo === 'moto' ? (
                <MotoIcon size={20} color={colors.primary} />
              ) : (
                <CarIcon size={20} color={colors.primary} />
              )}
            </View>
            <Text style={styles.novaCorridaTitulo}>Nova corrida</Text>
          </View>
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
        <View
          style={[styles.painelInferior, { paddingBottom: spacing.xl + insets.bottom }]}
          onLayout={medirPainel}
        >
          <View style={styles.grabber} />
          <View style={styles.corridaAtivaTopo}>
            <View style={styles.corridaAtivaBadge}>
              <CheckIcon size={11} color={colors.background} />
            </View>
            <Text style={styles.corridaAtivaTexto}>Corrida aceita</Text>
          </View>
          <View style={styles.painelHeaderComIcone}>
            <View style={styles.veiculoAvatar}>
              {corridaAtiva.tipoVeiculo === 'moto' ? (
                <MotoIcon size={20} color={colors.primary} />
              ) : (
                <CarIcon size={20} color={colors.primary} />
              )}
            </View>
            <Text style={styles.novaCorridaTitulo}>A caminho do passageiro</Text>
          </View>
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
          <SwipeButton
            label="Arraste para confirmar · Cheguei"
            onConfirm={confirmarEmbarque}
            loading={embarcando}
            disabled={cancelando}
            style={styles.painelBotao}
          />
          <Pressable
            onPress={abrirChat}
            style={({ pressed }) => [styles.chatBotao, pressed && styles.pressedFeedback]}
          >
            <ChatIcon size={18} color={colors.background} />
            <Text style={styles.chatBotaoTexto}>Conversar com o passageiro</Text>
            {mensagensNaoLidas > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeTexto}>{mensagensNaoLidas > 9 ? '9+' : mensagensNaoLidas}</Text>
              </View>
            )}
          </Pressable>
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
        <View
          style={[styles.painelInferior, { paddingBottom: spacing.xl + insets.bottom }]}
          onLayout={medirPainel}
        >
          <View style={styles.grabber} />
          <View style={styles.corridaAtivaTopo}>
            <View style={styles.corridaAtivaBadge}>
              <CheckIcon size={11} color={colors.background} />
            </View>
            <Text style={styles.corridaAtivaTexto}>Passageiro a bordo</Text>
          </View>
          <View style={styles.painelHeaderComIcone}>
            <View style={styles.veiculoAvatar}>
              {corridaAtiva.tipoVeiculo === 'moto' ? (
                <MotoIcon size={20} color={colors.primary} />
              ) : (
                <CarIcon size={20} color={colors.primary} />
              )}
            </View>
            <Text style={styles.novaCorridaTitulo}>A caminho do destino</Text>
          </View>
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
          <Pressable
            onPress={abrirChat}
            style={({ pressed }) => [styles.chatBotao, pressed && styles.pressedFeedback]}
          >
            <ChatIcon size={18} color={colors.background} />
            <Text style={styles.chatBotaoTexto}>Conversar com o passageiro</Text>
            {mensagensNaoLidas > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeTexto}>{mensagensNaoLidas > 9 ? '9+' : mensagensNaoLidas}</Text>
              </View>
            )}
          </Pressable>
          <Button
            label="Finalizar corrida"
            onPress={finalizarCorridaAtiva}
            loading={finalizando}
            style={styles.painelBotao}
          />
        </View>
      )}

      <StatusToast message={toastMensagem} tone={toastTom} topOffset={insets.top + spacing.xxl + spacing.xs} />

      <CancelRideModal
        visible={cancelamentoVisivel}
        titulo="Cancelar essa corrida?"
        subtitulo="Ela pode ser oferecida a outro motorista — o passageiro não perde o pedido."
        motivos={MOTIVOS_CANCELAMENTO_MOTORISTA}
        carregando={cancelando}
        onConfirmar={confirmarCancelamentoAtiva}
        onFechar={() => setCancelamentoVisivel(false)}
      />

      <ChatModal
        visible={chatVisivel}
        outroNome={corridaAtiva?.passageiroNome ?? 'Passageiro'}
        meuId={user?.id ?? ''}
        mensagens={mensagensChat}
        carregandoHistorico={carregandoHistoricoChat}
        onEnviar={enviarMensagemChat}
        onFechar={() => setChatVisivel(false)}
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
    ...sombraFlutuante,
  },
  topBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voltarBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...sombraFlutuante,
  },
  voltarBotaoDesabilitado: { opacity: 0.4 },
  voltarTexto: { ...typography.caption, color: colors.text, marginLeft: 4 },
  pressedFeedback: { opacity: 0.65 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...sombraFlutuante,
  },
  statusPillOnline: { borderWidth: 1, borderColor: colors.primary },
  recentralizarBotao: {
    position: 'absolute',
    right: spacing.lg,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...sombraFlutuante,
  },
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
  // Alcinha no topo do painel — mesmo sinal visual de "bottom sheet" usado
  // na tela do passageiro, dá a sensação de painel que pode ser puxado.
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  erroLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  erroTexto: { ...typography.caption, color: colors.danger, marginLeft: spacing.xs, flex: 1 },
  painelTitulo: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  painelSubtitulo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  painelBotao: { marginTop: spacing.xs },
  // Cabeçalho do painel offline: saudação/status de um lado, switch do outro.
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusHeaderTextos: { flex: 1, marginRight: spacing.md },
  toggleColuna: { alignItems: 'center' },
  toggleLegenda: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Chipzinho "Online há X min" — puramente informativo, sessão local.
  sessaoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  sessaoPonto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: spacing.xs,
  },
  sessaoTexto: { ...typography.caption, fontSize: 12, color: colors.text },
  // Cabeçalho com avatar do veículo, usado nos cards de corrida (nova
  // corrida / a caminho do passageiro / a caminho do destino).
  painelHeaderComIcone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  veiculoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  chatBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  chatBotaoTexto: {
    ...typography.bodyBold,
    color: colors.background,
    marginLeft: spacing.sm,
  },
  chatBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: spacing.sm,
  },
  chatBadgeTexto: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.background,
  },
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
  novaCorridaTitulo: { ...typography.h2, color: colors.text, flex: 1 },
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
  bloqueadoIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,176,32,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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