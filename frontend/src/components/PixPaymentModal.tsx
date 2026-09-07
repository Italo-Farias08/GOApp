import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { PagamentoPix } from '../types';
import { formatarMoeda } from '../utils/precoCorrida';
import Button from './Button';
import { CopyIcon, PixIcon } from './icons';

type Props = {
  visible: boolean;
  // true enquanto a cobrança ainda está sendo gerada no Mercado Pago —
  // antes do QR code existir.
  gerando: boolean;
  pagamento: PagamentoPix | null;
  onFechar: () => void;
};

// Modal de "pagar com Pix" — mostra o QR code (a imagem já vem pronta do
// Mercado Pago em base64) e o código "copia e cola", e vai atualizando o
// status sozinho enquanto o app faz o polling em segundo plano (ver
// HomeScreen). Assim que o pagamento é aprovado, quem fecha o modal e segue
// o fluxo é a própria tela — aqui só exibe.
export default function PixPaymentModal({ visible, gerando, pagamento, onFechar }: Props) {
  const [copiado, setCopiado] = React.useState(false);

  React.useEffect(() => {
    if (visible) setCopiado(false);
  }, [visible]);

  async function copiarCodigo() {
    if (!pagamento?.qrCode) return;
    await Clipboard.setStringAsync(pagamento.qrCode);
    setCopiado(true);
  }

  const expirado = pagamento?.status === 'expirado';
  const recusado = pagamento?.status === 'recusado';
  const comProblema = expirado || recusado;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFechar}>
      <Pressable style={styles.backdrop} onPress={onFechar} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.tituloRow}>
          <View style={styles.iconeBadge}>
            <PixIcon size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Pagar com Pix</Text>
            {!!pagamento && <Text style={styles.subtitulo}>{formatarMoeda(pagamento.valor)}</Text>}
          </View>
        </View>

        {gerando && (
          <View style={styles.estadoCentral}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.estadoTexto}>Gerando cobrança...</Text>
          </View>
        )}

        {!gerando && comProblema && (
          <View style={styles.estadoCentral}>
            <Text style={styles.estadoTexto}>
              {expirado
                ? 'O tempo pra pagar esse QR code acabou.'
                : 'O pagamento não foi aprovado.'}
            </Text>
          </View>
        )}

        {!gerando && !comProblema && !!pagamento && (
          <>
            <View style={styles.qrWrap}>
              <Image
                source={{ uri: `data:image/png;base64,${pagamento.qrCodeBase64}` }}
                style={styles.qrImagem}
                resizeMode="contain"
              />
            </View>

            <Pressable style={styles.copiarBotao} onPress={copiarCodigo}>
              <CopyIcon size={16} color={colors.background} />
              <Text style={styles.copiarTexto}>{copiado ? 'Código copiado!' : 'Copiar código Pix'}</Text>
            </Pressable>

            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.textSecondary} size="small" />
              <Text style={styles.statusTexto}>Aguardando confirmação do pagamento...</Text>
            </View>
          </>
        )}

        <Button label="Cancelar" variant="ghost" onPress={onFechar} />
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
  iconeBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  titulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
  },
  subtitulo: {
    ...typography.bodyBold,
    color: colors.primary,
    marginTop: 2,
  },
  estadoCentral: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  estadoTexto: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  qrImagem: {
    width: 220,
    height: 220,
  },
  copiarBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  copiarTexto: {
    ...typography.bodyBold,
    color: colors.background,
    marginLeft: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  statusTexto: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
});