// ==========================================
// 🗄️ DB CONNECTION SINGLETON
// ==========================================
// Node's module cache ensures only one db instance is ever created.
// All repositories import from here.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config(); // Ensure dotenv loads if running outside Docker

let dbPath;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl && dbUrl.startsWith('sqlite://')) {
    // Basic SQLite abstraction
    const cleanPath = dbUrl.replace('sqlite://', '').replace('./', '');
    dbPath = path.resolve(__dirname, '../../', cleanPath);
} else {
    // Default fallback
    dbPath = path.join(__dirname, '../../database/botarena.db');
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ [DB] Error opening database:', err);
    else console.log(`✅ [DB] Connected to database using env string.`);
});

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode=WAL;');
db.run('PRAGMA foreign_keys=ON;');

module.exports = db;
