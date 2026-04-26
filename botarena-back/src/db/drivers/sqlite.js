// ==========================================
// 🗄️ SQLITE DRIVER (Promise-based wrapper)
// ==========================================
// Wraps the callback-based sqlite3 API into a standardized Promise interface.
// All repositories use this driver via BaseRepository — never the raw sqlite3 API.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class SQLiteDriver {
    constructor() {
        let dbPath;
        const dbUrl = process.env.DATABASE_URL;

        if (dbUrl && dbUrl.startsWith('sqlite://')) {
            const cleanPath = dbUrl.replace('sqlite://', '').replace('./', '');
            dbPath = path.resolve(__dirname, '../../../', cleanPath);
        } else {
            dbPath = path.join(__dirname, '../../../database/botarena.db');
        }

        this._db = new sqlite3.Database(dbPath, (err) => {
            if (err) console.error('❌ [DB] Error opening SQLite database:', err);
            else console.log('✅ [DB] Connected to SQLite database.');
        });

        // Enable WAL mode for better concurrency
        this._db.run('PRAGMA journal_mode=WAL;');
        this._db.run('PRAGMA foreign_keys=ON;');
    }

    /**
     * Fetch a single row.
     * @param {string} sql
     * @param {Array}  [params=[]]
     * @returns {Promise<Object|undefined>}
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this._db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    /**
     * Fetch all matching rows.
     * @param {string} sql
     * @param {Array}  [params=[]]
     * @returns {Promise<Array>}
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this._db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Execute an INSERT/UPDATE/DELETE statement.
     * @param {string} sql
     * @param {Array}  [params=[]]
     * @returns {Promise<{lastID: number, changes: number}>}
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this._db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    /**
     * Execute a function inside a BEGIN/COMMIT transaction.
     * Rolls back automatically on error.
     * @param {Function} fn - Async function containing the transactional operations
     * @returns {Promise<*>} Return value of fn
     */
    async transaction(fn) {
        await this.run('BEGIN TRANSACTION');
        try {
            const result = await fn();
            await this.run('COMMIT');
            return result;
        } catch (err) {
            await this.run('ROLLBACK');
            throw err;
        }
    }

    /**
     * Close the database connection.
     * @returns {Promise<void>}
     */
    close() {
        return new Promise((resolve, reject) => {
            this._db.close((err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }
}

module.exports = new SQLiteDriver();
