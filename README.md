# Saude Recife - API (Backend)

Projeto Integrador 3º Periodo &middot; Senac PE
**1ª Entrega: PWA + Backend + Banco de Dados**

**Integrantes:** Ivan Roberto, Timóteo Batista e Filipe José.

Este repositorio contem apenas a API. O front-end (PWA) fica em um
repositorio separado: [saude-recife-frontend](https://github.com/alvess29/saude-recife-frontend).
Os dois precisam estar rodando ao mesmo tempo para o sistema funcionar.

Stack: **Node.js + Express** (API REST) e **Firebase** (Firestore como banco
de dados e Firebase Authentication para login).

---

## 1. Estrutura do projeto

```
backend/
├── src/
│   ├── config/        conexao com Firebase, nomes das colecoes
│   ├── middleware/     autenticacao (verifica token) e controle de perfil
│   ├── controllers/    regras de negocio de cada recurso
│   ├── routes/         endpoints da API
│   └── server.js       ponto de entrada
└── scripts/
    ├── criarAdmin.js   cria o primeiro administrador do sistema
    └── smokeTest.js    teste automatizado de ponta a ponta
```

As regras do Firestore (`firestore.rules`, que bloqueiam acesso direto do
navegador) tambem ficam neste repositorio.

## 2. Requisitos da 1ª Entrega atendidos por este repositorio

| Requisito do slide | Onde esta implementado |
|---|---|
| Cadastro de Clinicas | `POST /api/clinicas` |
| Cadastro de Profissionais de Saude | `POST /api/profissionais` |
| Cadastro de Especialidades | `POST /api/especialidades` |
| Cadastro de Pacientes | `POST /api/auth/registrar-paciente` |
| Login e Autenticacao | Firebase Authentication (e-mail/senha), validado pelo middleware |
| Perfis e Controle de Acesso | `tipoUsuario` (paciente/profissional/administrador) + middleware `permitir()` |
| Criacao de conta para Profissionais/Equipe | `POST /api/auth/registrar-equipe` |
| Cadastro de Pacientes pelo Administrador | `POST /api/auth/registrar-paciente` (mesma rota usada no autocadastro) |
| Edicao de Dados de Pacientes pelo Administrador | `PUT /api/auth/pacientes/:id` |
| Consulta do Perfil Logado | `GET /api/auth/perfil` |
| Consulta de Clinicas/Profissionais/Especialidades | `GET /api/clinicas`, `/api/profissionais`, `/api/especialidades` |
| Cadastro de Disponibilidade do Profissional | `POST /api/disponibilidades` (um horário) e `POST /api/disponibilidades/lote` (vários dias e horários de uma vez) |
| Consulta de Horários Disponíveis | `GET /api/disponibilidades` (só mostra de hoje em diante; horários livres cujo início já passou, no fuso de Recife, ficam de fora, e `POST /api/agendamentos` recusa esses horários com `409`) |
| Pré-triagem de Sintomas por IA | `POST /api/triagem` |
| Agendamento de Consulta | `POST /api/agendamentos` |
| Cancelamento de Agendamento | `PATCH /api/agendamentos/:id/cancelar` |
| Integracao Client-Server (API REST + JSON) | toda a pasta `src/routes` |
| Persistencia em Banco de Dados | Firebase Firestore |

Os requisitos de interface (PWA, responsividade, telas) estao documentados no
README do [repositorio do frontend](https://github.com/alvess29/saude-recife-frontend).

## 3. Configurar o Firebase

1. Crie um projeto em https://console.firebase.google.com
2. Ative **Authentication > Sign-in method > E-mail/senha**.
3. Ative **Firestore Database** (modo producao).
4. Em *Configuracoes do projeto > Contas de servico*, gere uma chave privada
   (arquivo JSON) e salve como `serviceAccountKey.json` na raiz deste repositorio.
5. Publique as regras de `firestore.rules` (bloqueiam acesso direto do
   navegador; toda escrita/leitura passa pela API, que usa o Admin SDK).

As chaves web do Firebase (usadas pelo front-end para login) ficam no
repositorio do frontend, nao neste.

## 4. Configurar a pré-triagem por IA (opcional)

A aba "Agendar consulta" do paciente tem um assistente que faz algumas
perguntas sobre os sintomas e recomenda a especialidade adequada, usando a
API gratuita do Google Gemini. Sem essa chave configurada, o resto do
sistema funciona normalmente, só a pré-triagem fica indisponível.

1. Crie uma chave gratuita em https://aistudio.google.com/apikey (só
   precisa de uma conta Google, sem cartão de crédito).
2. No arquivo `.env` da raiz do backend, adicione:
   ```
   GEMINI_API_KEY=sua-chave-aqui
   ```

Essa funcionalidade usa o `fetch` nativo do Node, por isso é necessário
**Node 18 ou superior** rodando o backend.

## 5. Rodar o backend

O arquivo `.env` e **opcional** para o Firebase: se voce colocou
`serviceAccountKey.json` na raiz do projeto (passo 4 da seção anterior), o
backend encontra ele sozinho. Ele passa a ser necessário apenas se você for
usar a pré-triagem por IA (seção 4 acima).

```bash
npm install
node scripts/criarAdmin.js "Seu Nome" admin@saude-recife.com SenhaForte123
npm start
```

Se der erro `credenciais do Firebase nao encontradas`, confira se o arquivo
esta exatamente em `serviceAccountKey.json` (mesmo nivel do `package.json`,
nome exato, extensao `.json`).

A API sobe em `http://localhost:3000`. Teste com `GET http://localhost:3000/api/saude`.

## 6. Como testar

### 6.1 Teste automatizado (smoke test)

Com o Firebase real configurado, existe um script que executa o fluxo
completo (especialidade, clinica, profissional, horario, paciente, agendamento
e cancelamento) via linha de comando:

```bash
FIREBASE_API_KEY=SUA_WEB_API_KEY \
ADMIN_EMAIL=admin@saude-recife.com \
ADMIN_SENHA=SenhaForte123 \
node scripts/smokeTest.js
```

- `FIREBASE_API_KEY` fica em *Configuracoes do projeto > Geral > Chave de API
  da Web* no Console do Firebase.
- `ADMIN_EMAIL`/`ADMIN_SENHA` sao os dados do administrador criado com
  `scripts/criarAdmin.js`.

O script imprime o resultado de cada etapa no terminal.

### 6.2 Testar a API sem o front-end (curl)

```bash
# Rota publica
curl http://localhost:3000/api/saude

# Cadastro de paciente (nao exige token)
curl -X POST http://localhost:3000/api/auth/registrar-paciente \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana Teste","email":"ana@teste.com","senha":"123456","cpf":"11122233344"}'
```

Rotas protegidas exigem `Authorization: Bearer <idToken>`. Para obter um
`idToken` rapidamente fora do navegador, use o endpoint REST do Firebase Auth:

```bash
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=SUA_WEB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@teste.com","password":"123456","returnSecureToken":true}'
```

### 6.3 Teste manual completo (backend + frontend)

O checklist passo a passo que cobre os dois repositorios juntos esta no
README do [frontend](https://github.com/alvess29/saude-recife-frontend).
