// ==========================================
// 🔄 MIGRATION: Add operation hours to settings
// ==========================================
// Idempotent — safe to run multiple times.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// // console.log('--- Iniciando Migração: Horário de Operação ---');
const start = performance.now();

// Resolve DB path
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
    const columns = [
        { name: 'operation_days', type: 'TEXT DEFAULT "1,2,3,4,5"' },
        { name: 'operation_start', type: 'TEXT DEFAULT "08:00"' },
        { name: 'operation_end', type: 'TEXT DEFAULT "18:00"' },
        { name: 'mensagem_ausencia', type: 'TEXT DEFAULT "No momento estamos fora do horário de atendimento. Deixe sua mensagem e retornaremos em breve."' }
    ];

    for (const col of columns) {
        const exists = await hasColumn('settings', col.name);
        if (!exists) {
            await runSQL(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
            // // console.log(`✅ [Migration] Added ${col.name} to "settings"`);
        } else {
            // // console.log(`⏭️ [Migration] ${col.name} already exists in "settings"`);
        }
    }

    const end = performance.now();
    // // console.log(`\n✅ Migração concluída! Tempo: ${(end - start).toFixed(2)}ms`);

    db.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ [Migration] Error:', err.message);
    db.close();
    process.exit(1);
});
