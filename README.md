# 🤖 BotArena

BotArena é uma plataforma profissional de automação e gestão de atendimento via WhatsApp, projetada com uma arquitetura moderna, modular e segura. O sistema permite a integração fluida entre um dashboard administrativo em tempo real e a API do WhatsApp, oferecendo recursos de auto-atendimento, gestão de cardápios e monitoramento de conversas.

---

## 🏗️ Arquitetura do Sistema

O projeto segue princípios de **Clean Architecture** e **Modular Design**, garantindo escalabilidade e facilidade de manutenção.

### 🧩 Camadas Principais

1.  **Core Intelligence (`botHandler.js`)**: Central de processamento de mensagens. Utiliza lógica baseada em palavras-chave e consulta a uma base de conhecimento para respostas automáticas.
2.  **Real-Time Sync (`socket/events.js`)**: Camada de comunicação bidirecional via Socket.IO, sincronizando o estado do bot e novas mensagens instantaneamente com o frontend.
3.  **Data Access Layer (Repository Pattern)**: Abstração completa do banco de dados (SQLite/PostgreSQL) através de repositórios especializados (`SettingsRepository`, `MenuRepository`, `KnowledgeRepo`).
4.  **Service Layer (`whatsappClient.js`)**: Gerenciamento do ciclo de vida do cliente WhatsApp (autenticação, QR Code, reconexão).
5.  **Validation Layer (`schemas/`)**: Validação rigorosa de dados utilizando **Zod**, garantindo a integridade das configurações e entradas do sistema.

---

## 🛠️ Tech Stack

### **Backend**
*   **Runtime:** Node.js (v22+)
*   **Framework:** Express
*   **Real-time:** Socket.IO (v4)
*   **WhatsApp Engine:** `whatsapp-web.js` (com suporte a Multi-Device)
*   **Validation:** Zod
*   **Observabilidade:** Sentry (Tracing & Error Tracking)

### **Frontend**
*   **Estrutura:** HTML5 Semântico
*   **Estilização:** Vanilla CSS (Modern CSS Variables, Flexbox, Grid)
*   **Lógica:** JavaScript Moderno (ES6+)
*   **Real-time:** Socket.IO Client

### **Database**
*   **Engine:** SQLite (Local) / Suporte a PostgreSQL
*   **Migrations:** Sistema customizado de migrações SQL

---

## 🛡️ Segurança e Robustez

*   **Socket Auth:** Autenticação via JWT em todas as conexões WebSocket.
*   **JID Lockdown:** Trava de segurança global para evitar interações indesejadas em grupos ou status (broadcast).
*   **Self-Trigger Protection:** Mecanismo rigoroso para ignorar mensagens `fromMe`, evitando loops de auto-atendimento.
*   **Input Sanitization:** Proteção contra XSS no frontend e validação de payloads no backend.

---

## ⚙️ CI/CD & Automação

O BotArena utiliza **GitHub Actions** com uma arquitetura de pipeline dividida para otimizar o ciclo de feedback:

*   **⚡ BotArena CI Fast (`ci-fast.yml`):** Executado em cada push para `feat/**`, `fix/**`, `chore/**` e `qa`. Focado em velocidade, realiza a instalação limpa (`npm ci`), prepara o banco de dados temporário (`ci_setup_db.js`) e executa os testes unitários, de integridade de banco e auditoria de segurança.
*   **🛡️ BotArena CI Full (`ci-full.yml`):** Executado em pushes para `homolog` e `main`. Além de todos os testes do workflow rápido, este pipeline gerencia o **Sentry Release** automaticamente ao atingir a branch `main`, garantindo que a versão em produção esteja devidamente monitorada.
*   **🗄️ Database Automation:** O ambiente de CI conta com um script de bootstrap (`scripts/ci_setup_db.js`) que inicializa o esquema SQLite e aplica migrações dinamicamente, garantindo testes determinísticos sem necessidade de um banco persistente no runner.

---

## 🔄 Fluxo de Trabalho (Git Workflow)

Para garantir a estabilidade do sistema, seguimos um fluxo rigoroso de promoção de código:

1.  **Desenvolvimento**: Branches `feat/BA-XX`, `fix/BA-XX` ou `chore/BA-XX`.
2.  **QA (Qualidade)**: Merge para a branch `qa` para testes integrados automatizados.
3.  **Homologação**: Promoção para a branch `homolog` para validação pré-produção.
4.  **Produção**: Merge final para a branch `main`, disparando o release oficial e monitoramento no Sentry.

> [!TIP]
> As branches `main` e `homolog` possuem regras de proteção que exigem o sucesso do workflow **BotArena CI Full** antes de permitir o merge.

---

## 📂 Estrutura do Repositório

```text
BotArena/
├── botarena-back/          # Servidor Node.js
│   ├── src/
│   │   ├── handlers/       # Lógica do Bot
│   │   ├── repositories/   # Acesso a Dados
│   │   ├── socket/         # Eventos WebSocket
│   │   ├── services/       # Integração WhatsApp
│   │   └── schemas/        # Validação (Zod)
│   └── tests/              # Testes Unitários e Integração
└── botarena-front/         # Dashboard & Chat UI
    ├── src/assets/         # Estilos, Imagens e Utils
    └── chat.html           # Interface Principal
```

---

## 🚀 Como Iniciar

1.  **Instale as dependências:**
    ```bash
    cd botarena-back
    npm install
    ```

2.  **Configure o ambiente:**
    *   Crie um arquivo `.env` baseado no `.env.example`.
    *   Configure sua `JWT_SECRET` e `SENTRY_DSN`.

3.  **Inicie o servidor:**
    ```bash
    npm run dev
    ```

4.  **Acesse o Dashboard:**
    *   Abra o navegador em `http://localhost:3000`.
    *   Escaneie o QR Code via WhatsApp para ativar o bot.

---

## 📝 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.
