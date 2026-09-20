import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedRoute from '../components/AnimatedRoute';
import type { Socket } from 'socket.io-client';
import Button from '../components/Button';
import CancelRideModal from '../components/CancelRideModal';
import ChatModal from '../components/ChatModal';
import CompleteProfileModal from '../components/CompleteProfileModal';
import MapPin from '../components/MapPin';
import UserDirectionIndicator, {
  type UserDirectionIndicatorHandle,
} from '../components/UserDirectionIndicator';
import PixPaymentModal from '../components/PixPaymentModal';
import PromoBanners, { Banner } from '../components/PromoBanners';
import RideOptionsModal from '../components/RideOptionsModal';
import SemMotoristasModal from '../components/SemMotoristasModal';
import SettingsModal from '../components/SettingsModal';
import StatusToast, { StatusToastTone } from '../components/StatusToast';
import {
  AlertIcon,
  CarIcon,
  ChatIcon,
  CheckIcon,
  CloseIcon,
  LocationIcon,
  MotoIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
} from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useAddressSearch, EnderecoSugerido, SugestaoEndereco } from '../hooks/useAddressSearch';
import { useRota } from '../hooks/useRota';
import * as addressService from '../services/addressService';
import * as paymentService from '../services/paymentService';
import * as rideService from '../services/rideService';
import { conectarSoquete } from '../services/socketService';
import { radius, spacing, typography } from '../theme/theme';
import type { ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import type { Corrida, FormaPagamento, MensagemChat, MotoristaInfo, PagamentoPix } from '../types';
import { LIGHT_MAP_STYLE, DARK_MAP_STYLE } from '../utils/mapaConfig';
import {
  EstimativaCorrida,
  TipoVeiculo,
  formatarDistancia,
  formatarDuracao,
  formatarMoeda,
  gerarEstimativas,
} from '../utils/precoCorrida';

// Imagens dos veículos — troque estes arquivos por fotos reais
// mantendo o mesmo nome/caminho (frontend/assets/images/carro.png e moto.png).
const IMAGEM_VEICULO: Record<TipoVeiculo, ReturnType<typeof require>> = {
  carro: require('../../assets/images/carro.png'),
  moto: require('../../assets/images/moto.png'),
};

// Banners promocionais do topo da Home — troque as imagens em
// assets/images/banners/ e edite title/subtitulo/onPress à vontade.
// Pra adicionar mais um, é só copiar um objeto e trocar o id/imagem.
const BANNERS: Banner[] = [
  {
    id: 'banner-1',
    imagem: require('../../assets/images/banners/banner1.png'),
  },
  {
    id: 'banner-2',
    imagem: require('../../assets/images/banners/banner2.png'),
  },
  {
    id: 'banner-3',
    imagem: require('../../assets/images/banners/banner3.png'),
  },
];

const FALLBACK_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Altura da tela — usada pra calcular os limites do cartão de baixo.
const ALTURA_TELA = Dimensions.get('window').height;

// O cartão se AJUSTA AO PRÓPRIO CONTEÚDO — nada de altura fixa deixando
// espaço vazio sobrando. Estes dois valores são só os limites de segurança:
// o cartão nunca fica menor que o mínimo nem maior que o máximo.
const SHEET_ALTURA_MINIMA = 230;
const SHEET_ALTURA_MAXIMA = ALTURA_TELA * 0.75;

// Teto da área rolável (erros/rota/confirmação/sugestões) — acima disso ela
// passa a rolar internamente em vez de empurrar o cartão pra cima. Maior que
// antes pra caber o card do motorista (foto do veículo + dados) sem cortar
// nada nem precisar rolar pra ver o resto.
const ALTURA_MAXIMA_CONTEUDO_ROLAVEL = 380;

// Degrau recolhido "de reserva", usado só até medirmos a altura real do
// grupo handle + input na primeira renderização — ver onLayout abaixo.
const SHEET_ALTURA_RECOLHIDA_PADRAO = 110;

// Saudação de acordo com o horário — pequeno detalhe que faz a tela parecer
// viva em vez de estática.
function obterSaudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia,';
  if (hora < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

// Motivos pré-definidos pro passageiro escolher ao cancelar — mantém o
// motivo curto, consistente e fácil de analisar depois (nada de campo de
// texto livre que ninguém preenche direito).
const MOTIVOS_CANCELAMENTO_PASSAGEIRO = [
  'Pedi por engano',
  'O motorista está demorando muito',
  'Preciso mudar o endereço',
  'Mudei de ideia',
  'Outro motivo',
];

export default function HomeScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user, precisaCompletarCadastro, updateAccount } = useAuth();
  const [perfilModalVisivel, setPerfilModalVisivel] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const { coords, heading, isLoading, errorMessage } = useCurrentLocation();
  const [destination, setDestination] = useState('');
  const [destinoSelecionado, setDestinoSelecionado] = useState<EnderecoSugerido | null>(null);
  // Posição em PIXEL (x,y) na tela onde a sua coordenada real cai
  // atualmente no mapa. Antes o farol ficava fixo no centro da tela, o que
  // só batia com sua localização enquanto o mapa estava perfeitamente
  // centralizado nela — desalinhava assim que você dava zoom (o pinça
  // geralmente centraliza no ponto onde os dedos tocaram, não no centro da
  // tela) ou arrastava o mapa. Recalculando esse ponto a cada movimento do
  // mapa via `pointForCoordinate`, o farol acompanha sua posição real na
  // tela em vez de ficar preso ao centro.
  // Posição em pixel do indicador de direção. Antes era `useState` aqui —
  // isso significava re-renderizar a Home inteira (dezenas de states, bottom
  // sheet, chat, listas...) a cada frame do loop de rastreamento no Android.
  // Agora é uma ref imperativa pro <UserDirectionIndicator>, que atualiza a
  // posição via Animated sem passar pelo React. Ver esse componente e
  // `atualizarPontoTelaUsuario` abaixo.
  const indicadorDirecaoRef = useRef<UserDirectionIndicatorHandle>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [opcoesVisiveis, setOpcoesVisiveis] = useState(false);
  const [estimativas, setEstimativas] = useState<EstimativaCorrida[]>([]);
  const [corridaConfirmada, setCorridaConfirmada] = useState<EstimativaCorrida | null>(null);
  const [inputFocado, setInputFocado] = useState(false);
  const buscaFocoAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(buscaFocoAnim, {
      toValue: inputFocado ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, 
    }).start();
  }, [inputFocado]);

  // --- Corrida real (backend + tempo real) ---
  const [corridaId, setCorridaId] = useState<string | null>(null);
  const [motoristaAtribuido, setMotoristaAtribuido] = useState<MotoristaInfo | null>(null);
  // Aviso de "nenhum motorista desse tipo disponível agora" — mostrado logo
  // após pedir a corrida (ou via socket, no caso do Pix pré-pago, que só
  // nasce depois do pagamento confirmado). A busca continua normalmente
  // mesmo com o modal aberto; ele só informa o passageiro.
  const [semMotoristasVisivel, setSemMotoristasVisivel] = useState(false);
  const [localizacaoMotorista, setLocalizacaoMotorista] = useState<{ latitude: number; longitude: number } | null>(null);
  // --- Marcador do motorista "em movimento" no mapa ---
  // Referência ao Marker do motorista — usada pra deslizar ele suavemente
  // de um ponto ao outro (animateMarkerToCoordinate) em vez de simplesmente
  // trocar a coordenada e o marcador "pular" de posição a cada atualização
  // do socket.
  const marcadorMotoristaRef = useRef<React.ElementRef<typeof Marker>>(null);
  // Coordenada usada na prop `coordinate` do Marker — fica FIXA na primeira
  // posição recebida. As atualizações seguintes só mexem no marcador via
  // ref (imperativamente), nunca trocando essa prop — se ela mudasse a
  // cada atualização, o React reaplicaria a posição de forma seca (sem
  // animação), atropelando o deslize suave.
  const [coordenadaInicialMotorista, setCoordenadaInicialMotorista] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const posicaoAnteriorMotoristaRef = useRef<{ latitude: number; longitude: number } | null>(null);
  // Ângulo (graus, 0 = norte) pra onde a imagem do veículo deve apontar —
  // calculado a partir do deslocamento real entre duas posições.
  const [rumoMotorista, setRumoMotorista] = useState(0);
  // true depois que o motorista confirma que pegou o passageiro — troca o
  // texto/estado da tela de "a caminho" pra "indo ao destino".
  const [embarcado, setEmbarcado] = useState(false);
  const [cancelandoCorrida, setCancelandoCorrida] = useState(false);
  const [cancelamentoVisivel, setCancelamentoVisivel] = useState(false);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);
  const [toastTom, setToastTom] = useState<StatusToastTone>('info');
  const corridaIdRef = useRef<string | null>(null);

  // --- Pix pré-pago: cobrança gerada e sendo aguardada (o app faz polling
  // de status enquanto o modal com o QR code está aberto) ---
  const [pixModalVisivel, setPixModalVisivel] = useState(false);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pagamentoPix, setPagamentoPix] = useState<PagamentoPix | null>(null);
  const pollingPixRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pararPollingPix() {
    if (pollingPixRef.current) {
      clearInterval(pollingPixRef.current);
      pollingPixRef.current = null;
    }
  }

  // Garante que o polling para se a tela desmontar com o modal ainda aberto.
  useEffect(() => () => pararPollingPix(), []);

  useEffect(() => {
    corridaIdRef.current = corridaId;
  }, [corridaId]);

  const userIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  // --- Chat com o motorista (substitui o antigo botão "Ligar") ---
  const [chatVisivel, setChatVisivel] = useState(false);
  const [mensagensChat, setMensagensChat] = useState<MensagemChat[]>([]);
  const [carregandoHistoricoChat, setCarregandoHistoricoChat] = useState(false);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState(0);
  const soqueteRef = useRef<Socket | null>(null);

  // Busca o histórico assim que sabe qual é a corrida (seja pedido novo
  // aceito, seja retomando uma corrida que já estava em andamento) — sem
  // isso o chat abriria vazio de novo a cada reabertura do app.
  useEffect(() => {
    if (!corridaId) {
      setMensagensChat([]);
      setMensagensNaoLidas(0);
      return;
    }
    let ativo = true;
    setCarregandoHistoricoChat(true);
    rideService
      .listarMensagens(corridaId)
      .then((mensagens) => {
        if (ativo) setMensagensChat(mensagens);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregandoHistoricoChat(false);
      });
    return () => {
      ativo = false;
    };
  }, [corridaId]);

  function abrirChat() {
    setMensagensNaoLidas(0);
    setChatVisivel(true);
  }

  function enviarMensagemChat(texto: string) {
    if (!corridaId) return;
    soqueteRef.current?.emit('chat:mensagem', { corridaId, texto });
  }

  const avisoContadorRef = useRef(0);
  function avisar(mensagem: string, tom: StatusToastTone = 'info') {
    avisoContadorRef.current += 1;
    setToastTom(tom);
    // Um caractere invisível no fim garante que o toast reanima mesmo se a
    // mensagem for idêntica à anterior (ex: dois avisos "Corrida cancelada"
    // seguidos).
    setToastMensagem(mensagem + '\u200B'.repeat(avisoContadorRef.current % 2));
  }

  // --- Animação de "motorista a caminho": o cartão nasce com um pequeno
  // pulo (scale) em vez de simplesmente aparecer, pra ficar óbvio que algo
  // mudou de estado. ---
  const motoristaAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (motoristaAtribuido) {
      motoristaAnim.setValue(0);
      Animated.spring(motoristaAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 60,
      }).start();
    }
  }, [motoristaAtribuido]);

  // --- Animação de "procurando motorista": anel pulsando ao redor do ícone
  // do veículo, tipo radar, pra deixar claro que o app está trabalhando. ---
  const radarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (corridaConfirmada && !motoristaAtribuido) {
      radarAnim.setValue(0);
      const loop = Animated.loop(
        Animated.timing(radarAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [corridaConfirmada, motoristaAtribuido]);

  // --- Entrada suave da tela (topo, FAB e cartão aparecem em cascata —
  // topo primeiro, cartão de baixo alguns instantes depois — em vez de
  // "estalar" tudo ao mesmo tempo assim que o componente monta). ---
  const entradaAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entradaAnim, {
      toValue: 1,
      duration: 620,
      delay: 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // 'bottom' do FAB não roda no driver nativo
    }).start();
  }, []);
  // Segunda onda da cascata (FAB de recentralizar + cartão de baixo): só
  // começa a aparecer depois que o topo já entrou quase todo.
  const entradaAnimAtrasada = entradaAnim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0, 1],
  });

  // --- Cartão de baixo arrastável (bottom sheet com 2 degraus) ---
  const [alturaRecolhida, setAlturaRecolhida] = useState(SHEET_ALTURA_RECOLHIDA_PADRAO);

  // Altura "natural" do conteúdo, medida ao vivo pelo onLayout do cartão —
  // é isso que evita espaço vazio sobrando: o cartão só cresce até onde o
  // conteúdo realmente precisa.
  const [alturaConteudo, setAlturaConteudo] = useState(SHEET_ALTURA_MINIMA);
  const alturaExpandida = Math.min(
    Math.max(alturaConteudo, SHEET_ALTURA_MINIMA),
    SHEET_ALTURA_MAXIMA
  );

  const [expandido, setExpandido] = useState(false);
  const panY = useRef(
    new Animated.Value(alturaExpandida - SHEET_ALTURA_RECOLHIDA_PADRAO)
  ).current;
  const alturaOcultavelRef = useRef(alturaExpandida - SHEET_ALTURA_RECOLHIDA_PADRAO);
  const valorAtualRef = useRef(alturaExpandida - SHEET_ALTURA_RECOLHIDA_PADRAO);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);
  // Ref não é mais usado (a rotação hoje é 100% via overlay em HTML/CSS,
  // não mais via Marker nativo) — mantido aqui comentado só pra explicar
  // por que não tem mais nenhum <Marker> de "Você está aqui" no return()
  // abaixo: era ele que causava a "bolinha verde duplicada", desalinhada
  // do cone novo.

  // Altura do cartão como Animated.Value — antes essa transição rodava por
  // LayoutAnimation (motor de animação separado do Animated.spring que já
  // move o cartão ao arrastar). Os dois rodando juntos, com curvas e
  // durações diferentes, é o que fazia o cartão parecer "travado"/dessincronizado
  // sempre que o conteúdo mudava de altura (ex: lista de sugestões
  // aparecendo/mudando de tamanho a cada letra digitada). Unificando tudo
  // num Animated.Value só, o movimento fica sempre consistente.
  const alturaAnimada = useRef(new Animated.Value(alturaExpandida)).current;
  const alturaAnteriorRef = useRef(alturaExpandida);
  useEffect(() => {
    if (alturaAnteriorRef.current === alturaExpandida) return;
    alturaAnteriorRef.current = alturaExpandida;
    Animated.timing(alturaAnimada, {
      toValue: alturaExpandida,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [alturaExpandida]);

  useEffect(() => {
    const alturaOcultavel = alturaExpandida - alturaRecolhida;
    alturaOcultavelRef.current = alturaOcultavel;
    if (!expandido) {
      valorAtualRef.current = alturaOcultavel;
      panY.setValue(alturaOcultavel);
    }
  }, [alturaRecolhida, alturaExpandida]);

  function irParaDegrau(paraExpandido: boolean) {
    const destino = paraExpandido ? 0 : alturaOcultavelRef.current;
    setExpandido(paraExpandido);
    valorAtualRef.current = destino;
    Animated.spring(panY, {
      toValue: destino,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evento, gesto) => Math.abs(gesto.dy) > 4,
      onPanResponderGrant: () => {
        panY.stopAnimation((valorAtual) => {
          valorAtualRef.current = valorAtual;
        });
      },
      onPanResponderMove: (_evento, gesto) => {
        const alturaOcultavel = alturaOcultavelRef.current;
        const novoValor = Math.min(
          alturaOcultavel,
          Math.max(0, valorAtualRef.current + gesto.dy)
        );
        panY.setValue(novoValor);
      },
      onPanResponderRelease: (_evento, gesto) => {
        const alturaOcultavel = alturaOcultavelRef.current;
        const posicaoFinal = Math.min(
          alturaOcultavel,
          Math.max(0, valorAtualRef.current + gesto.dy)
        );
        const deveExpandir =
          gesto.vy < -0.4 || (gesto.vy <= 0.4 && posicaoFinal < alturaOcultavel / 2);
        irParaDegrau(deveExpandir);
      },
    })
  ).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (evento) => {
      irParaDegrau(true);
      Animated.timing(keyboardOffset, {
        toValue: -evento.endCoordinates.height,
        duration: Platform.OS === 'ios' ? evento.duration ?? 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (evento) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? evento?.duration ?? 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const { sugestoes, buscando, resolvendo: resolvendoDestino, erro: erroBusca, resolverDestino } = useAddressSearch(
    destinoSelecionado ? '' : destination,
    coords
  );

  const { rota, carregando: calculandoRota, erro: erroRota, calcularRota, limparRota, distanciaAteRota } = useRota();

  useEffect(() => {
    if (sugestoes.length > 0 || corridaConfirmada) {
      irParaDegrau(true);
    }
  }, [sugestoes.length, corridaConfirmada]);

  // --- Entrada animada da lista de sugestões de endereço: some/aparece com
  // um leve "subir + crescer" pra dar mais vida quando os resultados chegam,
  // em vez de simplesmente aparecer travado na tela. ---
  const sugestoesAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (sugestoes.length > 0) {
      sugestoesAnim.setValue(0);
      Animated.spring(sugestoesAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [sugestoes.length > 0]);

  // Conecta ao socket e escuta o ciclo de vida da corrida (aceita, localização
  // do motorista ao vivo, finalizada, cancelada).
  useEffect(() => {
    let ativo = true;

    // IMPORTANTE: soquete é uma conexão singleton reaproveitada (ver
    // socketService.ts) e MAIS DE UM componente pode escutar o mesmo evento
    // ao mesmo tempo (ex: esta tela escuta "corrida:mensagem" pro chat da
    // corrida ativa, e a tela de "Mensagens" pós-corrida escuta o mesmo
    // evento pra conversa antiga aberta). Por isso cada handler é uma
    // referência nomeada e o cleanup usa `.off(evento, handler)` — remove
    // só ESTE listener. Um `.off(evento)` sem a referência removeria TODOS
    // os listeners desse evento, inclusive os de outros componentes — e
    // registrar de novo sem tirar o antigo empilha um segundo listener,
    // fazendo o mesmo evento disparar duas vezes (mensagem duplicada,
    // "motorista aceitou" avisado 2x, etc).

    // Mensagem nova do chat — só aceita se for da corrida atual. Se o chat
    // estiver fechado no momento, conta como "não lida" pra dar sinal
    // visual no botão de conversar. Mensagens de corridas já encerradas não
    // passam por aqui — quem cuida delas é o listener da tela de
    // "Mensagens" pós-corrida.
    function aoReceberMensagem(mensagem: MensagemChat) {
      if (!ativo || mensagem.corridaId !== corridaIdRef.current) return;
      setMensagensChat((atual) => {
        if (atual.some((item) => item.id === mensagem.id)) return atual;
        return [...atual, mensagem];
      });
      setChatVisivel((visivelAtual) => {
        if (!visivelAtual && mensagem.remetenteId !== userIdRef.current) {
          setMensagensNaoLidas((n) => n + 1);
        }
        return visivelAtual;
      });
    }

    function aoAceitar({ corridaId: id, motorista }: { corridaId: string; motorista: MotoristaInfo }) {
      if (!ativo || id !== corridaIdRef.current) return;
      setMotoristaAtribuido(motorista);
      setSemMotoristasVisivel(false);
      avisar(`${motorista.nome.split(' ')[0]} aceitou sua corrida e já está a caminho!`, 'success');
    }

    // Cobre o fluxo de Pix pré-pago: a corrida só nasce depois do pagamento
    // confirmado, então a resposta que o app recebe do polling de status
    // não carrega o campo `semMotoristasDisponiveis` (só o corridaId) — o
    // backend avisa por aqui em vez disso, pro passageiro ver o mesmo aviso
    // independente da forma de pagamento escolhida.
    function aoSemMotoristas({ corridaId: id }: { corridaId: string; tipoVeiculo: string }) {
      if (!ativo || id !== corridaIdRef.current) return;
      setSemMotoristasVisivel(true);
    }

    function aoAtualizarLocalizacao({ corridaId: id, latitude, longitude }: { corridaId: string; latitude: number; longitude: number }) {
      if (!ativo || id !== corridaIdRef.current) return;
      setLocalizacaoMotorista({ latitude, longitude });
    }

    // Motorista confirmou que pegou o passageiro — a partir daqui a
    // corrida está "em_andamento", indo pro destino final.
    function aoEmbarcar({ corridaId: id }: { corridaId: string }) {
      if (!ativo || id !== corridaIdRef.current) return;
      setEmbarcado(true);
      avisar('Motorista confirmou o embarque. A caminho do seu destino!', 'success');
    }

    // Motorista cancelou depois de aceitar, mas a corrida ainda tem chance
    // com outro motorista — não reseta a tela, só volta pro estado "procurando".
    function aoMotoristaCancelar({ corridaId: id }: { corridaId: string }) {
      if (!ativo || id !== corridaIdRef.current) return;
      setMotoristaAtribuido(null);
      setLocalizacaoMotorista(null);
      limparRota();
      avisar('Seu motorista precisou cancelar. Procurando outro motorista para você...', 'warning');
    }

    function aoFinalizar({ corridaId: id }: { corridaId: string }) {
      if (!ativo || id !== corridaIdRef.current) return;
      avisar('Corrida finalizada. Obrigado por viajar com o #GO!', 'success');
      resetarCorrida();
    }

    function aoCancelar({ corridaId: id, canceladoPor, motivo }: { corridaId: string; canceladoPor?: string; motivo?: string }) {
      if (!ativo || id !== corridaIdRef.current) return;
      if (canceladoPor === 'sistema') {
        avisar(motivo || 'Não encontramos um motorista disponível. Tente novamente.', 'danger');
      } else if (canceladoPor === 'motorista') {
        avisar('O motorista cancelou a corrida.', 'warning');
      } else {
        avisar('Corrida cancelada.', 'info');
      }
      resetarCorrida();
    }

    let soquete: Socket | null = null;
    (async () => {
      soquete = await conectarSoquete();
      soqueteRef.current = soquete;
      if (!ativo) return; // desmontou enquanto conectava — não registra nada

      soquete.on('corrida:mensagem', aoReceberMensagem);
      soquete.on('corrida:aceita', aoAceitar);
      soquete.on('corrida:sem_motoristas', aoSemMotoristas);
      soquete.on('corrida:localizacao_motorista', aoAtualizarLocalizacao);
      soquete.on('corrida:embarque', aoEmbarcar);
      soquete.on('corrida:motorista_cancelou', aoMotoristaCancelar);
      soquete.on('corrida:finalizada', aoFinalizar);
      soquete.on('corrida:cancelada', aoCancelar);
    })();

    return () => {
      ativo = false;
      soquete?.off('corrida:mensagem', aoReceberMensagem);
      soquete?.off('corrida:aceita', aoAceitar);
      soquete?.off('corrida:sem_motoristas', aoSemMotoristas);
      soquete?.off('corrida:localizacao_motorista', aoAtualizarLocalizacao);
      soquete?.off('corrida:embarque', aoEmbarcar);
      soquete?.off('corrida:motorista_cancelou', aoMotoristaCancelar);
      soquete?.off('corrida:finalizada', aoFinalizar);
      soquete?.off('corrida:cancelada', aoCancelar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tira uma mensagem legível de um erro de chamada à API (usa a mensagem
  // que o backend manda em `message`, com um texto genérico de fallback pra
  // quando o erro é de rede/timeout e não chegou a ter resposta).
  function extrairMensagemErro(erro: unknown, fallback: string): string {
    const resposta = (erro as { response?: { data?: { message?: string } } })?.response;
    return resposta?.data?.message || fallback;
  }

  // Ao abrir a Home, verifica se o passageiro já tem uma corrida em aberto
  // (procurando, aceita ou em andamento) — por exemplo se o app fechou ou
  // caiu a conexão no meio de uma corrida. Em vez de deixar a tela "zerada"
  // (o que faz qualquer novo pedido falhar com 409 "corrida em andamento"
  // sem explicação nenhuma), RETOMA o estado exatamente de onde parou.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const ativa = await rideService.buscarCorridaAtiva();
        if (!ativo || !ativa) return;

        const { corrida, motorista } = ativa;
        setCorridaId(corrida.id);
        setCorridaConfirmada({
          tipo: corrida.tipoVeiculo,
          preco: corrida.preco,
          distanciaKm: corrida.distanciaKm,
          duracaoMin: corrida.duracaoMin,
          multiplicadorHorario: 1,
          labelHorario: null,
        });
        setEmbarcado(corrida.status === 'em_andamento');
        if (motorista) setMotoristaAtribuido(motorista);

        if (corrida.destino) {
          const destino: EnderecoSugerido = {
            id: corrida.id,
            descricao: corrida.destino.endereco || 'Destino',
            latitude: corrida.destino.latitude,
            longitude: corrida.destino.longitude,
          };
          setDestinoSelecionado(destino);
          setDestination(destino.descricao);
          // Só traça direto coords->destino aqui se a corrida já estiver em
          // andamento (embarque já confirmado) — aí sim a rota certa é até
          // o destino final. Enquanto ainda está "aceita" (motorista a
          // caminho do passageiro), a rota motorista->passageiro é
          // calculada pelo efeito abaixo assim que a localização dele
          // chegar pelo socket.
          if (coords && corrida.status === 'em_andamento') calcularRota(coords, destino);
        }
      } catch {
        // Sem corrida ativa (ou falha ao consultar) — segue normal, tela em branco.
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetarCorrida() {
    setCorridaId(null);
    setCorridaConfirmada(null);
    setMotoristaAtribuido(null);
    setSemMotoristasVisivel(false);
    setLocalizacaoMotorista(null);
    setCoordenadaInicialMotorista(null);
    posicaoAnteriorMotoristaRef.current = null;
    setRumoMotorista(0);
    setEmbarcado(false);
    limparRota();
    setDestinoSelecionado(null);
    setDestination('');
    setChatVisivel(false);
    setMensagensChat([]);
    setMensagensNaoLidas(0);
  }

  // Ângulo (0-360°, 0 = norte) do ponto A até o ponto B — usado pra virar a
  // imagem do carro/moto na direção real do deslocamento no mapa.
  function calcularRumo(
    origem: { latitude: number; longitude: number },
    destino: { latitude: number; longitude: number }
  ): number {
    const lat1 = (origem.latitude * Math.PI) / 180;
    const lat2 = (destino.latitude * Math.PI) / 180;
    const deltaLon = ((destino.longitude - origem.longitude) * Math.PI) / 180;
    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    const rumoGraus = (Math.atan2(y, x) * 180) / Math.PI;
    return (rumoGraus + 360) % 360;
  }

  // Toda vez que chega uma localização nova do motorista: na primeira vez
  // só define a posição inicial do marcador; das próximas em diante, gira a
  // imagem na direção do movimento e desliza o marcador suavemente até o
  // novo ponto (em vez de reposicionar seco).
  useEffect(() => {
    if (!localizacaoMotorista) return;

    if (!coordenadaInicialMotorista) {
      setCoordenadaInicialMotorista(localizacaoMotorista);
      posicaoAnteriorMotoristaRef.current = localizacaoMotorista;
      return;
    }

    const anterior = posicaoAnteriorMotoristaRef.current;
    if (anterior) {
      // Só recalcula o rumo se o motorista realmente andou uma distância
      // mínima — em pé parado, pequenas variações de GPS fariam a imagem
      // "tremer" girando pra qualquer lado à toa.
      const andouODeSuficiente =
        Math.abs(anterior.latitude - localizacaoMotorista.latitude) > 0.00003 ||
        Math.abs(anterior.longitude - localizacaoMotorista.longitude) > 0.00003;
      if (andouODeSuficiente) {
        setRumoMotorista(calcularRumo(anterior, localizacaoMotorista));
      }
    }
    posicaoAnteriorMotoristaRef.current = localizacaoMotorista;
    marcadorMotoristaRef.current?.animateMarkerToCoordinate(localizacaoMotorista, 900);
  }, [localizacaoMotorista]);

  // Calcula a rota até o próximo ponto: enquanto o motorista ainda não
  // confirmou o embarque, mostra o caminho DELE até o passageiro; depois do
  // embarque, troca pra rota até o destino final — espelha exatamente o que
  // a tela do motorista já faz (ver DriverHomeScreen). Recalcula sempre que
  // a etapa muda (corrida aceita, embarque confirmado) ou na primeira vez
  // que a localização do motorista chega pelo socket.
  useEffect(() => {
    if (!motoristaAtribuido || !localizacaoMotorista) return;
    const alvo = embarcado ? destinoSelecionado : coords;
    if (!alvo) return;

    calcularRota(localizacaoMotorista, alvo).then((resultado) => {
      if (resultado) {
        mapRef.current?.fitToCoordinates(
          [localizacaoMotorista, alvo],
          { edgePadding: { top: 100, right: 60, bottom: 320, left: 60 }, animated: true }
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!motoristaAtribuido, embarcado, corridaId, !!localizacaoMotorista]);

  // --- Recálculo automático da rota do motorista por desvio --------------
  // Mesmo mecanismo do lado do motorista: se ele saiu do trajeto calculado
  // (entrou na rua errada, perdeu uma conversão etc.), recalcula a partir de
  // onde ele está agora em vez de deixar o traçado "preso" no caminho antigo.
  const DISTANCIA_DESVIO_ROTA_MOTORISTA_METROS = 60;
  const INTERVALO_MINIMO_RECALCULO_MOTORISTA_MS = 15000;
  const ultimoRecalculoMotoristaRef = useRef(0);
  const recalculandoMotoristaRef = useRef(false);
  useEffect(() => {
    if (!motoristaAtribuido || !localizacaoMotorista) return;
    const alvo = embarcado ? destinoSelecionado : coords;
    if (!alvo) return;

    const desvioMetros = distanciaAteRota(localizacaoMotorista);
    if (desvioMetros == null || desvioMetros <= DISTANCIA_DESVIO_ROTA_MOTORISTA_METROS) return;
    if (recalculandoMotoristaRef.current) return;

    const agora = Date.now();
    if (agora - ultimoRecalculoMotoristaRef.current < INTERVALO_MINIMO_RECALCULO_MOTORISTA_MS) return;

    ultimoRecalculoMotoristaRef.current = agora;
    recalculandoMotoristaRef.current = true;
    calcularRota(localizacaoMotorista, alvo).finally(() => {
      recalculandoMotoristaRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localizacaoMotorista?.latitude, localizacaoMotorista?.longitude]);

  function abrirCancelamento() {
    if (!corridaId) return;
    setCancelamentoVisivel(true);
  }

  async function confirmarCancelamento(motivo: string) {
    if (!corridaId) return;
    setCancelandoCorrida(true);
    try {
      await rideService.cancelarCorrida(corridaId, motivo);
      avisar('Corrida cancelada.', 'info');
    } catch {
      
      avisar('Corrida cancelada.', 'info');
    } finally {
      resetarCorrida();
      setCancelandoCorrida(false);
      setCancelamentoVisivel(false);
    }
  }

  // Força a rotação do pin "Você está aqui" via setNativeProps sempre que o
  // heading mudar. Necessário porque, com tracksViewChanges={false}, a
  // simples troca da prop `rotation` no JSX às vezes não é repassada pro
  // marker nativo já renderizado (bug conhecido do react-native-maps) — o
  // setNativeProps chama a atualização direto no componente nativo.
  // Recalcula onde a sua coordenada real cai na tela (em pixel) AGORA,
  // considerando o zoom/posição atual do mapa. Chamado sempre que sua
  // localização muda e a cada movimento do mapa (zoom, arrastar) via
  // onRegionChange no <MapView>.
  async function atualizarPontoTelaUsuario() {
    if (!coords) return;
    try {
      const ponto = await mapRef.current?.pointForCoordinate(coords);
      if (ponto) indicadorDirecaoRef.current?.mover(ponto.x, ponto.y);
    } catch {
      // Mapa ainda não terminou de montar / método indisponível nesse
      // instante — não tem problema, o próximo onRegionChange tenta de novo.
    }
  }

  useEffect(() => {
    atualizarPontoTelaUsuario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.latitude, coords?.longitude]);

  // Reforço só pro Android: mantém um loop CONTÍNUO (não depende de detectar
  // toque) recalculando o ponto na tela via requestAnimationFrame, sempre
  // que a Home está com o mapa centralizado no usuário. Tentamos antes
  // detectar início/fim do toque (onTouchStart/onTouchEnd) pra só rodar o
  // loop durante o gesto, mas o react-native-maps usa a SDK nativa do Google
  // Maps por baixo — o gesto de arrastar/zoom é capturado direto no nível
  // nativo e nem chega no sistema de eventos de toque do React Native, então
  // aquele loop nunca era realmente iniciado. Rodar sempre (em vez de só
  // durante o toque) é mais "bruto" em termos de CPU mas garante que o
  // indicador realmente acompanhe o mapa em tempo real no Android — no iOS
  // isso já acontece sozinho via onRegionChange, então mantemos o loop
  // restrito ao Android.
  const rafIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!coords || destinoSelecionado) {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }
    let ativo = true;
    // Throttle pra ~30fps (a cada 2 frames): a setinha de direção não
    // precisa de 60fps pra parecer fluida, e isso já corta pela metade as
    // chamadas de pointForCoordinate() (ponte nativa) por segundo. O
    // trabalho de renderização em si já não é mais o gargalo (ver
    // UserDirectionIndicator) — isso aqui é só economia extra de CPU/bateria.
    let contador = 0;
    function loop() {
      if (!ativo) return;
      contador += 1;
      if (contador % 2 === 0) atualizarPontoTelaUsuario();
      rafIdRef.current = requestAnimationFrame(loop);
    }
    rafIdRef.current = requestAnimationFrame(loop);
    return () => {
      ativo = false;
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Platform.OS, !!coords, !!destinoSelecionado]);


  const region = useMemo(
    () =>
      coords
        ? {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }
        : FALLBACK_REGION,
    // Só recalcula quando a localização realmente muda — não a cada
    // renderização da tela (digitar no campo de busca, toast aparecendo,
    // mensagem de chat chegando etc. não devem mexer no mapa).
    [coords?.latitude, coords?.longitude]
  );

  function medirConteudo(evento: LayoutChangeEvent) {
    const novaAltura = evento.nativeEvent.layout.height;
    setAlturaConteudo((atual) => (Math.abs(atual - novaAltura) <= 1 ? atual : novaAltura));
  }

  async function selecionarSugestao(sugestao: SugestaoEndereco) {
    Keyboard.dismiss();

    // A sugestão que veio do autocomplete ainda não tem coordenadas — só
    // resolve pra lat/lng (via place_id) agora que o usuário realmente
    // escolheu essa opção.
    const item = await resolverDestino(sugestao);
    if (!item) {
      avisar('Não foi possível obter esse endereço. Tente de novo.' );
      return;
    }

    setDestinoSelecionado(item);
    setDestination(item.descricao);
    setCorridaConfirmada(null);

    mapRef.current?.animateToRegion(
      {
        latitude: item.latitude,
        longitude: item.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );

    if (coords) {
      const resultado = await calcularRota(coords, item);
      if (resultado) {
        mapRef.current?.fitToCoordinates(
          [coords, { latitude: item.latitude, longitude: item.longitude }],
          { edgePadding: { top: 80, right: 60, bottom: 320, left: 60 }, animated: true }
        );
      }
    }
  }

  function limparDestino() {
    setDestination('');
    setDestinoSelecionado(null);
    setCorridaConfirmada(null);
    limparRota();
    Keyboard.dismiss();
  }

  function recentralizarMapa() {
    if (!coords) return;
    mapRef.current?.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      400
    );
  }

  function buscarCorrida() {
    if (!rota) return;
    // Quem entrou com Google chega até aqui sem telefone cadastrado (o
    // Google nunca pede isso) — sem telefone o motorista não tem como
    // contatar o passageiro, então a corrida fica bloqueada até completar
    // o cadastro em vez de deixar abrir as opções de veículo.
    if (precisaCompletarCadastro) {
      setPerfilModalVisivel(true);
      return;
    }
    setEstimativas(gerarEstimativas(rota.distanciaKm, rota.duracaoMin));
    setOpcoesVisiveis(true);
  }

  // Salva os dados que faltavam (nome/email/telefone) e, se deu tudo certo,
  // já segue direto pro fluxo normal de busca de corrida — a pessoa não
  // precisa apertar "Buscar corrida" de novo.
  async function salvarPerfilEContinuar(dados: { name: string; email: string; phone: string }) {
    setSalvandoPerfil(true);
    try {
      await updateAccount(dados);
      setPerfilModalVisivel(false);
      buscarCorrida();
    } catch (erro) {
      avisar(extrairMensagemErro(erro, 'Não foi possível salvar seus dados. Tente novamente.'), 'danger');
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function confirmarVeiculo(tipo: TipoVeiculo, formaPagamento: FormaPagamento) {
    const escolhida = estimativas.find((estimativa) => estimativa.tipo === tipo);
    setOpcoesVisiveis(false);
    if (!escolhida || !destinoSelecionado || !coords) return;

    // Descobre o endereço legível do ponto de embarque (o passageiro nunca
    // digita isso — é sempre a localização atual dele, que só existe como
    // coordenadas de GPS). Sem essa geocodificação reversa, o motorista
    // recebia a corrida sem NENHUM endereço de onde buscar o passageiro, só
    // o pino no mapa. Se a chamada falhar (sem internet, API fora do ar
    // etc.) a corrida segue mesmo assim — só sem o endereço de embarque —
    // pra nunca travar o pedido por causa disso.
    let enderecoEmbarque: string | undefined;
    try {
      const enderecoReverso = await addressService.buscarEnderecoReverso(coords.latitude, coords.longitude);
      enderecoEmbarque = enderecoReverso?.descricao;
    } catch {
      enderecoEmbarque = undefined;
    }

    const dadosCorrida = {
      origem: { latitude: coords.latitude, longitude: coords.longitude, endereco: enderecoEmbarque },
      destino: {
        latitude: destinoSelecionado.latitude,
        longitude: destinoSelecionado.longitude,
        endereco: destinoSelecionado.descricao,
      },
      tipoVeiculo: tipo,
      preco: escolhida.preco,
      distanciaKm: escolhida.distanciaKm,
      duracaoMin: escolhida.duracaoMin,
    };

    // Pix pré-pago não cria a corrida direto — primeiro gera o QR code e só
    // depois que o pagamento é confirmado a corrida nasce de verdade (ver
    // iniciarPagamentoPix / iniciarPollingPix abaixo).
    if (formaPagamento === 'pix_prepago') {
      await iniciarPagamentoPix(escolhida, dadosCorrida);
      return;
    }

    setCorridaConfirmada(escolhida);
    setMotoristaAtribuido(null);
    setLocalizacaoMotorista(null);
    setEmbarcado(false);

    try {
      const corrida = await rideService.criarCorrida({ ...dadosCorrida, formaPagamento });
      setCorridaId(corrida.id);
      // Backend já sabe, no instante da criação, se não tinha nenhum
      // motorista do tipo pedido disponível por perto — mostra o aviso na
      // hora em vez de deixar o passageiro só olhando o anel de
      // "procurando" girar sem explicação.
      if (corrida.semMotoristasDisponiveis) {
        setSemMotoristasVisivel(true);
      }
      // IMPORTANTE: o preço que volta aqui é o preço REAL da corrida — se o
      // passageiro tinha dívida pendente de uma corrida anterior não paga,
      // o backend já somou ela aqui (ver corridaServico.criarEDespachar no
      // back-end). Antes esse retorno era ignorado (só se usava `corrida.id`),
      // então a tela continuava mostrando a estimativa original, sem dívida
      // — o passageiro via um valor, o motorista via outro (maior), sem
      // nenhum aviso do porquê.
      setCorridaConfirmada({
        ...escolhida,
        preco: corrida.preco,
        dividaAplicada: corrida.dividaAplicada,
      });
      if (corrida.dividaAplicada > 0) {
        avisar(
          `Esse valor inclui ${formatarMoeda(corrida.dividaAplicada)} de uma corrida anterior não paga.`,
          'warning'
        );
      }
    } catch (erro) {
      // Antes esse catch resetava a tela em silêncio — dava a impressão de
      // que a corrida tinha sido "cancelada sozinha" quase na hora, quando
      // na real a criação nem chegou a dar certo (ex: já existia uma
      // corrida em aberto, sem internet, backend fora do ar). Agora sempre
      // mostra o motivo real pro passageiro.
      setCorridaConfirmada(null);
      avisar(
        extrairMensagemErro(erro, 'Não foi possível pedir a corrida. Tente novamente.'),
        'danger'
      );
    }
  }

  // Gera a cobrança Pix no Mercado Pago e abre o modal com o QR code. A
  // corrida (`dadosCorrida`) só é criada de verdade depois que o pagamento
  // for confirmado — ver iniciarPollingPix.
  async function iniciarPagamentoPix(
    escolhida: EstimativaCorrida,
    dadosCorrida: Omit<Parameters<typeof rideService.criarCorrida>[0], 'formaPagamento'>
  ) {
    setPixModalVisivel(true);
    setGerandoPix(true);
    setPagamentoPix(null);
    try {
      const pagamento = await paymentService.criarPagamentoPix(dadosCorrida);
      setPagamentoPix(pagamento);
      iniciarPollingPix(pagamento.id, escolhida);
    } catch (erro) {
      setPixModalVisivel(false);
      avisar(extrairMensagemErro(erro, 'Não foi possível gerar o Pix. Tente novamente.'), 'danger');
    } finally {
      setGerandoPix(false);
    }
  }

  // Fica perguntando pro backend se o pagamento já foi aprovado — assim que
  // aprovar, o backend já criou e despachou a corrida sozinho, então só
  // falta a tela "entrar" nesse estado (igual já acontece pra dinheiro/Pix
  // direto).
  function iniciarPollingPix(pagamentoId: string, escolhida: EstimativaCorrida) {
    pararPollingPix();
    pollingPixRef.current = setInterval(async () => {
      try {
        const atualizado = await paymentService.consultarPagamentoPix(pagamentoId);
        setPagamentoPix(atualizado);

        if (atualizado.status === 'aprovado' && atualizado.corridaId) {
          pararPollingPix();
          setPixModalVisivel(false);
          setMotoristaAtribuido(null);
          setLocalizacaoMotorista(null);
          setEmbarcado(false);
          setCorridaId(atualizado.corridaId);
          // Atualiza a ref NA HORA, sem esperar o próximo render — o
          // backend já pode ter emitido 'corrida:sem_motoristas' (ou
          // qualquer outro evento dessa corrida) no exato instante em que
          // criou a corrida, ainda dentro dessa mesma resposta do
          // polling. Se a gente esperasse só o useEffect (que roda depois
          // do render) pra sincronizar a ref, o evento chegava com a ref
          // ainda apontando pra corrida antiga (ou nula) e o listener
          // descartava o aviso — foi isso que fez o passageiro ficar
          // preso no radar "procurando" mesmo sem nenhum motorista
          // disponível, sem nunca ver o aviso.
          corridaIdRef.current = atualizado.corridaId;

          // Igual ao fluxo de dinheiro/Pix direto: busca a corrida de
          // verdade pra pegar o preço REAL (com dívida pendente somada, se
          // houver) em vez de ficar preso na estimativa calculada antes do
          // pagamento. Se essa busca falhar por algum motivo, ainda assim
          // mostra a estimativa — melhor um valor levemente desatualizado
          // do que a tela travada sem nada.
          try {
            const corrida = await rideService.buscarCorrida(atualizado.corridaId);
            setCorridaConfirmada({
              ...escolhida,
              preco: corrida.preco,
              dividaAplicada: corrida.dividaAplicada,
            });
            if (corrida.dividaAplicada > 0) {
              avisar(
                `Esse valor inclui ${formatarMoeda(corrida.dividaAplicada)} de uma corrida anterior não paga.`,
                'warning'
              );
            }
          } catch {
            setCorridaConfirmada(escolhida);
          }
        } else if (atualizado.status === 'recusado' || atualizado.status === 'expirado') {
          pararPollingPix();
        }
      } catch {
        // Falha pontual de rede — a próxima tentativa do intervalo já
        // tenta de novo, não precisa avisar o passageiro por isso.
      }
    }, 3000);
  }

  function fecharPixModal() {
    pararPollingPix();
    setPixModalVisivel(false);
    setPagamentoPix(null);
  }

  const destinoPronto = !!destinoSelecionado && !!rota;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        // O SDK nativo do Google Maps só lê `customMapStyle` na hora em que
        // a view é criada — trocar a prop com o mapa já montado é
        // ignorado silenciosamente (limitação conhecida do
        // react-native-maps no Android). Colocando o tema na `key`, o
        // React desmonta e remonta o MapView inteiro quando o usuário
        // troca de Claro pra Escuro (ou vice-versa), forçando o estilo
        // novo a ser aplicado de verdade.
        key={scheme}
        // Força o Google Maps nas duas plataformas: sem isso, no iOS o
        // MapView usa o Apple Maps (MapKit) por padrão, que simplesmente
        // ignora `customMapStyle` — e como o app tem `userInterfaceStyle:
        // 'dark'` travado em app.config.js, o mapa nativo ficava sempre
        // escuro mesmo com o app no tema claro.
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        region={coords && !destinoSelecionado ? region : undefined}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={scheme === 'claro' ? LIGHT_MAP_STYLE : DARK_MAP_STYLE}
        onMapReady={atualizarPontoTelaUsuario}
        onRegionChange={atualizarPontoTelaUsuario}
        // onRegionChange sozinho é suficiente no iOS (dispara várias vezes
        // por segundo durante o próprio gesto de zoom/arraste). No Android
        // esse mesmo evento é bem mais raro durante o gesto — muitas vezes
        // só perto do fim — e é por isso que o indicador demorava a "se
        // encaixar" depois do zoom. onRegionChangeComplete dispara de forma
        // mais confiável nas duas plataformas ao FIM do gesto, então serve
        // de reforço: garante o reencaixe final mesmo quando o Android não
        // disparou onRegionChange durante o meio do movimento.
        onRegionChangeComplete={atualizarPontoTelaUsuario}
      >
        {destinoSelecionado && (
          <Marker
            coordinate={destinoSelecionado}
            anchor={{ x: 0.5, y: 0.85 }}
            title="Destino"
            description={destinoSelecionado.descricao}
            tracksViewChanges={false}
          >
            <MapPin variant="destino" />
          </Marker>
        )}
        {rota && <AnimatedRoute coordenadas={rota.coordenadas} />}
        {localizacaoMotorista && coordenadaInicialMotorista && (
          <Marker
            ref={marcadorMotoristaRef}
            coordinate={coordenadaInicialMotorista}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Motorista a caminho"
            tracksViewChanges={false}
            flat
            rotation={rumoMotorista}
          >
            <Image
              source={IMAGEM_VEICULO[corridaConfirmada?.tipo ?? 'carro']}
              style={styles.veiculoMarcadorImagem}
              resizeMode="contain"
              fadeDuration={0}
            />
          </Marker>
        )}
      </MapView>

      {/* Indicador de direção sobreposto ao mapa (não é mais um <Marker>).
          O rotation nativo do react-native-maps em Marker com
          tracksViewChanges={false} não estava sendo aplicado de forma
          confiável nesse setup (testado: setNativeProps também não girou).
          Essa View normal do React Native, por outro lado, sempre
          re-renderiza no `transform: rotate()` quando `heading` muda —
          sem cache nenhum de bitmap nativo no meio do caminho. Só faz
          sentido mostrar quando o mapa está de fato centralizado no
          usuário (mesma condição usada no `region` do MapView acima).
          Fica fixo no centro da tela porque é aí que o pin "Você está
          aqui" cai quando o mapa está centralizado nele.
          Exige `heading !== null`: em aparelhos sem sensor de bússola
          (existe, testamos — alguns Android simplesmente não têm
          magnetômetro), o heading nunca chega a atualizar e a setinha
          ficaria "congelada" sempre apontando pro mesmo lugar, parecendo
          bug. Melhor não mostrar setinha nenhuma nesse caso do que mostrar
          uma direção errada/parada — a bolinha de localização sozinha
          (showsUserLocation, nativa) continua aparecendo normalmente. */}
      <UserDirectionIndicator
        ref={indicadorDirecaoRef}
        heading={heading}
        visivel={!!coords && heading !== null && !destinoSelecionado}
        pivoStyle={styles.farolOverlayPivo}
        centralizadorStyle={styles.direcaoOverlayCentralizador}
      />

      <View pointerEvents="none" style={styles.mapBrightener} />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Buscando sua localização...</Text>
          </View>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.errorBanner}>
          <AlertIcon size={16} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.marcaBadge,
          {
            opacity: entradaAnim,
            transform: [
              {
                translateY: entradaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Image source={require('../../assets/logo-mark.png')} style={styles.marcaImagem} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={[
          styles.topBar,
          {
            opacity: entradaAnim,
            transform: [
              {
                translateY: entradaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.perfilPill}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetra}>
              {(user?.name?.trim()?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.saudacaoLabel}>{obterSaudacao()}</Text>
            <Text style={styles.saudacaoNome} numberOfLines={1}>
              {user?.name?.split(' ')[0] ?? 'por aí'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            // O iOS às vezes mantém o campo de texto focado "flutuando" numa
            // camada acima de views abertas depois dele (bug conhecido de
            // TextInput nativo focado) — fechar o teclado antes de abrir o
            // menu evita esse vazamento visual.
            Keyboard.dismiss();
            setSettingsVisible(true);
          }}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressedFeedback]}
          hitSlop={6}
        >
          <SettingsIcon size={18} color={colors.text} />
        </Pressable>
      </Animated.View>

      {!!coords && (
        <Animated.View
          style={[
            styles.fabLocalizacao,
            {
              opacity: entradaAnimAtrasada,
              bottom: Animated.add(
                Animated.subtract(alturaAnimada, Animated.add(panY, keyboardOffset)),
                spacing.md
              ),
            },
          ]}
        >
          <Pressable
            onPress={recentralizarMapa}
            style={({ pressed }) => [styles.fabToque, pressed && styles.pressedFeedback]}
            hitSlop={6}
          >
            <LocationIcon size={20} color={colors.text} />
          </Pressable>
        </Animated.View>
      )}

      <Animated.View
        // Enquanto as configurações estão abertas, esse cartão fica
        // totalmente invisível e "morto" pra toque — assim, seja lá qual
        // for o motivo dele às vezes aparecer por cima de outros modais,
        // ele não tem como vazar: não está nem visível.
        pointerEvents={settingsVisible ? 'none' : 'auto'}
        style={[
          styles.bottomSheet,
          {
            height: alturaAnimada,
            opacity: settingsVisible ? 0 : entradaAnimAtrasada,
            transform: [
              {
                translateY: Animated.add(
                  panY,
                  Animated.add(
                    keyboardOffset,
                    entradaAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] })
                  )
                ),
              },
            ],
          },
        ]}
      >
        <View onLayout={medirConteudo} style={{ paddingBottom: insets.bottom }}>
          <View style={styles.cabecalhoArrastavel}>
            {expandido && (
              <Text style={styles.bottomTitle}>
                {corridaConfirmada ? 'Sua corrida' : 'Para onde vamos?'}
              </Text>
            )}

            <View
              style={styles.grupoBase}
              onLayout={(evento) => setAlturaRecolhida(evento.nativeEvent.layout.height)}
            >
              <View style={styles.handleArea} {...panResponder.panHandlers}>
                <View style={styles.sheetHandle} />
              </View>

              {/* Regra: com a corrida já solicitada (procurando OU aceita),
                  esconde a busca de endereço — o passageiro não pode nem
                  deveria pesquisar/trocar destino ou disparar outra corrida
                  por cima da atual. Só volta a aparecer depois que a corrida
                  atual for cancelada ou finalizada (resetarCorrida). */}
              {!corridaConfirmada && !settingsVisible && (
                <Animated.View
                  style={[
                    styles.destinationRow,
                    {
                      borderColor: buscaFocoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [colors.border, colors.primary],
                      }),
                      borderWidth: buscaFocoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.5],
                      }),
                      shadowOpacity: buscaFocoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.45],
                      }),
                    },
                  ]}
                >
                  <SearchIcon size={18} color={colors.textMuted} />
                  <TextInput
                    style={styles.destinationInput}
                    placeholder="Digite o endereço de destino"
                    placeholderTextColor={colors.textMuted}
                    value={destination}
                    onChangeText={(texto) => {
                      setDestination(texto);
                      if (destinoSelecionado) setDestinoSelecionado(null);
                    }}
                    onFocus={() => {
                      irParaDegrau(true);
                      setInputFocado(true);
                    }}
                    onBlur={() => setInputFocado(false)}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  {buscando && <ActivityIndicator size="small" color={colors.textMuted} />}
                  {!!destination && !buscando && (
                    <Pressable
                      onPress={limparDestino}
                      hitSlop={10}
                      style={({ pressed }) => [styles.clearButton, pressed && styles.pressedFeedback]}
                    >
                      <CloseIcon size={14} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </Animated.View>
              )}
            </View>
          </View>

          {/* Fora do cabecalhoArrastavel de propósito: aquele container tem
              padding lateral (spacing.lg) pro resto do conteúdo, e isso
              cortava o carrossel antes da borda de verdade da tela. Aqui
              fora ele nasce sem nenhum padding herdado — só o rótulo de
              texto abaixo é que ganha o respiro lateral, pra ficar alinhado
              com o resto, o carrossel em si vai de ponta a ponta. */}
          {expandido && !destinoSelecionado && !corridaConfirmada && sugestoes.length === 0 && (
            <View style={styles.promoSecao}>
              <Text style={styles.promoLabel}>Promoções pra você</Text>
              <PromoBanners banners={BANNERS} destaque />
            </View>
          )}

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollConteudo}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={expandido}
            bounces={false}
          >
            {!corridaConfirmada && !!erroBusca && (
              <View style={styles.errorHintRow}>
                <AlertIcon size={14} color={colors.danger} />
                <Text style={styles.errorHint}>{erroBusca}</Text>
              </View>
            )}
            {!corridaConfirmada && !!erroRota && (
              <View style={styles.errorHintRow}>
                <AlertIcon size={14} color={colors.danger} />
                <Text style={styles.errorHint}>{erroRota}</Text>
              </View>
            )}

            {!corridaConfirmada && calculandoRota && (
              <Text style={styles.rotaInfo}>Calculando rota...</Text>
            )}
            {!calculandoRota && rota && !corridaConfirmada && (
              <Text style={styles.rotaInfo}>
                {formatarDistancia(rota.distanciaKm)} · aproximadamente {formatarDuracao(rota.duracaoMin)}
              </Text>
            )}

            {corridaConfirmada && !motoristaAtribuido && (
              <View style={styles.confirmacaoBanner}>
                <View style={styles.confirmacaoIconeBadge}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.radarAnel,
                      {
                        opacity: radarAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 0.15, 0] }),
                        transform: [
                          {
                            scale: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Image
                    source={IMAGEM_VEICULO[corridaConfirmada.tipo]}
                    style={styles.confirmacaoIconeImagem}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                </View>
                <View style={styles.confirmacaoTextos}>
                  <Text style={styles.confirmacaoTexto}>
                    {corridaConfirmada.tipo === 'moto' ? 'Moto solicitada' : 'Carro solicitado'}
                    {' · '}
                    {formatarMoeda(corridaConfirmada.preco)}
                  </Text>
                  {!!corridaConfirmada.dividaAplicada && corridaConfirmada.dividaAplicada > 0 && (
                    <Text style={styles.dividaAvisoTexto}>
                      Inclui {formatarMoeda(corridaConfirmada.dividaAplicada)} de uma corrida anterior não paga
                    </Text>
                  )}
                  <View style={styles.procurandoRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.confirmacaoSubtexto}>
                      Procurando um motorista perto de você...
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={abrirCancelamento}
                  disabled={cancelandoCorrida}
                  hitSlop={8}
                  style={({ pressed }) => [styles.cancelarBuscaBotao, pressed && styles.pressedFeedback]}
                >
                  <CloseIcon size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}

            {motoristaAtribuido && (
              <Animated.View
                style={[
                  styles.motoristaBanner,
                  {
                    opacity: motoristaAnim,
                    transform: [
                      { scale: motoristaAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    ],
                  },
                ]}
              >
                <View style={styles.motoristaAceitaTopo}>
                  <View style={styles.motoristaAceitaBadge}>
                    <CheckIcon size={11} color={colors.onPrimary} />
                  </View>
                  <Text style={styles.motoristaAceitaTexto}>
                    {embarcado
                      ? 'Embarque confirmado · a caminho do destino'
                      : `Corrida aceita · ${corridaConfirmada?.tipo === 'moto' ? 'moto a caminho' : 'carro a caminho'}`}
                  </Text>
                </View>

                {/* Card principal, maior e FLEXÍVEL — cresce com o conteúdo
                    (sem numberOfLines cortando texto) em vez de espremer tudo
                    numa única linha. Mostra a mesma imagem do veículo usada
                    na tela de escolha (carro.png/moto.png). */}
                <View style={styles.motoristaCardPrincipal}>
                  <View style={styles.motoristaVeiculoImagemBox}>
                    <Image
                      source={IMAGEM_VEICULO[motoristaAtribuido.veiculoTipo ?? corridaConfirmada?.tipo ?? 'carro']}
                      style={styles.motoristaVeiculoImagem}
                      resizeMode="contain"
                      fadeDuration={0}
                    />
                  </View>

                  <View style={styles.motoristaInfoPrincipal}>
                    <View style={styles.motoristaLinhaNome}>
                      {motoristaAtribuido.avatarUrl ? (
                        <Image
                          source={{ uri: motoristaAtribuido.avatarUrl }}
                          style={styles.motoristaAvatarFoto}
                        />
                      ) : (
                        <View style={styles.motoristaAvatar}>
                          <Text style={styles.motoristaAvatarLetra}>
                            {motoristaAtribuido.nome.trim()[0]?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.motoristaNome}>{motoristaAtribuido.nome}</Text>
                    </View>

                    {!!(motoristaAtribuido.veiculoModelo || motoristaAtribuido.veiculoCor) && (
                      <View style={styles.motoristaVeiculoRow}>
                        {corridaConfirmada?.tipo === 'moto' ? (
                          <MotoIcon size={14} color={colors.textSecondary} />
                        ) : (
                          <CarIcon size={14} color={colors.textSecondary} />
                        )}
                        <Text style={styles.motoristaVeiculoTexto}>
                          {[motoristaAtribuido.veiculoModelo, motoristaAtribuido.veiculoCor]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                    )}

                    {!!(motoristaAtribuido.veiculoAno || motoristaAtribuido.veiculoPlaca) && (
                      <Text style={styles.motoristaVeiculoSub}>
                        {[motoristaAtribuido.veiculoAno, motoristaAtribuido.veiculoPlaca]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={abrirChat}
                  style={({ pressed }) => [styles.ligarBotaoGrande, pressed && styles.pressedFeedback]}
                >
                  <ChatIcon size={18} color={colors.onPrimary} />
                  <Text style={styles.ligarBotaoTexto}>Conversar com o motorista</Text>
                  {mensagensNaoLidas > 0 && (
                    <View style={styles.chatBadge}>
                      <Text style={styles.chatBadgeTexto}>
                        {mensagensNaoLidas > 9 ? '9+' : mensagensNaoLidas}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            )}

            {!corridaConfirmada && !destinoSelecionado && sugestoes.length > 0 && (
              <Animated.View
                style={[
                  styles.sugestoesLista,
                  {
                    opacity: sugestoesAnim,
                    transform: [
                      {
                        translateY: sugestoesAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [14, 0],
                        }),
                      },
                      {
                        scale: sugestoesAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.97, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {sugestoes.map((item, index) => {
                  // Separa "Rua Tal, 123" (linha principal, em destaque) do
                  // resto do endereço ("Bairro, Cidade - UF", menor e
                  // discreto) — deixa mais fácil bater o olho e achar o
                  // endereço certo rápido.
                  const [linhaPrincipal, ...restoPartes] = item.descricao.split(',');
                  const linhaSecundaria = restoPartes.join(',').trim();

                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.sugestaoItem,
                        index === sugestoes.length - 1 && styles.sugestaoItemUltimo,
                        pressed && styles.sugestaoItemPressed,
                      ]}
                      onPress={() => selecionarSugestao(item)}
                      disabled={resolvendoDestino}
                    >
                      <View style={styles.sugestaoIconeWrap}>
                        <PinIcon size={18} color={colors.primary} />
                      </View>
                      <View style={styles.sugestaoTextos}>
                        <Text style={styles.sugestaoTextoPrincipal} numberOfLines={1}>
                          {linhaPrincipal.trim()}
                        </Text>
                        {!!linhaSecundaria && (
                          <Text style={styles.sugestaoTextoSecundario} numberOfLines={1}>
                            {linhaSecundaria}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}
          </ScrollView>

          {/* Regra de exibição: uma vez que a corrida foi solicitada, o botão
              de busca SOME — no lugar aparece "Cancelar corrida". Sem isso
              dava pra parecer que nada tinha acontecido e a pessoa clicar de
              novo achando que não pediu a corrida. */}
          {corridaConfirmada ? (
            <Button
              label="Cancelar corrida"
              variant="secondary"
              onPress={abrirCancelamento}
              disabled={cancelandoCorrida}
              style={styles.confirmButtonWrapper}
            />
          ) : (
            <Button
              label="Buscar corrida"
              onPress={buscarCorrida}
              loading={calculandoRota}
              disabled={!destinoPronto}
              style={styles.confirmButtonWrapper}
            />
          )}
        </View>
      </Animated.View>

      <StatusToast message={toastMensagem} tone={toastTom} />

      <RideOptionsModal
        visible={opcoesVisiveis}
        destino={destinoSelecionado?.descricao}
        estimativas={estimativas}
        onSelecionar={confirmarVeiculo}
        onClose={() => setOpcoesVisiveis(false)}
      />

      <PixPaymentModal
        visible={pixModalVisivel}
        gerando={gerandoPix}
        pagamento={pagamentoPix}
        onFechar={fecharPixModal}
      />

      <CancelRideModal
        visible={cancelamentoVisivel}
        titulo="Cancelar essa corrida?"
        subtitulo={
          motoristaAtribuido
            ? `${motoristaAtribuido.nome.split(' ')[0]} já está a caminho — cancelar agora pode atrasar a corrida dele(a).`
            : 'Ainda estamos procurando um motorista pra você.'
        }
        motivos={MOTIVOS_CANCELAMENTO_PASSAGEIRO}
        carregando={cancelandoCorrida}
        onConfirmar={confirmarCancelamento}
        onFechar={() => setCancelamentoVisivel(false)}
      />

      <SemMotoristasModal
        visible={semMotoristasVisivel}
        tipoVeiculo={corridaConfirmada?.tipo ?? 'carro'}
        onContinuar={() => setSemMotoristasVisivel(false)}
        onCancelarCorrida={() => {
          setSemMotoristasVisivel(false);
          abrirCancelamento();
        }}
      />

      <CompleteProfileModal
        visible={perfilModalVisivel}
        user={user}
        carregando={salvandoPerfil}
        onSalvar={salvarPerfilEContinuar}
        onFechar={() => setPerfilModalVisivel(false)}
      />

      <ChatModal
        visible={chatVisivel}
        outroNome={motoristaAtribuido?.nome ?? 'Motorista'}
        meuId={user?.id ?? ''}
        mensagens={mensagensChat}
        carregandoHistorico={carregandoHistoricoChat}
        onEnviar={enviarMensagemChat}
        onFechar={() => setChatVisivel(false)}
      />

      {/* Precisa ser o ÚLTIMO item renderizado aqui — ele não usa mais o
          <Modal> nativo do React Native (ver comentário no topo do
          SettingsModal.tsx), então o que garante que ele fique por cima de
          tudo mais (mapa, busca de destino, botão "Buscar corrida", os
          outros modais acima) é só a ordem em que aparece na árvore. */}
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  // Indicador de direção sobreposto (não depende de rotação nativa de
  // Marker — ver comentário no return()). farolOverlayPivo é posicionado
  // no PIXEL exato (calculado via pointForCoordinate) onde sua coordenada
  // real cai na tela — recalculado a cada zoom/arrastar do mapa via
  // onRegionChange, então acompanha sua posição real mesmo fora do centro.
  // O `rotate` vai nesse pivô, e o triângulo (filho, offset fixo pra cima)
  // varre um círculo em volta dele — por isso ele aponta pro lado certo em
  // vez de só girar em torno do próprio centro.
  farolOverlayPivo: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  // O <DirectionIndicator> (60x60) já tem seu próprio ponto central
  // desenhado no centro do SVG — esse marginLeft/Top negativo (metade do
  // tamanho) centraliza isso em cima do pivô (que é 0x0, plantado no pixel
  // exato da sua coordenada real).
  direcaoOverlayCentralizador: {
    marginLeft: -30,
    marginTop: -30,
  },
  mapBrightener: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 25, 63, 0.25)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
  },
  errorBanner: {
    position: 'absolute',
    top: spacing.xxl + spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginLeft: spacing.sm,
    flex: 1,
  },
  marcaBadge: {
    position: 'absolute',
    top: spacing.xxl,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  marcaImagem: {
    width: 58,
    height:58,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  topBar: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  perfilPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: 190,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarLetra: {
    ...typography.bodyBold,
    color: colors.onPrimary,
  },
  saudacaoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  saudacaoNome: {
    ...typography.bodyBold,
    color: colors.text,
    lineHeight: 18,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  pressedFeedback: {
    opacity: 0.65,
  },
  fabLocalizacao: {
    position: 'absolute',
    right: spacing.lg,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  fabToque: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  cabecalhoArrastavel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grupoBase: {
    // nada extra — o espaçamento do topo já vem do handleArea
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  sheetScroll: {
    maxHeight: ALTURA_MAXIMA_CONTEUDO_ROLAVEL,
    paddingHorizontal: spacing.lg,
  },
  sheetScrollConteudo: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  bottomTitle: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  destinationInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  clearButton: {
    padding: spacing.xs,
    borderRadius: radius.full,
  },
  errorHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  errorHint: {
    ...typography.caption,
    color: colors.danger,
    marginLeft: spacing.xs,
    flex: 1,
  },
  rotaInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  confirmacaoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  confirmacaoIconeBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radarAnel: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  confirmacaoIconeImagem: {
    width: 36,
    height: 36,
  },
  confirmacaoTextos: {
    flex: 1,
  },
  confirmacaoTexto: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  procurandoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  confirmacaoSubtexto: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  // Aviso de que o preço mostrado inclui dívida de uma corrida anterior não
  // paga — usa a cor de "warning" (não "danger") porque não é bem um erro,
  // é só uma informação que o passageiro precisa ter pra não estranhar o
  // valor mais alto.
  dividaAvisoTexto: {
    ...typography.caption,
    color: colors.warning,
    marginTop: 2,
  },
  cancelarBuscaBotao: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  motoristaBanner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  motoristaAceitaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  motoristaAceitaBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  motoristaAceitaTexto: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  // Card principal — imagem do veículo (mesma da tela de escolha) + dados do
  // motorista lado a lado. FLEXÍVEL: nada de altura fixa, cresce conforme o
  // conteúdo (nome grande, placa, ano etc.) em vez de cortar texto.
  motoristaCardPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  motoristaVeiculoImagemBox: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  motoristaVeiculoImagem: {
    width: 60,
    height: 60,
  },
  motoristaInfoPrincipal: {
    flex: 1,
    minWidth: 0,
  },
  motoristaLinhaNome: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  motoristaAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  motoristaAvatarLetra: {
    ...typography.bodyBold,
    fontSize: 22,
    color: colors.onPrimary,
  },
  motoristaAvatarFoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  motoristaNome: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.text,
    flexShrink: 1,
  },
  motoristaVeiculoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  motoristaVeiculoTexto: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  motoristaVeiculoSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  ligarBotaoGrande: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ligarBotaoTexto: {
    ...typography.bodyBold,
    color: colors.onPrimary,
    marginLeft: spacing.sm,
  },
  chatBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: spacing.sm,
  },
  chatBadgeTexto: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  // Imagem do veículo (carro.png/moto.png) usada no marcador do motorista
  // em movimento no mapa — mesmo arquivo de imagem usado no card de "Sua
  // corrida" e na tela de escolha de veículo, só que menor. Sem fundo/borda
  // (diferente do antigo círculo colorido) pra parecer o carro de verdade
  // andando sobre o mapa, não um ícone genérico.
  veiculoMarcadorImagem: {
    width: 38,
    height: 38,
  },
  sugestoesLista: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    // Sombra sutil pra a lista "flutuar" sobre o mapa, em vez de parecer
    // só mais uma faixa colada no cartão.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  sugestaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sugestaoItemUltimo: {
    borderBottomWidth: 0,
  },
  sugestaoItemPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  sugestaoIconeWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(57, 255, 106, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sugestaoTextos: {
    flex: 1,
  },
  sugestaoTextoPrincipal: {
    ...typography.bodyBold,
    fontSize: 17,
    color: colors.text,
  },
  sugestaoTextoSecundario: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  promoSecao: {
    marginBottom: spacing.md,
  },
  promoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  confirmButtonWrapper: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
}