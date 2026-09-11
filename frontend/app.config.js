const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

export default {
  expo: {
    name: '#GO',
    slug: 'go-app',
    version: '1.0.0',
    // Ícone real do app — aparece na tela inicial do celular, e também é o
    // que o Android usa pra mostrar o selo colorido nas notificações
    // (diferente do ícone branco de notification.icon, que é só o desenho
    // pequeno da barra de status — regra do próprio Android, sem exceção).
    icon: './assets/icon.png',
    // Usado pelo login com Google (e qualquer outro OAuth) pra saber pra
    // onde voltar depois que o usuário confirma o login no navegador do
    // sistema. Precisa bater com o redirect URI configurado no fluxo do
    // AuthSession — ver src/hooks/useGoogleAuth.ts.
    scheme: 'goapp',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    splash: {
      backgroundColor: '#0B0B0F',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.goapp.mobile',
      config: {
        googleMapsApiKey,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'O #GO usa sua localização pra mostrar onde você está no mapa e encontrar corridas por perto.',
      },
    },
    android: {
      package: 'com.goapp.mobile',
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'],
      // Ícone adaptativo (Android 8+): primeiro plano com só o "G" (sem o
      // fundo navy) + a cor de fundo — é o Android quem monta o ícone final,
      // aplicando a máscara (círculo, "squircle" etc) de cada fabricante.
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#001566',
      },
    },
    // Ícone e cor usados na barra de status/notificação do Android — o
    // Android sempre desenha esse ícone só com branco/transparente (ele
    // ignora qualquer outra cor da imagem, incluindo a logo original), por
    // isso o arquivo é a silhueta do "G" da logo, sem o fundo azul.
    // "color" é a cor do círculo de fundo atrás do ícone.
    notification: {
      icon: './assets/notification-icon.png',
      color: '#001566',
    },
    plugins: [
      'expo-secure-store',
      'expo-status-bar',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#001566',
        },
      ],
      // Login com Google via SDK nativo (ver src/hooks/useGoogleAuth.ts).
      // O Google não permite mais o fluxo antigo de navegador com esquema
      // de URL customizado ("goapp://") pra client IDs do tipo iOS/Android
      // — por isso a troca. iosUrlScheme é o Client ID do iOS "invertido"
      // (com.googleusercontent.apps.<a parte antes de .apps.googleusercontent.com>).
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: 'com.googleusercontent.apps.682727645534-dl62moirr693nuvenelqdce3ofg1siol',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: '72d0ff1f-2015-46ae-91b3-5c06624f49f2',
      },
    },
  },
};