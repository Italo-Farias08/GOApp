# #GO — Front-end (React Native / Expo)

App de corridas estilo 99/Uber. Este pacote cobre o **fluxo de autenticação**
(login + cadastro) e já deixa a estrutura pronta pra plugar num backend real.

## Rodando o projeto

```bash
npm install
npx expo start
```

Abre no Expo Go (celular) ou num emulador Android/iOS.

## Estrutura

```
App.tsx                     # entry point
src/
  theme/theme.ts             # cores, tipografia, espaçamentos — mexe aqui pra rebrandar
  types/index.ts              # tipos compartilhados (User, navegação, etc.)
  services/
    api.ts                    # instância axios + token (SecureStore)
    authService.ts             # login/registro/logout — hoje mockado
  context/AuthContext.tsx      # estado global de autenticação
  navigation/RootNavigator.tsx # troca Login/Register <-> Home conforme login
  components/
    Button.tsx
    Input.tsx
  screens/
    LoginScreen.tsx
    RegisterScreen.tsx
    HomeScreen.tsx            # placeholder pós-login (mapa/corrida entram aqui)
```

## Conectando com o backend

1. Em `src/services/api.ts`, troque `API_BASE_URL` pela URL real
   (ou defina `EXPO_PUBLIC_API_URL` num `.env`).
2. Em `src/services/authService.ts`, mude `USE_MOCK` para `false`.
   Os endpoints já estão no formato esperado:
   - `POST /auth/login` → `{ user, tokens }`
   - `POST /auth/register` → `{ user, tokens }`
   - `GET /auth/me` → `User`
3. Se os nomes dos campos do backend forem diferentes, ajusta só esse arquivo —
   o resto do app (telas, contexto, navegação) não muda.

## Próximos passos sugeridos

- Tela de mapa / solicitação de corrida (HomeScreen é só o placeholder)
- Recuperação de senha
- Tela de perfil do usuário
- Integração com mapas (react-native-maps) e localização
