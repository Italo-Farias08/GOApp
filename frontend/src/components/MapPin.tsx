import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/theme';

type Props = {
  variant?: 'origem' | 'destino';
  // Mostra um "facho de luz" (farol) saindo do pin, apontando pra frente.
  // Só faz sentido no pin de origem (o "Você está aqui"): é ele que dá o
  // feedback visual de PRA ONDE o usuário está virado. O giro em si quem
  // faz é a prop `rotation` do <Marker> no HomeScreen (nativa, baseada na
  // bússola) — aqui a gente só desenha algo assimétrico pra esse giro
  // aparecer. Um círculo perfeito giraria e ninguém notaria a diferença.
  comFarol?: boolean;
};

// Pin customizado pro mapa — substitui o marcador padrão (vermelho, fora do tema)
// por algo consistente com a identidade visual escura + verde neon do app.
//
// IMPORTANTE: este componente é renderizado dentro de um <Marker> do
// react-native-maps com tracksViewChanges={false} (ver HomeScreen.tsx). Isso
// significa que ele é "fotografado" uma vez e reaproveitado como imagem
// estática no mapa nativo — por isso não tem nenhuma Animated aqui dentro.
// Uma animação em loop faria o mapa redesenhar essa foto a cada quadro, o
// que é bem pesado (principalmente em Android/tablets com mais pixels pra
// redesenhar). Se um dia quiser reativar o efeito pulsando, o lugar certo é
// como um <Circle> nativo do mapa, não uma view customizada dentro do Marker.
//
// A rotação em si (girar o pin todo, farol incluso) é feita pelo React
// Native Maps de forma nativa via `rotation`/`flat` no <Marker> — como essa
// rotação gira a imagem inteira já "fotografada", o farol desenhado aqui
// gira junto sem precisar de nenhum código extra neste arquivo.
export default function MapPin({ variant = 'destino', comFarol = false }: Props) {
  const isOrigem = variant === 'origem';

  return (
    <View style={styles.wrapper}>
      {comFarol && <View style={styles.farol} />}
      <View style={[styles.halo, isOrigem && styles.haloOrigem]} />
      <View style={[styles.nucleo, isOrigem ? styles.nucleoOrigem : styles.nucleoDestino]} />
      {!isOrigem && <View style={styles.haste} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Triângulo apontando "pra frente" (truque clássico de CSS: caixa 0x0 com
  // borda colorida só de um lado vira triângulo). Fica encostado no topo do
  // halo, esticando o facho pra fora do pin — é essa forma assimétrica que
  // deixa visível o "eu virei pra direita/esquerda" quando o Marker gira.
  farol: {
    position: 'absolute',
    bottom: '78%',
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 26,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(57, 255, 106, 0.65)',
  },
  halo: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(57, 255, 106, 0.18)',
  },
  haloOrigem: {
    backgroundColor: 'rgba(57, 255, 106, 0.25)',
  },
  nucleo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: colors.background,
  },
  nucleoOrigem: {
    borderColor: colors.primary,
  },
  nucleoDestino: {
    borderColor: colors.text,
  },
  haste: {
    width: 2,
    height: 10,
    backgroundColor: colors.text,
    marginTop: -1,
  },
});