import React, { useMemo } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCenterModalAnimation } from '../hooks/useModalAnimation';
import { radius, spacing, typography } from '../theme/theme';
import type { ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import Button from './Button';
import { AlertIcon, CarIcon, MotoIcon } from './icons';
import type { TipoVeiculo } from '../types';

type Props = {
  visible: boolean;
  tipoVeiculo: TipoVeiculo;
  onContinuar: () => void;
  onCancelarCorrida: () => void;
};

// Aviso mostrado assim que a corrida é pedida, quando o backend já sabe (na
// hora da criação) que não tem nenhum motorista do tipo escolhido
// disponível por perto — em vez de deixar o passageiro só olhando o anel de
// "procurando" girar sem explicação nenhuma. A corrida já foi criada e
// segue procurando em segundo plano (qualquer motorista desse tipo que
// ficar disponível depois ainda recebe a oferta) — esse modal só avisa e
// deixa o passageiro decidir se quer esperar ou cancelar.
export default function SemMotoristasModal({
  visible,
  tipoVeiculo,
  onContinuar,
  onCancelarCorrida,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const Icone = tipoVeiculo === 'moto' ? MotoIcon : CarIcon;
  const rotuloVeiculo = tipoVeiculo === 'moto' ? 'motos' : 'carros';

  const { mounted, backdropOpacity, scale, contentOpacity } = useCenterModalAnimation(visible);
  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onContinuar}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onContinuar} />
      </Animated.View>
      <Animated.View
        style={[styles.cartao, { opacity: contentOpacity, transform: [{ scale }] }]}
      >
        <View style={styles.iconeBadge}>
          <Image
            source={require('../../assets/logo-mark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.alertaSelinho}>
            <AlertIcon size={12} color={colors.onPrimary} />
          </View>
        </View>

        <Text style={styles.titulo}>Nenhum motorista por perto agora</Text>
        <Text style={styles.subtitulo}>
          No momento não há motoristas de {rotuloVeiculo} disponíveis na sua região. Sua corrida
          já foi solicitada e vamos continuar procurando — assim que alguém ficar disponível, a
          oferta chega pra ele automaticamente.
        </Text>

        <View style={styles.veiculoLinha}>
          <View style={styles.veiculoIconeCirculo}>
            <Icone size={18} color={colors.textSecondary} />
          </View>
          <Text style={styles.veiculoTexto}>
            {tipoVeiculo === 'moto' ? 'Moto' : 'Carro'} indisponível no momento
          </Text>
        </View>

        <Button label="Continuar procurando" onPress={onContinuar} style={styles.botaoPrincipal} />
        <Button label="Cancelar corrida" variant="ghost" onPress={onCancelarCorrida} />
      </Animated.View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  cartao: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '30%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 16,
  },
  iconeBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logo: {
    width: 40,
    height: 60,
  },
  // Selinho de alerta sobreposto no canto da logo — mantém o aviso visual
  // de "atenção" mesmo com a marca do app no lugar do ícone genérico.
  alertaSelinho: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  titulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitulo: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  veiculoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  veiculoIconeCirculo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  veiculoTexto: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  botaoPrincipal: {
    marginBottom: spacing.sm,
  },
});
}