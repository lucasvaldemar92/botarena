const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

console.log('--- Iniciando Migração: 011_delivery_fees_distance ---');

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

function allSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function getFallbackDistance(address, zipCode) {
    const str = (address + zipCode).replace(/\D/g, '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const distance = 1.0 + (Math.abs(hash) % 150) / 10;
    return parseFloat(distance.toFixed(2));
}

async function migrate() {
    const exists = await hasColumn('delivery_fees', 'distance_km');
    if (!exists) {
        await runSQL('ALTER TABLE delivery_fees ADD COLUMN distance_km REAL DEFAULT 0.0');
        console.log('✅ [Migration] Added "distance_km" to "delivery_fees"');
    } else {
        console.log('⏭️ [Migration] "distance_km" already exists in "delivery_fees"');
    }

    // Calcula e atualiza os registros existentes
    const fees = await allSQL('SELECT id, neighborhood, zip_code FROM delivery_fees');
    console.log(`📦 [Migration] Found ${fees.length} delivery fee records to update.`);

    for (const item of fees) {
        const distance = getFallbackDistance(item.neighborhood || '', item.zip_code || '');
        await runSQL('UPDATE delivery_fees SET distance_km = ? WHERE id = ?', [distance, item.id]);
        console.log(`🔹 [Migration] Updated fee ID ${item.id} (${item.neighborhood}): ${distance} km`);
    }

    console.log('🎉 Migração concluída com sucesso!');
    db.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ [Migration] Error:', err.message);
    db.close();
    process.exit(1);
});
