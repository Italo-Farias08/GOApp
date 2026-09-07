import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import { formatarMoeda } from '../utils/precoCorrida';
import { AlertIcon, ChevronLeftIcon, MoneyIcon, PixIcon } from './icons';

export type FormaFinalizacao = 'pix' | 'dinheiro' | 'nao_pagou';

type Props = {
  visible: boolean;
  valor: number;
  carregando?: boolean;
  onEscolher: (forma: FormaFinalizacao) => void;
  onFechar: () => void;
};

// Modal que abre assim que o motorista toca em "Finalizar corrida" — ele
// escolhe COMO o passageiro pagou (ou avisa que não pagou) antes da corrida
// ser encerrada de vez. É o ponto de partida dos três jeitos de finalizar:
// - "pix"       -> abre o PixPaymentModal com QR code pra passageiro pagar
// - "dinheiro"  -> confirma na hora que já recebeu em espécie
// - "nao_pagou" -> encerra mesmo assim, e a cobrança vira dívida na próxima
//                  corrida desse passageiro
export default function FinalizarCorridaModal({ visible, valor, carregando = false, onEscolher, onFechar }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={carregando ? undefined : onFechar}>
      <Pressable style={styles.backdrop} onPress={carregando ? undefined : onFechar} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.tituloRow}>
          <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Como o passageiro pagou?</Text>
            <Text style={styles.valor}>{formatarMoeda(valor)}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.opcao, pressed && !carregando && styles.opcaoPressionada]}
          onPress={() => !carregando && onEscolher('pix')}
          disabled={carregando}
        >
          <View style={styles.opcaoIconeBadge}>
            <PixIcon size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.opcaoLabel}>Pix</Text>
            <Text style={styles.opcaoSublabel}>Gerar QR code pro passageiro pagar agora</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.opcao, pressed && !carregando && styles.opcaoPressionada]}
          onPress={() => !carregando && onEscolher('dinheiro')}
          disabled={carregando}
        >
          <View style={styles.opcaoIconeBadge}>
            <MoneyIcon size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.opcaoLabel}>Dinheiro</Text>
            <Text style={styles.opcaoSublabel}>Já recebi o valor em espécie</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.opcao,
            styles.opcaoNaoPagou,
            pressed && !carregando && styles.opcaoPressionada,
          ]}
          onPress={() => !carregando && onEscolher('nao_pagou')}
          disabled={carregando}
        >
          <View style={[styles.opcaoIconeBadge, styles.opcaoIconeBadgeAlerta]}>
            <AlertIcon size={18} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.opcaoLabel, styles.opcaoLabelAlerta]}>O passageiro não pagou</Text>
            <Text style={styles.opcaoSublabel}>
              A corrida encerra e o valor é cobrado na próxima viagem dele
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.voltarBotao, pressed && !carregando && styles.opcaoPressionada]}
          onPress={carregando ? undefined : onFechar}
          disabled={carregando}
        >
          <ChevronLeftIcon size={16} color={colors.textSecondary} />
          <Text style={styles.voltarTexto}>Voltar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  tituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 34,
    height: 34,
    marginRight: spacing.sm,
  },
  titulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
  },
  valor: {
    ...typography.bodyBold,
    color: colors.primary,
    marginTop: 2,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  opcaoNaoPagou: {
    borderColor: colors.border,
  },
  opcaoPressionada: {
    opacity: 0.8,
  },
  opcaoIconeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  opcaoIconeBadgeAlerta: {
    backgroundColor: 'rgba(255, 77, 77, 0.12)',
  },
  opcaoLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  opcaoLabelAlerta: {
    color: colors.danger,
  },
  opcaoSublabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  voltarBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginTop: spacing.xs,
  },
  voltarTexto: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
});