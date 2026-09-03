import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import { AlertIcon, CheckIcon } from './icons';

export type StatusToastTone = 'success' | 'info' | 'warning' | 'danger';

type Props = {
  // Trocar essa string (mesmo que pro mesmo texto de novo) faz o toast
  // reaparecer — controle simples de "avisar algo agora".
  message: string | null;
  tone?: StatusToastTone;
  duration?: number;
  topOffset?: number;
  onHide?: () => void;
};

const CORES: Record<StatusToastTone, string> = {
  success: colors.primary,
  info: colors.text,
  warning: colors.warning,
  danger: colors.danger,
};

// Banner animado que entra com uma molinha, fica um tempo na tela e some
// sozinho — usado pra marcar momentos importantes do ciclo da corrida
// ("Corrida aceita!", "O motorista cancelou, buscando outro...") sem
// depender só de um texto estático dentro do cartão.
export default function StatusToast({
  message,
  tone = 'info',
  duration = 3200,
  topOffset,
  onHide,
}: Props) {
  const [mensagemExibida, setMensagemExibida] = useState<string | null>(null);
  const [toneExibido, setToneExibido] = useState<StatusToastTone>(tone);
  const anim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    setMensagemExibida(message);
    setToneExibido(tone);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    anim.setValue(0);

    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 10,
    }).start();

    timeoutRef.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setMensagemExibida(null);
        onHide?.();
      });
    }, duration);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, tone, duration]);

  if (!mensagemExibida) return null;

  const cor = CORES[toneExibido];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        typeof topOffset === 'number' && { top: topOffset },
        {
          borderColor: cor,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <View style={[styles.iconeBadge, { backgroundColor: cor }]}>
        {toneExibido === 'danger' || toneExibido === 'warning' ? (
          <AlertIcon size={14} color={colors.background} />
        ) : (
          <CheckIcon size={14} color={colors.background} />
        )}
      </View>
      <Text style={styles.texto} numberOfLines={2}>
        {mensagemExibida}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.xxl + spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 20,
  },
  iconeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  texto: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
});