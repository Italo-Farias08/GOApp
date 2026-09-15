import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { API_BASE_URL, getToken } from './api';

// Nome da tarefa de rastreamento em segundo plano do motorista. Precisa ser
// único no app: é esse nome que liga o registro (startLocationUpdatesAsync)
// ao callback definido logo abaixo, e o TaskManager consegue disparar esse
// callback mesmo com o app minimizado ou a tela travada — coisa que o
// watchPositionAsync usado em useDriverLocationWatcher NÃO faz sozinho,
// porque ele depende da árvore de componentes React continuar "viva" e o JS
// em primeiro plano, o que o sistema operacional pausa assim que o app sai
// de foreground.
export const TAREFA_LOCALIZACAO_SEGUNDO_PLANO = 'go-app-localizacao-motorista';

// Id da corrida ativa no momento, se houver. Não dá pra vir de useState:
// esse callback pode rodar com o app suspenso, sem nenhuma tela React
// montada — por isso guardamos numa variável de módulo simples, mantida em
// dia pelo DriverHomeScreen (ver definirCorridaAtivaParaSegundoPlano)
// sempre que a corrida ativa muda.
let corridaIdAtual: string | null = null;

export function definirCorridaAtivaParaSegundoPlano(corridaId: string | null) {
  corridaIdAtual = corridaId;
}

type LocationTaskData = { locations?: Location.LocationObject[] };

TaskManager.defineTask<LocationTaskData>(
  TAREFA_LOCALIZACAO_SEGUNDO_PLANO,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error) {
      console.error('[localizacao-segundo-plano] erro do TaskManager:', error);
      return;
    }

    const ultimaPosicao = data?.locations?.[data.locations.length - 1];
    if (!ultimaPosicao) return;

    try {
      const token = await getToken();
      if (!token) return; // deslogado — nada pra reportar

      // Chamada HTTP direta com fetch (não via socketService): o processo
      // pode ter sido apenas acordado pelo sistema pra rodar esse callback,
      // sem garantia nenhuma de que a conexão de socket em tempo real (que
      // vive presa ao componente React) esteja de pé nesse momento. Um POST
      // simples e autocontido é o jeito confiável de continuar atualizando o
      // servidor mesmo nesse cenário.
      await fetch(`${API_BASE_URL}/driver/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: ultimaPosicao.coords.latitude,
          longitude: ultimaPosicao.coords.longitude,
          corridaId: corridaIdAtual,
        }),
      });
    } catch (erroEnvio) {
      // Sem sinal, backend fora do ar etc. Não tem pra quem mostrar erro
      // daqui (não há tela montada) — só deixa passar, a próxima leitura
      // periódica tenta de novo.
      console.error('[localizacao-segundo-plano] falha ao enviar localização:', erroEnvio);
    }
  }
);

// Pede a permissão "Permitir sempre" (Always / Allow all the time) e liga o
// rastreamento em segundo plano. Sem ACCESS_BACKGROUND_LOCATION concedida
// (Android) ou "Always" (iOS), o sistema para de entregar posições assim
// que o app sai de primeiro plano — exatamente o comportamento que fazia o
// motorista sumir do rastreamento ao vivo do passageiro e, depois de um
// tempo com o socket caindo, sumir também do radar de corridas novas.
export async function iniciarRastreamentoSegundoPlano(): Promise<boolean> {
  const permissaoAtual = await Location.getForegroundPermissionsAsync();
  if (permissaoAtual.status !== 'granted') return false;

  const permissaoSegundoPlano = await Location.requestBackgroundPermissionsAsync();
  if (permissaoSegundoPlano.status !== 'granted') return false;

  const jaRegistrada = await TaskManager.isTaskRegisteredAsync(TAREFA_LOCALIZACAO_SEGUNDO_PLANO);
  if (jaRegistrada) return true;

  await Location.startLocationUpdatesAsync(TAREFA_LOCALIZACAO_SEGUNDO_PLANO, {
    accuracy: Location.Accuracy.High,
    timeInterval: 15000,
    distanceInterval: 30,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: '#GO — localização ativa',
      notificationBody:
        'Compartilhando sua localização enquanto você está disponível ou em corrida.',
      notificationColor: '#001566',
    },
  });

  return true;
}

export async function pararRastreamentoSegundoPlano() {
  const jaRegistrada = await TaskManager.isTaskRegisteredAsync(TAREFA_LOCALIZACAO_SEGUNDO_PLANO);
  if (jaRegistrada) {
    await Location.stopLocationUpdatesAsync(TAREFA_LOCALIZACAO_SEGUNDO_PLANO);
  }
  corridaIdAtual = null;
}