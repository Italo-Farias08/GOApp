import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import Button from './Button';
import { AlertIcon, CheckIcon } from './icons';

type Props = {
  visible: boolean;
  titulo?: string;
  subtitulo?: string;
  motivos: string[];
  carregando?: boolean;
  onConfirmar: (motivo: string) => void;
  onFechar: () => void;
};

// Modal de "por que você quer cancelar" — usado tanto pelo passageiro quanto
// pelo motorista, cada um passando sua própria lista de motivos. Exigir um
// motivo antes de liberar o botão é parte da regra de cancelamento: ninguém
// cancela "no escuro", e o motivo fica registrado no backend.
export default function CancelRideModal({
  visible,
  titulo = 'Por que você quer cancelar?',
  subtitulo,
  motivos,
  carregando = false,
  onConfirmar,
  onFechar,
}: Props) {
  const [motivoSelecionado, setMotivoSelecionado] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (visible) setMotivoSelecionado(null);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFechar}>
      <Pressable style={styles.backdrop} onPress={carregando ? undefined : onFechar} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.tituloRow}>
          <View style={styles.avisoBadge}>
            <AlertIcon size={18} color={colors.danger} />
          </View>
          <View style={styles.tituloTextos}>
            <Text style={styles.titulo}>{titulo}</Text>
            {!!subtitulo && <Text style={styles.subtitulo}>{subtitulo}</Text>}
          </View>
        </View>

        <View style={styles.opcoes}>
          {motivos.map((motivo) => {
            const ativo = motivoSelecionado === motivo;
            return (
              <Pressable
                key={motivo}
                onPress={() => setMotivoSelecionado(motivo)}
                style={({ pressed }) => [
                  styles.opcao,
                  ativo && styles.opcaoAtiva,
                  pressed && styles.opcaoPressionada,
                ]}
              >
                <Text style={[styles.opcaoTexto, ativo && styles.opcaoTextoAtivo]}>{motivo}</Text>
                <View style={[styles.checkCirculo, ativo && styles.checkCirculoAtivo]}>
                  {ativo && <CheckIcon size={12} color={colors.background} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={carregando ? 'Cancelando...' : 'Confirmar cancelamento'}
          variant="secondary"
          onPress={() => motivoSelecionado && onConfirmar(motivoSelecionado)}
          disabled={!motivoSelecionado || carregando}
          loading={carregando}
          style={styles.botaoConfirmar}
        />
        <Button label="Voltar" variant="ghost" onPress={onFechar} disabled={carregando} />
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
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  avisoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  tituloTextos: { flex: 1 },
  titulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
  },
  subtitulo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  opcoes: {
    marginBottom: spacing.lg,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  opcaoAtiva: {
    borderColor: colors.danger,
    backgroundColor: colors.surfaceAlt,
  },
  opcaoPressionada: {
    opacity: 0.85,
  },
  opcaoTexto: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  opcaoTextoAtivo: {
    ...typography.bodyBold,
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
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  botaoConfirmar: {
    marginBottom: spacing.sm,
    borderColor: colors.danger,
  },
});