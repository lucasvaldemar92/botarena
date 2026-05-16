const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database/botarena.db');
db.all("SELECT sql FROM sqlite_master WHERE name='clients'", (err, rows) => {
    if (err) console.error(err);
    console.log(rows[0].sql);
    db.close();
});
