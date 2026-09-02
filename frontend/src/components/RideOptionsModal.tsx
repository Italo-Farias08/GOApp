import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import {
  EstimativaCorrida,
  TipoVeiculo,
  formatarDistancia,
  formatarDuracao,
  formatarMoeda,
} from '../utils/precoCorrida';
import Button from './Button';
import { CheckIcon } from './icons';

// Imagens dos veículos — troque estes arquivos por fotos reais
// mantendo o mesmo nome/caminho (frontend/assets/images/carro.png e moto.png).
const IMAGEM_VEICULO: Record<TipoVeiculo, ReturnType<typeof require>> = {
  carro: require('../../assets/images/carro.png'),
  moto: require('../../assets/images/moto.png'),
};

type Props = {
  visible: boolean;
  destino?: string;
  estimativas: EstimativaCorrida[];
  onSelecionar: (tipo: TipoVeiculo) => void;
  onClose: () => void;
};

const INFO_VEICULO: Record<TipoVeiculo, { label: string; sublabel: string }> = {
  carro: { label: 'Carro', sublabel: 'Mais conforto e espaço' },
  moto: { label: 'Moto', sublabel: 'Mais rápido no trânsito' },
};

export default function RideOptionsModal({
  visible,
  destino,
  estimativas,
  onSelecionar,
  onClose,
}: Props) {
  const [selecionado, setSelecionado] = React.useState<TipoVeiculo | null>(null);

  // Reseta a seleção sempre que o modal é reaberto com novas estimativas.
  React.useEffect(() => {
    if (visible) setSelecionado(null);
  }, [visible]);

  const distanciaKm = estimativas[0]?.distanciaKm ?? 0;
  const duracaoMin = estimativas[0]?.duracaoMin ?? 0;
  const labelHorario = estimativas[0]?.labelHorario ?? null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>Como você quer ir?</Text>
        {!!destino && (
          <Text style={styles.destino} numberOfLines={1}>
            Para {destino}
          </Text>
        )}

        <View style={styles.resumoRow}>
          <Text style={styles.resumo}>{formatarDistancia(distanciaKm)}</Text>
          <View style={styles.resumoDivisor} />
          <Text style={styles.resumo}>{formatarDuracao(duracaoMin)}</Text>
          {!!labelHorario && (
            <>
              <View style={styles.resumoDivisor} />
              <Text style={styles.avisoHorario}>{labelHorario}</Text>
            </>
          )}
        </View>

        <View style={styles.opcoes}>
          {estimativas.map((estimativa) => {
            const info = INFO_VEICULO[estimativa.tipo];
            const ativo = selecionado === estimativa.tipo;

            return (
              <Pressable
                key={estimativa.tipo}
                style={[styles.opcao, ativo && styles.opcaoAtiva]}
                onPress={() => setSelecionado(estimativa.tipo)}
              >
                <View style={styles.iconeBadge}>
                  <Image
                    source={IMAGEM_VEICULO[estimativa.tipo]}
                    style={styles.iconeImagem}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                </View>

                <View style={styles.opcaoTexto}>
                  <Text style={styles.opcaoLabel}>{info.label}</Text>
                  <Text style={styles.opcaoSublabel}>{info.sublabel}</Text>
                </View>

                <Text style={[styles.opcaoPreco, ativo && styles.opcaoPrecoAtivo]}>
                  {formatarMoeda(estimativa.preco)}
                </Text>

                <View style={[styles.checkCirculo, ativo && styles.checkCirculoAtivo]}>
                  {ativo && <CheckIcon size={12} color={colors.background} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={selecionado ? `Confirmar ${INFO_VEICULO[selecionado].label.toLowerCase()}` : 'Selecione uma opção'}
          onPress={() => selecionado && onSelecionar(selecionado)}
          disabled={!selecionado}
          style={styles.confirmButton}
        />
        <Button label="Cancelar" variant="ghost" onPress={onClose} />
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
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: 2,
  },
  destino: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  resumoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resumo: {
    ...typography.caption,
    color: colors.textMuted,
  },
  resumoDivisor: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    marginHorizontal: spacing.sm,
  },
  avisoHorario: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  opcoes: {
    marginBottom: spacing.lg,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  opcaoAtiva: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  iconeBadge: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconeImagem: {
    width: 40,
    height: 40,
  },
  opcaoTexto: {
    flex: 1,
  },
  opcaoLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  opcaoSublabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  opcaoPreco: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  opcaoPrecoAtivo: {
    color: colors.text,
  },
  checkCirculo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCirculoAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  confirmButton: {
    marginBottom: spacing.sm,
  },
});