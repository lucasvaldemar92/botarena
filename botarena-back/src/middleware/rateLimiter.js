const rateLimit = require('express-rate-limit');

/**
 * sensitiveLimiter — Protects write/mutation endpoints against automated abuse.
 * 10 requests per minute per IP.  Skips localhost to keep internal calls unthrottled.
 */
const sensitiveLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 10,                 // Limite de 10 req por minuto para rotas sensíveis
    message: { error: 'Muitas requisições, tente novamente em 1 minuto.' },
    standardHeaders: true,   // RateLimit-* headers (draft-6)
    legacyHeaders: false,    // Disable X-RateLimit-* headers
    skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1', // Relaxed for internal calls
});

module.exports = { sensitiveLimiter };
