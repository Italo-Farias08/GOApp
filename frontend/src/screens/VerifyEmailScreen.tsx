import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

const TAMANHO_CODIGO = 6;
const SEGUNDOS_PARA_REENVIAR = 30;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const { verifyEmail, resendCode } = useAuth();

  const [digitos, setDigitos] = useState<string[]>(Array(TAMANHO_CODIGO).fill(''));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const inputsRef = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function handleChangeDigito(texto: string, index: number) {
    // Só aceita números; se o usuário colar o código inteiro num campo só, distribui.
    const limpo = texto.replace(/\D/g, '');
    if (!limpo) {
      const proximos = [...digitos];
      proximos[index] = '';
      setDigitos(proximos);
      return;
    }

    if (limpo.length > 1) {
      const proximos = [...digitos];
      for (let i = 0; i < limpo.length && index + i < TAMANHO_CODIGO; i += 1) {
        proximos[index + i] = limpo[i];
      }
      setDigitos(proximos);
      const proximoIndex = Math.min(index + limpo.length, TAMANHO_CODIGO - 1);
      inputsRef.current[proximoIndex]?.focus();
      return;
    }

    const proximos = [...digitos];
    proximos[index] = limpo;
    setDigitos(proximos);
    if (index < TAMANHO_CODIGO - 1) {
      inputsRef.current[index + 1]?.focus();
    } else {
      Keyboard.dismiss();
    }
  }

  function handleKeyPress(evento: any, index: number) {
    if (evento.nativeEvent.key === 'Backspace' && !digitos[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const codigo = digitos.join('');
    setSubmitError(null);

    if (codigo.length < TAMANHO_CODIGO) {
      setSubmitError('Informe o código completo.');
      return;
    }

    setLoading(true);
    try {
      await verifyEmail(email, codigo);
      // Sucesso: isAuthenticated vira true e o RootNavigator troca pra Home sozinho.
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? 'Código inválido.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setResendMessage(null);
    setSubmitError(null);
    setReenviando(true);
    try {
      await resendCode(email);
      setResendMessage('Enviamos um novo código pro seu email.');
      setCooldown(SEGUNDOS_PARA_REENVIAR);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? 'Não foi possível reenviar.');
    } finally {
      setReenviando(false);
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
              <Text style={styles.title}>Confirme seu email</Text>
              <Text style={styles.subtitle}>
                Mandamos um código de 6 dígitos para{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>
            </View>

            <View style={styles.codeRow}>
              {digitos.map((digito, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputsRef.current[index] = ref;
                  }}
                  style={[styles.codeInput, !!submitError && styles.codeInputError]}
                  value={digito}
                  onChangeText={(texto) => handleChangeDigito(texto, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={TAMANHO_CODIGO}
                  textAlign="center"
                  placeholderTextColor={colors.textMuted}
                />
              ))}
            </View>

            {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}
            {!!resendMessage && !submitError && <Text style={styles.resendSuccess}>{resendMessage}</Text>}

            <Button label="Confirmar" onPress={handleVerify} loading={loading} style={styles.verifyButton} />

            <Pressable onPress={handleResend} disabled={cooldown > 0 || reenviando} hitSlop={8}>
              <Text style={[styles.resendLabel, cooldown > 0 && styles.resendLabelDisabled]}>
                {cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Não recebeu? Reenviar código'}
              </Text>
            </Pressable>
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
  emailHighlight: {
    color: colors.text,
    fontWeight: '700',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    ...typography.h2,
  },
  codeInputError: {
    borderColor: colors.danger,
  },
  submitError: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  resendSuccess: {
    color: colors.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  verifyButton: {
    marginBottom: spacing.lg,
  },
  resendLabel: {
    ...typography.bodyBold,
    color: colors.primary,
    textAlign: 'center',
  },
  resendLabelDisabled: {
    color: colors.textMuted,
  },
});