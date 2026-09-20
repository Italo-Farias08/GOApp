import React, { useMemo } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '../theme/theme';
import type { ThemeColors } from '../theme/theme';
import { useSheetModalAnimation } from '../hooks/useModalAnimation';
import { useTheme } from '../theme/ThemeContext';
import { formatarMoeda } from '../utils/precoCorrida';
import { ChevronLeftIcon, PixIcon } from './icons';

type Props = {
  visible: boolean;
  valor: number;
  carregando?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
};

// Modal que abre ao finalizar uma corrida cujo Pix já foi pago ANTES de
// começar (pix_prepago) — diferente do FinalizarCorridaModal, aqui não tem
// escolha nenhuma pra fazer: o dinheiro já está na conta da plataforma, só
// falta confirmar pro backend liberar o valor (menos a comissão) no saldo
// disponível pra saque do motorista.
export default function ConfirmarPixPrepagoModal({
  visible,
  valor,
  carregando = false,
  onConfirmar,
  onFechar,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { mounted, backdropOpacity, translateY } = useSheetModalAnimation(visible);
  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={carregando ? undefined : onFechar}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={carregando ? undefined : onFechar} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        <View style={styles.iconeWrap}>
          <PixIcon size={28} color={colors.primary} strokeWidth={1.8} />
        </View>

        <Text style={styles.titulo}>Essa corrida já está paga</Text>
        <Text style={styles.subtitulo}>
          O passageiro pagou via Pix antes mesmo de embarcar. O valor já está com a gente — ao
          confirmar, ele cai (com a comissão já descontada) no seu saldo disponível pra saque.
        </Text>

        <View style={styles.valorCard}>
          <Text style={styles.valorLabel}>Valor da corrida</Text>
          <Text style={styles.valorTexto}>{formatarMoeda(valor)}</Text>
        </View>

        <Pressable
          style={[styles.confirmarBotao, carregando && styles.confirmarBotaoDesabilitado]}
          onPress={carregando ? undefined : onConfirmar}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.confirmarBotaoTexto}>Confirmar e finalizar</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.voltarBotao, pressed && !carregando && styles.pressionado]}
          onPress={carregando ? undefined : onFechar}
          disabled={carregando}
        >
          <ChevronLeftIcon size={16} color={colors.textSecondary} />
          <Text style={styles.voltarTexto}>Voltar</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  iconeWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  titulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
  },
  subtitulo: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  valorCard: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  valorLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  valorTexto: {
    ...typography.h2,
    color: colors.primary,
    marginTop: 2,
  },
  confirmarBotao: {
    width: '100%',
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmarBotaoDesabilitado: {
    opacity: 0.7,
  },
  confirmarBotaoTexto: {
    ...typography.bodyBold,
    color: colors.onPrimary,
  },
  voltarBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginTop: spacing.xs,
  },
  pressionado: {
    opacity: 0.8,
  },
  voltarTexto: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
});
}