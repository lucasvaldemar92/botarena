// ==========================================
// 🔄 MIGRATION: Add company_id to all tables
// ==========================================
// Idempotent — safe to run multiple times.
// Adds `company_id INTEGER DEFAULT 1` to: settings, knowledge_base, daily_menu

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

console.log('--- Iniciando Migração: company_id ---');
const start = performance.now();

// Resolve DB path (same logic as connection.js)
let dbPath;
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.startsWith('sqlite://')) {
    const cleanPath = dbUrl.replace('sqlite://', '').replace('./', '');
    dbPath = path.resolve(__dirname, '..', cleanPath);
} else {
    dbPath = path.join(__dirname, '../database/botarena.db');
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ [Migration] Cannot open database:', err.message);
        process.exit(1);
    }
});

function hasColumn(table, column) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table})`, (err, rows) => {
            if (err) return reject(err);
            resolve(rows.some(r => r.name === column));
        });
    });
}

function runSQL(sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

async function migrate() {
    const tables = ['settings', 'knowledge_base', 'daily_menu'];

    for (const table of tables) {
        const exists = await hasColumn(table, 'company_id');
        if (!exists) {
            await runSQL(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER DEFAULT 1`);
            console.log(`✅ [Migration] Added company_id to "${table}"`);
        } else {
            console.log(`⏭️ [Migration] company_id already exists in "${table}"`);
        }
    }

    const end = performance.now();
    console.log(`\n✅ Migração concluída! Tempo: ${(end - start).toFixed(2)}ms`);

    db.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ [Migration] Error:', err.message);
    db.close();
    process.exit(1);
});
