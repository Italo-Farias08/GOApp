import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, typography } from '../theme/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Informe seu nome.';
    if (!email.trim()) next.email = 'Informe seu email.';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Email inválido.';
    if (!password) next.password = 'Informe uma senha.';
    else if (password.length < 6) next.password = 'Mínimo de 6 caracteres.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRegister() {
    setSubmitError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await signUp({ name: name.trim(), email: email.trim(), phone, password });
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Leva menos de um minuto.</Text>
        </View>

        <View style={styles.form}>
          <Input label="Nome" placeholder="Seu nome completo" value={name} onChangeText={setName} errorMessage={errors.name} />
          <Input label="Email" placeholder="seuemail@exemplo.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} errorMessage={errors.email} />
          <Input label="Telefone" placeholder="(00) 00000-0000" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Input label="Senha" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} errorMessage={errors.password} />

          {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}

          <Button label="Cadastrar" onPress={handleRegister} loading={loading} style={styles.registerButton} />
          <Button label="Já tenho conta" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  header: { marginBottom: spacing.xl },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  form: { width: '100%' },
  registerButton: { marginTop: spacing.sm, marginBottom: spacing.sm },
  submitError: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
});
