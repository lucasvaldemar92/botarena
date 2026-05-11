# QA Conventions - BotArena

## UI Purge Policy
- Botões de "Chamada de Vídeo" e "Voz" devem ser REMOVIDOS do DOM (purge), não apenas escondidos.
- Botões de "Nova Conversa", "Menu Principal" e "Busca no Chat" devem ser preservados para gestão administrativa e histórico.

## Database
- Sempre rodar `execution/ci_setup_db.js` antes de iniciar qualquer suite de testes para garantir a integridade do SQLite.

## CI/CD
- Deploys em produção (main) exigem aprovação do `ci-full.yml`.
