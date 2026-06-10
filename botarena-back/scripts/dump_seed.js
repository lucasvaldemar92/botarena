// ==========================================
// 🌱 DUMP SEED DATA SCRIPT
// ==========================================
// Exports all SQLite database contents into database/seed_data.sql.
// Run: node scripts/dump_seed.js

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

console.log(`🔌 [Dump] Conectando ao banco em: ${dbPath}`);
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ [Dump] Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
});

const excludeTables = ['migrations', 'sqlite_sequence'];

db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], async (err, tables) => {
    if (err) {
        console.error('❌ [Dump] Erro ao listar tabelas:', err.message);
        db.close();
        process.exit(1);
    }

    const tableNames = tables.map(t => t.name).filter(name => !excludeTables.includes(name));
    let sqlContent = `-- ==========================================\n`;
    sqlContent += `-- 🌱 DATABASE PRODUCTION/SIMULATION SEED DATA\n`;
    sqlContent += `-- Generated automatically to restore simulated state\n`;
    sqlContent += `-- ==========================================\n\n`;
    sqlContent += `PRAGMA foreign_keys=OFF;\n\n`;

    try {
        for (const table of tableNames) {
            sqlContent += `DELETE FROM ${table};\n`;
            
            const rows = await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM ${table}`, [], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            if (!rows || rows.length === 0) {
                sqlContent += `-- Table ${table} is empty\n\n`;
                continue;
            }

            sqlContent += `-- Seeding table ${table} (${rows.length} rows)\n`;

            const columns = await new Promise((resolve, reject) => {
                db.all(`PRAGMA table_info(${table})`, [], (err, result) => {
                    if (err) reject(err);
                    else resolve(result.map(c => c.name));
                });
            });

            const colsStr = columns.join(', ');

            for (const row of rows) {
                const vals = [];
                for (const col of columns) {
                    const val = row[col];
                    if (val === null || val === undefined) {
                        vals.append ? vals.append("NULL") : vals.push("NULL");
                    } else if (typeof val === 'number') {
                        vals.push(String(val));
                    } else {
                        const escaped = String(val).replace(/'/g, "''");
                        vals.push(`'${escaped}'`);
                    }
                }
                const valsStr = vals.join(', ');
                sqlContent += `INSERT INTO ${table} (${colsStr}) VALUES (${valsStr});\n`;
            }
            sqlContent += `\n`;
        }

        sqlContent += `PRAGMA foreign_keys=ON;\n`;
        fs.writeFileSync(seedPath, sqlContent, 'utf8');
        console.log(`✅ [Dump] Estado do banco exportado com sucesso para: ${seedPath}`);
        db.close();
    } catch (e) {
        console.error('❌ [Dump] Erro ao gerar dump:', e.message);
        db.close();
        process.exit(1);
    }
});
