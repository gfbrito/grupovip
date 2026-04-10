# 🗺️ Roadmap - WhatsApp Group Sender

## ✅ Implementado

- [x] Sistema base de lançamentos
- [x] Criação/linkagem de grupos
- [x] Sincronização de leads (participantes)
- [x] Mensagens agendadas com mídia
- [x] Ações agendadas (mudar foto, nome, descrição, travar grupo)
- [x] Webhooks de saída
- [x] Tracking (Meta Pixel, GTM)
- [x] Página de entrada com link de grupo

---

## 🔄 Em Andamento / Próximos

### 1️⃣ Multi-Servidor WhatsApp ⭐ AGORA
Suporte a múltiplos provedores de WhatsApp com failover automático.

| Provedor | Status |
|----------|--------|
| Evolution API | ✅ Existente |
| Baileys | 🔄 Planejado |
| WhatsApp Web.js | 🔄 Planejado |

**Prioridade de uso:** Baileys → Evolution → Web.js

---

### 2️⃣ IA - Resposta Automática de Leads
Sistema de IA para responder mensagens de leads dentro dos grupos.

- **Como funciona:**
  1. Lead envia mensagem no grupo
  2. IA interpreta a mensagem (dúvida, objeção, interesse)
  3. Sistema gera sugestão de resposta
  4. Admin aprova/edita antes de enviar OU modo automático

---

## 📋 Backlog (Features Futuras)

### 🗄️ Migração para PostgreSQL
Migrar de SQLite para PostgreSQL para suportar maior volume de usuários.

- **Opções:** Supabase, Neon, PlanetScale ou self-hosted
- **Complexidade:** Baixa

---

### 🪄 IA - Criação Automatizada de Lançamento
Criar lançamento completo com IA a partir de uma descrição.

- **O que seria gerado:**
  - Nome do lançamento
  - Nomes dos grupos (com emojis)
  - Descrição dos grupos
  - Mensagens de boas-vindas
  - Sequência de mensagens agendadas (aquecimento, abertura, escassez)

- **Complexidade:** Média
- **Custo estimado:** ~$0.03 por lançamento gerado

---

### 📊 Dashboard Analytics Avançado
- Gráficos de crescimento de leads
- Taxa de retenção por grupo
- Horários de pico de cliques
- Funil de conversão

---

### 🔗 Multi-Conexão WhatsApp
Múltiplas instâncias WhatsApp por usuário (baseado no plano de assinatura).

---

### 👑 Painel Master Admin
Gerenciamento de múltiplos usuários da plataforma.
- Gerenciar usuários
- Definir limites por plano
- Logs globais
- Configurações do sistema

---

## 💡 Ideias (Ainda não priorizadas)

- [ ] Importação de leads via CSV
- [ ] Exportação de relatórios PDF
- [ ] Templates de mensagens prontos
- [ ] Integração com CRM (HubSpot, RD Station)
- [ ] App mobile para acompanhamento
- [ ] Notificações push/email

---

## 📅 Histórico de Versões

| Versão | Data | Principais mudanças |
|--------|------|---------------------|
| 1.0 | - | Sistema base funcionando |
