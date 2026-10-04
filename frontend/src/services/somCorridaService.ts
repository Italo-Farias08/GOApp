import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState, Vibration } from 'react-native';

const DURACAO_MAXIMA_MS = 30000;

// Vibração em loop (Android/iOS): 0 = espera, depois vibra/pausa alternando.
const PADRAO_VIBRACAO = [0, 500, 400, 500, 1000];

let player: AudioPlayer | null = null;
let modoConfigurado = false;
let timeoutParada: ReturnType<typeof setTimeout> | null = null;
let tocando = false;

async function prepararAudio() {
  if (!modoConfigurado) {
    modoConfigurado = true;
    try {
      await setAudioModeAsync({
        // Toca mesmo com o celular no modo silencioso — o motorista
        // precisa ouvir a corrida, é a ferramenta de trabalho dele.
        playsInSilentMode: true,
        // Baixa o volume da música/Waze em vez de pausar de vez.
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: true,
      });
    } catch (erro) {
      modoConfigurado = false;
      console.warn('[som-corrida] não foi possível configurar o áudio:', erro);
    }
  }

  if (!player) {
    player = createAudioPlayer(require('../../assets/sounds/corrida_nova.wav'));
    player.loop = true;
    player.volume = 1;
  }
  return player;
}

export async function iniciarSomCorrida() {
  if (tocando) return;
  // Com o app em segundo plano / tela bloqueada, quem avisa é o push (que
  // já traz o mesmo som). Tocar aqui também faria os dois sons se
  // sobreporem, como um eco.
  if (AppState.currentState !== 'active') return;
  tocando = true;

  try {
    const p = await prepararAudio();
    // Se já mandaram parar enquanto o áudio preparava, não toca.
    if (!tocando) return;
    await p.seekTo(0);
    p.play();
    Vibration.vibrate(PADRAO_VIBRACAO, true);

    if (timeoutParada) clearTimeout(timeoutParada);
    timeoutParada = setTimeout(pararSomCorrida, DURACAO_MAXIMA_MS);
  } catch (erro) {
    // Som é um "extra": nunca pode atrapalhar o recebimento da corrida.
    console.warn('[som-corrida] não foi possível tocar:', erro);
  }
}

export function pararSomCorrida() {
  tocando = false;
  if (timeoutParada) {
    clearTimeout(timeoutParada);
    timeoutParada = null;
  }
  Vibration.cancel();
  try {
    player?.pause();
  } catch {
    // player já liberado — nada a fazer.
  }
}