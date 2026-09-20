import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

// Anima a entrada/saída dos modais em formato de "bottom sheet": o fundo
// escurece com um fade suave enquanto o conteúdo sobe com uma leve mola,
// em vez do corte seco do Modal nativo (animationType="slide" troca de
// tela sem nenhuma transição de opacidade, por exemplo). Fica montado até
// a animação de saída terminar, pra dar tempo do sheet descer/desaparecer
// antes do Modal sumir de verdade.
export function useSheetModalAnimation(visible: boolean) {
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          mass: 0.9,
          stiffness: 180,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 32,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return { mounted, backdropOpacity, translateY };
}

// Mesma ideia, mas pra modais centralizados (cartão no meio da tela) — em
// vez de subir de baixo, o cartão aparece com um leve zoom-in + fade.
export function useCenterModalAnimation(visible: boolean) {
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 16,
          mass: 0.9,
          stiffness: 180,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 160, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return { mounted, backdropOpacity, scale, contentOpacity };
}

// Transição usada dentro do SettingsModal pra trocar de "página" (menu ->
// conta, menu -> motorista, etc.) com um crossfade + leve deslocamento
// horizontal, tipo uma navegação em pilha, em vez de trocar a view na
// hora. `view` é o estado "alvo"; o hook guarda a última view renderizada
// e só troca DEPOIS que a animação de saída termina.
export function useStackViewTransition<T extends string>(view: T, backView: T) {
  const [displayedView, setDisplayedView] = useState(view);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const previousView = useRef(view);

  useEffect(() => {
    if (view === previousView.current) return;
    const indoParaTras = view === backView && previousView.current !== backView;
    const direcao = indoParaTras ? -1 : 1;

    Animated.parallel([
      Animated.timing(translateX, { toValue: direcao * -16, duration: 140, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setDisplayedView(view);
      translateX.setValue(direcao * 16);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    });

    previousView.current = view;
  }, [view, backView, translateX, opacity]);

  return { displayedView, translateX, opacity };
}