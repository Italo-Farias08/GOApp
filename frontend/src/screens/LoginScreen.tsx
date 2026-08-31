import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Button from '../components/Button';
import CityBackground from '../components/CityBackground';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signInWithPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setErrorMessage(null);
    setLoading(true);
    try {
      await signInWithPhone({ countryCode: '+55', phone: phone.trim() });
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Não foi possível continuar.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    setErrorMessage('Login com Google ainda não está disponível.');
  }

  return (
    <LinearGradient colors={['#070B1A', '#0A0F24']} style={styles.flex}>
      <CityBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              Chegue <Text style={styles.titleAccent}>mais longe.</Text>
            </Text>
            <Text style={styles.subtitle}>Corridas rápidas, seguras e do seu jeito.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.flag}>🇧🇷</Text>
                <Text style={styles.countryCodeText}>+55</Text>
                <Text style={styles.chevron}>▾</Text>
              </View>
              <View style={styles.divider} />
              <TextInput
                style={styles.phoneInput}
                placeholder="Número de celular"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <Button
              label="Continuar"
              onPress={handleContinue}
              loading={loading}
              style={styles.continueButton}
            />

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>ou</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable style={styles.googleButton} onPress={handleGoogleLogin}>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleLabel}>Entrar com Google</Text>
            </Pressable>

            <Text style={styles.terms}>
              Ao continuar, você concorda com os{' '}
              <Text style={styles.termsLink}>Termos de Uso</Text> e a{' '}
              <Text style={styles.termsLink}>Política de Privacidade</Text>.
            </Text>

            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={styles.noAccount}>Ainda não tenho uma conta</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 300,
    height: 210,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  titleAccent: {
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  countryCodeText: {
    ...typography.bodyBold,
    color: colors.text,
    marginRight: 4,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  phoneInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  continueButton: {
    marginBottom: spacing.lg,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.sm,
  },
  googleLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  terms: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  noAccount: {
    ...typography.bodyBold,
    color: colors.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});