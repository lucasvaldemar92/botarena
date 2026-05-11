# Global Rule: Dynamic DOM Frontend

**Escopo:** Global — aplicar em qualquer projeto com interface web (HTML/JS/React/Vue).
**Gatilho:** Sempre que for editar arquivos de frontend que manipulam o DOM.

## 🖱️ Regras de eventos e referências
1. **Nunca armazenar referências a elementos DOM em variáveis de módulo/global:**
   - **Errado:** `const btn = document.getElementById('send')` no topo do arquivo.
   - **Certo:** Buscar o elemento dentro do handler ou função, no exato momento do uso.
2. **Sempre usar delegação de eventos para elementos dinâmicos:**
   - **Errado:** `btn.addEventListener('click', handler)`.
   - **Certo:** `document.addEventListener('click', e => { if (e.target.id === 'send') handler(e) })`.
3. **Prevenção de duplicidade:** Antes de adicionar qualquer event listener, verificar se já existe um igual para evitar execuções múltiplas.

## 📦 Regras de escopo e variáveis
4. **Isolamento por IIFE:** Isolar código em IIFE quando o arquivo usa variáveis globais para evitar poluição do `window`.
   - **Padrão:** `(function() { /* todo o código aqui */ })();`
5. **Checagem de redeclaração:** Antes de declarar qualquer variável (`let`/`const`), buscar no arquivo se já existe uma declaração com o mesmo nome para evitar erros fatais no browser.
6. **Busca de impacto:** Antes de deletar qualquer variável, buscar todas as referências no projeto: `grep -r "nomeVar" ./src`.

## ✍️ Regras de edição
7. **Atomicidade de funções:** Se precisar alterar uma função com mais de 30 linhas, reescrever a função inteira para garantir consistência, nunca editar apenas um trecho interno.
8. **Verificação de sintaxe:** Rodar `node --check [arquivo]` após cada edição.

## 🛠️ Artifact e validação
9. **Prova Real:** Nunca usar apenas screenshots como prova; o funcionamento deve ser validado via logs ou testes de DOM.
10. **Artifact obrigatório:** Gerar `git diff --stat` mostrando claramente os arquivos alterados.
11. **Cache Busting:** Ao alterar JS/CSS, verificar e incrementar o versionamento no HTML (`?v=0.0.1`) para forçar o recarregamento pelo navegador.
