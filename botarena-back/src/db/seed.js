// ==========================================
// 🌱 AUTO SEED LOADER
// ==========================================
// Executes database/seed_data.sql on startup using the shared SQLiteDriver
// instance. This avoids opening a second DB connection and ensures the seed
// runs before the HTTP server accepts requests.
//
// The seed is ONLY applied when the file exists. Safe in environments without it.
// Called automatically in server.js before server.listen().

const fs   = require('fs');
const path = require('path');

/**
 * Loads seed_data.sql into the database if the file exists.
 *
 * @param {import('../db/drivers/sqlite')} db  - Shared SQLiteDriver instance
 * @returns {Promise<void>}
 */
async function autoSeed(db) {
    const seedPath = path.join(__dirname, '../../database/seed_data.sql');

    if (!fs.existsSync(seedPath)) {
        console.log('ℹ️  [AutoSeed] seed_data.sql não encontrado — seed ignorado.');
        return;
    }

    const sql = fs.readFileSync(seedPath, 'utf8');

    console.log('🌱 [AutoSeed] Carregando seed_data.sql...');

    // db.exec não está no wrapper — usamos o _db interno diretamente
    // pois exec é a única forma segura de executar múltiplos statements SQL.
    await new Promise((resolve, reject) => {
        db._db.exec(sql, (err) => {
            if (err) {
                console.error('❌ [AutoSeed] Erro ao aplicar seed:', err.message);
                return reject(err);
            }
            console.log('✅ [AutoSeed] Dados do seed carregados com sucesso!');
            resolve();
        });
    });
}

module.exports = { autoSeed };
