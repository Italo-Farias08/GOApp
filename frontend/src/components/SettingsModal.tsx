import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import * as driverService from '../services/driverService';
import * as rideService from '../services/rideService';
import { conectarSoquete } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type {
  DriverStatus,
  HistoricoCorridaItem,
  MensagemChat,
  RootStackParamList,
  TipoVeiculo,
} from '../types';
import Button from './Button';
import ChatModal from './ChatModal';
import Input from './Input';
import {
  CarIcon,
  ChatIcon,
  ChevronLeftIcon,
  ExitIcon,
  HistoryIcon,
  MotoIcon,
  UserIcon,
} from './icons';

type ModalView = 'menu' | 'account' | 'driver' | 'messages';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SettingsModal({ visible, onClose }: Props) {
  const { user, signOut } = useAuth();
  const [view, setView] = useState<ModalView>('menu');

  function handleClose() {
    onClose();
    // pequeno delay pra não trocar de tela enquanto o modal ainda está fechando
    setTimeout(() => setView('menu'), 300);
  }

  async function handleSignOut() {
    await signOut();
    handleClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {view === 'menu' && (
          <MenuView
            userName={user?.name}
            onSelectAccount={() => setView('account')}
            onSelectDriver={() => setView('driver')}
            onSelectMessages={() => setView('messages')}
            onSignOut={handleSignOut}
          />
        )}
        {view === 'account' && <AccountView onBack={() => setView('menu')} />}
        {view === 'driver' && <DriverView onBack={() => setView('menu')} onClose={handleClose} />}
        {view === 'messages' && <MessagesView onBack={() => setView('menu')} />}
      </View>
    </Modal>
  );
}

// ---------- Menu principal ----------

function MenuView({
  userName,
  onSelectAccount,
  onSelectDriver,
  onSelectMessages,
  onSignOut,
}: {
  userName?: string;
  onSelectAccount: () => void;
  onSelectDriver: () => void;
  onSelectMessages: () => void;
  onSignOut: () => void;
}) {
  return (
    <View>
      <Text style={styles.menuTitle}>Olá, {userName?.split(' ')[0] ?? 'por aí'}</Text>

      <MenuItem
        renderIcon={(cor) => <UserIcon size={22} color={cor} />}
        label="Conta"
        sublabel="Dados e credenciais"
        onPress={onSelectAccount}
      />
      <MenuItem
        renderIcon={(cor) => <ChatIcon size={20} color={cor} />}
        label="Mensagens"
        sublabel="Fale com motoristas de corridas anteriores"
        onPress={onSelectMessages}
      />
      <MenuItem
        renderIcon={(cor) => <CarIcon size={22} color={cor} />}
        label="Motorista"
        sublabel="Cadastre-se pra dirigir no GO"
        onPress={onSelectDriver}
      />

      <View style={styles.divider} />

      <MenuItem
        renderIcon={(cor) => <ExitIcon size={20} color={cor} />}
        label="Sair"
        danger
        onPress={onSignOut}
      />
    </View>
  );
}

function MenuItem({
  renderIcon,
  label,
  sublabel,
  danger,
  onPress,
}: {
  renderIcon: (color: string) => React.ReactNode;
  label: string;
  sublabel?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const corIcone = danger ? colors.danger : colors.text;
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={styles.menuIconWrap}>{renderIcon(corIcone)}</View>
      <View style={styles.menuItemTextWrap}>
        <Text style={[styles.menuItemLabel, danger && styles.menuItemLabelDanger]}>{label}</Text>
        {!!sublabel && <Text style={styles.menuItemSublabel}>{sublabel}</Text>}
      </View>
      {!danger && <ChevronRightIcon />}
    </Pressable>
  );
}

// Seta ">" simples reaproveitando o ChevronLeftIcon espelhado, pra não criar
// mais um ícone só pra isso.
function ChevronRightIcon() {
  return (
    <View style={{ transform: [{ rotate: '180deg' }] }}>
      <ChevronLeftIcon size={18} color={colors.textMuted} strokeWidth={1.8} />
    </View>
  );
}

// ---------- Conta ----------

function AccountView({ onBack }: { onBack: () => void }) {
  const { user, updateAccount } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      await updateAccount({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      setSaved(true);
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível salvar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Header title="Conta" onBack={onBack} />
      <Text style={styles.sectionHint}>
        Edite suas credenciais abaixo.
      </Text>

      <Input label="Nome" value={name} onChangeText={setName} placeholder="Seu nome completo" />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="seuemail@exemplo.com"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input
        label="Telefone"
        value={phone}
        onChangeText={setPhone}
        placeholder="(00) 00000-0000"
        keyboardType="phone-pad"
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {saved && !error && <Text style={styles.savedText}>Credenciais atualizadas ✓</Text>}

      <Button label="Salvar" onPress={handleSave} loading={loading} style={styles.actionButton} />
    </ScrollView>
  );
}

// ---------- Motorista ----------

function DriverView({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { user, updateDriverStatus } = useAuth();
  const [cnhNumber, setCnhNumber] = useState('');
  const [cnhCategory, setCnhCategory] = useState('');
  const [vehicleType, setVehicleType] = useState<TipoVeiculo>('carro');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status: DriverStatus = user?.driverStatus ?? 'none';

  async function handleApply() {
    setError(null);
    setLoading(true);
    try {
      const { status: newStatus } = await driverService.applyToBeDriver({
        cnhNumber: cnhNumber.trim(),
        cnhCategory: cnhCategory.trim(),
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        vehicleYear: vehicleYear.trim(),
      });
      updateDriverStatus(newStatus);
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível enviar seu cadastro.');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'pending') {
    return (
      <View>
        <Header title="Motorista" onBack={onBack} />
        <StatusCard
          icon={<HistoryIcon size={36} color={colors.warning} strokeWidth={1.6} />}
          title="Cadastro em análise"
          description="Recebemos seus dados. Assim que forem aprovados, sua conta vira motorista do GO."
        />
      </View>
    );
  }

  if (status === 'approved') {
    return <DriverVehiclePanel onBack={onBack} onClose={onClose} />;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Header title="Motorista" onBack={onBack} />
      <Text style={styles.sectionHint}>
        Quer dirigir no GO? Preencha os dados abaixo pra virar motorista usando a sua conta de
        cliente.
      </Text>

      {status === 'rejected' && (
        <Text style={styles.errorText}>
          Seu último cadastro não foi aprovado. Confira os dados e envie novamente.
        </Text>
      )}

      <Input label="Número da CNH" value={cnhNumber} onChangeText={setCnhNumber} placeholder="00000000000" keyboardType="number-pad" />
      <Input label="Categoria da CNH" value={cnhCategory} onChangeText={setCnhCategory} placeholder="Ex: B" autoCapitalize="characters" />

      <Text style={styles.fieldLabel}>Tipo de veículo</Text>
      <View style={styles.vehicleTypeRow}>
        <Pressable
          onPress={() => setVehicleType('carro')}
          style={[styles.vehicleTypeButton, vehicleType === 'carro' && styles.vehicleTypeButtonAtivo]}
        >
          <View style={styles.vehicleTypeConteudo}>
            <CarIcon
              size={18}
              color={vehicleType === 'carro' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.vehicleTypeTexto, vehicleType === 'carro' && styles.vehicleTypeTextoAtivo]}>
              Carro
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setVehicleType('moto')}
          style={[styles.vehicleTypeButton, vehicleType === 'moto' && styles.vehicleTypeButtonAtivo]}
        >
          <View style={styles.vehicleTypeConteudo}>
            <MotoIcon
              size={18}
              color={vehicleType === 'moto' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.vehicleTypeTexto, vehicleType === 'moto' && styles.vehicleTypeTextoAtivo]}>
              Moto
            </Text>
          </View>
        </Pressable>
      </View>

      <Input label="Placa do veículo" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="ABC1D23" autoCapitalize="characters" />
      <Input label="Modelo do veículo" value={vehicleModel} onChangeText={setVehicleModel} placeholder="Ex: Onix 2020" />
      <Input label="Cor do veículo" value={vehicleColor} onChangeText={setVehicleColor} placeholder="Ex: Prata" />
      <Input label="Ano do veículo" value={vehicleYear} onChangeText={setVehicleYear} placeholder="Ex: 2020" keyboardType="number-pad" />

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Button label="Enviar cadastro" onPress={handleApply} loading={loading} style={styles.actionButton} />
    </ScrollView>
  );
}

// ---------- Painel do motorista aprovado (dados do veículo) ----------

function DriverVehiclePanel({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const [cnhNumber, setCnhNumber] = useState('');
  const [cnhCategory, setCnhCategory] = useState('');
  const [vehicleType, setVehicleType] = useState<TipoVeiculo>('carro');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const perfil = await driverService.fetchMyDriverProfile();
        if (!ativo) return;
        setCnhNumber(perfil.cnhNumber ?? '');
        setCnhCategory(perfil.cnhCategory ?? '');
        setVehicleType(perfil.vehicleType ?? 'carro');
        setVehiclePlate(perfil.vehiclePlate ?? '');
        setVehicleModel(perfil.vehicleModel ?? '');
        setVehicleColor(perfil.vehicleColor ?? '');
        setVehicleYear(perfil.vehicleYear ?? '');
      } catch (err: any) {
        if (ativo) setErroCarregar(err?.message ?? 'Não foi possível carregar seus dados.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function handleSalvar() {
    setErroSalvar(null);
    setSalvo(false);
    setSalvando(true);
    try {
      await driverService.updateVehicle({
        cnhNumber: cnhNumber.trim(),
        cnhCategory: cnhCategory.trim(),
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        vehicleYear: vehicleYear.trim(),
      });
      setSalvo(true);
    } catch (err: any) {
      setErroSalvar(err?.message ?? 'Não foi possível salvar os dados.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Header title="Motorista" onBack={onBack} />

      <StatusCard
        icon={<CarIcon size={36} color={colors.primary} strokeWidth={1.5} />}
        title="Você já é motorista GO"
        description="Confira ou atualize os dados do seu veículo abaixo sempre que precisar."
      />

      <Button
        label="Entrar no modo motorista"
        onPress={() => {
          onBack();
          onClose();
          navigation.navigate('DriverHome');
        }}
        style={styles.actionButton}
      />

      <View style={styles.divider} />

      <Text style={styles.fieldLabel}>Dados do veículo e da CNH</Text>

      {carregando ? (
        <ActivityIndicator color={colors.primary} style={styles.painelCarregando} />
      ) : erroCarregar ? (
        <Text style={styles.errorText}>{erroCarregar}</Text>
      ) : (
        <>
          <Input label="Número da CNH" value={cnhNumber} onChangeText={setCnhNumber} placeholder="00000000000" keyboardType="number-pad" />
          <Input label="Categoria da CNH" value={cnhCategory} onChangeText={setCnhCategory} placeholder="Ex: B" autoCapitalize="characters" />

          <Text style={styles.fieldLabel}>Tipo de veículo</Text>
          <View style={styles.vehicleTypeRow}>
            <Pressable
              onPress={() => setVehicleType('carro')}
              style={[styles.vehicleTypeButton, vehicleType === 'carro' && styles.vehicleTypeButtonAtivo]}
            >
              <View style={styles.vehicleTypeConteudo}>
                <CarIcon
                  size={18}
                  color={vehicleType === 'carro' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.vehicleTypeTexto, vehicleType === 'carro' && styles.vehicleTypeTextoAtivo]}>
                  Carro
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setVehicleType('moto')}
              style={[styles.vehicleTypeButton, vehicleType === 'moto' && styles.vehicleTypeButtonAtivo]}
            >
              <View style={styles.vehicleTypeConteudo}>
                <MotoIcon
                  size={18}
                  color={vehicleType === 'moto' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.vehicleTypeTexto, vehicleType === 'moto' && styles.vehicleTypeTextoAtivo]}>
                  Moto
                </Text>
              </View>
            </Pressable>
          </View>

          <Input label="Placa do veículo" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="ABC1D23" autoCapitalize="characters" />
          <Input label="Modelo do veículo" value={vehicleModel} onChangeText={setVehicleModel} placeholder="Ex: Onix 2020" />
          <Input label="Cor do veículo" value={vehicleColor} onChangeText={setVehicleColor} placeholder="Ex: Prata" />
          <Input label="Ano do veículo" value={vehicleYear} onChangeText={setVehicleYear} placeholder="Ex: 2020" keyboardType="number-pad" />

          {!!erroSalvar && <Text style={styles.errorText}>{erroSalvar}</Text>}
          {salvo && !erroSalvar && <Text style={styles.savedText}>Dados do veículo atualizados ✓</Text>}

          <Button label="Salvar dados do veículo" onPress={handleSalvar} loading={salvando} style={styles.actionButton} />
        </>
      )}
    </ScrollView>
  );
}

// ---------- Mensagens (histórico pós-corrida) ----------
//
// Lista as corridas já encerradas que tiveram motorista, pra o passageiro
// poder reabrir a conversa e mandar um recado mesmo depois que a viagem já
// acabou — ex: esqueceu algo no carro. Ao tocar num item, abre o mesmo
// ChatModal usado durante a corrida, só que carregando o histórico daquela
// corrida específica e enviando por REST (funciona mesmo com a corrida já
// finalizada, diferente do chat em tempo real).
function MessagesView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<HistoricoCorridaItem[]>([]);

  const [conversaAberta, setConversaAberta] = useState<HistoricoCorridaItem | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [carregandoConversa, setCarregandoConversa] = useState(false);

  const corridaAbertaIdRef = useRef<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [historico] = await Promise.all([
          rideService.listarHistoricoCorridas(),
          // garante o socket conectado pra receber resposta do motorista em
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
  }, []);

  // Escuta mensagem nova enquanto uma conversa está aberta, pra resposta do
  // motorista aparecer na hora sem precisar reabrir a tela.
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

  async function abrirConversa(item: HistoricoCorridaItem) {
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

  return (
    <View style={styles.messagesWrap}>
      <Header title="Mensagens" onBack={onBack} />
      <Text style={styles.sectionHint}>
        Precisou falar com o motorista depois da corrida? Toque numa viagem abaixo pra mandar
        uma mensagem — por exemplo, se esqueceu algo no veículo.
      </Text>

      {carregando ? (
        <ActivityIndicator color={colors.primary} style={styles.painelCarregando} />
      ) : erro ? (
        <Text style={styles.errorText}>{erro}</Text>
      ) : itens.length === 0 ? (
        <View style={styles.messagesVazio}>
          <HistoryIcon size={32} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.messagesVazioTexto}>
            Suas corridas encerradas com motorista aparecem aqui pra você poder falar com eles
            depois.
          </Text>
        </View>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(item) => item.corrida.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesLista}
          renderItem={({ item }) => (
            <RideHistoryRow item={item} onPress={() => abrirConversa(item)} />
          )}
        />
      )}

      {!!conversaAberta && (
        <ChatModal
          visible={!!conversaAberta}
          outroNome={conversaAberta.motorista.nome}
          meuId={user?.id ?? ''}
          mensagens={mensagens}
          carregandoHistorico={carregandoConversa}
          onEnviar={enviarMensagem}
          onFechar={() => setConversaAberta(null)}
        />
      )}
    </View>
  );
}

function RideHistoryRow({ item, onPress }: { item: HistoricoCorridaItem; onPress: () => void }) {
  const cancelada = item.corrida.status === 'cancelada';
  return (
    <Pressable
      style={({ pressed }) => [styles.rideRow, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={styles.rideRowIcone}>
        <UserIcon size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.menuItemTextWrap}>
        <Text style={styles.menuItemLabel}>{item.motorista.nome}</Text>
        <Text style={styles.menuItemSublabel} numberOfLines={1}>
          {formatarDataCorrida(item.corrida.criadoEm)}
          {item.corrida.destino.endereco ? ` · ${item.corrida.destino.endereco}` : ''}
        </Text>
      </View>
      {cancelada && (
        <View style={styles.rideRowBadge}>
          <Text style={styles.rideRowBadgeTexto}>Cancelada</Text>
        </View>
      )}
      <ChevronRightIcon />
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

// ---------- Peças compartilhadas ----------

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}>
        <ChevronLeftIcon size={22} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function StatusCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusIconWrap}>{icon}</View>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  menuTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  menuItemPressed: {
    opacity: 0.6,
  },
  menuIconWrap: {
    width: 36,
    height: 22,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  menuItemTextWrap: {
    flex: 1,
  },
  menuItemLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  menuItemLabelDanger: {
    color: colors.danger,
  },
  menuItemSublabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
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
  fieldLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  vehicleTypeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  vehicleTypeButtonAtivo: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '1A',
  },
  vehicleTypeConteudo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleTypeTexto: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  vehicleTypeTextoAtivo: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  savedText: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  actionButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  painelCarregando: {
    marginVertical: spacing.xl,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statusIconWrap: {
    marginBottom: spacing.sm,
  },
  statusTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  statusDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  messagesWrap: {
    minHeight: 320,
  },
  messagesLista: {
    paddingBottom: spacing.md,
  },
  messagesVazio: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  messagesVazioTexto: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rideRowIcone: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rideRowBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.sm,
  },
  rideRowBadgeTexto: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
});