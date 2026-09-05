import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, typography } from '../theme/theme';

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

// Chute inicial só pra o primeiro frame não ficar com largura 0 antes do
// onLayout disparar — o valor de verdade usado no carrossel vem sempre da
// medição real do container (ver `largura` no componente).
const LARGURA_INICIAL = Dimensions.get('window').width;
const ALTURA_CARD_BASE = 150;
const ALTURA_CARD_DESTAQUE = 162;
// Espaço entre um card e outro (e entre o card e a borda da tela).
const GAP_CARD = spacing.sm;
const RAIO_CARD = 16;

export default function PromoBanners({ banners, autoplayMs = 4000, destaque = false }: Props) {
  const alturaCard = destaque ? ALTURA_CARD_DESTAQUE : ALTURA_CARD_BASE;
  const listRef = useRef<FlatList<Banner>>(null);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const indiceRef = useRef(0);

  // Largura real de cada "página" do carrossel = largura medida do próprio
  // container (onLayout). O card em si é desenhado GAP_CARD menor de cada
  // lado, pra sobrar um respiro visual entre um banner e o próximo (e entre
  // o banner e a borda da tela) sem quebrar o paginado.
  const [largura, setLargura] = useState(LARGURA_INICIAL);
  const larguraRef = useRef(LARGURA_INICIAL);

  function aoMedirContainer(evento: LayoutChangeEvent) {
    const novaLargura = evento.nativeEvent.layout.width;
    if (Math.abs(novaLargura - larguraRef.current) < 0.5) return;
    larguraRef.current = novaLargura;
    setLargura(novaLargura);
  }

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
    const indice = Math.round(evento.nativeEvent.contentOffset.x / larguraRef.current);
    indiceRef.current = indice;
    setIndiceAtivo(indice);
  }

  if (banners.length === 0) return null;

  const larguraCard = Math.max(largura - GAP_CARD * 2, 0);

  return (
    <View style={styles.container} onLayout={aoMedirContainer}>
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(item) => item.id}
        style={styles.lista}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={aoRolarManualmente}
        getItemLayout={(_, index) => ({
          length: largura,
          offset: largura * index,
          index,
        })}
        renderItem={({ item }) => (
          // Cada "página" ocupa a largura cheia (necessário pro pagingEnabled
          // continuar funcionando certinho), mas o card visível dentro dela
          // é menor, com respiro dos dois lados.
          <View style={{ width: largura, height: alturaCard }}>
            <Pressable
              style={[
                styles.card,
                { width: larguraCard, height: alturaCard, marginHorizontal: GAP_CARD },
              ]}
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
          </View>
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
  // Sem isso, um FlatList/ScrollView horizontal pode encolher pro tamanho
  // do próprio conteúdo em vez de esticar pra preencher o pai.
  lista: {
    width: '100%',
  },
  card: {
    borderRadius: RAIO_CARD,
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