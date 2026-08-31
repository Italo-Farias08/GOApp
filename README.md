# #GO — App completo (Frontend + Backend)

Este pacote junta o seu app front-end (React Native / Expo) com um backend
Node.js + Express + PostgreSQL feito pra validar exatamente as chamadas que
o front já faz (login, cadastro, perfil e virar motorista).

```
GOApp-completo/
├── frontend/   → app React Native (Expo) — o mesmo que você mandou
└── backend/    → API Node.js + Express + PostgreSQL
```

## Como o front e o back se conversam

O front já tinha os serviços (`authService.ts`, `driverService.ts`) prontos
esperando um backend real, só com um "modo mock" ligado (`USE_MOCK = true`)
pra não travar o desenvolvimento. Eu:

1. Desliguei o `USE_MOCK` (agora é `false`) em `authService.ts` e `driverService.ts`.
2. Ajustei `src/services/api.ts` pra apontar pro backend local por padrão.
3. Criei o backend implementando exatamente as rotas que o front chama.

| Rota do front         | Método | Rota do backend  | O que faz |
|------------------------|--------|------------------|-----------|
| login()                | POST   | /auth/login      | Login com email + senha |
| loginWithPhone()       | POST   | /auth/login-phone| Login/cadastro simplificado por telefone |
| register()             | POST   | /auth/register   | Cria conta nova |
| fetchMe()               | GET    | /auth/me         | Retorna o usuário logado |
| updateAccount()        | PUT    | /auth/me         | Atualiza nome/email/telefone |
| applyToBeDriver()      | POST   | /driver/apply    | Envia solicitação pra virar motorista |
| fetchDriverStatus()    | GET    | /driver/status   | Consulta status do cadastro de motorista |

## 1. Subindo o backend

### Pré-requisitos
- Node.js 18+
- PostgreSQL rodando (local ou em algum serviço na nuvem)

### Passo a passo

```bash
cd backend
npm install
cp .env.example .env
```

Abra o `.env` e ajuste:
- `URL_BANCO_DE_DADOS` com os dados do seu PostgreSQL
- `JWT_SEGREDO` com uma string aleatória grande

Crie as tabelas no banco (uma vez só):

```bash
psql -U postgres -d goapp -f banco-de-dados/esquema.sql
```

Suba o servidor:

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000` (ou na porta que você definir em
`PORTA`). Pra checar se está no ar: `GET http://localhost:3000/saude`.

## 2. Rodando o frontend

```bash
cd frontend
npm install
cp .env.example .env
```

No `.env` do frontend, ajuste `EXPO_PUBLIC_API_URL`:
- Emulador Android → `http://10.0.2.2:3000`
- iOS Simulator → `http://localhost:3000`
- Celular físico → `http://SEU_IP_NA_REDE:3000` (ex: `http://192.168.0.10:3000`)

Depois:

```bash
npx expo start
```

## Estrutura do backend (pastas e responsabilidades)

```
backend/
├── src/
│   ├── configuracao/       → conexão com o PostgreSQL
│   ├── controladores/      → regras de cada rota (autenticação, motorista)
│   ├── intermediarios/     → autenticação via JWT e tratamento de erros
│   ├── modelos/            → acesso direto às tabelas do banco
│   ├── rotas/              → definição das rotas do Express
│   ├── utilitarios/        → geração/verificação de token JWT
│   ├── app.js              → configuração do Express (middlewares, rotas)
│   └── servidor.js         → ponto de entrada (sobe o servidor)
├── banco-de-dados/
│   └── esquema.sql         → criação das tabelas usuarios e motoristas
├── .env.example
└── package.json
```

## Segurança e validações já implementadas

- Senhas nunca são salvas em texto puro — usa `bcryptjs` pra gerar o hash.
- Login e cadastro validam formato de email e tamanho mínimo de senha.
- Rotas de perfil e motorista exigem token JWT válido (`Authorization: Bearer <token>`).
- Email e telefone são únicos no banco (retorna erro 409 se já existirem).
- Erros retornam sempre um JSON `{ message: "..." }` com o status HTTP correto.

## Próximos passos sugeridos (não implementados ainda)

- Envio de SMS/OTP de verdade no login por telefone (hoje ele loga direto).
- Refresh token (hoje só existe o `accessToken`).
- Upload de avatar e dos documentos do motorista (CNH, foto do veículo).
- Painel/admin pra aprovar ou rejeitar cadastros de motorista.
