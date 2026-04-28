// ==========================================
// ⚙️ CONFIG SCHEMA (Zod)
// ==========================================
// Validates POST /api/config payloads.
// All fields are optional (partial update via COALESCE),
// but at least one field must be present.

const { z } = require('zod');

const configSchema = z.object({
    empresa:         z.string().min(3, 'Empresa deve ter no mínimo 3 caracteres').max(100).optional(),
    pix:             z.string().min(5, 'Chave PIX deve ter no mínimo 5 caracteres').optional(),
    nome_favorecido: z.string().max(100).optional(),
    cardapio_url:    z.string().url('URL do cardápio inválida').optional().or(z.literal('')),
    boas_vindas:     z.string().min(5, 'Mensagem de boas-vindas deve ter no mínimo 5 caracteres').max(500).optional(),
    bot_active:      z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'Pelo menos um campo deve ser enviado.'
});

module.exports = { configSchema };
