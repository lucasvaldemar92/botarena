const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database/botarena.db');

db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'", (err, rows) => {
    if (err) {
        console.error('❌ Erro ao verificar tabelas:', err);
    } else if (rows.length === 0) {
        console.log('⚠️ A tabela "clients" NÃO EXISTE no banco de dados!');
    } else {
        console.log('✅ A tabela "clients" existe.');
        db.all("PRAGMA table_info(clients)", (err, columns) => {
            console.log('--- Estrutura da tabela ---');
            columns.forEach(c => console.log(`${c.name} (${c.type})`));
        });
    }
    db.close();
});
