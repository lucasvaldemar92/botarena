const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

console.log('--- Iniciando Migração: 012_delivery_fees_address ---');

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

// Auxiliar para fazer fetch assíncrono (compatível com Node 18+)
async function fetchViaCep(cep) {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return null;
    
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (res.ok) {
            const data = await res.json();
            if (data && !data.erro) {
                return data;
            }
        }
    } catch (e) {
        console.error(`⚠️ [ViaCEP] Erro ao buscar CEP ${cep}:`, e.message);
    }
    return null;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function migrate() {
    const exists = await hasColumn('delivery_fees', 'address');
    if (!exists) {
        await runSQL('ALTER TABLE delivery_fees ADD COLUMN address TEXT');
        console.log('✅ [Migration] Added "address" to "delivery_fees"');
    } else {
        console.log('⏭️ [Migration] "address" already exists in "delivery_fees"');
    }

    // Busca todos os registros do banco de dados
    const fees = await allSQL('SELECT id, neighborhood, zip_code FROM delivery_fees');
    console.log(`📦 [Migration] Found ${fees.length} delivery fee records to update.`);

    for (const item of fees) {
        const cleanCep = (item.zip_code || '').replace(/\D/g, '');
        let street = null;
        
        if (cleanCep) {
            console.log(`🔍 [Migration] Buscando CEP ${item.zip_code} no ViaCEP...`);
            const data = await fetchViaCep(cleanCep);
            if (data && data.logradouro) {
                street = data.logradouro;
                console.log(`📍 [Migration] Encontrado via CEP: "${street}"`);
            }
            // Delay pequeno para respeitar limites do ViaCEP
            await sleep(250);
        }

        // Fallback caso não encontre ou falhe
        if (!street) {
            street = `Rua Principal, ${item.neighborhood || 'Bairro'}`;
            console.log(`⚠️ [Migration] Fallback para ID ${item.id}: "${street}"`);
        }

        await runSQL('UPDATE delivery_fees SET address = ? WHERE id = ?', [street, item.id]);
        console.log(`🔹 [Migration] Updated ID ${item.id} with address: "${street}"`);
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
