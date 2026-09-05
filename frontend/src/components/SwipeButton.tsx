import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import { ArrowRightIcon, CheckIcon } from './icons';

type Props = {
  // Texto mostrado na trilha enquanto ainda não foi arrastado.
  label: string;
  // Chamado quando o arraste chega até o fim (mesmo papel do onPress de um
  // botão normal) — ações críticas tipo "confirmar embarque" ou "finalizar
  // corrida" fazem sentido aqui, exatamente pra não disparar com um toque
  // sem querer.
  onConfirm: () => void;
  // true enquanto a ação pedida pelo onConfirm ainda está em andamento
  // (chamada à API, por exemplo) — trava o arraste no fim e mostra um
  // spinner em vez da seta.
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

const ALTURA = 56;
const PADDING_TRILHA = 4;
const TAMANHO_PUXADOR = ALTURA - PADDING_TRILHA * 2;
// Só conta como "confirmado" se arrastar pelo menos essa fração da trilha —
// evita disparar com um arraste curto que pareceria mais um toque.
const LIMIAR_CONFIRMACAO = 0.72;

// Botão de "arraste para confirmar": em vez de disparar a ação com um tap
// (fácil de acontecer sem querer, principalmente com o celular balançando
// dentro do carro), só confirma quando o puxador é arrastado até o fim da
// trilha. Solta antes do fim e ele volta pro início sozinho.
export default function SwipeButton({ label, onConfirm, loading = false, disabled = false, style }: Props) {
  const [larguraTrilha, setLarguraTrilha] = useState(0);
  const [concluido, setConcluido] = useState(false);
  const pan = useRef(new Animated.Value(0)).current;
  const panValorRef = useRef(0);
  const larguraTrilhaRef = useRef(0);

  useEffect(() => {
    const id = pan.addListener(({ value }) => {
      panValorRef.current = value;
    });
    return () => pan.removeListener(id);
  }, [pan]);

  useEffect(() => {
    larguraTrilhaRef.current = larguraTrilha;
  }, [larguraTrilha]);

  // Quando o carregamento externo termina (a chamada à API deu erro e o
  // botão continua na tela, por exemplo), o puxador volta pro início pra dar
  // outra chance de arrastar — se tivesse dado certo, o botão já teria
  // sumido junto com o resto da tela.
  useEffect(() => {
    if (!loading && concluido) {
      Animated.timing(pan, { toValue: 0, duration: 220, useNativeDriver: false }).start();
      setConcluido(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function larguraMaxima() {
    return Math.max(larguraTrilhaRef.current - TAMANHO_PUXADOR - PADDING_TRILHA * 2, 1);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !loading && !concluido,
      onMoveShouldSetPanResponder: (_evento, gesto) =>
        !disabled && !loading && !concluido && Math.abs(gesto.dx) > 2,
      onPanResponderMove: (_evento, gesto) => {
        const max = larguraMaxima();
        const novoValor = Math.min(Math.max(gesto.dx, 0), max);
        pan.setValue(novoValor);
      },
      onPanResponderRelease: () => {
        const max = larguraMaxima();
        if (panValorRef.current >= max * LIMIAR_CONFIRMACAO) {
          Animated.timing(pan, { toValue: max, duration: 140, useNativeDriver: false }).start(() => {
            setConcluido(true);
            onConfirm();
          });
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (!concluido) {
          Animated.spring(pan, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
    })
  ).current;

  function aoMedirTrilha(evento: LayoutChangeEvent) {
    setLarguraTrilha(evento.nativeEvent.layout.width);
  }

  const max = Math.max(larguraTrilha - TAMANHO_PUXADOR - PADDING_TRILHA * 2, 1);
  const isDesabilitado = disabled && !loading && !concluido;

  return (
    <View style={[styles.trilha, isDesabilitado && styles.trilhaDesabilitada, style]} onLayout={aoMedirTrilha}>
      {/* Preenchimento verde que cresce junto com o puxador — dá o feedback
          de "quanto falta" pra completar o arraste. */}
      <Animated.View
        style={[
          styles.preenchimento,
          { width: Animated.add(pan, TAMANHO_PUXADOR + PADDING_TRILHA) },
        ]}
      />

      <Animated.Text
        style={[
          styles.rotulo,
          {
            opacity: pan.interpolate({
              inputRange: [0, Math.max(max * 0.6, 1)],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>

      <Animated.View style={[styles.puxador, { transform: [{ translateX: pan }] }]} {...panResponder.panHandlers}>
        {loading ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : concluido ? (
          <CheckIcon size={20} color={colors.background} />
        ) : (
          <ArrowRightIcon size={22} color={colors.background} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  trilha: {
    height: ALTURA,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trilhaDesabilitada: {
    opacity: 0.5,
  },
  preenchimento: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primaryPressed,
  },
  rotulo: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: TAMANHO_PUXADOR + spacing.md,
  },
  puxador: {
    position: 'absolute',
    left: PADDING_TRILHA,
    top: PADDING_TRILHA,
    width: TAMANHO_PUXADOR,
    height: TAMANHO_PUXADOR,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});