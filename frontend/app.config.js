const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

export default {
  expo: {
    name: '#GO',
    slug: 'go-app',
    version: '1.0.0',
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
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    },
    plugins: [
      'expo-secure-store',
      'expo-status-bar',
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