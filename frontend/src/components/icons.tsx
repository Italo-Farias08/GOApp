import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

// Ícone de carro (visão lateral, estilo outline minimalista).
export function CarIcon({ size = 24, color = '#F5F5F7', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 11 L8 6.6 Q8.5 6 9.2 6 H14.8 Q15.5 6 16 6.6 L18 11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.5 11H20.5A1.5 1.5 0 0 1 22 12.5V15A1.5 1.5 0 0 1 20.5 16.5H3.5A1.5 1.5 0 0 1 2 15V12.5A1.5 1.5 0 0 1 3.5 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="7" cy="16.7" r="1.8" fill={color} />
      <Circle cx="17" cy="16.7" r="1.8" fill={color} />
    </Svg>
  );
}

// Ícone de moto (visão lateral, mesma linguagem visual do carro).
export function MotoIcon({ size = 24, color = '#F5F5F7', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="5.5" cy="17" r="2.8" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="18.5" cy="17" r="2.8" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M5.5 17 H9.2 L11.2 12.3 H15.6 L18.5 17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.2 12.3 L9.6 8.2 H12.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="14" cy="14.6" r="1.5" fill={color} />
    </Svg>
  );
}

// Ícone de configurações (sliders horizontais) — substitui o emoji ⚙️.
export function SettingsIcon({ size = 20, color = '#F5F5F7', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="9" cy="7" r="2.1" fill="#0B0B0F" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="4" y1="13" x2="20" y2="13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="15" cy="13" r="2.1" fill="#0B0B0F" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="4" y1="19" x2="20" y2="19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="11" cy="19" r="2.1" fill="#0B0B0F" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

// Ícone de usuário (cabeça + ombros) — usado no item "Conta" do menu de
// configurações, no lugar do emoji 👤.
export function UserIcon({ size = 20, color = '#F5F5F7', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8.2" r="3.6" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M4.5 20 C4.5 15.9 7.8 13.6 12 13.6 C16.2 13.6 19.5 15.9 19.5 20"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Ícone de saída (porta + seta) — usado no item "Sair" do menu de
// configurações, no lugar do emoji 🚪.
export function ExitIcon({ size = 20, color = '#FF4D4D', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.8 4.5 H6.7 A1.5 1.5 0 0 0 5.2 6 V18 A1.5 1.5 0 0 0 6.7 19.5 H10.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="9.8" y1="12" x2="20" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M16.3 8.2 L20.3 12 L16.3 15.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Ícone de relógio/histórico — usado na lista de "Mensagens" pra indicar
// uma corrida já encerrada.
export function HistoryIcon({ size = 16, color = '#9A9AA5', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12.5" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 8.3 V12.5 L15 14.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8.5 3.5 H15.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// Ícone de fechar (X) — substitui o "✕" em texto puro.
export function CloseIcon({ size = 16, color = '#9A9AA5', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// Ícone de check (✓) — usado pra marcar a opção selecionada no modal de corrida.
export function CheckIcon({ size = 14, color = '#0B0B0F', strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12.5 L9.5 18 L20 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Ícone de mira/GPS — usado no botão de recentralizar o mapa.
export function LocationIcon({ size = 20, color = '#F5F5F7', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="12" y1="2" x2="12" y2="5.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="12" y1="18.5" x2="12" y2="22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="2" y1="12" x2="5.5" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="18.5" y1="12" x2="22" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// Ícone de lupa — usado no campo de busca de destino.
export function SearchIcon({ size = 18, color = '#9A9AA5', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="15.3" y1="15.3" x2="21" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// Ícone de alerta (triângulo com exclamação) — usado em banners de erro.
export function AlertIcon({ size = 16, color = '#FF4D4D', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5 L21.5 20 H2.5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Line x1="12" y1="9.5" x2="12" y2="14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="12" cy="17" r="1" fill={color} />
    </Svg>
  );
}

// Ícone de pin pequeno — usado na lista de sugestões de endereço.
export function PinIcon({ size = 16, color = '#9A9AA5', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.5 C12 21.5 5 14.6 5 9.8 A7 7 0 0 1 19 9.8 C19 14.6 12 21.5 12 21.5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="9.8" r="2.4" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

// Ícone de telefone — mantido pra quem ainda usa ligação em algum lugar.
export function PhoneIcon({ size = 18, color = '#0B0B0F', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 3.5 L9.5 3.5 L11 8 L8.7 9.6 C9.6 11.8 11.2 13.4 13.4 14.3 L15 12 L19.5 13.5 L19.5 16.5 C19.5 18.2 18.1 19.6 16.4 19.4 C10.7 18.8 5.7 13.8 5.1 8.1 C4.9 6.4 6.3 3.5 6.5 3.5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Ícone de balão de chat — usado no botão de conversar com o motorista/passageiro.
export function ChatIcon({ size = 18, color = '#0B0B0F', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.5 H20 A1.2 1.2 0 0 1 21.2 6.7 V15.3 A1.2 1.2 0 0 1 20 16.5 H9.5 L5.2 19.8 A0.5 0.5 0 0 1 4.4 19.4 V16.5 H4 A1.2 1.2 0 0 1 2.8 15.3 V6.7 A1.2 1.2 0 0 1 4 5.5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Line x1="7" y1="9.5" x2="17" y2="9.5" stroke={color} strokeWidth={strokeWidth * 0.85} strokeLinecap="round" />
      <Line x1="7" y1="12.6" x2="14" y2="12.6" stroke={color} strokeWidth={strokeWidth * 0.85} strokeLinecap="round" />
    </Svg>
  );
}

// Ícone de seta pra esquerda — usado no botão de voltar (navegação),
// deliberadamente vetorial em vez do glifo "‹" solto.
export function ChevronLeftIcon({ size = 20, color = '#0B0B0F', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5 L9 12 L15 19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Ícone de seta pra direita — usado no "puxador" do botão de arrastar
// (dá a dica visual de "arraste pra cá" antes mesmo de tocar).
export function ArrowRightIcon({ size = 20, color = '#0B0B0F', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="12" x2="18" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M13 6.5 L19 12 L13 17.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
// Ícone de dinheiro (cédula com um círculo no meio) — usado na opção de
// pagamento "Dinheiro".
export function MoneyIcon({ size = 22, color = '#F5F5F7', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 6.5A1.5 1.5 0 0 1 4 5H20A1.5 1.5 0 0 1 21.5 6.5V17.5A1.5 1.5 0 0 1 20 19H4A1.5 1.5 0 0 1 2.5 17.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="5.5" y1="9" x2="5.5" y2="9.01" stroke={color} strokeWidth={strokeWidth * 1.6} strokeLinecap="round" />
      <Line x1="18.5" y1="15" x2="18.5" y2="15.01" stroke={color} strokeWidth={strokeWidth * 1.6} strokeLinecap="round" />
    </Svg>
  );
}

// Ícone de Pix (representação própria, geométrica, do símbolo de troca
// instantânea — dois "cantos" espelhados conectados por linhas, lembrando
// o conceito de transferência sem reproduzir a marca oficial).
export function PixIcon({ size = 22, color = '#F5F5F7', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.6 4.3 L12 6.7 L14.4 4.3 A2.2 2.2 0 0 1 16 3.6 H16.6 A2.2 2.2 0 0 1 18.2 4.3 L19.7 5.8 A2.2 2.2 0 0 1 20.4 7.4 V8 A2.2 2.2 0 0 1 19.7 9.6 L17.3 12 L19.7 14.4 A2.2 2.2 0 0 1 20.4 16 V16.6 A2.2 2.2 0 0 1 19.7 18.2 L18.2 19.7 A2.2 2.2 0 0 1 16.6 20.4 H16 A2.2 2.2 0 0 1 14.4 19.7 L12 17.3 L9.6 19.7 A2.2 2.2 0 0 1 8 20.4 H7.4 A2.2 2.2 0 0 1 5.8 19.7 L4.3 18.2 A2.2 2.2 0 0 1 3.6 16.6 V16 A2.2 2.2 0 0 1 4.3 14.4 L6.7 12 L4.3 9.6 A2.2 2.2 0 0 1 3.6 8 V7.4 A2.2 2.2 0 0 1 4.3 5.8 L5.8 4.3 A2.2 2.2 0 0 1 7.4 3.6 H8 A2.2 2.2 0 0 1 9.6 4.3 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}

// Ícone de QR code (mini grid) — usado no cabeçalho do modal de Pix pré-pago.
export function QrCodeIcon({ size = 20, color = '#F5F5F7', strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 3.5H9.5V9.5H3.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M14.5 3.5H20.5V9.5H14.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M3.5 14.5H9.5V20.5H3.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M14.5 14.5H17V17H14.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M20.5 14.5V17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M14.5 20.5H17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M20.5 20.5H17.5V17.5" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// Ícone de copiar (dois retângulos sobrepostos) — usado no botão "Copiar
// código Pix".
export function CopyIcon({ size = 16, color = '#0B0B0F', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 9H19.5A1 1 0 0 1 20.5 10V19.5A1 1 0 0 1 19.5 20.5H10A1 1 0 0 1 9 19.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path
        d="M6 15H4.5A1 1 0 0 1 3.5 14V4.5A1 1 0 0 1 4.5 3.5H14A1 1 0 0 1 15 4.5V6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Ícone de enviar (avião de papel) — usado no botão de enviar mensagem do chat.
// Ícone de lápis (editar) — usado no card de chave Pix cadastrada.
export function EditIcon({ size = 16, color = '#9A9AA5', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20L4.6 16.6L15.5 5.7C16.1 5.1 17 5.1 17.6 5.7L18.3 6.4C18.9 7 18.9 7.9 18.3 8.5L7.4 19.4L4 20Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M13.8 7.4L16.6 10.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SendIcon({ size = 18, color = '#0B0B0F', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.5 3.5 L3 10.7 C2.5 10.9 2.5 11.6 3.1 11.8 L9.9 14.1 L12.2 20.9 C12.4 21.5 13.1 21.5 13.3 21 L20.5 3.5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Line x1="9.9" y1="14.1" x2="20.5" y2="3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}