// ==========================================
// ✅ VALIDATION MIDDLEWARE (Zod)
// ==========================================
// Generic middleware factory — takes a Zod schema and validates req.body.
// Returns 400 with formatted errors on failure, passes clean data on success.

/**
 * validate — Returns an Express middleware that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (and coerced) data.
 * On failure, returns 400 with Zod's formatted error object.
 *
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @returns {Function} Express middleware
 */
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        console.warn('⚠️ [Validation] Payload rejected:', JSON.stringify(result.error.format()));
        return res.status(400).json({
            error: 'Dados inválidos',
            details: result.error.format()
        });
    }
    req.body = result.data; // Replace with parsed/coerced data
    next();
};

module.exports = { validate };
