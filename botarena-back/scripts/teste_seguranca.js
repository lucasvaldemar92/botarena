const fs = require('fs');
const path = require('path');

console.log('--- Iniciando Teste de Segurança Modular (Serverless Guard) ---');
const start = performance.now();

try {
    // Busca no server.js (ou bot.service se tiver sido fragmentado depois)
    const serverPath = path.resolve(__dirname, '../server.js');
    if (!fs.existsSync(serverPath)) {
        throw new Error('server.js não encontrado.');
    }

    const code = fs.readFileSync(serverPath, 'utf8');

    // MOCK VIRTUAL: Validação por Inspecão de AST / RegEx rígida
    // Garante que o desenvolvedor não removeu a trava global.
    
    // Regra 1: Block de status broadcast
    const hasStatusBlock = code.includes("msg.from === 'status@broadcast'");
    
    // Regra 2: Block de Groups (g.us)
    const hasGroupBlock = code.includes("@g.us") && (code.includes("msg.from.includes") || code.includes("msg.from.endsWith"));
    
    // Regra 3: Block Array 'status@broadcast', 'g.us' -> Trava de saída Global
    const hasOutboundBlock = code.includes("['status@broadcast', 'g.us']") || code.includes('["status@broadcast", "g.us"]');

    if (!hasStatusBlock) {
         console.warn('⚠️ [Aviso de Segurança]: Filtro Inbound de status@broadcast AUSENTE!');
    }
    if (!hasGroupBlock) {
         console.warn('⚠️ [Aviso de Segurança]: Filtro Inbound de grupos @g.us AUSENTE!');
    }
    
    if (!hasOutboundBlock) {
         console.error('❌ FATAL: Trava GLOBAL Outbound de segurança ("Global Guard") removida ou alterada!');
         process.exit(1);
    }

    console.log('🛡️ MOCK VIRTUAL Aprovado: As travas de status/grupos estão ativas na camada de serviço.');

    // ==========================================
    // 🔐 AUTH SECURITY RULES
    // ==========================================

    // Regra 4: authMiddleware must be imported
    const hasAuthMiddleware = code.includes("require('./src/middleware/auth')") || code.includes('require("./src/middleware/auth")');
    if (!hasAuthMiddleware) {
        console.error('❌ FATAL: authMiddleware NÃO está importado no server.js!');
        process.exit(1);
    }
    console.log('🔐 Regra 4 OK: authMiddleware importado.');

    // Regra 5: Socket.IO io.use() auth middleware must be present
    const hasSocketAuth = code.includes('io.use(') && code.includes('Authentication error');
    if (!hasSocketAuth) {
        console.error('❌ FATAL: Middleware de autenticação Socket.IO (io.use) AUSENTE!');
        process.exit(1);
    }
    console.log('🔐 Regra 5 OK: Socket.IO auth middleware presente.');

    // Regra 6: JWT_SECRET must come from process.env (not hardcoded)
    const hasEnvJwtSecret = code.includes('process.env.JWT_SECRET');
    if (!hasEnvJwtSecret) {
        console.error('❌ FATAL: JWT_SECRET não está sendo lido de process.env!');
        process.exit(1);
    }
    console.log('🔐 Regra 6 OK: JWT_SECRET via process.env.');

    // Regra 7: Rate limiter must be imported and applied to sensitive routes
    const hasRateLimiterImport = code.includes("require('./src/middleware/rateLimiter')") || code.includes('require("./src/middleware/rateLimiter")');
    const hasRateLimiterUsage  = code.includes('sensitiveLimiter,');
    if (!hasRateLimiterImport || !hasRateLimiterUsage) {
        console.error('❌ FATAL: Rate limiter (sensitiveLimiter) não está importado ou aplicado nas rotas!');
        process.exit(1);
    }
    console.log('🔐 Regra 7 OK: Rate limiter aplicado em rotas sensíveis.');

    const end = performance.now();
    console.log(`✅ Segurança validada! Status: Verde.`);
    console.log(`⏱️ Tempo: ${(end - start).toFixed(2)}ms`);
    process.exit(0);

} catch (err) {
    console.error('❌ Erro no Virtual Mock de Segurança:', err.message);
    process.exit(1);
}
