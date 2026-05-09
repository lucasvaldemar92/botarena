# Global Rules - BotArena

## Elite Agent Architecture (3 Layers)

### Layer 1: Directive (Rules)
- Localizada em `.gemini/rules/`.
- Contém a "Constituição" do projeto, regras de negócio e convenções de código.
- Nenhuma execução deve violar as diretrizes desta camada.

### Layer 2: Orchestration (Skills)
- Localizada em `.gemini/skills/`.
- Documenta as capacidades técnicas do agente (DB, UI, Automação).
- Serve como ponte entre as regras e a execução.

### Layer 3: Execution (Scripts)
- Localizada em `execution/`.
- Contém scripts determinísticos e ferramentas de automação.
- Garante resultados consistentes e repetíveis.
