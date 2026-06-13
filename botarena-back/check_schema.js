const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, './database/botarena.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
});

db.all("PRAGMA table_info(clients)", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("COLUNAS DE CLIENTS:");
        console.log(rows.map(r => `${r.name} (${r.type})`));
    }
    db.close();
});
