import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertIcon,
  CarIcon,
  CheckIcon,
  ChevronLeftIcon,
  HistoryIcon,
  MoneyIcon,
} from '../components/icons';
import { useAuth } from '../context/AuthContext';
import * as driverService from '../services/driverService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { ResumoMotoboyHoje, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MotoboyPanel'>;

// Tela acessível a QUALQUER usuário logado (cliente ou motorista) a partir
// das configurações. Só quem é motorista aprovado (carro ou moto) enxerga
// o resumo do dia — todo mundo mais cai no aviso de "isso aqui é só pra
// motorista".
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
    // pra saber que não é motorista.
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
          <ResumoMotoboy resumo={resumo} onAtualizar={() => carregarResumo(false)} />
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
      <Text style={styles.headerTitle}>Painel do Motorista</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function NaoEhMotoboyAviso() {
  return (
    <View style={styles.avisoWrap}>
      <View style={styles.avisoIconeWrap}>
        <CarIcon size={36} color={colors.warning} strokeWidth={1.5} />
      </View>
      <Text style={styles.avisoTitulo}>Você ainda não é motorista</Text>
      <Text style={styles.avisoTexto}>
        Esse painel é exclusivo para motoristas do GO aprovados (carro ou moto). Cadastre-se em
        Configurações {'>'} Motorista pra liberar seu resumo do dia.
      </Text>
    </View>
  );
}

function ResumoMotoboy({
  resumo,
  onAtualizar,
}: {
  resumo: ResumoMotoboyHoje | null;
  onAtualizar: () => void;
}) {
  const saldoAReceber = resumo?.saldoAReceber ?? 0;
  const saldoFormatado = formatarMoeda(saldoAReceber);
  const comissaoFormatada = formatarMoeda(resumo?.comissaoHoje ?? 0);

  const [modalSaqueAberto, setModalSaqueAberto] = useState(false);
  const [modalSucessoAberto, setModalSucessoAberto] = useState(false);
  const [valorSacado, setValorSacado] = useState(0);

  function handleAbrirSaque() {
    setModalSaqueAberto(true);
  }

  function handleSaqueSolicitado(valor: number) {
    setModalSaqueAberto(false);
    setValorSacado(valor);
    setModalSucessoAberto(true);
    onAtualizar();
  }

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
          <Text style={styles.cardValor}>{saldoFormatado}</Text>
          <Text style={styles.cardLabel}>Saldo pra sacar</Text>
          {(resumo?.comissaoHoje ?? 0) > 0 && (
            <Text style={styles.cardSublabel}>já descontada taxa de {comissaoFormatada} hoje</Text>
          )}
        </View>
      </View>

      {saldoAReceber > 0 && (
        <View style={styles.saldoCard}>
          <View style={styles.saldoTopoLinha}>
            <MoneyIcon size={18} color={colors.primary} strokeWidth={1.8} />
            <View style={styles.saldoTextos}>
              <Text style={styles.saldoLabel}>
                Esse é o valor real disponível pra você sacar agora — corridas pagas por Pix
                (já com a taxa da plataforma descontada) e valores de corridas antigas que
                caíram pra você. Não inclui corridas pagas em dinheiro, já que esse valor já
                ficou com você na hora.
              </Text>
            </View>
          </View>
          <Pressable style={styles.receberBotao} onPress={handleAbrirSaque}>
            <Text style={styles.receberBotaoTexto}>Solicitar Saque</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.rodapeTexto}>
        O resumo considera só as corridas já finalizadas hoje. Puxe a tela pra baixo pra
        atualizar.
      </Text>

      <ModalSolicitarSaque
        visivel={modalSaqueAberto}
        saldoDisponivel={saldoAReceber}
        onFechar={() => setModalSaqueAberto(false)}
        onSolicitado={handleSaqueSolicitado}
      />

      <ModalSucessoSaque
        visivel={modalSucessoAberto}
        valor={valorSacado}
        onFechar={() => setModalSucessoAberto(false)}
      />
    </View>
  );
}

// Modal onde o motorista digita quanto quer sacar e o CPF de quem vai
// receber. Ao confirmar, só registra o PEDIDO (não transfere nada na
// hora) — por isso não pede chave Pix nenhuma aqui, só o CPF.
function ModalSolicitarSaque({
  visivel,
  saldoDisponivel,
  onFechar,
  onSolicitado,
}: {
  visivel: boolean;
  saldoDisponivel: number;
  onFechar: () => void;
  onSolicitado: (valor: number) => void;
}) {
  const [valor, setValor] = useState('');
  const [cpf, setCpf] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Toda vez que o modal abre, começa limpo — evita mostrar um valor/CPF
  // de um pedido anterior já enviado.
  useEffect(() => {
    if (visivel) {
      setValor('');
      setCpf('');
    }
  }, [visivel]);

  async function handleConfirmar() {
    const valorNumero = Number(valor.replace(',', '.'));

    if (!valorNumero || valorNumero <= 0) {
      Alert.alert('Faltou algo', 'Digite o valor que você quer sacar.');
      return;
    }
    if (valorNumero > saldoDisponivel) {
      Alert.alert('Valor muito alto', 'Esse valor é maior que o seu saldo disponível.');
      return;
    }
    if (cpf.trim().length !== 11) {
      Alert.alert('Faltou algo', 'Digite o CPF (só números) de quem vai receber o saque.');
      return;
    }

    setEnviando(true);
    try {
      const solicitacao = await driverService.requestWithdraw({
        valor: valorNumero,
        cpf: cpf.trim(),
      });
      onSolicitado(solicitacao.valor);
    } catch (err: any) {
      Alert.alert(
        'Não deu pra solicitar',
        err?.response?.data?.message ?? err?.message ?? 'Tenta de novo em instantes.'
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={onFechar}>
      <KeyboardAvoidingView
        style={styles.modalFundo}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalConteudo}>
          <Text style={styles.modalTitulo}>Solicitar saque</Text>
          <Text style={styles.modalSubtitulo}>
            Saldo disponível: {formatarMoeda(saldoDisponivel)}. Seu pedido é enviado pra gente
            processar o pagamento.
          </Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Valor do saque (ex: 50,00)"
            placeholderTextColor={colors.textSecondary}
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
          />

          <TextInput
            style={styles.modalInput}
            placeholder="CPF de quem vai receber (só números)"
            placeholderTextColor={colors.textSecondary}
            value={cpf}
            onChangeText={setCpf}
            keyboardType="number-pad"
            maxLength={11}
          />

          <View style={styles.modalBotoesLinha}>
            <Pressable style={styles.modalBotaoSecundario} onPress={onFechar} disabled={enviando}>
              <Text style={styles.modalBotaoSecundarioTexto}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBotaoPrimario, enviando && styles.receberBotaoDesabilitado]}
              onPress={handleConfirmar}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={styles.modalBotaoPrimarioTexto}>Confirmar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Modal animado de confirmação — aparece depois que o pedido de saque foi
// enviado, avisando que o valor cai em até 3 horas úteis.
function ModalSucessoSaque({
  visivel,
  valor,
  onFechar,
}: {
  visivel: boolean;
  valor: number;
  onFechar: () => void;
}) {
  const escala = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (visivel) {
      escala.setValue(0);
      Animated.spring(escala, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [visivel, escala]);

  return (
    <Modal visible={visivel} animationType="fade" transparent onRequestClose={onFechar}>
      <View style={styles.sucessoFundo}>
        <View style={styles.sucessoConteudo}>
          <Animated.View style={[styles.sucessoIconeWrap, { transform: [{ scale: escala }] }]}>
            <CheckIcon size={36} color={colors.background} strokeWidth={2.4} />
          </Animated.View>
          <Text style={styles.sucessoTitulo}>Pedido enviado!</Text>
          <Text style={styles.sucessoTexto}>
            {formatarMoeda(valor)} serão depositados pra você em até 3 horas úteis.
          </Text>
          <Pressable style={styles.modalBotaoPrimario} onPress={onFechar}>
            <Text style={styles.modalBotaoPrimarioTexto}>Entendi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    width: 220,
    height: 200,
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
  cardSublabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  saldoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  saldoTopoLinha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  receberBotao: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receberBotaoDesabilitado: {
    opacity: 0.6,
  },
  receberBotaoTexto: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalConteudo: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitulo: {
    ...typography.h2,
    fontSize: 18,
    color: colors.text,
  },
  modalSubtitulo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  modalBotoesLinha: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalBotaoSecundario: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBotaoSecundarioTexto: {
    ...typography.body,
    color: colors.text,
  },
  modalBotaoPrimario: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  modalBotaoPrimarioTexto: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  saldoTextos: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  saldoValor: {
    ...typography.h2,
    fontSize: 18,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  saldoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  rodapeTexto: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  sucessoFundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sucessoConteudo: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  sucessoIconeWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sucessoTitulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  sucessoTexto: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
});