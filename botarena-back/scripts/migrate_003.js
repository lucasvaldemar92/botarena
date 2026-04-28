const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

console.log('--- Iniciando Migração: 003_menu_asset ---');

let dbPath;
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.startsWith('sqlite://')) {
    const cleanPath = dbUrl.replace('sqlite://', '').replace('./', '');
    dbPath = path.resolve(__dirname, '..', cleanPath);
} else {
    dbPath = path.join(__dirname, '../database/botarena.db');
}

const db = new sqlite3.Database(dbPath);

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
        { name: 'mimetype', type: 'TEXT' },
        { name: 'base64_data', type: 'TEXT' }
    ];

    for (const col of columns) {
        const exists = await hasColumn('daily_menu', col.name);
        if (!exists) {
            await runSQL(`ALTER TABLE daily_menu ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ [Migration] Added ${col.name} to "daily_menu"`);
        } else {
            console.log(`⏭️ [Migration] ${col.name} already exists in "daily_menu"`);
        }
    }

    console.log('✅ Migração concluída!');
    db.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ [Migration] Error:', err.message);
    db.close();
    process.exit(1);
});
