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

        // Garante que o diretório do banco de dados exista antes de inicializar o SQLite
        const fs = require('fs');
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this._db = new sqlite3.Database(dbPath, (err) => {
            if (err) console.error('❌ [DB] Error opening SQLite database:', err);
        });

        // Enable WAL mode for better concurrency
        this._db.run('PRAGMA journal_mode=WAL;');
        this._db.run('PRAGMA foreign_keys=ON;');
        this._db.run('ALTER TABLE clients ADD COLUMN neighborhood TEXT;', (err) => {
            // Silently ignore if column already exists or table does not exist yet
        });

        // Adiciona campos de integração do Google e APIs de IA
        ['google_analytics_id', 'google_tag_manager_id', 'google_maps_api_key', 'google_site_verification', 'openai_api_key', 'gemini_api_key'].forEach(col => {
            this._db.run(`ALTER TABLE settings ADD COLUMN ${col} TEXT;`, (err) => {
                // Silently ignore se a coluna já existir
            });
        });

        // Adiciona status de ativação das IAs
        ['openai_active', 'gemini_active'].forEach(col => {
            this._db.run(`ALTER TABLE settings ADD COLUMN ${col} INTEGER DEFAULT 0;`, (err) => {
                // Silently ignore se a coluna já existir
            });
        });

        // Migração para remover a constraint UNIQUE de zip_code na tabela delivery_fees
        this._db.serialize(() => {
            this._db.get(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_delivery_fees_zip'",
                [],
                (err, row) => {
                    if (row) {
                        console.log('📦 [DB Migration] Detectado índice UNIQUE antigo em delivery_fees. Removendo restrição...');
                        
                        this._db.serialize(() => {
                            this._db.run('PRAGMA foreign_keys=OFF;');

                            this._db.run('ALTER TABLE delivery_fees RENAME TO delivery_fees_old;', (errRename) => {
                                if (errRename) {
                                    console.error('❌ [DB Migration] Erro ao renomear tabela:', errRename.message);
                                    return;
                                }

                                this._db.run(`
                                    CREATE TABLE delivery_fees (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        company_id INTEGER DEFAULT 1,
                                        neighborhood TEXT,
                                        address TEXT,
                                        zip_code TEXT,
                                        fee REAL DEFAULT 0.00,
                                        distance_km REAL DEFAULT 0.0,
                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                                    );
                                `, (errCreate) => {
                                    if (errCreate) {
                                        console.error('❌ [DB Migration] Erro ao criar nova tabela:', errCreate.message);
                                        return;
                                    }

                                    this._db.run(`
                                        INSERT INTO delivery_fees (id, company_id, neighborhood, address, zip_code, fee, distance_km, created_at, updated_at)
                                        SELECT id, company_id, neighborhood, address, zip_code, fee, distance_km, created_at, updated_at FROM delivery_fees_old;
                                    `, (errCopy) => {
                                        if (errCopy) {
                                            console.error('❌ [DB Migration] Erro ao copiar dados:', errCopy.message);
                                            return;
                                        }

                                        this._db.run('DROP TABLE delivery_fees_old;');
                                        this._db.run('DROP INDEX IF EXISTS idx_delivery_fees_zip;');
                                        this._db.run('PRAGMA foreign_keys=ON;');

                                        console.log('✅ [DB Migration] Tabela delivery_fees migrada com sucesso (restrição UNIQUE de zip_code removida).');
                                    });
                                });
                            });
                        });
                    }
                }
            );
        });
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
