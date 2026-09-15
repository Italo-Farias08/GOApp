import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as paymentService from '../services/paymentService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { Divida, PagamentoPix } from '../types';
import { formatarMoeda } from '../utils/precoCorrida';
import Button from './Button';
import { AlertIcon, ChevronLeftIcon, CheckIcon, CopyIcon } from './icons';

type Props = {
  onBack: () => void;
};

// Tela "Pendências" nas configurações do passageiro: mostra quanto ele
// ainda deve de corridas anteriores não pagas e deixa quitar tudo na hora
// via Pix, sem precisar esperar a próxima corrida embutir o valor
// automaticamente (ver corridaServico.calcularPrecoComDividasPendentes no
// backend, que é o outro jeito dessa dívida ser cobrada).
export default function PendenciasView({ onBack }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [total, setTotal] = useState(0);

  const [pagando, setPagando] = useState(false);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pagamentoPix, setPagamentoPix] = useState<PagamentoPix | null>(null);
  const [erroPix, setErroPix] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [quitado, setQuitado] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- Entrada animada da tela ----------
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  // ---------- Logo "respirando" enquanto aguarda o pagamento ----------
  const logoPulso = useRef(new Animated.Value(1)).current;

  // ---------- Selo de sucesso ----------
  const seloEscala = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    carregarPendencias();

    return () => pararPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enquanto o QR code está na tela esperando pagamento, o logo pulsa
  // suavemente em loop — dá vida pra tela sem distrair do QR code.
  useEffect(() => {
    if (pagando && !quitado) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(logoPulso, {
            toValue: 1.08,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(logoPulso, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [pagando, quitado, logoPulso]);

  // Selo de "quitado" nasce com uma pequena animação de "pop".
  useEffect(() => {
    if (quitado) {
      Animated.spring(seloEscala, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [quitado, seloEscala]);

  async function carregarPendencias() {
    setErro(null);
    setCarregando(true);
    try {
      const resumo = await paymentService.listarDividas();
      setDividas(resumo.dividas);
      setTotal(resumo.total);
    } catch (err: any) {
      setErro(extrairMensagemErro(err, 'Não foi possível carregar suas pendências.'));
    } finally {
      setCarregando(false);
    }
  }

  function pararPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function iniciarPagamento() {
    setPagando(true);
    setGerandoPix(true);
    setErroPix(null);
    setPagamentoPix(null);
    setCopiado(false);
    try {
      const pagamento = await paymentService.criarPagamentoPixDivida();
      setPagamentoPix(pagamento);
      iniciarPolling(pagamento.id);
    } catch (err: any) {
      setErroPix(extrairMensagemErro(err, 'Não foi possível gerar o Pix. Tente novamente.'));
    } finally {
      setGerandoPix(false);
    }
  }

  function iniciarPolling(pagamentoId: string) {
    pararPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const atualizado = await paymentService.consultarPagamentoPix(pagamentoId);
        setPagamentoPix(atualizado);

        if (atualizado.status === 'aprovado') {
          pararPolling();
          setQuitado(true);
          // Recarrega em segundo plano pra lista já vir vazia (ou menor)
          // quando o passageiro voltar pro resumo.
          carregarPendencias();
        } else if (atualizado.status === 'recusado' || atualizado.status === 'expirado') {
          pararPolling();
        }
      } catch {
        // Falha pontual de rede — a próxima tentativa do intervalo tenta de
        // novo, não precisa travar a tela por causa disso.
      }
    }, 3000);
  }

  async function copiarCodigo() {
    if (!pagamentoPix?.qrCode) return;
    await Clipboard.setStringAsync(pagamentoPix.qrCode);
    setCopiado(true);
  }

  function voltarParaResumo() {
    pararPolling();
    setPagando(false);
    setPagamentoPix(null);
    setErroPix(null);
    setQuitado(false);
    seloEscala.setValue(0);
  }

  const expirado = pagamentoPix?.status === 'expirado';
  const recusado = pagamentoPix?.status === 'recusado';
  const comProblema = expirado || recusado;

  return (
    <Animated.View
      style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
    >
      <View style={styles.header}>
        <Pressable
          onPress={pagando && !quitado ? voltarParaResumo : onBack}
          hitSlop={10}
          style={styles.backButton}
        >
          <ChevronLeftIcon size={22} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Pendências</Text>
        <View style={styles.backButton} />
      </View>

      {!pagando && (
        <ResumoPendencias
          carregando={carregando}
          erro={erro}
          dividas={dividas}
          total={total}
          onPagar={iniciarPagamento}
          onTentarDeNovo={carregarPendencias}
        />
      )}

      {pagando && (
        <PagamentoPendencia
          gerando={gerandoPix}
          erro={erroPix}
          pagamento={pagamentoPix}
          quitado={quitado}
          comProblema={comProblema}
          copiado={copiado}
          logoPulso={logoPulso}
          seloEscala={seloEscala}
          onCopiar={copiarCodigo}
          onTentarDeNovo={iniciarPagamento}
          onFechar={voltarParaResumo}
        />
      )}
    </Animated.View>
  );
}

// ---------- Resumo (lista de pendências + botão de pagar) ----------

function ResumoPendencias({
  carregando,
  erro,
  dividas,
  total,
  onPagar,
  onTentarDeNovo,
}: {
  carregando: boolean;
  erro: string | null;
  dividas: Divida[];
  total: number;
  onPagar: () => void;
  onTentarDeNovo: () => void;
}) {
  if (carregando) {
    return <ActivityIndicator color={colors.primary} style={styles.carregando} />;
  }

  if (erro) {
    return (
      <View style={styles.estadoCentral}>
        <Text style={styles.erroTexto}>{erro}</Text>
        <Button label="Tentar de novo" variant="secondary" onPress={onTentarDeNovo} style={styles.tentarBotao} />
      </View>
    );
  }

  if (total <= 0) {
    return (
      <View style={styles.estadoCentral}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoTudoCerto}
          resizeMode="contain"
        />
        <Text style={styles.statusTitulo}>Tudo certo por aqui</Text>
        <Text style={styles.statusDescricao}>
          Você não tem nenhuma pendência. Assim que uma corrida ficar sem pagar, ela aparece
          aqui.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionHint}>
        Isso é o que ficou de corridas anteriores não pagas. Você pode quitar tudo agora via Pix,
        ou deixar que o valor entra automaticamente na sua próxima corrida.
      </Text>

      <View style={styles.totalCard}>
        <View style={styles.totalIconeWrap}>
          <AlertIcon size={20} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalLabel}>Total pendente</Text>
          <Text style={styles.totalValor}>{formatarMoeda(total)}</Text>
        </View>
      </View>

      <Text style={styles.listaLabel}>Corridas não pagas</Text>
      {dividas.map((divida) => (
        <View key={divida.id} style={styles.dividaRow}>
          <View style={styles.dividaRowTextos}>
            <Text style={styles.dividaRowTitulo}>Corrida não paga</Text>
            <Text style={styles.dividaRowData}>{formatarDataDivida(divida.criadoEm)}</Text>
          </View>
          <Text style={styles.dividaRowValor}>{formatarMoeda(divida.valor)}</Text>
        </View>
      ))}

      <Button label="Pagar pendências agora" onPress={onPagar} style={styles.pagarBotao} />
    </ScrollView>
  );
}

// ---------- Pagamento (QR code + status + sucesso) ----------

function PagamentoPendencia({
  gerando,
  erro,
  pagamento,
  quitado,
  comProblema,
  copiado,
  logoPulso,
  seloEscala,
  onCopiar,
  onTentarDeNovo,
  onFechar,
}: {
  gerando: boolean;
  erro: string | null;
  pagamento: PagamentoPix | null;
  quitado: boolean;
  comProblema: boolean;
  copiado: boolean;
  logoPulso: Animated.Value;
  seloEscala: Animated.Value;
  onCopiar: () => void;
  onTentarDeNovo: () => void;
  onFechar: () => void;
}) {
  if (quitado) {
    return (
      <View style={styles.estadoCentral}>
        <View style={styles.seloWrap}>
          <Animated.Image
            source={require('../../assets/logo.png')}
            style={[styles.logoSeloFundo, { transform: [{ scale: seloEscala }] }]}
            resizeMode="contain"
          />
          <Animated.View
            style={[
              styles.seloCheck,
              {
                transform: [{ scale: seloEscala }],
              },
            ]}
          >
            <CheckIcon size={22} color={colors.background} strokeWidth={3} />
          </Animated.View>
        </View>
        <Text style={styles.statusTitulo}>Pendência quitada!</Text>
        <Text style={styles.statusDescricao}>
          Recebemos seu pagamento e já atualizamos tudo por aqui.
        </Text>
        <Button label="Voltar" onPress={onFechar} style={styles.tentarBotao} />
      </View>
    );
  }

  if (gerando) {
    return (
      <View style={styles.estadoCentral}>
        <Animated.Image
          source={require('../../assets/logo.png')}
          style={[styles.logoGerando, { transform: [{ scale: logoPulso }] }]}
          resizeMode="contain"
        />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        <Text style={styles.statusDescricao}>Gerando cobrança...</Text>
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.estadoCentral}>
        <Text style={styles.erroTexto}>{erro}</Text>
        <Button label="Tentar de novo" variant="secondary" onPress={onTentarDeNovo} style={styles.tentarBotao} />
      </View>
    );
  }

  if (comProblema) {
    return (
      <View style={styles.estadoCentral}>
        <Text style={styles.statusDescricao}>
          {pagamento?.status === 'expirado'
            ? 'O tempo pra pagar esse QR code acabou.'
            : 'O pagamento não foi aprovado.'}
        </Text>
        <Button label="Gerar novo QR code" onPress={onTentarDeNovo} style={styles.tentarBotao} />
      </View>
    );
  }

  if (!pagamento) return null;

  return (
    <View>
      <View style={styles.valorPixWrap}>
        <Animated.Image
          source={require('../../assets/logo.png')}
          style={[styles.logoPequeno, { transform: [{ scale: logoPulso }] }]}
          resizeMode="contain"
        />
        <Text style={styles.valorPixTexto}>{formatarMoeda(pagamento.valor)}</Text>
      </View>

      <View style={styles.qrWrap}>
        <Image
          source={{ uri: `data:image/png;base64,${pagamento.qrCodeBase64}` }}
          style={styles.qrImagem}
          resizeMode="contain"
        />
      </View>

      <Pressable style={styles.copiarBotao} onPress={onCopiar}>
        <CopyIcon size={16} color={colors.background} />
        <Text style={styles.copiarTexto}>{copiado ? 'Código copiado!' : 'Copiar código Pix'}</Text>
      </Pressable>

      <View style={styles.statusRow}>
        <ActivityIndicator color={colors.textSecondary} size="small" />
        <Text style={styles.statusTexto}>Aguardando confirmação do pagamento...</Text>
      </View>
    </View>
  );
}

function extrairMensagemErro(erro: unknown, fallback: string): string {
  const resposta = (erro as { response?: { data?: { message?: string } } })?.response;
  return resposta?.data?.message || fallback;
}

function formatarDataDivida(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  carregando: {
    marginVertical: spacing.xl,
  },
  estadoCentral: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  erroTexto: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  tentarBotao: {
    marginTop: spacing.md,
    minWidth: 200,
  },
  logoTudoCerto: {
    width: 120,
    height: 84,
    marginBottom: spacing.md,
    opacity: 0.9,
  },
  statusTitulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  statusDescricao: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  totalIconeWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warning + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  totalValor: {
    ...typography.h2,
    fontSize: 24,
    color: colors.warning,
    marginTop: 2,
  },
  listaLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dividaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dividaRowTextos: {
    flex: 1,
  },
  dividaRowTitulo: {
    ...typography.bodyBold,
    color: colors.text,
  },
  dividaRowData: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dividaRowValor: {
    ...typography.bodyBold,
    color: colors.text,
  },
  pagarBotao: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  valorPixWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoPequeno: {
    width: 74,
    height: 65,
    marginBottom: spacing.xs,
  },
  logoGerando: {
    width: 96,
    height: 67,
  },
  valorPixTexto: {
    ...typography.h2,
    fontSize: 22,
    color: colors.primary,
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  qrImagem: {
    width: 220,
    height: 220,
  },
  copiarBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  copiarTexto: {
    ...typography.bodyBold,
    color: colors.background,
    marginLeft: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statusTexto: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  seloWrap: {
    width: 120,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoSeloFundo: {
    width: 120,
    height: 84,
    position: 'absolute',
    opacity: 0.9,
  },
  seloCheck: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
});