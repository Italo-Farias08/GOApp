import React, { useEffect, useRef, useState } from 'react';
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
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import type { Socket } from 'socket.io-client';
import Button from '../components/Button';
import CancelRideModal from '../components/CancelRideModal';
import ChatModal from '../components/ChatModal';
import MapPin from '../components/MapPin';
import PromoBanners, { Banner } from '../components/PromoBanners';
import RideOptionsModal from '../components/RideOptionsModal';
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
import { useAddressSearch, EnderecoSugerido } from '../hooks/useAddressSearch';
import { useRota } from '../hooks/useRota';
import * as rideService from '../services/rideService';
import { conectarSoquete } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/theme';
import type { Corrida, MensagemChat, MotoristaInfo } from '../types';
import { STADIA_TILE_URL } from '../utils/mapaConfig';
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
  const { user } = useAuth();
  const { coords, isLoading, errorMessage } = useCurrentLocation();
  const [destination, setDestination] = useState('');
  const [destinoSelecionado, setDestinoSelecionado] = useState<EnderecoSugerido | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [opcoesVisiveis, setOpcoesVisiveis] = useState(false);
  const [estimativas, setEstimativas] = useState<EstimativaCorrida[]>([]);
  const [corridaConfirmada, setCorridaConfirmada] = useState<EstimativaCorrida | null>(null);
  const [inputFocado, setInputFocado] = useState(false);

  // --- Corrida real (backend + tempo real) ---
  const [corridaId, setCorridaId] = useState<string | null>(null);
  const [motoristaAtribuido, setMotoristaAtribuido] = useState<MotoristaInfo | null>(null);
  const [localizacaoMotorista, setLocalizacaoMotorista] = useState<{ latitude: number; longitude: number } | null>(null);
  // true depois que o motorista confirma que pegou o passageiro — troca o
  // texto/estado da tela de "a caminho" pra "indo ao destino".
  const [embarcado, setEmbarcado] = useState(false);
  const [cancelandoCorrida, setCancelandoCorrida] = useState(false);
  const [cancelamentoVisivel, setCancelamentoVisivel] = useState(false);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);
  const [toastTom, setToastTom] = useState<StatusToastTone>('info');
  const corridaIdRef = useRef<string | null>(null);

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

  // --- Entrada suave da tela (topo, FAB e cartão aparecem com fade+slide
  // em vez de "estalar" na tela assim que o componente monta). ---
  const entradaAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entradaAnim, {
      toValue: 1,
      duration: 420,
      delay: 80,
      useNativeDriver: false, // 'bottom' do FAB não roda no driver nativo
    }).start();
  }, []);

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

  const { sugestoes, buscando, erro: erroBusca } = useAddressSearch(
    destinoSelecionado ? '' : destination,
    coords
  );

  const { rota, carregando: calculandoRota, erro: erroRota, calcularRota, limparRota } = useRota();

  useEffect(() => {
    if (sugestoes.length > 0 || corridaConfirmada) {
      irParaDegrau(true);
    }
  }, [sugestoes.length, corridaConfirmada]);

  // Conecta ao socket e escuta o ciclo de vida da corrida (aceita, localização
  // do motorista ao vivo, finalizada, cancelada).
  useEffect(() => {
    let ativo = true;
    let soquete: Socket | null = null;

    (async () => {
      soquete = await conectarSoquete();
      soqueteRef.current = soquete;

      // Mensagem nova do chat — só aceita se for da corrida atual. Se o chat
      // estiver fechado no momento, conta como "não lida" pra dar sinal
      // visual no botão de conversar.
      soquete.on('corrida:mensagem', (mensagem: MensagemChat) => {
        if (!ativo || mensagem.corridaId !== corridaIdRef.current) return;
        setMensagensChat((atual) => [...atual, mensagem]);
        setChatVisivel((visivelAtual) => {
          if (!visivelAtual && mensagem.remetenteId !== userIdRef.current) {
            setMensagensNaoLidas((n) => n + 1);
          }
          return visivelAtual;
        });
      });

      soquete.on('corrida:aceita', ({ corridaId: id, motorista }: { corridaId: string; motorista: MotoristaInfo }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        setMotoristaAtribuido(motorista);
        avisar(`${motorista.nome.split(' ')[0]} aceitou sua corrida e já está a caminho!`, 'success');
      });

      soquete.on('corrida:localizacao_motorista', ({ corridaId: id, latitude, longitude }: { corridaId: string; latitude: number; longitude: number }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        setLocalizacaoMotorista({ latitude, longitude });
      });

      // Motorista confirmou que pegou o passageiro — a partir daqui a
      // corrida está "em_andamento", indo pro destino final.
      soquete.on('corrida:embarque', ({ corridaId: id }: { corridaId: string }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        setEmbarcado(true);
        avisar('Motorista confirmou o embarque. A caminho do seu destino!', 'success');
      });

      // Motorista cancelou depois de aceitar, mas a corrida ainda tem chance
      // com outro motorista — não reseta a tela, só volta pro estado "procurando".
      soquete.on('corrida:motorista_cancelou', ({ corridaId: id }: { corridaId: string }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        setMotoristaAtribuido(null);
        setLocalizacaoMotorista(null);
        avisar('Seu motorista precisou cancelar. Procurando outro motorista para você...', 'warning');
      });

      soquete.on('corrida:finalizada', ({ corridaId: id }: { corridaId: string }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        avisar('Corrida finalizada. Obrigado por viajar com o #GO!', 'success');
        resetarCorrida();
      });

      soquete.on('corrida:cancelada', ({ corridaId: id, canceladoPor, motivo }: { corridaId: string; canceladoPor?: string; motivo?: string }) => {
        if (!ativo || id !== corridaIdRef.current) return;
        if (canceladoPor === 'sistema') {
          avisar(motivo || 'Não encontramos um motorista disponível. Tente novamente.', 'danger');
        } else if (canceladoPor === 'motorista') {
          avisar('O motorista cancelou a corrida.', 'warning');
        } else {
          avisar('Corrida cancelada.', 'info');
        }
        resetarCorrida();
      });
    })();

    return () => {
      ativo = false;
      soquete?.off('corrida:mensagem');
      soquete?.off('corrida:aceita');
      soquete?.off('corrida:localizacao_motorista');
      soquete?.off('corrida:embarque');
      soquete?.off('corrida:motorista_cancelou');
      soquete?.off('corrida:finalizada');
      soquete?.off('corrida:cancelada');
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
          if (coords) calcularRota(coords, destino);
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
    setLocalizacaoMotorista(null);
    setEmbarcado(false);
    limparRota();
    setDestinoSelecionado(null);
    setDestination('');
    setChatVisivel(false);
    setMensagensChat([]);
    setMensagensNaoLidas(0);
  }

  // Regra: só faz sentido oferecer "cancelar" enquanto existe uma corrida
  // em aberto (procurando ou já aceita) — depois disso o botão nem aparece.
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
      // segue liberando a tela mesmo se a chamada falhar
      avisar('Corrida cancelada.', 'info');
    } finally {
      resetarCorrida();
      setCancelandoCorrida(false);
      setCancelamentoVisivel(false);
    }
  }

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : FALLBACK_REGION;

  function medirConteudo(evento: LayoutChangeEvent) {
    const novaAltura = evento.nativeEvent.layout.height;
    setAlturaConteudo((atual) => (Math.abs(atual - novaAltura) <= 1 ? atual : novaAltura));
  }

  async function selecionarSugestao(item: EnderecoSugerido) {
    setDestinoSelecionado(item);
    setDestination(item.descricao);
    setCorridaConfirmada(null);
    Keyboard.dismiss();

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
    setEstimativas(gerarEstimativas(rota.distanciaKm, rota.duracaoMin));
    setOpcoesVisiveis(true);
  }

  async function confirmarVeiculo(tipo: TipoVeiculo) {
    const escolhida = estimativas.find((estimativa) => estimativa.tipo === tipo);
    setOpcoesVisiveis(false);
    if (!escolhida || !destinoSelecionado || !coords) return;

    setCorridaConfirmada(escolhida);
    setMotoristaAtribuido(null);
    setLocalizacaoMotorista(null);
    setEmbarcado(false);

    try {
      const corrida = await rideService.criarCorrida({
        origem: { latitude: coords.latitude, longitude: coords.longitude },
        destino: {
          latitude: destinoSelecionado.latitude,
          longitude: destinoSelecionado.longitude,
          endereco: destinoSelecionado.descricao,
        },
        tipoVeiculo: tipo,
        preco: escolhida.preco,
        distanciaKm: escolhida.distanciaKm,
        duracaoMin: escolhida.duracaoMin,
      });
      setCorridaId(corrida.id);
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

  const destinoPronto = !!destinoSelecionado && !!rota;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        region={coords && !destinoSelecionado ? region : undefined}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <UrlTile urlTemplate={STADIA_TILE_URL} maximumZ={20} flipY={false} />

        {coords && (
          <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }} title="Você está aqui">
            <MapPin variant="origem" />
          </Marker>
        )}
        {destinoSelecionado && (
          <Marker
            coordinate={destinoSelecionado}
            anchor={{ x: 0.5, y: 0.85 }}
            title="Destino"
            description={destinoSelecionado.descricao}
          >
            <MapPin variant="destino" />
          </Marker>
        )}
        {rota && (
          <Polyline
            coordinates={rota.coordenadas}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}
        {localizacaoMotorista && (
          <Marker coordinate={localizacaoMotorista} anchor={{ x: 0.5, y: 0.5 }} title="Motorista a caminho">
            <View style={styles.marcadorMotorista}>
              {corridaConfirmada?.tipo === 'moto' ? (
                <MotoIcon size={16} color={colors.background} />
              ) : (
                <CarIcon size={16} color={colors.background} />
              )}
            </View>
          </Marker>
        )}
      </MapView>

      <View pointerEvents="none" style={styles.mapBrightener} />

      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© Stadia Maps © OpenMapTiles © OpenStreetMap</Text>
      </View>

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
          onPress={() => setSettingsVisible(true)}
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
              opacity: entradaAnim,
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

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            height: alturaAnimada,
            opacity: entradaAnim,
            transform: [{ translateY: Animated.add(panY, keyboardOffset) }],
          },
        ]}
      >
        <View onLayout={medirConteudo}>
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
              {!corridaConfirmada && (
                <View style={[styles.destinationRow, inputFocado && styles.destinationRowFocado]}>
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
                </View>
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
                    <CheckIcon size={11} color={colors.background} />
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
                  <ChatIcon size={18} color={colors.background} />
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
              <View style={styles.sugestoesLista}>
                {sugestoes.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.sugestaoItem,
                      pressed && styles.sugestaoItemPressed,
                    ]}
                    onPress={() => selecionarSugestao(item)}
                  >
                    <PinIcon size={16} color={colors.textMuted} />
                    <Text style={styles.sugestaoTexto} numberOfLines={2}>
                      {item.descricao}
                    </Text>
                  </Pressable>
                ))}
              </View>
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

      <ChatModal
        visible={chatVisivel}
        outroNome={motoristaAtribuido?.nome ?? 'Motorista'}
        meuId={user?.id ?? ''}
        mensagens={mensagensChat}
        carregandoHistorico={carregandoHistoricoChat}
        onEnviar={enviarMensagemChat}
        onFechar={() => setChatVisivel(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  mapBrightener: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 25, 63, 0.25)',
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attributionText: {
    fontSize: 10,
    color: '#fff',
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
    color: colors.background,
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
  },
  destinationRowFocado: {
    borderColor: colors.primary,
    borderWidth: 1.5,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  motoristaAvatarLetra: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.background,
  },
  motoristaAvatarFoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    color: colors.background,
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
    color: colors.background,
  },
  marcadorMotorista: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  sugestoesLista: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sugestaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sugestaoItemPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  sugestaoTexto: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  promoSecao: {
    marginBottom: spacing.md,
  },
  promoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    // O carrossel embaixo agora não tem padding nenhum (vai de ponta a
    // ponta na tela) — então é o rótulo que precisa desse respiro lateral
    // pra ficar alinhado com o resto do conteúdo da folha.
    paddingHorizontal: spacing.lg,
  },
  confirmButtonWrapper: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});