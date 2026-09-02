import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';

export type Banner = {
  id: string;
  imagem: ReturnType<typeof require>;
  titulo?: string;
  subtitulo?: string;
  onPress?: () => void;
};

type Props = {
  banners: Banner[];
  autoplayMs?: number;
  // Deixa o card um pouquinho maior — usado quando os banners aparecem
  // junto com o cartão expandido.
  destaque?: boolean;
};

const LARGURA_TELA = Dimensions.get('window').width;
const LARGURA_CARD = LARGURA_TELA - spacing.lg * 2;
const ALTURA_CARD_BASE = 150;
const ALTURA_CARD_DESTAQUE = 162;

export default function PromoBanners({ banners, autoplayMs = 4000, destaque = false }: Props) {
  const alturaCard = destaque ? ALTURA_CARD_DESTAQUE : ALTURA_CARD_BASE;
  const listRef = useRef<FlatList<Banner>>(null);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const indiceRef = useRef(0);

  // Autoplay: avança pro próximo slide sozinho, e volta pro primeiro
  // quando chega no fim.
  useEffect(() => {
    if (banners.length <= 1) return;

    const intervalo = setInterval(() => {
      const proximo = (indiceRef.current + 1) % banners.length;
      listRef.current?.scrollToIndex({ index: proximo, animated: true });
      indiceRef.current = proximo;
      setIndiceAtivo(proximo);
    }, autoplayMs);

    return () => clearInterval(intervalo);
  }, [banners.length, autoplayMs]);

  function aoRolarManualmente(evento: NativeSyntheticEvent<NativeScrollEvent>) {
    const indice = Math.round(evento.nativeEvent.contentOffset.x / LARGURA_CARD);
    indiceRef.current = indice;
    setIndiceAtivo(indice);
  }

  if (banners.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={LARGURA_CARD}
        decelerationRate="fast"
        onMomentumScrollEnd={aoRolarManualmente}
        getItemLayout={(_, index) => ({
          length: LARGURA_CARD,
          offset: LARGURA_CARD * index,
          index,
        })}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { height: alturaCard }]}
            onPress={item.onPress}
            disabled={!item.onPress}
          >
            <Image source={item.imagem} style={styles.imagem} resizeMode="cover" />
            {(!!item.titulo || !!item.subtitulo) && (
              <View style={styles.textoOverlay}>
                {!!item.titulo && <Text style={styles.titulo}>{item.titulo}</Text>}
                {!!item.subtitulo && <Text style={styles.subtitulo}>{item.subtitulo}</Text>}
              </View>
            )}
          </Pressable>
        )}
      />

      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((item, index) => (
            <View
              key={item.id}
              style={[styles.dot, index === indiceAtivo && styles.dotAtivo]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  card: {
    width: LARGURA_CARD,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  imagem: {
    width: '100%',
    height: '100%',
  },
  textoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  titulo: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  subtitulo: {
    ...typography.caption,
    color: '#E5E5EA',
    marginTop: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginHorizontal: 3,
  },
  dotAtivo: {
    width: 16,
    backgroundColor: colors.primary,
  },
});