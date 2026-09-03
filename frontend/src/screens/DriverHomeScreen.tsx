import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import type { Socket } from 'socket.io-client';
import Button from '../components/Button';
import MapPin from '../components/MapPin';
import { CarIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useDriverLocationWatcher } from '../hooks/useDriverLocationWatcher';
import { useRota } from '../hooks/useRota';
import * as rideService from '../services/rideService';
import { conectarSoquete } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { Corrida, RootStackParamList } from '../types';
import { formatarDistancia, formatarDuracao, formatarMoeda } from '../utils/precoCorrida';
import { STADIA_TILE_URL } from '../utils/mapaConfig';

export default function DriverHomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [disponivel, setDisponivel] = useState(false);
  const [corridaRecebida, setCorridaRecebida] = useState<Corrida | null>(null);
  const [corridaAtiva, setCorridaAtiva] = useState<Corrida | null>(null);
  const [aceitando, setAceitando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { coords } = useDriverLocationWatcher(disponivel || !!corridaAtiva);
  const { rota, calcularRota, limparRota } = useRota();
  const mapRef = useRef<MapView>(null);
  const soqueteRef = useRef<Socket | null>(null);

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

      soquete.on('corrida:cancelada', ({ corridaId }: { corridaId: string }) => {
        if (!ativo) return;
        setCorridaAtiva((atual) => (atual?.id === corridaId ? null : atual));
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

  // Calcula a rota até o passageiro assim que a corrida é aceita, e limpa
  // quando ela termina.
  useEffect(() => {
    if (corridaAtiva && coords) {
      calcularRota(coords, corridaAtiva.origem);
      mapRef.current?.fitToCoordinates(
        [corridaAtiva.origem, corridaAtiva.destino],
        { edgePadding: { top: 100, right: 60, bottom: 280, left: 60 }, animated: true }
      );
    } else {
      limparRota();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corridaAtiva?.id]);

  async function aceitarCorridaRecebida() {
    if (!corridaRecebida) return;
    setAceitando(true);
    setErro(null);
    try {
      const { corrida } = await rideService.aceitarCorrida(corridaRecebida.id);
      setCorridaAtiva(corrida);
      setCorridaRecebida(null);
      setDisponivel(false);
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

  async function finalizarCorridaAtiva() {
    if (!corridaAtiva) return;
    setFinalizando(true);
    try {
      await rideService.finalizarCorrida(corridaAtiva.id);
    } catch {
      // segue liberando a tela mesmo se a chamada falhar
    } finally {
      setCorridaAtiva(null);
      setFinalizando(false);
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

        {corridaAtiva && (
          <>
            <Marker coordinate={corridaAtiva.origem} anchor={{ x: 0.5, y: 0.85 }} title="Passageiro">
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
          <View style={[styles.statusPonto, disponivel && styles.statusPontoOnline]} />
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
        <View style={styles.painelInferior}>
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
        </View>
      )}

      {corridaAtiva && (
        <View style={styles.painelInferior}>
          <Text style={styles.novaCorridaTitulo}>Corrida em andamento</Text>
          <View style={styles.novaCorridaLinha}>
            <View style={[styles.pontoRota, styles.pontoDestino]} />
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
            label="Finalizar corrida"
            onPress={finalizarCorridaAtiva}
            loading={finalizando}
            style={styles.painelBotao}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { ...StyleSheet.absoluteFillObject },
  mapBrightener: {
    ...StyleSheet.absoluteFillObject,
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
