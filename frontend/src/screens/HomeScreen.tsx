import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import MapPin from '../components/MapPin';
import RideOptionsModal from '../components/RideOptionsModal';
import SettingsModal from '../components/SettingsModal';
import { CloseIcon, SettingsIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useAddressSearch, EnderecoSugerido } from '../hooks/useAddressSearch';
import { useRota } from '../hooks/useRota';
import { colors, radius, spacing, typography } from '../theme/theme';
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

const FALLBACK_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Estilo "Alidade Smooth Dark" da Stadia Maps — versão escura do design.
// Camada mapBrightener por cima clareia um pouco o contraste, sem trocar o mapa.
const STADIA_TILE_URL = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${process.env.EXPO_PUBLIC_STADIA_KEY}`;

export default function HomeScreen() {
  const { user } = useAuth();
  const { coords, isLoading, errorMessage } = useCurrentLocation();
  const [destination, setDestination] = useState('');
  const [destinoSelecionado, setDestinoSelecionado] = useState<EnderecoSugerido | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [opcoesVisiveis, setOpcoesVisiveis] = useState(false);
  const [estimativas, setEstimativas] = useState<EstimativaCorrida[]>([]);
  const [corridaConfirmada, setCorridaConfirmada] = useState<EstimativaCorrida | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const mapRef = useRef<MapView>(null);

  // Levanta o cartão de baixo pra acompanhar o teclado, em vez de deixar
  // o teclado cobrir o campo de destino (que é fixo no bottom: 0).
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (evento) => {
      setKeyboardHeight(evento.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const { sugestoes, buscando, erro: erroBusca } = useAddressSearch(
    destinoSelecionado ? '' : destination, // some com a lista assim que um destino é escolhido
    coords
  );

  const { rota, carregando: calculandoRota, erro: erroRota, calcularRota, limparRota } = useRota();

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : FALLBACK_REGION;

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

    // Calcula e desenha a rota assim que o endereço é escolhido —
    // não precisa esperar o botão "Buscar corrida" pra isso.
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

  function buscarCorrida() {
    if (!rota) return;
    setEstimativas(gerarEstimativas(rota.distanciaKm, rota.duracaoMin));
    setOpcoesVisiveis(true);
  }

  function confirmarVeiculo(tipo: TipoVeiculo) {
    const escolhida = estimativas.find((estimativa) => estimativa.tipo === tipo);
    if (escolhida) setCorridaConfirmada(escolhida);
    setOpcoesVisiveis(false);
  }

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
      </MapView>

      <View pointerEvents="none" style={styles.mapBrightener} />

      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© Stadia Maps © OpenMapTiles © OpenStreetMap</Text>
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Buscando sua localização...</Text>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <View style={styles.topBar}>
        <Text style={styles.greeting}>
          Olá, {user?.name?.split(' ')[0] ?? 'por aí'} 👋
        </Text>
        <Pressable onPress={() => setSettingsVisible(true)} style={styles.settingsButton}>
          <SettingsIcon size={18} color={colors.text} />
        </Pressable>
      </View>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      <View style={[styles.bottomSheet, { bottom: keyboardHeight }]}>
        <Text style={styles.bottomTitle}>Para onde vamos?</Text>
        <View style={styles.destinationRow}>
          <View style={styles.dot} />
          <TextInput
            style={styles.destinationInput}
            placeholder="Digite o endereço de destino"
            placeholderTextColor={colors.textMuted}
            value={destination}
            onChangeText={(texto) => {
              setDestination(texto);
              if (destinoSelecionado) setDestinoSelecionado(null);
            }}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {buscando && <ActivityIndicator size="small" color={colors.textMuted} />}
          {!!destination && !buscando && (
            <Pressable onPress={limparDestino} hitSlop={10} style={styles.clearButton}>
              <CloseIcon size={14} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {!!erroBusca && <Text style={styles.errorHint}>{erroBusca}</Text>}
        {!!erroRota && <Text style={styles.errorHint}>{erroRota}</Text>}

        {calculandoRota && (
          <Text style={styles.rotaInfo}>Calculando rota...</Text>
        )}
        {!calculandoRota && rota && !corridaConfirmada && (
          <Text style={styles.rotaInfo}>
            {formatarDistancia(rota.distanciaKm)} · aproximadamente {formatarDuracao(rota.duracaoMin)}
          </Text>
        )}

        {corridaConfirmada && (
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
              <Text style={styles.confirmacaoSubtexto}>Procurando um motorista perto de você...</Text>
            </View>
          </View>
        )}

        {!destinoSelecionado && sugestoes.length > 0 && (
          <FlatList
            style={styles.sugestoesLista}
            data={sugestoes}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.sugestaoItem} onPress={() => selecionarSugestao(item)}>
                <Text style={styles.sugestaoTexto} numberOfLines={2}>
                  {item.descricao}
                </Text>
              </Pressable>
            )}
          />
        )}

        <Pressable
          style={[
            styles.confirmButton,
            (!destinoSelecionado || calculandoRota || !rota) && styles.confirmButtonDisabled,
          ]}
          disabled={!destinoSelecionado || calculandoRota || !rota}
          onPress={buscarCorrida}
        >
          {calculandoRota ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.confirmLabel}>Buscar corrida</Text>
          )}
        </Pressable>
      </View>

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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
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
  greeting: {
    ...typography.bodyBold,
    color: colors.text,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
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
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  bottomTitle: {
    ...typography.h2,
    color: colors.text,
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
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  destinationInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  clearButton: {
    padding: spacing.xs,
  },
  errorHint: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
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
  confirmacaoSubtexto: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sugestoesLista: {
    maxHeight: 180,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sugestaoItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sugestaoTexto: {
    ...typography.body,
    color: colors.text,
  },
  confirmButton: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmLabel: {
    ...typography.button,
    color: colors.background,
  },
});