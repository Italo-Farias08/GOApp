import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import { CloseIcon, SendIcon } from './icons';
import type { MensagemChat } from '../types';

type Props = {
  visible: boolean;
  // Nome de quem está do outro lado da conversa (motorista, pro passageiro;
  // passageiro, pro motorista) — mostrado no cabeçalho.
  outroNome: string;
  // ID do usuário logado — usado só pra saber de que lado cada bolha cai
  // (direita = eu, esquerda = a outra pessoa).
  meuId: string;
  mensagens: MensagemChat[];
  carregandoHistorico?: boolean;
  onEnviar: (texto: string) => void;
  onFechar: () => void;
};

// Chat simples entre passageiro e motorista durante a corrida — mesmo
// papel que antes era do botão "Ligar para o motorista" (Linking.openURL
// com tel:), só que dentro do próprio app via socket em vez de abrir o
// discador do telefone.
export default function ChatModal({
  visible,
  outroNome,
  meuId,
  mensagens,
  carregandoHistorico = false,
  onEnviar,
  onFechar,
}: Props) {
  const [texto, setTexto] = useState('');
  const listaRef = useRef<FlatList<MensagemChat>>(null);

  // Rola pro final sempre que chega mensagem nova (ou o histórico termina de
  // carregar) — sem isso a conversa abriria "no meio" em vez da última troca.
  useEffect(() => {
    if (!visible) return;
    const tempo = setTimeout(() => {
      listaRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => clearTimeout(tempo);
  }, [visible, mensagens.length, carregandoHistorico]);

  function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    onEnviar(limpo);
    setTexto('');
  }

  function formatarHorario(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFechar}>
      <Pressable style={styles.backdrop} onPress={onFechar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.cabecalho}>
            <View style={styles.cabecalhoTextos}>
              <Text style={styles.titulo}>{outroNome}</Text>
              <Text style={styles.subtitulo}>Converse sobre a corrida</Text>
            </View>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              style={({ pressed }) => [styles.fecharBotao, pressed && styles.pressedFeedback]}
            >
              <CloseIcon size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.corpo}>
            {carregandoHistorico ? (
              <View style={styles.carregandoBox}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : mensagens.length === 0 ? (
              <View style={styles.vazioBox}>
                <Text style={styles.vazioTexto}>
                  Nenhuma mensagem ainda. Diga um oi pra {outroNome.split(' ')[0]}!
                </Text>
              </View>
            ) : (
              <FlatList
                ref={listaRef}
                data={mensagens}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listaConteudo}
                onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  const minha = item.remetenteId === meuId;
                  return (
                    <View style={[styles.bolhaLinha, minha ? styles.bolhaLinhaMinha : styles.bolhaLinhaOutro]}>
                      <View style={[styles.bolha, minha ? styles.bolhaMinha : styles.bolhaOutro]}>
                        <Text style={[styles.bolhaTexto, minha && styles.bolhaTextoMinha]}>{item.texto}</Text>
                        <Text style={[styles.bolhaHorario, minha && styles.bolhaHorarioMinha]}>
                          {formatarHorario(item.criadoEm)}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>

          <View style={styles.entradaRow}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Digite uma mensagem..."
              placeholderTextColor={colors.textMuted}
              style={styles.entradaInput}
              multiline
              maxLength={1000}
              onSubmitEditing={enviar}
            />
            <Pressable
              onPress={enviar}
              disabled={!texto.trim()}
              style={({ pressed }) => [
                styles.enviarBotao,
                !texto.trim() && styles.enviarBotaoDesabilitado,
                pressed && !!texto.trim() && styles.pressedFeedback,
              ]}
            >
              <SendIcon size={18} color={colors.background} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheetWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '78%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  pressedFeedback: { opacity: 0.65 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  cabecalhoTextos: { flex: 1 },
  titulo: {
    ...typography.h2,
    fontSize: 20,
    color: colors.text,
  },
  subtitulo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fecharBotao: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  corpo: {
    flex: 1,
  },
  carregandoBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vazioBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  vazioTexto: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listaConteudo: {
    paddingVertical: spacing.sm,
  },
  bolhaLinha: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  bolhaLinhaMinha: { justifyContent: 'flex-end' },
  bolhaLinhaOutro: { justifyContent: 'flex-start' },
  bolha: {
    maxWidth: '78%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bolhaOutro: {
    backgroundColor: colors.surfaceAlt,
    borderBottomLeftRadius: 4,
  },
  bolhaMinha: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bolhaTexto: {
    ...typography.body,
    color: colors.text,
  },
  bolhaTextoMinha: {
    color: colors.background,
  },
  bolhaHorario: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  bolhaHorarioMinha: {
    color: 'rgba(11, 11, 15, 0.55)',
  },
  entradaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  entradaInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    ...typography.body,
  },
  enviarBotao: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarBotaoDesabilitado: {
    opacity: 0.4,
  },
});