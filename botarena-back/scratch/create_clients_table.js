const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/botarena.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Creating clients table...');
    
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        name TEXT,
        birth_date TEXT,
        phone TEXT,
        contact_jid TEXT,
        address TEXT,
        zip_code TEXT,
        notes TEXT,
        source TEXT DEFAULT 'manual',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating table:', err.message);
        else console.log('✅ Clients table created successfully.');
    });
});

db.close();
