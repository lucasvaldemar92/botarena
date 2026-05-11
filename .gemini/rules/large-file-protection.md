# Global Rule: Large File Protection

**Escopo:** Global — aplicar em qualquer projeto, qualquer linguagem.
**Gatilho:** Sempre que for editar um arquivo com mais de 200 linhas.

## 🛡️ ANTES de qualquer edição
1. **Contar linhas e registrar:** `wc -l [arquivo]`
2. **Criar backup:** `cp [arquivo] [arquivo].bak`
3. **Commitar estado atual:** `git add [arquivo] && git commit -m "backup: antes de editar [arquivo]"`

## 🛠️ DURANTE as edições
4. **Editar uma função por vez:** Nunca substituir múltiplos blocos em uma única operação de escrita.
5. **Verificar sintaxe após cada edição:**
   - JavaScript/Node: `node --check [arquivo]`
   - Python: `python -m py_compile [arquivo]`
6. **Se a verificação retornar erro:**
   - Restaurar backup imediatamente: `cp [arquivo].bak [arquivo]`
   - Reportar o erro ao usuário antes de qualquer nova tentativa.
   - **Nunca** tentar "consertar por cima" de um arquivo com erro de sintaxe.
7. **Commitar progresso parcial:** Após cada função verificada e funcionando: `git add [arquivo] && git commit -m "fix: [descrição]"`

## 🏁 APÓS todas as edições
8. **Verificar integridade (Truncamento):** `wc -l [arquivo]` — deve ser >= ao valor registrado no passo 1.
9. **Verificação final:** Rodar verificação de sintaxe final no arquivo completo.
10. **Limpeza:** Remover backup: `rm [arquivo].bak`

## 🚫 PROIBIDO — NUNCA FAZER
- Reescrever o arquivo inteiro em uma única operação de escrita.
- Substituir mais de uma função por operação.
- Deletar variável sem antes buscar todas as referências: `grep -r "nomeDaVariavel" ./`.
- Continuar editando após detectar erro de sintaxe sem restaurar o backup.
