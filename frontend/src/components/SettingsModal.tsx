import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import * as driverService from '../services/driverService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { DriverStatus, RootStackParamList, TipoVeiculo } from '../types';
import Button from './Button';
import Input from './Input';

type ModalView = 'menu' | 'account' | 'driver';

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
            onSignOut={handleSignOut}
          />
        )}
        {view === 'account' && <AccountView onBack={() => setView('menu')} />}
        {view === 'driver' && <DriverView onBack={() => setView('menu')} onClose={handleClose} />}
      </View>
    </Modal>
  );
}

// ---------- Menu principal ----------

function MenuView({
  userName,
  onSelectAccount,
  onSelectDriver,
  onSignOut,
}: {
  userName?: string;
  onSelectAccount: () => void;
  onSelectDriver: () => void;
  onSignOut: () => void;
}) {
  return (
    <View>
      <Text style={styles.menuTitle}>Olá, {userName?.split(' ')[0] ?? 'por aí'}</Text>

      <MenuItem icon="👤" label="Conta" sublabel="Dados e credenciais" onPress={onSelectAccount} />
      <MenuItem icon="🚗" label="Motorista" sublabel="Cadastre-se pra dirigir no GO" onPress={onSelectDriver} />

      <View style={styles.divider} />

      <MenuItem icon="🚪" label="Sair" danger onPress={onSignOut} />
    </View>
  );
}

function MenuItem({
  icon,
  label,
  sublabel,
  danger,
  onPress,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={styles.menuItemTextWrap}>
        <Text style={[styles.menuItemLabel, danger && styles.menuItemLabelDanger]}>{label}</Text>
        {!!sublabel && <Text style={styles.menuItemSublabel}>{sublabel}</Text>}
      </View>
      {!danger && <Text style={styles.chevron}>›</Text>}
    </Pressable>
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
        Edite suas credenciais abaixo. Isso ainda não é validado nem enviado a um backend real —
        só deixa tudo pronto pra quando ele existir.
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
          icon="⏳"
          title="Cadastro em análise"
          description="Recebemos seus dados. Assim que forem aprovados, sua conta vira motorista do GO."
        />
      </View>
    );
  }

  if (status === 'approved') {
    return (
      <View>
        <Header title="Motorista" onBack={onBack} />
        <StatusCard
          icon="🎉"
          title="Você já é motorista GO"
          description="Seu cadastro foi aprovado. Toque abaixo pra começar a receber corridas."
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
      </View>
    );
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
          <Text style={[styles.vehicleTypeTexto, vehicleType === 'carro' && styles.vehicleTypeTextoAtivo]}>
            🚗 Carro
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setVehicleType('moto')}
          style={[styles.vehicleTypeButton, vehicleType === 'moto' && styles.vehicleTypeButtonAtivo]}
        >
          <Text style={[styles.vehicleTypeTexto, vehicleType === 'moto' && styles.vehicleTypeTextoAtivo]}>
            🏍️ Moto
          </Text>
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

// ---------- Peças compartilhadas ----------

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}>
        <Text style={styles.backIcon}>‹</Text>
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
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusIcon}>{icon}</Text>
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
  menuIcon: {
    fontSize: 22,
    width: 36,
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
  chevron: {
    color: colors.textMuted,
    fontSize: 20,
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
  backIcon: {
    fontSize: 28,
    color: colors.text,
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
  vehicleTypeTexto: {
    ...typography.body,
    color: colors.textSecondary,
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
  statusCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statusIcon: {
    fontSize: 40,
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
});