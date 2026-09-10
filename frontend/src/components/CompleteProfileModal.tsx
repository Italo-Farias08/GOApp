import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { User } from '../types';
import Button from './Button';
import Input from './Input';
import { PhoneIcon } from './icons';

type Props = {
  visible: boolean;
  user: User | null;
  carregando?: boolean;
  onSalvar: (dados: { name: string; email: string; phone: string }) => void;
  onFechar: () => void;
};

// Mostrado antes de deixar o passageiro chamar uma corrida quando falta
// nome, email ou (o caso mais comum) telefone no perfil — típico de quem
// entrou com Google, já que esse login nunca passa pela tela de Cadastro
// onde o telefone é pedido. Sem telefone o motorista não tem como contatar
// o passageiro, então a corrida fica bloqueada até esses dados existirem.
export default function CompleteProfileModal({ visible, user, carregando = false, onSalvar, onFechar }: Props) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (visible) {
      setName(user?.name ?? '');
      setEmail(user?.email ?? '');
      setPhone(user?.phone ?? '');
      setErrors({});
    }
  }, [visible, user]);

  function validar() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Informe seu nome.';
    if (!email.trim()) next.email = 'Informe seu email.';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Email inválido.';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) next.phone = 'Informe um número válido.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function confirmar() {
    if (!validar()) return;
    onSalvar({ name: name.trim(), email: email.trim(), phone: phone.trim() });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={carregando ? undefined : onFechar}>
      <Pressable style={styles.backdrop} onPress={carregando ? undefined : onFechar} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.tituloRow}>
          <View style={styles.avisoBadge}>
            <PhoneIcon size={18} color={colors.background} />
          </View>
          <View style={styles.tituloTextos}>
            <Text style={styles.titulo}>Complete seu cadastro</Text>
            <Text style={styles.subtitulo}>
              Pra chamar uma corrida, o motorista precisa conseguir falar com você — confirme seus
              dados abaixo, especialmente o telefone.
            </Text>
          </View>
        </View>

        <Input
          label="Nome"
          placeholder="Seu nome completo"
          value={name}
          onChangeText={setName}
          errorMessage={errors.name}
          returnKeyType="next"
        />
        <Input
          label="Email"
          placeholder="seuemail@exemplo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          errorMessage={errors.email}
          returnKeyType="next"
        />
        <Input
          label="Telefone"
          placeholder="(00) 00000-0000"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          errorMessage={errors.phone}
          returnKeyType="done"
          onSubmitEditing={confirmar}
        />

        <Button
          label={carregando ? 'Salvando...' : 'Salvar e continuar'}
          onPress={confirmar}
          loading={carregando}
          disabled={carregando}
          style={styles.botaoConfirmar}
        />
        <Button label="Agora não" variant="ghost" onPress={onFechar} disabled={carregando} />
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
    backgroundColor: colors.primary,
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
    marginTop: 4,
  },
  botaoConfirmar: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});