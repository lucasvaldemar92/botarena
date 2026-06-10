// ==========================================
// 🌱 LOAD SEED DATA SCRIPT
// ==========================================
// Reads database/seed_data.sql and applies it to the SQLite database.
// Run: node scripts/load_seed.js

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

let dbPath;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl && dbUrl.startsWith('sqlite://')) {
    const cleanPath = dbUrl.replace('sqlite://', '').replace('./', '');
    dbPath = path.resolve(__dirname, '../', cleanPath);
} else {
    dbPath = path.join(__dirname, '../database/botarena.db');
}

const seedPath = path.join(__dirname, '../database/seed_data.sql');

if (!fs.existsSync(seedPath)) {
    console.error(`❌ [Seed] seed_data.sql não encontrado em ${seedPath}`);
    process.exit(1);
}

console.log(`🔌 [Seed] Conectando ao banco em: ${dbPath}`);
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ [Seed] Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
});

// Read and execute the SQL file
const sql = fs.readFileSync(seedPath, 'utf8');

// SQLite doesn't support executing multiple statements via db.run, so we use db.exec
db.exec(sql, (err) => {
    if (err) {
        console.error('❌ [Seed] Erro ao carregar dados do seed:', err.message);
        db.close();
        process.exit(1);
    }
    console.log('✅ [Seed] Dados do seed de simulação/produção carregados com sucesso!');
    db.close();
});
