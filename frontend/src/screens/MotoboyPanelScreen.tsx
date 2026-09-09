import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  ChevronLeftIcon,
  EditIcon,
  HistoryIcon,
  MoneyIcon,
  MotoIcon,
  PixIcon,
} from '../components/icons';
import { useAuth } from '../context/AuthContext';
import * as driverService from '../services/driverService';
import type { ChavePixTipo } from '../services/driverService';
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

function ResumoMotoboy({
  resumo,
  onAtualizar,
}: {
  resumo: ResumoMotoboyHoje | null;
  onAtualizar: () => void;
}) {
  const valorFormatado = formatarMoeda(resumo?.valorHoje ?? 0);
  const saldoAReceber = resumo?.saldoAReceber ?? 0;
  const chavePixCadastrada = resumo?.chavePixCadastrada ?? false;

  const [modalAberto, setModalAberto] = useState(false);
  const [sacando, setSacando] = useState(false);

  const valoresChaveAtual = {
    chavePix: resumo?.chavePix ?? null,
    chavePixTipo: resumo?.chavePixTipo ?? null,
    cpf: resumo?.cpf ?? null,
  };

  async function handleReceber() {
    if (!chavePixCadastrada) {
      setModalAberto(true);
      return;
    }

    setSacando(true);
    try {
      const resultado = await driverService.withdrawBalance();
      Alert.alert(
        'Pix enviado!',
        `${formatarMoeda(resultado.valorTransferido)} foram transferidos pra sua chave Pix.`
      );
      onAtualizar();
    } catch (err: any) {
      Alert.alert('Não deu pra sacar', err?.response?.data?.message ?? err?.message ?? 'Tenta de novo em instantes.');
    } finally {
      setSacando(false);
    }
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
          <Text style={styles.cardValor}>{valorFormatado}</Text>
          <Text style={styles.cardLabel}>Lucrado hoje</Text>
        </View>
      </View>

      <ChavePixCard
        cadastrada={chavePixCadastrada}
        tipo={resumo?.chavePixTipo ?? null}
        valor={resumo?.chavePix ?? null}
        onEditar={() => setModalAberto(true)}
      />

      {saldoAReceber > 0 && (
        <View style={styles.saldoCard}>
          <View style={styles.saldoTopoLinha}>
            <MoneyIcon size={18} color={colors.primary} strokeWidth={1.8} />
            <View style={styles.saldoTextos}>
              <Text style={styles.saldoValor}>{formatarMoeda(saldoAReceber)}</Text>
              <Text style={styles.saldoLabel}>
                Referente a corridas antigas que não foram pagas na hora — o passageiro quitou
                numa corrida mais recente e esse valor caiu pra você.
              </Text>
            </View>
          </View>
          <Pressable
            style={[styles.receberBotao, sacando && styles.receberBotaoDesabilitado]}
            onPress={handleReceber}
            disabled={sacando}
          >
            {sacando ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.receberBotaoTexto}>
                {chavePixCadastrada ? 'Receber agora' : 'Cadastrar chave Pix'}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <Text style={styles.rodapeTexto}>
        O resumo considera só as corridas já finalizadas hoje. Puxe a tela pra baixo pra
        atualizar.
      </Text>

      <ModalChavePix
        visivel={modalAberto}
        valoresIniciais={valoresChaveAtual}
        onFechar={() => setModalAberto(false)}
        onSalvo={() => {
          setModalAberto(false);
          onAtualizar();
        }}
      />
    </View>
  );
}

const ROTULO_TIPO: Record<string, string> = {
  CPF: 'CPF',
  EMAIL: 'E-mail',
  PHONE: 'Telefone',
  CNPJ: 'CNPJ',
  PIX_CODE: 'Chave aleatória',
};

// Card fixo mostrando a chave Pix cadastrada (ou o convite pra cadastrar),
// com botão de editar sempre visível — assim o motorista consegue corrigir
// uma chave digitada errada sem precisar cair no fluxo de saque primeiro.
function ChavePixCard({
  cadastrada,
  tipo,
  valor,
  onEditar,
}: {
  cadastrada: boolean;
  tipo: ChavePixTipo | null;
  valor: string | null;
  onEditar: () => void;
}) {
  return (
    <View style={styles.pixCard}>
      <View style={styles.pixCardTopo}>
        <View style={styles.pixCardIconeWrap}>
          <PixIcon size={18} color={colors.primary} strokeWidth={1.8} />
        </View>
        <Text style={styles.pixCardTitulo}>Chave Pix</Text>
        <Pressable
          style={styles.pixEditarBotao}
          onPress={onEditar}
          hitSlop={8}
          accessibilityLabel={cadastrada ? 'Editar chave Pix' : 'Cadastrar chave Pix'}
        >
          <EditIcon size={14} color={colors.primary} strokeWidth={1.9} />
          <Text style={styles.pixEditarBotaoTexto}>{cadastrada ? 'Editar' : 'Cadastrar'}</Text>
        </Pressable>
      </View>

      {cadastrada && valor ? (
        <View style={styles.pixValorLinha}>
          {tipo && (
            <View style={styles.pixTipoChip}>
              <Text style={styles.pixTipoChipTexto}>{ROTULO_TIPO[tipo] ?? tipo}</Text>
            </View>
          )}
          <Text style={styles.pixValorTexto} numberOfLines={1} ellipsizeMode="middle">
            {valor}
          </Text>
        </View>
      ) : (
        <Text style={styles.pixVazioTexto}>
          Nenhuma chave cadastrada ainda. É pra onde seus saques vão cair.
        </Text>
      )}
    </View>
  );
}

const TIPOS_CHAVE: { valor: ChavePixTipo; rotulo: string }[] = [
  { valor: 'CPF', rotulo: 'CPF' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'PHONE', rotulo: 'Telefone' },
  { valor: 'CNPJ', rotulo: 'CNPJ' },
  { valor: 'PIX_CODE', rotulo: 'Chave aleatória' },
];

function ModalChavePix({
  visivel,
  onFechar,
  onSalvo,
  valoresIniciais,
}: {
  visivel: boolean;
  onFechar: () => void;
  onSalvo: () => void;
  valoresIniciais?: {
    chavePix: string | null;
    chavePixTipo: ChavePixTipo | null;
    cpf: string | null;
  };
}) {
  const jaTinhaChave = Boolean(valoresIniciais?.chavePix);

  const [tipo, setTipo] = useState<ChavePixTipo>(valoresIniciais?.chavePixTipo ?? 'CPF');
  const [chave, setChave] = useState(valoresIniciais?.chavePix ?? '');
  const [cpf, setCpf] = useState(valoresIniciais?.cpf ?? '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (visivel) {
      setTipo(valoresIniciais?.chavePixTipo ?? 'CPF');
      setChave(valoresIniciais?.chavePix ?? '');
      setCpf(valoresIniciais?.cpf ?? '');
    }
    
  }, [visivel]);

  async function handleSalvar() {
    if (!chave.trim() || !cpf.trim()) {
      Alert.alert('Faltou algo', 'Preenche a chave Pix e o CPF do titular da conta.');
      return;
    }

    setSalvando(true);
    try {
      await driverService.updatePixKey({ chavePix: chave.trim(), chavePixTipo: tipo, cpf: cpf.trim() });
      onSalvo();
    } catch (err: any) {
      Alert.alert('Não deu pra salvar', err?.response?.data?.message ?? err?.message ?? 'Tenta de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={onFechar}>
      <KeyboardAvoidingView
        style={styles.modalFundo}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalConteudo}>
          <Text style={styles.modalTitulo}>
            {jaTinhaChave ? 'Editar chave Pix' : 'Cadastrar chave Pix'}
          </Text>
          <Text style={styles.modalSubtitulo}>
            {jaTinhaChave
              ? 'Corrige aqui se algum dado foi digitado errado. É pra onde seus saques caem.'
              : 'É pra onde seus saques vão cair. Só precisa fazer isso uma vez.'}
          </Text>

          <View style={styles.tiposLinha}>
            {TIPOS_CHAVE.map((item) => (
              <Pressable
                key={item.valor}
                style={[styles.tipoChip, tipo === item.valor && styles.tipoChipSelecionado]}
                onPress={() => setTipo(item.valor)}
              >
                <Text
                  style={[
                    styles.tipoChipTexto,
                    tipo === item.valor && styles.tipoChipTextoSelecionado,
                  ]}
                >
                  {item.rotulo}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.modalInput}
            placeholder="Sua chave Pix"
            placeholderTextColor={colors.textSecondary}
            value={chave}
            onChangeText={setChave}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.modalInput}
            placeholder="CPF do titular (só números)"
            placeholderTextColor={colors.textSecondary}
            value={cpf}
            onChangeText={setCpf}
            keyboardType="number-pad"
            maxLength={11}
          />

          <View style={styles.modalBotoesLinha}>
            <Pressable style={styles.modalBotaoSecundario} onPress={onFechar} disabled={salvando}>
              <Text style={styles.modalBotaoSecundarioTexto}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBotaoPrimario, salvando && styles.receberBotaoDesabilitado]}
              onPress={handleSalvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={styles.modalBotaoPrimarioTexto}>Salvar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  pixCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  pixCardTopo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pixCardIconeWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  pixCardTitulo: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  pixEditarBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pixEditarBotaoTexto: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  pixValorLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  pixTipoChip: {
    paddingVertical: 3,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pixTipoChipTexto: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  pixValorTexto: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
  },
  pixVazioTexto: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 16,
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
  tiposLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tipoChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipoChipSelecionado: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tipoChipTexto: {
    ...typography.caption,
    color: colors.text,
  },
  tipoChipTextoSelecionado: {
    color: colors.background,
    fontWeight: '600',
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
});