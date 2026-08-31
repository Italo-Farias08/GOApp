import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import SettingsModal from '../components/SettingsModal';
import { useAuth } from '../context/AuthContext';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useAddressSearch, EnderecoSugerido } from '../hooks/useAddressSearch';
import { colors, radius, spacing, typography } from '../theme/theme';

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
  const mapRef = useRef<MapView>(null);

  const { sugestoes, buscando, erro: erroBusca } = useAddressSearch(
    destinoSelecionado ? '' : destination, // some com a lista assim que um destino é escolhido
    coords
  );

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : FALLBACK_REGION;

  function selecionarSugestao(item: EnderecoSugerido) {
    setDestinoSelecionado(item);
    setDestination(item.descricao);
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
  }

  function limparDestino() {
    setDestination('');
    setDestinoSelecionado(null);
    Keyboard.dismiss();
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
          <Marker coordinate={coords} title="Você está aqui" pinColor={colors.primary} />
        )}
        {destinoSelecionado && (
          <Marker
            coordinate={destinoSelecionado}
            title="Destino"
            description={destinoSelecionado.descricao}
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
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      <View style={styles.bottomSheet}>
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
            <Pressable onPress={limparDestino} hitSlop={10}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>

        {!!erroBusca && <Text style={styles.errorHint}>{erroBusca}</Text>}

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
          style={[styles.confirmButton, !destinoSelecionado && styles.confirmButtonDisabled]}
          disabled={!destinoSelecionado}
          onPress={() => {
            // TODO: quando o backend existir, aqui entra a chamada pra buscar
            // rota/preço e navegar pra tela de confirmação da corrida.
            // destinoSelecionado já tem { latitude, longitude, descricao } prontos pra usar.
          }}
        >
          <Text style={styles.confirmLabel}>Buscar corrida</Text>
        </Pressable>
      </View>
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
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
  },
  settingsIcon: {
    fontSize: 18,
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
  clearIcon: {
    color: colors.textSecondary,
    fontSize: 16,
    paddingLeft: spacing.sm,
  },
  errorHint: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
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