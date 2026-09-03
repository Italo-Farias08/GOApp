import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  LayoutAnimation,
  LayoutChangeEvent,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import type { Socket } from 'socket.io-client';
import Button from '../components/Button';
import MapPin from '../components/MapPin';
import PromoBanners, { Banner } from '../components/PromoBanners';
import RideOptionsModal from '../components/RideOptionsModal';
import SettingsModal from '../components/SettingsModal';
import {
  AlertIcon,
  CarIcon,
  CloseIcon,
  LocationIcon,
  MotoIcon,
  PhoneIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
} from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useAddressSearch, EnderecoSugerido } from '../hooks/useAddressSearch';
import { useRota } from '../hooks/useRota';
import * as rideService from '../services/rideService';
import { conectarSoquete } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { Corrida, MotoristaInfo } from '../types';
import { STADIA_TILE_URL } from '../utils/mapaConfig';
import {
  EstimativaCorrida,
  TipoVeiculo,
  formatarDistancia,
  formatarDuracao,
  formatarMoeda,
  gerarEstimativas,
} from '../utils/precoCorrida';

// Imagens dos veículos — troque estes arquivos por fotos reais
// mantendo o mesmo nome/caminho (frontend/assets/images/carro.png e moto.png).
const IMAGEM_VEICULO: Record<TipoVeiculo, ReturnType<typeof require>> = {
  carro: require('../../assets/images/carro.png'),
  moto: require('../../assets/images/moto.png'),
};

// Banners promocionais do topo da Home — troque as imagens em
// assets/images/banners/ e edite title/subtitulo/onPress à vontade.
// Pra adicionar mais um, é só copiar um objeto e trocar o id/imagem.
const BANNERS: Banner[] = [
  {
    id: 'banner-1',
    imagem: require('../../assets/images/banners/banner1.png'),
  },
  {
    id: 'banner-2',
    imagem: require('../../assets/images/banners/banner2.png'),
  },
  {
    id: 'banner-3',
    imagem: require('../../assets/images/banners/banner3.png'),
  },
];

const FALLBACK_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Altura da tela — usada pra calcular os limites do cartão de baixo.
const ALTURA_TELA = Dimensions.get('window').height;

// O cartão se AJUSTA AO PRÓPRIO CONTEÚDO — nada de altura fixa deixando
// espaço vazio sobrando. Estes dois valores são só os limites de segurança:
// o cartão nunca fica menor que o mínimo nem maior que o máximo.
const SHEET_ALTURA_MINIMA = 230;
const SHEET_ALTURA_MAXIMA = ALTURA_TELA * 0.75;

// Teto da área rolável (erros/rota/confirmação/sugestões) — acima disso ela
// passa a rolar internamente em vez de empurrar o cartão pra cima.
const ALTURA_MAXIMA_CONTEUDO_ROLAVEL = 260;

// Degrau recolhido "de reserva", usado só até medirmos a altura real do
// grupo handle + input na primeira renderização — ver onLayout abaixo.
const SHEET_ALTURA_RECOLHIDA_PADRAO = 110;

// Android precisa habilitar isso manualmente pra LayoutAnimation funcionar.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Saudação de acordo com o horário — pequeno detalhe que faz a tela parecer
// viva em vez de estática.
function obterSaudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia,';
  if (hora < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { coords, isLoading, errorMessage } = useCurrentLocation();
  const [destination, setDestination] = useState('');
  const [destinoSelecionado, setDestinoSelecionado] = useState<EnderecoSugerido | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [opcoesVisiveis, setOpcoesVisiveis] = useState(false);
  const [estimativas, setEstimativas] = useState<EstimativaCorrida[]>([]);
  const [corridaConfirmada, setCorridaConfirmada] = useState<EstimativaCorrida | null>(null);
  const [inputFocado, setInputFocado] = useState(false);

  // --- Corrida real (backend + tempo real) ---
  const [corridaId, setCorridaId] = useState<string | null>(null);
  const [motoristaAtribuido, setMotoristaAtribuido] = useState<MotoristaInfo | null>(null);
  const [localizacaoMotorista, setLocalizacaoMotorista] = useState<{ latitude: number; longitude: number } | null>(null);
  const [cancelandoCorrida, setCancelandoCorrida] = useState(false);
  const corridaIdRef = useRef<string | null>(null);

  useEffect(() => {
    corridaIdRef.current = corridaId;
  }, [corridaId]);

  // --- Entrada suave da tela (topo, FAB e cartão aparecem com fade+slide
  // em vez de "estalar" na tela assim que o componente monta). ---
  const entradaAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entradaAnim, {
      toValue: 1,
      duration: 420,
      delay: 80,
      useNativeDriver: false, // 'bottom' do FAB não roda no driver nativo
    }).start();
  }, []);

  // --- Cartão de baixo arrastável (bottom sheet com 2 degraus) ---
  const [alturaRecolhida, setAlturaRecolhida] = useState(SHEET_ALTURA_RECOLHIDA_PADRAO);

  // Altura "natural" do conteúdo, medida ao vivo pelo onLayout do cartão —
  // é isso que evita espaço vazio sobrando: o cartão só cresce até onde o
  // conteúdo realmente precisa.
  const [alturaConteudo, setAlturaConteudo] = useState(SHEET_ALTURA_MINIMA);
  const alturaExpandida = Math.min(
    Math.max(alturaConteudo, SHEET_ALTURA_MINIMA),
    SHEET_ALTURA_MAXIMA
  );

  const [expandido, setExpandido] = useState(false);
  const panY = useRef(
    new Animated.Value(alturaExpandida - SHEET_ALTURA_RECOLHIDA_PADRAO)
  ).current;
  const alturaOcultavelRef = useRef(alturaExpandida - SHEET_ALTURA_RECOLHIDA_PADRAO);
  const valorAtualRef = useRef(alturaExpandida - SHEET_ALTURA_RECOLHIDA_PADRAO);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const alturaOcultavel = alturaExpandida - alturaRecolhida;
    alturaOcultavelRef.current = alturaOcultavel;
    if (!expandido) {
      valorAtualRef.current = alturaOcultavel;
      panY.setValue(alturaOcultavel);
    }
  }, [alturaRecolhida, alturaExpandida]);

  function irParaDegrau(paraExpandido: boolean) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const destino = paraExpandido ? 0 : alturaOcultavelRef.current;
    setExpandido(paraExpandido);
    valorAtualRef.current = destino;
    Animated.spring(panY, {
      toValue: destino,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evento, gesto) => Math.abs(gesto.dy) > 4,
      onPanResponderGrant: () => {
        panY.stopAnimation((valorAtual) => {
          valorAtualRef.current = valorAtual;
        });
      },
      onPanResponderMove: (_evento, gesto) => {
        const alturaOcultavel = alturaOcultavelRef.current;
        const novoValor = Math.min(
          alturaOcultavel,
          Math.max(0, valorAtualRef.current + gesto.dy)
        );
        panY.setValue(novoValor);
      },
      onPanResponderRelease: (_evento, gesto) => {
        const alturaOcultavel = alturaOcultavelRef.current;
        const posicaoFinal = Math.min(
          alturaOcultavel,
          Math.max(0, valorAtualRef.current + gesto.dy)
        );
        const deveExpandir =
          gesto.vy < -0.4 || (gesto.vy <= 0.4 && posicaoFinal < alturaOcultavel / 2);
        irParaDegrau(deveExpandir);
      },
    })
  ).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (evento) => {
      irParaDegrau(true);
      Animated.timing(keyboardOffset, {
        toValue: -evento.endCoordinates.height,
        duration: Platform.OS === 'ios' ? evento.duration ?? 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (evento) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? evento?.duration ?? 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const { sugestoes, buscando, erro: erroBusca } = useAddressSearch(
    destinoSelecionado ? '' : destination,
    coords
  );

  const { rota, carregando: calculandoRota, erro: erroRota, calcularRota, limparRota } = useRota();

  useEffect(() => {
    if (sugestoes.length > 0 || corridaConfirmada) {
      irParaDegrau(true);
    }
  }, [sugestoes.length, corridaConfirmada]);

  // Conecta ao socket e escuta o ciclo de vida da corrida (aceita, localização
  // do motorista ao vivo, finalizada, cancelada).
  useEffect(() => {
    let ativo = true;
    let soquete: Socket | null = null;

    (async () => {
      soquete = await conectarSoquete();

      soquete.on('corrida:aceita', ({ corridaId: id, motorista }: { corridaId: string; motorista: MotoristaInfo }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        setMotoristaAtribuido(motorista);
      });

      soquete.on('corrida:localizacao_motorista', ({ corridaId: id, latitude, longitude }: { corridaId: string; latitude: number; longitude: number }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        setLocalizacaoMotorista({ latitude, longitude });
      });

      soquete.on('corrida:finalizada', ({ corridaId: id }: { corridaId: string }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        resetarCorrida();
      });

      soquete.on('corrida:cancelada', ({ corridaId: id }: { corridaId: string }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        resetarCorrida();
      });
    })();

    return () => {
      ativo = false;
      soquete?.off('corrida:aceita');
      soquete?.off('corrida:localizacao_motorista');
      soquete?.off('corrida:finalizada');
      soquete?.off('corrida:cancelada');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetarCorrida() {
    setCorridaId(null);
    setCorridaConfirmada(null);
    setMotoristaAtribuido(null);
    setLocalizacaoMotorista(null);
    limparRota();
    setDestinoSelecionado(null);
    setDestination('');
  }

  async function cancelarBuscaCorrida() {
    if (!corridaId) return;
    setCancelandoCorrida(true);
    try {
      await rideService.cancelarCorrida(corridaId);
    } catch {
      // segue liberando a tela mesmo se a chamada falhar
    } finally {
      resetarCorrida();
      setCancelandoCorrida(false);
    }
  }

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : FALLBACK_REGION;

  function medirConteudo(evento: LayoutChangeEvent) {
    const novaAltura = evento.nativeEvent.layout.height;
    setAlturaConteudo((atual) => {
      if (Math.abs(atual - novaAltura) <= 1) return atual;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return novaAltura;
    });
  }

  async function selecionarSugestao(item: EnderecoSugerido) {
    setDestinoSelecionado(item);
    setDestination(item.descricao);
    setCorridaConfirmada(null);
    Keyboard.dismiss();

    mapRef.current?.animateToRegion(
      {
        latitude: item.latitude,
        longitude: item.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );

    if (coords) {
      const resultado = await calcularRota(coords, item);
      if (resultado) {
        mapRef.current?.fitToCoordinates(
          [coords, { latitude: item.latitude, longitude: item.longitude }],
          { edgePadding: { top: 80, right: 60, bottom: 320, left: 60 }, animated: true }
        );
      }
    }
  }

  function limparDestino() {
    setDestination('');
    setDestinoSelecionado(null);
    setCorridaConfirmada(null);
    limparRota();
    Keyboard.dismiss();
  }

  function recentralizarMapa() {
    if (!coords) return;
    mapRef.current?.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      400
    );
  }

  function buscarCorrida() {
    if (!rota) return;
    setEstimativas(gerarEstimativas(rota.distanciaKm, rota.duracaoMin));
    setOpcoesVisiveis(true);
  }

  async function confirmarVeiculo(tipo: TipoVeiculo) {
    const escolhida = estimativas.find((estimativa) => estimativa.tipo === tipo);
    setOpcoesVisiveis(false);
    if (!escolhida || !destinoSelecionado || !coords) return;

    setCorridaConfirmada(escolhida);
    setMotoristaAtribuido(null);
    setLocalizacaoMotorista(null);

    try {
      const corrida = await rideService.criarCorrida({
        origem: { latitude: coords.latitude, longitude: coords.longitude },
        destino: {
          latitude: destinoSelecionado.latitude,
          longitude: destinoSelecionado.longitude,
          endereco: destinoSelecionado.descricao,
        },
        tipoVeiculo: tipo,
        preco: escolhida.preco,
        distanciaKm: escolhida.distanciaKm,
        duracaoMin: escolhida.duracaoMin,
      });
      setCorridaId(corrida.id);
    } catch {
      setCorridaConfirmada(null);
    }
  }

  const destinoPronto = !!destinoSelecionado && !!rota;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        region={coords && !destinoSelecionado ? region : undefined}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <UrlTile urlTemplate={STADIA_TILE_URL} maximumZ={20} flipY={false} />

        {coords && (
          <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }} title="Você está aqui">
            <MapPin variant="origem" />
          </Marker>
        )}
        {destinoSelecionado && (
          <Marker
            coordinate={destinoSelecionado}
            anchor={{ x: 0.5, y: 0.85 }}
            title="Destino"
            description={destinoSelecionado.descricao}
          >
            <MapPin variant="destino" />
          </Marker>
        )}
        {rota && (
          <Polyline
            coordinates={rota.coordenadas}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}
        {localizacaoMotorista && (
          <Marker coordinate={localizacaoMotorista} anchor={{ x: 0.5, y: 0.5 }} title="Motorista a caminho">
            <View style={styles.marcadorMotorista}>
              {corridaConfirmada?.tipo === 'moto' ? (
                <MotoIcon size={16} color={colors.background} />
              ) : (
                <CarIcon size={16} color={colors.background} />
              )}
            </View>
          </Marker>
        )}
      </MapView>

      <View pointerEvents="none" style={styles.mapBrightener} />

      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© Stadia Maps © OpenMapTiles © OpenStreetMap</Text>
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Buscando sua localização...</Text>
          </View>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.errorBanner}>
          <AlertIcon size={16} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.topBar,
          {
            opacity: entradaAnim,
            transform: [
              {
                translateY: entradaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.perfilPill}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetra}>
              {(user?.name?.trim()?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.saudacaoLabel}>{obterSaudacao()}</Text>
            <Text style={styles.saudacaoNome} numberOfLines={1}>
              {user?.name?.split(' ')[0] ?? 'por aí'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => setSettingsVisible(true)}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressedFeedback]}
          hitSlop={6}
        >
          <SettingsIcon size={18} color={colors.text} />
        </Pressable>
      </Animated.View>

      {!!coords && (
        <Animated.View
          style={[
            styles.fabLocalizacao,
            {
              opacity: entradaAnim,
              bottom: Animated.add(
                Animated.subtract(alturaExpandida, Animated.add(panY, keyboardOffset)),
                spacing.md
              ),
            },
          ]}
        >
          <Pressable
            onPress={recentralizarMapa}
            style={({ pressed }) => [styles.fabToque, pressed && styles.pressedFeedback]}
            hitSlop={6}
          >
            <LocationIcon size={20} color={colors.text} />
          </Pressable>
        </Animated.View>
      )}

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            height: alturaExpandida,
            opacity: entradaAnim,
            transform: [{ translateY: Animated.add(panY, keyboardOffset) }],
          },
        ]}
      >
        <View onLayout={medirConteudo}>
          <View style={styles.cabecalhoArrastavel}>
            {expandido && <Text style={styles.bottomTitle}>Para onde vamos?</Text>}

            <View
              style={styles.grupoBase}
              onLayout={(evento) => setAlturaRecolhida(evento.nativeEvent.layout.height)}
            >
              <View style={styles.handleArea} {...panResponder.panHandlers}>
                <View style={styles.sheetHandle} />
              </View>
              <View style={[styles.destinationRow, inputFocado && styles.destinationRowFocado]}>
                <SearchIcon size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.destinationInput}
                  placeholder="Digite o endereço de destino"
                  placeholderTextColor={colors.textMuted}
                  value={destination}
                  onChangeText={(texto) => {
                    setDestination(texto);
                    if (destinoSelecionado) setDestinoSelecionado(null);
                  }}
                  onFocus={() => {
                    irParaDegrau(true);
                    setInputFocado(true);
                  }}
                  onBlur={() => setInputFocado(false)}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                {buscando && <ActivityIndicator size="small" color={colors.textMuted} />}
                {!!destination && !buscando && (
                  <Pressable
                    onPress={limparDestino}
                    hitSlop={10}
                    style={({ pressed }) => [styles.clearButton, pressed && styles.pressedFeedback]}
                  >
                    <CloseIcon size={14} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            </View>

            {expandido && !destinoSelecionado && !corridaConfirmada && sugestoes.length === 0 && (
              <View style={styles.promoSecao}>
                <Text style={styles.promoLabel}>Promoções pra você</Text>
                <PromoBanners banners={BANNERS} destaque />
              </View>
            )}
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollConteudo}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={expandido}
            bounces={false}
          >
            {!!erroBusca && (
              <View style={styles.errorHintRow}>
                <AlertIcon size={14} color={colors.danger} />
                <Text style={styles.errorHint}>{erroBusca}</Text>
              </View>
            )}
            {!!erroRota && (
              <View style={styles.errorHintRow}>
                <AlertIcon size={14} color={colors.danger} />
                <Text style={styles.errorHint}>{erroRota}</Text>
              </View>
            )}

            {calculandoRota && (
              <Text style={styles.rotaInfo}>Calculando rota...</Text>
            )}
            {!calculandoRota && rota && !corridaConfirmada && (
              <Text style={styles.rotaInfo}>
                {formatarDistancia(rota.distanciaKm)} · aproximadamente {formatarDuracao(rota.duracaoMin)}
              </Text>
            )}

            {corridaConfirmada && !motoristaAtribuido && (
              <View style={styles.confirmacaoBanner}>
                <View style={styles.confirmacaoIconeBadge}>
                  <Image
                    source={IMAGEM_VEICULO[corridaConfirmada.tipo]}
                    style={styles.confirmacaoIconeImagem}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                </View>
                <View style={styles.confirmacaoTextos}>
                  <Text style={styles.confirmacaoTexto}>
                    Corrida solicitada · {formatarMoeda(corridaConfirmada.preco)}
                  </Text>
                  <View style={styles.procurandoRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.confirmacaoSubtexto}>
                      Procurando um motorista perto de você...
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={cancelarBuscaCorrida}
                  disabled={cancelandoCorrida}
                  hitSlop={8}
                  style={({ pressed }) => [styles.cancelarBuscaBotao, pressed && styles.pressedFeedback]}
                >
                  <CloseIcon size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}

            {motoristaAtribuido && (
              <View style={styles.motoristaBanner}>
                <View style={styles.motoristaAvatar}>
                  <Text style={styles.motoristaAvatarLetra}>
                    {motoristaAtribuido.nome.trim()[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.motoristaTextos}>
                  <Text style={styles.motoristaNome} numberOfLines={1}>{motoristaAtribuido.nome}</Text>
                  <View style={styles.motoristaVeiculoRow}>
                    {corridaConfirmada?.tipo === 'moto' ? (
                      <MotoIcon size={14} color={colors.textSecondary} />
                    ) : (
                      <CarIcon size={14} color={colors.textSecondary} />
                    )}
                    <Text style={styles.motoristaVeiculoTexto} numberOfLines={1}>
                      {[motoristaAtribuido.veiculoModelo, motoristaAtribuido.veiculoCor].filter(Boolean).join(' · ')}
                      {motoristaAtribuido.veiculoPlaca ? ` · ${motoristaAtribuido.veiculoPlaca}` : ''}
                    </Text>
                  </View>
                </View>
                {!!motoristaAtribuido.telefone && (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${motoristaAtribuido.telefone}`)}
                    style={({ pressed }) => [styles.ligarBotao, pressed && styles.pressedFeedback]}
                    hitSlop={8}
                  >
                    <PhoneIcon size={18} color={colors.background} />
                  </Pressable>
                )}
              </View>
            )}

            {!destinoSelecionado && sugestoes.length > 0 && (
              <View style={styles.sugestoesLista}>
                {sugestoes.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.sugestaoItem,
                      pressed && styles.sugestaoItemPressed,
                    ]}
                    onPress={() => selecionarSugestao(item)}
                  >
                    <PinIcon size={16} color={colors.textMuted} />
                    <Text style={styles.sugestaoTexto} numberOfLines={2}>
                      {item.descricao}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          <Button
            label="Buscar corrida"
            onPress={buscarCorrida}
            loading={calculandoRota}
            disabled={!destinoPronto}
            style={styles.confirmButtonWrapper}
          />
        </View>
      </Animated.View>

      <RideOptionsModal
        visible={opcoesVisiveis}
        destino={destinoSelecionado?.descricao}
        estimativas={estimativas}
        onSelecionar={confirmarVeiculo}
        onClose={() => setOpcoesVisiveis(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapBrightener: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 25, 63, 0.25)',
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attributionText: {
    fontSize: 10,
    color: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
  },
  errorBanner: {
    position: 'absolute',
    top: spacing.xxl + spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginLeft: spacing.sm,
    flex: 1,
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
  perfilPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: 190,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarLetra: {
    ...typography.bodyBold,
    color: colors.background,
  },
  saudacaoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  saudacaoNome: {
    ...typography.bodyBold,
    color: colors.text,
    lineHeight: 18,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  pressedFeedback: {
    opacity: 0.65,
  },
  fabLocalizacao: {
    position: 'absolute',
    right: spacing.lg,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  fabToque: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  cabecalhoArrastavel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grupoBase: {
    // nada extra — o espaçamento do topo já vem do handleArea
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  sheetScroll: {
    maxHeight: ALTURA_MAXIMA_CONTEUDO_ROLAVEL,
    paddingHorizontal: spacing.lg,
  },
  sheetScrollConteudo: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  bottomTitle: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  destinationRowFocado: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  destinationInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  clearButton: {
    padding: spacing.xs,
    borderRadius: radius.full,
  },
  errorHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  errorHint: {
    ...typography.caption,
    color: colors.danger,
    marginLeft: spacing.xs,
    flex: 1,
  },
  rotaInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  confirmacaoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  confirmacaoIconeBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  confirmacaoIconeImagem: {
    width: 36,
    height: 36,
  },
  confirmacaoTextos: {
    flex: 1,
  },
  confirmacaoTexto: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  procurandoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  confirmacaoSubtexto: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  cancelarBuscaBotao: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  motoristaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  motoristaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  motoristaAvatarLetra: {
    ...typography.bodyBold,
    color: colors.background,
  },
  motoristaTextos: { flex: 1 },
  motoristaNome: {
    ...typography.bodyBold,
    color: colors.text,
  },
  motoristaVeiculoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  motoristaVeiculoTexto: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  ligarBotao: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
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
  sugestoesLista: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sugestaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sugestaoItemPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  sugestaoTexto: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  promoSecao: {
    marginBottom: spacing.md,
  },
  promoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  confirmButtonWrapper: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
