const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database/botarena.db');

db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone) WHERE phone IS NOT NULL`,
    (err) => {
        if (err) console.error('❌ Erro:', err.message);
        else console.log('✅ UNIQUE INDEX em clients.phone criado com sucesso!');
        db.close();
    }
);
