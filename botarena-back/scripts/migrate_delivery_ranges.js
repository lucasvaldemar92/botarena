#!/usr/bin/env node
// 🔄 MIGRATION SCRIPT: Create delivery_ranges table
// Run: node scripts/migrate_delivery_ranges.js

const path = require('path');
const fs   = require('fs');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

console.log('--- Iniciando Migração: 013_create_delivery_ranges ---');

let dbPath;
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.startsWith('sqlite://')) {
    const cleanPath = dbUrl.replace('sqlite://', '').replace('./', '');
    dbPath = path.resolve(__dirname, '..', cleanPath);
} else {
    dbPath = path.join(__dirname, '../database/botarena.db');
}

let db;
try {
    db = new sqlite3.Database(dbPath);
    console.log(`📦 [Migration] Opened database at: ${dbPath}`);
} catch (err) {
    console.error('❌ [Migration] Cannot open database:', err.message);
    process.exit(1);
}

// ── Read SQL file ──
const migrationPath = path.join(__dirname, '../migrations/013_create_delivery_ranges.sql');
let migrationSQL;
try {
    migrationSQL = fs.readFileSync(migrationPath, 'utf8');
} catch (err) {
    console.error('❌ [Migration] Cannot read SQL file:', err.message);
    process.exit(1);
}

// ── Execute ──
db.exec(migrationSQL, (err) => {
    if (err) {
        console.error('❌ [Migration] Error executing delivery_ranges schema:', err.message);
    } else {
        console.log('✅ [Migration] delivery_ranges table created/verified successfully!');
    }
    db.close();
});
