// ==========================================
// 🍽️ MENU SCHEMA (Zod)
// ==========================================
// Validates POST /api/menu payloads.

const { z } = require('zod');

const menuSchema = z.object({
    extracted_text: z.string().min(5, 'Texto do cardápio deve ter no mínimo 5 caracteres').optional().or(z.literal('')),
    mimetype:       z.string().optional(),
    base64_data:    z.string().optional()
});

module.exports = { menuSchema };
