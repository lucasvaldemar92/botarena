// ==========================================
// 🗄️ DB CONNECTION FACTORY
// ==========================================
// Loads the appropriate driver based on DB_TYPE environment variable.
// Both drivers expose the same Promise-based interface:
//   get(sql, params), all(sql, params), run(sql, params), transaction(fn), close()

const DB_TYPE = process.env.DB_DRIVER || process.env.DB_TYPE || 'sqlite';

let driver;
if (DB_TYPE === 'postgres') {
    driver = require('./drivers/postgres');
} else {
    driver = require('./drivers/sqlite');
}

console.log(`📦 [DB] Driver loaded: ${DB_TYPE}`);

module.exports = driver;
