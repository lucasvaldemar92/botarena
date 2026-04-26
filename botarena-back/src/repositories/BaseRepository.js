// ==========================================
// 🏗️ BASE REPOSITORY
// ==========================================
// Abstract base class providing generic CRUD operations.
// All domain repositories extend this class.
// The `db` connection is injected via the constructor for testability.

class BaseRepository {
    /**
     * @param {sqlite3.Database} db - The SQLite database connection
     * @param {string} tableName    - The table this repository manages
     */
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }

    /**
     * Find a single row by ID.
     * @param {number|string} id
     * @returns {Promise<Object|undefined>}
     */
    findById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM ${this.tableName} WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    /**
     * Find all rows, optionally ordered.
     * @param {string} [orderBy='id ASC'] - ORDER BY clause
     * @returns {Promise<Array>}
     */
    findAll(orderBy = 'id ASC') {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM ${this.tableName} ORDER BY ${orderBy}`,
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Insert a new row.
     * @param {Object} data - Column-value pairs to insert
     * @returns {Promise<Object>} The inserted data with its new ID
     */
    create(data) {
        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(', ');
        const values = Object.values(data);

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID, ...data });
                }
            );
        });
    }

    /**
     * Update a row by ID with the given data.
     * @param {number|string} id
     * @param {Object} data - Column-value pairs to update
     * @returns {Promise<number>} Number of rows changed
     */
    update(id, data) {
        const columns = Object.keys(data);
        const setClauses = columns.map(col => `${col} = ?`).join(', ');
        const values = [...Object.values(data), id];

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE ${this.tableName} SET ${setClauses} WHERE id = ?`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });
    }

    /**
     * Delete a row by ID.
     * @param {number|string} id
     * @returns {Promise<number>} Number of rows deleted
     */
    delete(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM ${this.tableName} WHERE id = ?`,
                [id],
                function (err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });
    }
}

module.exports = BaseRepository;
