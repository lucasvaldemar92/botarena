# Global Rules — BotArena

## Elite Agent Architecture (3 Layers)

### Layer 1: Directive (Rules)
- Location: `.gemini/rules/`
- Contains the project "Constitution" — business rules and code conventions
- No execution may violate the directives of this layer

### Layer 2: Orchestration (Skills)
- Location: `.gemini/skills/`
- Documents the agent's technical capabilities (DB, UI, Automation)
- Acts as the bridge between rules and execution

### Layer 3: Execution (Scripts)
- Location: `execution/`
- Contains deterministic scripts and automation tools
- Ensures consistent and repeatable results