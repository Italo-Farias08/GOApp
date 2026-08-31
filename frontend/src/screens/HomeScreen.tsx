import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import SettingsModal from '../components/SettingsModal';
import { useAuth } from '../context/AuthContext';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { colors, radius, spacing, typography } from '../theme/theme';

const FALLBACK_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { coords, isLoading, errorMessage } = useCurrentLocation();
  const [destination, setDestination] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const mapRef = useRef<MapView>(null);

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : FALLBACK_REGION;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        region={coords ? region : undefined}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {coords && (
          <Marker
            coordinate={coords}
            title="Você está aqui"
            pinColor={colors.primary}
          />
        )}
      </MapView>

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
            onChangeText={setDestination}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {!!destination && (
            <Pressable
              onPress={() => {
                setDestination('');
                Keyboard.dismiss();
              }}
              hitSlop={10}
            >
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.confirmButton, !destination && styles.confirmButtonDisabled]}
          disabled={!destination}
          onPress={() => {
            // TODO: quando o backend existir, aqui entra a chamada pra buscar
            // rota/preço e navegar pra tela de confirmação da corrida.
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