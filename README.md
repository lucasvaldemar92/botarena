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
*   **Runtime:** Node.js (v18+)
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

O BotArena utiliza **GitHub Actions** para garantir a qualidade do código através de uma pipeline de Integração Contínua (CI) automatizada:

*   **Testes Rápidos (`test-fast`):** Execução de testes unitários, testes de banco de dados e auditoria de segurança em cada push para `qa` ou `main`.
*   **Testes E2E (`test-e2e`):** Validação visual e de fluxo completo utilizando **Playwright** em ambientes isolados.
*   **Sentry Release:** Automatização da criação de releases no Sentry após o sucesso dos testes em `main`, garantindo rastreabilidade total de erros.

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
