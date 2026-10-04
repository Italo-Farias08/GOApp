import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

// Banner de "próxima curva" da navegação (estilo 99/Uber/Waze):
//   [ícone da curva]  350 m
//                     Vire à direita
//                     Rua das Flores
type Props = {
  instrucao: string;
  nome: string | null;
  distanciaM: number;
  top: number;
};

type TipoSeta = 'frente' | 'direita' | 'esquerda' | 'fechadaDireita' | 'fechadaEsquerda' | 'retorno' | 'chegada';

// Deduz o desenho da seta a partir do texto da instrução (que vem do
// backend em português) — evita o app depender de campos extras.
function tipoDaSeta(instrucao: string): TipoSeta {
  const t = instrucao.toLowerCase();
  if (t.includes('chegou')) return 'chegada';
  if (t.includes('retorno')) return 'retorno';
  if (t.includes('fechada') && t.includes('direita')) return 'fechadaDireita';
  if (t.includes('fechada') && t.includes('esquerda')) return 'fechadaEsquerda';
  if (t.includes('direita')) return 'direita';
  if (t.includes('esquerda')) return 'esquerda';
  return 'frente';
}

// Desenhos num quadro 24x24. Todos apontam "pra onde ir" a partir de baixo.
const DESENHOS: Record<TipoSeta, string> = {
  frente: 'M12 21 V6 M6 11 L12 5 L18 11',
  direita: 'M7 21 V13 Q7 9 11 9 H17 M13 5 L17 9 L13 13',
  esquerda: 'M17 21 V13 Q17 9 13 9 H7 M11 5 L7 9 L11 13',
  fechadaDireita: 'M7 4 V12 Q7 16 11 16 H17 M13 12 L17 16 L13 20',
  fechadaEsquerda: 'M17 4 V12 Q17 16 13 16 H7 M11 12 L7 16 L11 20',
  retorno: 'M16 21 V9 Q16 5 12 5 Q8 5 8 9 V13 M5 10 L8 14 L11 10',
  chegada: 'M12 21 C8 16 6 13 6 10 A6 6 0 0 1 18 10 C18 13 16 16 12 21 Z M12 12 A2 2 0 1 0 12 8 A2 2 0 0 0 12 12',
};

function formatarDistanciaCurva(metros: number): string {
  if (metros >= 1000) return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
  // arredonda de 10 em 10 m (mais legível e não "pisca" a cada metro)
  const arredondado = metros < 50 ? Math.max(Math.round(metros / 10) * 10, 10) : Math.round(metros / 10) * 10;
  return `${arredondado} m`;
}

export default function BannerManobra({ instrucao, nome, distanciaM, top }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);
  const tipo = tipoDaSeta(instrucao);

  return (
    <View pointerEvents="none" style={[styles.container, { top }]}>
      <View style={styles.iconeCaixa}>
        <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
          <Path
            d={DESENHOS[tipo]}
            stroke={colors.onPrimary}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={styles.textos}>
        {tipo !== 'chegada' && <Text style={styles.distancia}>{formatarDistanciaCurva(distanciaM)}</Text>}
        <Text style={styles.instrucao} numberOfLines={1}>
          {instrucao}
        </Text>
        {!!nome && tipo !== 'chegada' && (
          <Text style={styles.rua} numberOfLines={1}>
            {nome}
          </Text>
        )}
      </View>
    </View>
  );
}

function criarEstilos(colors: any) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    iconeCaixa: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textos: { flex: 1 },
    distancia: { color: colors.text, fontSize: 22, fontWeight: '800' },
    instrucao: { color: colors.text, fontSize: 15, fontWeight: '600' },
    rua: { color: colors.textSecondary, fontSize: 13, marginTop: 1 },
  });
}