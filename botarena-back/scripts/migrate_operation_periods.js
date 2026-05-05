// ==========================================
// 🔄 MIGRATION: Add operation_periods to settings
// ==========================================
// Adds `operation_periods` column to store JSON array of shifts.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

console.log('--- Iniciando Migração: operation_periods ---');
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
    const colName = 'operation_periods';
    const colType = 'TEXT DEFAULT "[]"';

    const exists = await hasColumn('settings', colName);
    if (!exists) {
        await runSQL(`ALTER TABLE settings ADD COLUMN ${colName} ${colType}`);
        console.log(`✅ [Migration] Added ${colName} to "settings"`);
    } else {
        console.log(`⏭️ [Migration] ${colName} already exists in "settings"`);
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
