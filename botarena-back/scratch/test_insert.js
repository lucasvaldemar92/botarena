const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database/botarena.db');

const data = {
    company_id: 1,
    name: 'Teste Lucas',
    birth_date: '1990-01-01',
    phone: '44999824696',
    contact_jid: null,
    address: 'Rua Teste',
    zip_code: '00000-000',
    notes: 'Nota teste',
    source: 'manual',
    is_active: 1
};

const columns = Object.keys(data);
const placeholders = columns.map(() => '?').join(', ');
const values = Object.values(data);
const sql = `INSERT INTO clients (${columns.join(', ')}) VALUES (${placeholders})`;

console.log('SQL:', sql);
console.log('Values:', values);

db.run(sql, values, function(err) {
    if (err) {
        console.error('❌ ERRO NO SQLITE:', err.message);
    } else {
        console.log('✅ Inserido com sucesso! ID:', this.lastID);
    }
    db.close();
});
