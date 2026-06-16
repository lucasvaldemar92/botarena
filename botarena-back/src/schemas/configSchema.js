// ==========================================
// ⚙️ CONFIG SCHEMA (Zod)
// ==========================================
// Validates POST /api/config payloads.
// All fields are optional (partial update via COALESCE),
// but at least one field must be present.

const { z } = require('zod');

const configSchema = z.object({
    empresa:         z.string().min(3, 'Empresa deve ter no mínimo 3 caracteres').max(100).optional().or(z.literal('')),
    pix:             z.string().min(5, 'Chave PIX deve ter no mínimo 5 caracteres').optional().or(z.literal('')),
    nome_favorecido: z.string().max(100).optional().or(z.literal('')),
    cardapio_url:    z.string().url('URL do cardápio inválida').optional().or(z.literal('')),
    boas_vindas:     z.string().min(5, 'Mensagem de boas-vindas deve ter no mínimo 5 caracteres').max(500).optional(),
    operation_days:  z.string().optional(),
    operation_start: z.string().optional(),
    operation_end:   z.string().optional(),
    operation_periods: z.string().optional(),
    mensagem_ausencia: z.string().optional(),
    bot_active:      z.boolean().optional(),
    consumer_client_id: z.string().optional().or(z.literal('')),
    consumer_client_secret: z.string().optional().or(z.literal('')),
    consumer_integration_active: z.boolean().optional(),
    openai_api_key: z.string().optional().or(z.literal('')),
    gemini_api_key: z.string().optional().or(z.literal('')),
    openai_active: z.boolean().optional(),
    gemini_active: z.boolean().optional(),
    menu_lunch_active: z.boolean().optional(),
    menu_lunch_start:  z.string().optional(),
    menu_lunch_end:    z.string().optional(),
    menu_acai_active:  z.boolean().optional(),
    menu_acai_start:   z.string().optional(),
    menu_acai_end:     z.string().optional(),
    menu_events_active: z.boolean().optional(),
    menu_events_start:  z.string().optional(),
    menu_events_end:    z.string().optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'Pelo menos um campo deve ser enviado.'
});

module.exports = { configSchema };
