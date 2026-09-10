import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Keyboard,
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
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signInWithPhone, signInWithGoogle } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const deslocamento = useRef(new Animated.Value(0)).current;

  const {
    disponivel: googleDisponivel,
    resultado: googleResultado,
    promptAsync: promptGoogleAsync,
    resetar: resetarGoogle,
  } = useGoogleAuth();

  // Reage ao resultado do fluxo do Google (a tela do navegador roda por
  // fora, então o resultado chega de forma assíncrona aqui, não direto no
  // clique do botão).
  useEffect(() => {
    if (googleResultado.status === 'success') {
      (async () => {
        try {
          await signInWithGoogle(googleResultado.idToken);
        } catch (err: any) {
          const dadosErro = err?.response?.data;
          setErrorMessage(dadosErro?.message ?? err?.message ?? 'Não foi possível entrar com o Google.');
        } finally {
          resetarGoogle();
        }
      })();
    } else if (googleResultado.status === 'error') {
      setErrorMessage(googleResultado.message);
      resetarGoogle();
    } else if (googleResultado.status === 'cancelled') {
      resetarGoogle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResultado]);

  // Sobe o formulário suavemente quando o teclado abre — animação roda na
  // thread nativa (useNativeDriver), sem recalcular layout a cada frame,
  // então não trava mesmo com o gradiente e o SVG de fundo na tela.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (evento) => {
      Animated.timing(deslocamento, {
        toValue: -(evento.endCoordinates.height * 0.4),
        duration: Platform.OS === 'ios' ? evento.duration ?? 250 : 200,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (evento) => {
      Animated.timing(deslocamento, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? evento?.duration ?? 250 : 200,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [deslocamento]);

    async function handleContinue() {
    setErrorMessage(null);
    if (!password) {
      setErrorMessage('Informe sua senha.');
      return;
    }
    setLoading(true);
    try {
      await signInWithPhone({ countryCode: '+55', phone: phone.trim(), password });
    } catch (err: any) {
      const dadosErro = err?.response?.data;
      if (dadosErro?.needsVerification && dadosErro?.email) {
        navigation.navigate('VerifyEmail', { email: dadosErro.email });
        return;
      }
      setErrorMessage(dadosErro?.message ?? err?.message ?? 'Não foi possível continuar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage(null);
    if (!googleDisponivel) {
      setErrorMessage('Login com Google não está disponível nessa versão do app.');
      return;
    }
    await promptGoogleAsync();
  }

  return (
    <LinearGradient colors={['#070B1A', '#0A0F24']} style={styles.flex}>
      <CityBackground />
      <Animated.View style={[styles.flex, { transform: [{ translateY: deslocamento }] }]}>
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

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Senha"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

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

            <Pressable
              style={[styles.googleButton, googleResultado.status === 'loading' && styles.googleButtonDisabled]}
              onPress={handleGoogleLogin}
              disabled={googleResultado.status === 'loading'}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleLabel}>
                {googleResultado.status === 'loading' ? 'Entrando…' : 'Entrar com Google'}
              </Text>
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
      </Animated.View>
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
  passwordRow: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  passwordInput: {
    ...typography.body,
    color: colors.text,
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
  googleButtonDisabled: {
    opacity: 0.6,
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