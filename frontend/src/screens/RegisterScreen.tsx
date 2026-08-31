import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Button from '../components/Button';
import CityBackground from '../components/CityBackground';
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

  // Refs pra pular de um campo pro próximo apertando "próximo" no teclado,
  // sem precisar tocar na tela toda vez.
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

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
    <LinearGradient colors={['#070B1A', '#0A0F24']} style={styles.flex}>
      <CityBackground />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
              <Text style={styles.backArrow}>‹</Text>
              <Text style={styles.backLabel}>Voltar</Text>
            </Pressable>

            <View style={styles.header}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.title}>Criar conta</Text>
              <Text style={styles.subtitle}>Leva menos de um minuto.</Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Nome"
                placeholder="Seu nome completo"
                value={name}
                onChangeText={setName}
                errorMessage={errors.name}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              <Input
                ref={emailRef}
                label="Email"
                placeholder="seuemail@exemplo.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                errorMessage={errors.email}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
              <Input
                ref={phoneRef}
                label="Telefone"
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Input
                ref={passwordRef}
                label="Senha"
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                errorMessage={errors.password}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />

              {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}

              <Button label="Cadastrar" onPress={handleRegister} loading={loading} style={styles.registerButton} />
              <Button label="Já tenho conta" variant="ghost" onPress={() => navigation.goBack()} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backArrow: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 28,
    marginRight: 2,
  },
  backLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 180,
    height: 126,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  form: { width: '100%' },
  registerButton: { marginTop: spacing.sm, marginBottom: spacing.sm },
  submitError: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
});