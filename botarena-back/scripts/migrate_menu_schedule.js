const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

console.log('--- Iniciando Migração: 010_menu_activation_and_schedule ---');

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

function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

async function migrate() {
    const columns = [
        { name: 'menu_lunch_active', type: 'BOOLEAN DEFAULT 1' },
        { name: 'menu_lunch_start', type: "TEXT DEFAULT '10:00'" },
        { name: 'menu_lunch_end', type: "TEXT DEFAULT '14:00'" },
        { name: 'menu_acai_active', type: 'BOOLEAN DEFAULT 1' },
        { name: 'menu_acai_start', type: "TEXT DEFAULT '14:00'" },
        { name: 'menu_acai_end', type: "TEXT DEFAULT '22:00'" },
        { name: 'menu_events_active', type: 'BOOLEAN DEFAULT 1' },
        { name: 'menu_events_start', type: "TEXT DEFAULT '08:00'" },
        { name: 'menu_events_end', type: "TEXT DEFAULT '22:00'" }
    ];

    for (const col of columns) {
        const exists = await hasColumn('settings', col.name);
        if (!exists) {
            await runSQL(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ [Migration] Added ${col.name} to "settings"`);
        } else {
            console.log(`⏭️ [Migration] ${col.name} already exists in "settings"`);
        }
    }

    // Garante que os valores padrão estejam populados para id = 1
    await runSQL(`
        UPDATE settings 
        SET menu_lunch_active = COALESCE(menu_lunch_active, 1), 
            menu_lunch_start = COALESCE(menu_lunch_start, '10:00'), 
            menu_lunch_end = COALESCE(menu_lunch_end, '14:00'),
            menu_acai_active = COALESCE(menu_acai_active, 1), 
            menu_acai_start = COALESCE(menu_acai_start, '14:00'), 
            menu_acai_end = COALESCE(menu_acai_end, '22:00'),
            menu_events_active = COALESCE(menu_events_active, 1), 
            menu_events_start = COALESCE(menu_events_start, '08:00'), 
            menu_events_end = COALESCE(menu_events_end, '22:00')
        WHERE id = 1
    `);
    console.log('✅ [Migration] Default settings populated for company ID 1');

    console.log('🎉 Migração concluída com sucesso!');
    db.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ [Migration] Error:', err.message);
    db.close();
    process.exit(1);
});
