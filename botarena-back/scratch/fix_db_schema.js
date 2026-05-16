const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/botarena.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Checking daily_menu table structure...');
    
    // Add company_id if missing
    db.run("ALTER TABLE daily_menu ADD COLUMN company_id INTEGER DEFAULT 1", (err) => {
        if (err) console.log('company_id might already exist or error:', err.message);
        else console.log('Added company_id column.');
    });

    // Add mimetype if missing
    db.run("ALTER TABLE daily_menu ADD COLUMN mimetype TEXT", (err) => {
        if (err) console.log('mimetype might already exist or error:', err.message);
        else console.log('Added mimetype column.');
    });

    // Add base64_data if missing
    db.run("ALTER TABLE daily_menu ADD COLUMN base64_data TEXT", (err) => {
        if (err) console.log('base64_data might already exist or error:', err.message);
        else console.log('Added base64_data column.');
    });

    console.log('Database migration finished.');
});

db.close();
