// ==========================================
// 🔄 MIGRATION SCRIPT: Setup RAG Tables
// ==========================================
// Parses and executes 003_setup_rag_tables.sql against SQLite.

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// // console.log('--- Iniciando Migração: Setup RAG Tables ---');

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

const migrationPath = path.join(__dirname, '../migrations/003_setup_rag_tables.sql');
let migrationSQL;

try {
    migrationSQL = fs.readFileSync(migrationPath, 'utf8');
} catch (err) {
    console.error('❌ [Migration] Cannot read SQL file:', err.message);
    db.close();
    process.exit(1);
}

db.exec(migrationSQL, (err) => {
    if (err) {
        console.error('❌ [Migration] Error executing RAG schema:', err.message);
        db.close();
        process.exit(1);
    }
    // // console.log('✅ [Migration] RAG chunks table created successfully!');
    db.close();
    process.exit(0);
});
