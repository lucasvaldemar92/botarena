// ==========================================
// 🐘 POSTGRES DRIVER (Placeholder)
// ==========================================
// Implements the same Promise-based interface as SQLiteDriver.
// Requires `npm install pg` before use.
//
// Activate by setting: DB_TYPE=postgres in .env
// Connection string:   DATABASE_URL=postgres://user:pass@host:5432/dbname

class PostgresDriver {
    constructor() {
        // Lazy-load pg to avoid crash when not installed
        try {
            const { Pool } = require('pg');
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
            });
            console.log('✅ [DB] Connected to PostgreSQL database.');
        } catch {
            console.warn('⚠️ [DB] PostgreSQL driver loaded but `pg` package is not installed.');
            console.warn('    Run: npm install pg');
            this.pool = null;
        }
    }

    _ensurePool() {
        if (!this.pool) throw new Error('PostgreSQL pool not initialized. Install pg: npm install pg');
    }

    /**
     * Fetch a single row.
     * @param {string} sql   - Use $1, $2... placeholders (Postgres style)
     * @param {Array}  [params=[]]
     * @returns {Promise<Object|undefined>}
     */
    async get(sql, params = []) {
        this._ensurePool();
        const pgSql = this._convertPlaceholders(sql);
        const { rows } = await this.pool.query(pgSql, params);
        return rows[0];
    }

    /**
     * Fetch all matching rows.
     * @param {string} sql
     * @param {Array}  [params=[]]
     * @returns {Promise<Array>}
     */
    async all(sql, params = []) {
        this._ensurePool();
        const pgSql = this._convertPlaceholders(sql);
        const { rows } = await this.pool.query(pgSql, params);
        return rows || [];
    }

    /**
     * Execute an INSERT/UPDATE/DELETE statement.
     * @param {string} sql
     * @param {Array}  [params=[]]
     * @returns {Promise<{lastID: number, changes: number}>}
     */
    async run(sql, params = []) {
        this._ensurePool();
        let pgSql = this._convertPlaceholders(sql);

        // Auto-append RETURNING id for INSERTs to get lastID
        const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
        if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
            pgSql += ' RETURNING id';
        }

        const result = await this.pool.query(pgSql, params);
        return {
            lastID:  isInsert ? result.rows?.[0]?.id : undefined,
            changes: result.rowCount
        };
    }

    /**
     * Execute a function inside a BEGIN/COMMIT transaction.
     * @param {Function} fn - Async function containing the transactional operations
     * @returns {Promise<*>}
     */
    async transaction(fn) {
        this._ensurePool();
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn();
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Convert SQLite-style `?` placeholders to Postgres-style `$1, $2, ...`
     * @param {string} sql
     * @returns {string}
     */
    _convertPlaceholders(sql) {
        let i = 0;
        return sql.replace(/\?/g, () => `$${++i}`);
    }

    /**
     * Close the connection pool.
     * @returns {Promise<void>}
     */
    async close() {
        if (this.pool) await this.pool.end();
    }
}

module.exports = new PostgresDriver();
