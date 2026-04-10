# WhatsApp Group Sender (Mini-SendFlow)

Sistema local para disparo de mensagens em grupos de WhatsApp via Evolution API.

## 🚀 Stack Técnica

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js + Express + TypeScript |
| Banco | SQLite + Prisma ORM |
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Ícones | Lucide React |
| Auth | JWT (httpOnly cookie) + bcrypt |

## 📋 Pré-requisitos

- Node.js 18+
- npm ou yarn
- Instância da Evolution API configurada e conectada

## 🛠️ Instalação

### 1. Backend

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run dev
```

O backend rodará em `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend rodará em `http://localhost:3000`

## 🎯 Primeiro Acesso

1. Acesse `http://localhost:3000`
2. Crie uma conta (register)
3. O sistema redirecionará para `/settings`
4. Configure a Evolution API:
   - URL da API
   - API Key
   - Nome da Instância
5. Teste a conexão
6. Salve as configurações
7. Pronto! Agora você pode usar o sistema

## 📱 Funcionalidades

### Dashboard
- Visão geral do sistema
- Cards de métricas (grupos, mensagens enviadas, erros, fila)
- Logs recentes com auto-refresh

### Grupos
- Sincronização com Evolution API
- Toggle de ativo/inativo
- Apelidos customizados para grupos
- Busca por nome/apelido

### Campanhas
- Criação com seleção de grupos
- Variáveis dinâmicas:
  - `{group_name}` → Nome do grupo
  - `{date}` → Data atual
  - `{time}` → Hora atual
- Preview em tempo real
- Controles de iniciar/pausar
- Progresso em tempo real
- Retry automático (3 tentativas)
- Delay aleatório entre mensagens (800-1800ms)

### Configurações
- Configuração da Evolution API
- Teste de conexão antes de salvar

## 🔧 Endpoints da API

### Auth
- `POST /api/auth/register` - Registrar usuário
- `POST /api/auth/login` - Fazer login
- `POST /api/auth/logout` - Fazer logout
- `GET /api/auth/me` - Dados do usuário logado

### Settings
- `GET /api/settings` - Buscar configurações
- `PUT /api/settings` - Atualizar configurações
- `POST /api/settings/test` - Testar conexão

### Groups
- `GET /api/groups` - Listar grupos
- `POST /api/groups/sync` - Sincronizar grupos
- `PATCH /api/groups/:id` - Atualizar grupo
- `GET /api/groups/stats` - Estatísticas

### Campaigns
- `GET /api/campaigns` - Listar campanhas
- `POST /api/campaigns` - Criar campanha
- `GET /api/campaigns/:id` - Detalhes da campanha
- `POST /api/campaigns/:id/start` - Iniciar campanha
- `POST /api/campaigns/:id/pause` - Pausar campanha
- `DELETE /api/campaigns/:id` - Excluir campanha
- `GET /api/campaigns/stats` - Estatísticas

### Status
- `GET /api/status` - Status do sistema (API e Worker)
- `GET /api/logs` - Logs recentes

## 📂 Estrutura de Pastas

```
whatsapp-sender/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── app.ts
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   └── services/
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   └── ui/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   └── lib/
│   └── package.json
│
└── README.md
```

## 🔒 Segurança

- Autenticação via JWT em cookie httpOnly
- Senhas hashadas com bcrypt
- API Key da Evolution mascarada no frontend
- Middleware de proteção de rotas

## 🐛 Troubleshooting

### API não conecta
1. Verifique se a URL está correta
2. Confirme que a API Key é válida
3. Certifique-se que a instância existe e está conectada (QR Code escaneado)

### Mensagens não são enviadas
1. Verifique se o Worker está rodando (indicador no header)
2. Confirme que a campanha está com status "Em execução"
3. Verifique os logs para identificar erros

### Grupos não aparecem
1. Clique em "Sincronizar" na página de grupos
2. Verifique se a instância tem grupos no WhatsApp
3. Confira se a conexão com a API está funcionando

## 📄 Licença

MIT
