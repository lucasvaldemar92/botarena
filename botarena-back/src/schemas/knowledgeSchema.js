// ==========================================
// 📚 KNOWLEDGE SCHEMA (Zod)
// ==========================================
// Validates POST /api/knowledge payloads.

const { z } = require('zod');

const knowledgeSchema = z.object({
    keyword:  z.string().min(2, 'Keyword deve ter no mínimo 2 caracteres').max(100),
    response: z.string().min(5, 'Resposta deve ter no mínimo 5 caracteres').max(1000),
    category: z.string().min(2).max(50).optional().default('faq')
});

module.exports = { knowledgeSchema };
