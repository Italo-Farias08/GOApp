import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as rideService from '../services/rideService';
import { conectarSoquete } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { HistoricoCorridaMotoristaItem, MensagemChat } from '../types';
import ChatModal from './ChatModal';
import { ChevronLeftIcon, HistoryIcon, UserIcon } from './icons';

// Espelho da MessagesView do SettingsModal (passageiro), só que do lado do
// motorista: lista corridas encerradas com PASSAGEIROS (não motoristas), pra
// ele poder reabrir a conversa e responder um recado mesmo depois que a
// viagem já acabou (ex: passageiro esqueceu algo, ou perguntou algo depois).
type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function DriverMessagesModal({ visible, onClose }: Props) {
  const { user } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<HistoricoCorridaMotoristaItem[]>([]);

  const [conversaAberta, setConversaAberta] = useState<HistoricoCorridaMotoristaItem | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [carregandoConversa, setCarregandoConversa] = useState(false);

  const corridaAbertaIdRef = useRef<string | null>(null);

  // O backend devolve uma linha por CORRIDA, não por passageiro — quem já
  // levou o mesmo passageiro várias vezes o veria repetido na lista. Reduz
  // pra um item por passageiro, ficando com a corrida mais recente de cada
  // um (a lista já vem ordenada por criado_em DESC lá no backend).
  const itensPorPassageiro = useMemo(() => {
    const vistos = new Set<string>();
    const unicos: HistoricoCorridaMotoristaItem[] = [];
    for (const item of itens) {
      if (vistos.has(item.passageiro.id)) continue;
      vistos.add(item.passageiro.id);
      unicos.push(item);
    }
    return unicos;
  }, [itens]);

  useEffect(() => {
    if (!visible) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    (async () => {
      try {
        const [historico] = await Promise.all([
          rideService.listarHistoricoCorridasMotorista(),
          // garante o socket conectado pra receber resposta do passageiro em
          // tempo real caso ele responda enquanto a conversa está aberta
          conectarSoquete().catch(() => null),
        ]);
        if (ativo) setItens(historico);
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Não foi possível carregar suas mensagens.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [visible]);

  // Escuta mensagem nova enquanto uma conversa está aberta, pra resposta do
  // passageiro aparecer na hora sem precisar reabrir a tela.
  useEffect(() => {
    corridaAbertaIdRef.current = conversaAberta?.corrida.id ?? null;
    if (!conversaAberta) return;

    let cancelado = false;
    let soquete: Awaited<ReturnType<typeof conectarSoquete>> | null = null;

    (async () => {
      soquete = await conectarSoquete().catch(() => null);
      if (cancelado || !soquete) return;
      soquete.on('corrida:mensagem', aoReceberMensagem);
    })();

    function aoReceberMensagem(mensagem: MensagemChat) {
      if (mensagem.corridaId !== corridaAbertaIdRef.current) return;
      setMensagens((atual) => {
        if (atual.some((item) => item.id === mensagem.id)) return atual;
        return [...atual, mensagem];
      });
    }

    return () => {
      cancelado = true;
      soquete?.off('corrida:mensagem', aoReceberMensagem);
    };
  }, [conversaAberta]);

  async function abrirConversa(item: HistoricoCorridaMotoristaItem) {
    setConversaAberta(item);
    setMensagens([]);
    setCarregandoConversa(true);
    try {
      const historicoMensagens = await rideService.listarMensagens(item.corrida.id);
      setMensagens(historicoMensagens);
    } catch (err: any) {
      Alert.alert('Ops', err?.message ?? 'Não foi possível carregar essa conversa.');
    } finally {
      setCarregandoConversa(false);
    }
  }

  async function enviarMensagem(texto: string) {
    if (!conversaAberta) return;
    try {
      const mensagem = await rideService.enviarMensagemCorrida(conversaAberta.corrida.id, texto);
      setMensagens((atual) => [...atual, mensagem]);
    } catch (err: any) {
      Alert.alert('Ops', err?.message ?? 'Não foi possível enviar sua mensagem.');
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => setConversaAberta(null), 300);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={10} style={styles.voltarBotao}>
            <ChevronLeftIcon size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitulo}>Mensagens</Text>
          <View style={styles.voltarBotao} />
        </View>
        <Text style={styles.sectionHint}>
          Passageiro mandou recado depois da corrida? Toque numa viagem abaixo pra responder —
          por exemplo, se ele esqueceu algo com você.
        </Text>

        {carregando ? (
          <ActivityIndicator color={colors.primary} style={styles.carregando} />
        ) : erro ? (
          <Text style={styles.errorText}>{erro}</Text>
        ) : itensPorPassageiro.length === 0 ? (
          <View style={styles.vazio}>
            <HistoryIcon size={32} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.vazioTexto}>
              Suas corridas encerradas com passageiros aparecem aqui pra você poder responder
              eles depois.
            </Text>
          </View>
        ) : (
          <FlatList
            data={itensPorPassageiro}
            keyExtractor={(item) => item.passageiro.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.lista}
            renderItem={({ item }) => (
              <RideHistoryRow item={item} onPress={() => abrirConversa(item)} />
            )}
          />
        )}
      </View>

      {!!conversaAberta && (
        <ChatModal
          visible={!!conversaAberta}
          outroNome={conversaAberta.passageiro.nome}
          meuId={user?.id ?? ''}
          mensagens={mensagens}
          carregandoHistorico={carregandoConversa}
          onEnviar={enviarMensagem}
          onFechar={() => setConversaAberta(null)}
        />
      )}
    </Modal>
  );
}

function RideHistoryRow({
  item,
  onPress,
}: {
  item: HistoricoCorridaMotoristaItem;
  onPress: () => void;
}) {
  const cancelada = item.corrida.status === 'cancelada';
  return (
    <Pressable style={({ pressed }) => [styles.rideRow, pressed && styles.rideRowPressed]} onPress={onPress}>
      <View style={styles.rideRowIcone}>
        <UserIcon size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.rideRowTextos}>
        <Text style={styles.rideRowLabel}>{item.passageiro.nome}</Text>
        <Text style={styles.rideRowSublabel} numberOfLines={1}>
          {formatarDataCorrida(item.corrida.criadoEm)}
          {item.corrida.origem.endereco ? ` · ${item.corrida.origem.endereco}` : ''}
        </Text>
      </View>
      {cancelada && (
        <View style={styles.rideRowBadge}>
          <Text style={styles.rideRowBadgeTexto}>Cancelada</Text>
        </View>
      )}
      <View style={{ transform: [{ rotate: '180deg' }] }}>
        <ChevronLeftIcon size={18} color={colors.textMuted} strokeWidth={1.8} />
      </View>
    </Pressable>
  );
}

function formatarDataCorrida(iso: string): string {
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
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    height: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voltarBotao: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  headerTitulo: {
    ...typography.h2,
    fontSize: 18,
    color: colors.text,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  carregando: {
    marginTop: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  vazio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  vazioTexto: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  lista: {
    paddingBottom: spacing.xl,
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rideRowPressed: {
    opacity: 0.65,
  },
  rideRowIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideRowTextos: {
    flex: 1,
  },
  rideRowLabel: {
    ...typography.body,
    color: colors.text,
  },
  rideRowSublabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rideRowBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  rideRowBadgeTexto: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
});