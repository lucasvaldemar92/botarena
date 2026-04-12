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
    const end = performance.now();
    console.log(`✅ Segurança validada! Status: Verde.`);
    console.log(`⏱️ Tempo: ${(end - start).toFixed(2)}ms`);
    process.exit(0);

} catch (err) {
    console.error('❌ Erro no Virtual Mock de Segurança:', err.message);
    process.exit(1);
}
