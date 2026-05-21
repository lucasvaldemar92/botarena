const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

console.log('--- Iniciando Migração: Delivery Fees & Client Number ---');

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
    // 1. Alter clients table to add number if not exists
    const hasNumber = await hasColumn('clients', 'number');
    if (!hasNumber) {
        await runSQL('ALTER TABLE clients ADD COLUMN number TEXT');
        console.log('✅ [Migration] Added "number" column to "clients" table.');
    } else {
        console.log('⏭️ [Migration] Column "number" already exists in "clients" table.');
    }

    // 2. Create delivery_fees table
    await runSQL(`
        CREATE TABLE IF NOT EXISTS delivery_fees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER DEFAULT 1,
            neighborhood TEXT,
            zip_code TEXT UNIQUE,
            fee REAL DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ [Migration] Table "delivery_fees" created/verified.');

    // 3. Create index on zip_code
    await runSQL('CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_fees_zip ON delivery_fees (zip_code)');
    console.log('✅ [Migration] Unique index on "zip_code" created/verified.');

    // 4. Seed initial static values if table is empty
    const countRow = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM delivery_fees', (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });

    if (countRow.count === 0) {
        await runSQL(`
            INSERT INTO delivery_fees (id, company_id, neighborhood, zip_code, fee) VALUES
            (1, 1, 'Centro', '87055-520', 5.00),
            (2, 1, 'Jardim América', '15084-120', 7.50),
            (3, 1, 'Vila Nova', '12345-000', 10.00)
        `);
        console.log('✅ [Migration] Seeded initial data into "delivery_fees".');
    } else {
        console.log('⏭️ [Migration] Table "delivery_fees" already has data, skipping seed.');
    }

    console.log('✅ Migração finalizada com sucesso!');
    db.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ [Migration] Error:', err.message);
    db.close();
    process.exit(1);
});
