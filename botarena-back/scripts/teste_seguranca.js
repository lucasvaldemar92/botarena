const fs = require('fs');
const path = require('path');

/**
 * Recursively collects all .js files under a directory.
 */
function collectJsFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
            results = results.concat(collectJsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

function validateBroadcastRules(code) {
    const hasStatusBlock = code.includes("msg.from === 'status@broadcast'");
    const hasGroupBlock = code.includes("@g.us") && (code.includes("msg.from.includes") || code.includes("msg.from.endsWith"));
    const hasOutboundBlock = code.includes("['status@broadcast', 'g.us']") || code.includes('["status@broadcast", "g.us"]');

    if (!hasStatusBlock) console.warn('⚠️ [Aviso de Segurança]: Filtro Inbound de status@broadcast AUSENTE!');
    if (!hasGroupBlock) console.warn('⚠️ [Aviso de Segurança]: Filtro Inbound de grupos @g.us AUSENTE!');
    
    if (!hasOutboundBlock) {
         console.error('❌ FATAL: Trava GLOBAL Outbound de segurança ("Global Guard") removida ou alterada!');
         process.exit(1);
    }
}

function validateAuthSecurity(code) {
    const hasAuthMiddleware = code.includes("require('../middleware/auth')") || code.includes("require('./src/middleware/auth')");
    const hasSocketAuth = code.includes('io.use(') && code.includes('Authentication error');
    const hasEnvJwtSecret = code.includes('process.env.JWT_SECRET');

    if (!hasAuthMiddleware) {
        console.error('❌ FATAL: authMiddleware NÃO está importado!');
        process.exit(1);
    }
    if (!hasSocketAuth) {
        console.error('❌ FATAL: Middleware Socket.IO AUSENTE!');
        process.exit(1);
    }
    if (!hasEnvJwtSecret) {
        console.error('❌ FATAL: JWT_SECRET não está em process.env!');
        process.exit(1);
    }
}

function validateRateLimiter(code) {
    const hasRateLimiterImport = code.includes("require('../middleware/rateLimiter')") || code.includes("require('./src/middleware/rateLimiter')");
    const hasRateLimiterUsage  = code.includes('sensitiveLimiter,');

    if (!hasRateLimiterImport || !hasRateLimiterUsage) {
        console.error('❌ FATAL: Rate limiter não está aplicado!');
        process.exit(1);
    }
}

// Execution Logic
try {
    const rootDir    = path.resolve(__dirname, '..');
    const serverPath = path.join(rootDir, 'server.js');
    const srcDir     = path.join(rootDir, 'src');

    if (!fs.existsSync(serverPath)) throw new Error('server.js não encontrado.');

    const allFiles = [serverPath, ...collectJsFiles(srcDir)];
    const code = allFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

    validateBroadcastRules(code);
    validateAuthSecurity(code);
    validateRateLimiter(code);

    process.exit(0);
} catch (err) {
    console.error('❌ Erro no Virtual Mock de Segurança:', err.message);
    process.exit(1);
}
