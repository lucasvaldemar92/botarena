# Business Logic - BotArena

## Pagamento PIX
- A chave PIX deve ser validada e formatada no frontend e backend.
- **Padrão de Mensagem**: Sempre fornecer o formato "Copia e Cola" para facilitar o pagamento pelo cliente.

## Horário de Atendimento
- O bot deve verificar se o horário atual está dentro dos períodos configurados antes de responder.
- Mensagem de ausência global deve ser enviada fora do horário.

## Regras de Negócio Específicas
### Almoço Executivo
- Gestão de refil e acompanhamentos.
- Fluxo de pedido prioritário entre 11:30 e 14:30.

### Gelados e Açaí
- Escala de complementos e montagem dinâmica.
- Verificação de estoque em tempo real.
