#!/usr/bin/env node
// ==========================================
// 🏗️ CI Database Setup
// Creates a fresh SQLite database and runs all migrations.
// Used exclusively in CI environments where no .db file exists.
// ==========================================

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_DIR  = path.join(__dirname, '..', 'database');
const DB_PATH = path.join(DB_DIR, 'botarena.db');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ [CI Setup] Cannot create database:', err.message);
        process.exit(1);
    }
    console.log('✅ [CI Setup] SQLite database created at:', DB_PATH);
});

function runSQL(sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

async function setup() {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') && !f.startsWith('.'))
        .sort();

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        // Skip empty migration files (like 002_cleanup.sql)
        if (sql.trim().length === 0 || !sql.match(/\b(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i)) {
            console.log(`⏭️ [CI Setup] Skipping ${file} (no executable SQL)`);
            continue;
        }

        try {
            await runSQL(sql);
            console.log(`✅ [CI Setup] Applied ${file}`);
        } catch (err) {
            // ALTER TABLE may fail if column already exists — that's OK
            if (err.message.includes('duplicate column name')) {
                console.log(`⏭️ [CI Setup] ${file} — column already exists, skipping.`);
            } else {
                throw err;
            }
        }
    }

    // Run company_id migration (idempotent)
    const tables = ['settings', 'knowledge_base', 'daily_menu'];
    for (const table of tables) {
        try {
            await runSQL(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER DEFAULT 1`);
            console.log(`✅ [CI Setup] Added company_id to "${table}"`);
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log(`⏭️ [CI Setup] company_id already exists in "${table}"`);
            } else {
                throw err;
            }
        }
    }

    console.log('\n✅ [CI Setup] Database ready for testing.');
    db.close();
    process.exit(0);
}

setup().catch(err => {
    console.error('❌ [CI Setup] Fatal error:', err.message);
    db.close();
    process.exit(1);
});
