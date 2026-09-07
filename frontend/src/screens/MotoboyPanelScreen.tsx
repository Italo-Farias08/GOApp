import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AlertIcon, ChevronLeftIcon, HistoryIcon, MoneyIcon, MotoIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import * as driverService from '../services/driverService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { ResumoMotoboyHoje, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MotoboyPanel'>;

// Tela acessível a QUALQUER usuário logado (cliente ou motorista) a partir
// das configurações. Só quem é motorista aprovado com veículo do tipo moto
// (ou seja, um motoboy de fato) enxerga o resumo do dia — todo mundo mais
// cai no aviso de "isso aqui é só pra motoboy".
export default function MotoboyPanelScreen({ navigation }: Props) {
  const { user } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [ehMotoboy, setEhMotoboy] = useState(false);
  const [resumo, setResumo] = useState<ResumoMotoboyHoje | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarResumo = useCallback(async (comSpinner: boolean) => {
    if (comSpinner) setCarregando(true);
    setErro(null);
    try {
      const dados = await driverService.fetchTodaySummary();
      setEhMotoboy(true);
      setResumo(dados);
    } catch (err: any) {
      // Backend responde 403 quando o usuário não é motorista aprovado com
      // moto — é o sinal de "mostra o aviso", não um erro de verdade.
      if (err?.response?.status === 403) {
        setEhMotoboy(false);
        setResumo(null);
      } else {
        setErro(err?.message ?? 'Não foi possível carregar o painel agora.');
      }
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    // Cliente sem nenhum cadastro de motorista nem precisa bater no backend
    // pra saber que não é motoboy.
    if (user?.driverStatus !== 'approved') {
      setEhMotoboy(false);
      setCarregando(false);
      return;
    }
    carregarResumo(true);
  }, [user?.driverStatus, carregarResumo]);

  function handleRefresh() {
    setAtualizando(true);
    carregarResumo(false);
  }

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          ehMotoboy ? (
            <RefreshControl
              refreshing={atualizando}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {carregando ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : !ehMotoboy ? (
          <NaoEhMotoboyAviso />
        ) : erro ? (
          <View style={styles.avisoWrap}>
            <AlertIcon size={32} color={colors.danger} strokeWidth={1.6} />
            <Text style={styles.avisoTitulo}>Ops</Text>
            <Text style={styles.avisoTexto}>{erro}</Text>
            <Pressable style={styles.tentarNovamente} onPress={() => carregarResumo(true)}>
              <Text style={styles.tentarNovamenteTexto}>Tentar de novo</Text>
            </Pressable>
          </View>
        ) : (
          <ResumoMotoboy resumo={resumo} />
        )}
      </ScrollView>
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}>
        <ChevronLeftIcon size={22} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.headerTitle}>Painel do Motoboy</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function NaoEhMotoboyAviso() {
  return (
    <View style={styles.avisoWrap}>
      <View style={styles.avisoIconeWrap}>
        <MotoIcon size={36} color={colors.warning} strokeWidth={1.5} />
      </View>
      <Text style={styles.avisoTitulo}>Você não é motoboy</Text>
      <Text style={styles.avisoTexto}>
        Esse painel é exclusivo para motoristas do GO cadastrados com moto. Se você entrega de
        moto, cadastre-se como motorista em Configurações {'>'} Motorista escolhendo o veículo
        "Moto".
      </Text>
    </View>
  );
}

function ResumoMotoboy({ resumo }: { resumo: ResumoMotoboyHoje | null }) {
  const valorFormatado = formatarMoeda(resumo?.valorHoje ?? 0);

  return (
    <View style={styles.resumoWrap}>
      <Text style={styles.saudacao}>Suas corridas de hoje</Text>

      <View style={styles.cardsRow}>
        <View style={styles.card}>
          <View style={styles.cardIconeWrap}>
            <HistoryIcon size={22} color={colors.primary} strokeWidth={1.8} />
          </View>
          <Text style={styles.cardValor}>{resumo?.corridasHoje ?? 0}</Text>
          <Text style={styles.cardLabel}>Corridas feitas hoje</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIconeWrap}>
            <MoneyIcon size={22} color={colors.primary} strokeWidth={1.8} />
          </View>
          <Text style={styles.cardValor}>{valorFormatado}</Text>
          <Text style={styles.cardLabel}>Lucrado hoje</Text>
        </View>
      </View>

      <Text style={styles.rodapeTexto}>
        O resumo considera só as corridas já finalizadas hoje. Puxe a tela pra baixo pra
        atualizar.
      </Text>
    </View>
  );
}

function formatarMoeda(valor: number): string {
  try {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${valor.toFixed(2)}`;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h2,
    fontSize: 18,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    flexGrow: 1,
  },
  logo: {
    width: 96,
    height: 96,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  spinner: {
    marginTop: spacing.xxl,
  },
  avisoWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  avisoIconeWrap: {
    marginBottom: spacing.sm,
  },
  avisoTitulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  avisoTexto: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  tentarNovamente: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tentarNovamenteTexto: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  resumoWrap: {
    width: '100%',
  },
  saudacao: {
    ...typography.h2,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    width: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  cardIconeWrap: {
    marginBottom: spacing.sm,
  },
  cardValor: {
    ...typography.h1,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rodapeTexto: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});