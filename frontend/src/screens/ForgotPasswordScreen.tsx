import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Button from '../components/Button';
import CityBackground from '../components/CityBackground';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setErrorMessage(null);
    const emailLimpo = email.trim().toLowerCase();

    if (!emailLimpo || !REGEX_EMAIL.test(emailLimpo)) {
      setErrorMessage('Digite um email válido.');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(emailLimpo);
      navigation.navigate('ResetPassword', { email: emailLimpo });
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message ?? err?.message ?? 'Não foi possível enviar o código.');
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
          <View style={styles.container}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
              <Text style={styles.backArrow}>‹</Text>
              <Text style={styles.backLabel}>Voltar</Text>
            </Pressable>

            <View style={styles.header}>
              <Text style={styles.title}>Esqueceu sua senha?</Text>
              <Text style={styles.subtitle}>
                Digite o email da sua conta. A gente manda um código de 6 dígitos pra você criar uma senha nova.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              <Button label="Enviar código" onPress={handleSend} loading={loading} style={styles.sendButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
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
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputRow: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  sendButton: {
    marginTop: spacing.sm,
  },
});