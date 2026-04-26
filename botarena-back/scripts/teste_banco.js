const path = require('path');

console.log('--- Iniciando Teste de Integridade de Banco (Data Integrity) ---');
const start = performance.now();

async function runTests() {
    // ==========================================
    // 1. Driver Factory Verification
    // ==========================================
    console.log('\n🔌 Verificando Driver Factory...');
    const db = require('../src/db/connection');

    const requiredMethods = ['get', 'all', 'run', 'transaction', 'close'];
    for (const method of requiredMethods) {
        if (typeof db[method] !== 'function') {
            throw new Error(`Driver missing required method: ${method}`);
        }
    }
    console.log('✅ Driver expõe interface completa: get, all, run, transaction, close');

    // ==========================================
    // 2. Basic Query Verification
    // ==========================================
    console.log('\n💾 Verificando consulta básica...');
    const testRow = await db.get('SELECT 1 as test_value');
    if (!testRow || testRow.test_value !== 1) {
        throw new Error('Basic SELECT query failed');
    }
    console.log('✅ SELECT 1 retornou corretamente.');

    // ==========================================
    // 3. Repository Contract Verification
    // ==========================================
    console.log('\n📦 Verificando contratos dos Repositórios...');
    const { settingsRepo, knowledgeRepo, menuRepo } = require('../src/container');

    // Settings
    const config = await settingsRepo.get();
    if (config === undefined || config === null) {
        throw new Error('SettingsRepository.get() returned null/undefined');
    }
    if (typeof config.bot_active !== 'boolean') {
        throw new Error('SettingsRepository.get() did not cast bot_active to boolean');
    }
    console.log(`  ⚙️ SettingsRepo.get() → empresa: "${config.empresa}", bot_active: ${config.bot_active}`);

    // Knowledge
    const kbEntries = await knowledgeRepo.getAll();
    if (!Array.isArray(kbEntries)) {
        throw new Error('KnowledgeRepository.getAll() did not return an array');
    }
    console.log(`  📚 KnowledgeRepo.getAll() → ${kbEntries.length} entries`);

    // Menu
    const menu = await menuRepo.getActive();
    // menu can be null (no active menu), that's fine
    console.log(`  🍽️ MenuRepo.getActive() → ${menu ? 'active menu found' : 'no active menu'}`);

    // ==========================================
    // 4. Multi-tenant Column Verification
    // ==========================================
    console.log('\n🏢 Verificando coluna company_id...');
    const tables = ['settings', 'knowledge_base', 'daily_menu'];
    for (const table of tables) {
        const columns = await db.all(`PRAGMA table_info(${table})`);
        const hasCompanyId = columns.some(c => c.name === 'company_id');
        if (!hasCompanyId) {
            throw new Error(`Table "${table}" is missing company_id column. Run: npm run migrate`);
        }
    }
    console.log('✅ Todas as tabelas possuem coluna company_id.');

    // ==========================================
    // Done
    // ==========================================
    const end = performance.now();
    console.log(`\n✅ Integridade de Banco validada! Status: Verde.`);
    console.log(`⏱️ Tempo: ${(end - start).toFixed(2)}ms`);
    process.exit(0);
}

runTests().catch(err => {
    console.error(`\n❌ Falha na integridade do banco de dados: ${err.message}`);
    process.exit(1);
});
