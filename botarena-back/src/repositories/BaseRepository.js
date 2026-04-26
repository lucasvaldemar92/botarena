// ==========================================
// 🏗️ BASE REPOSITORY
// ==========================================
// Abstract base class providing generic CRUD operations.
// All domain repositories extend this class.
// The `db` driver and `companyId` are injected via the constructor.
// All queries filter by `company_id` for multi-tenant readiness.

class BaseRepository {
    /**
     * @param {object} db         - The database driver (SQLite or Postgres)
     * @param {string} tableName  - The table this repository manages
     * @param {number} companyId  - The tenant ID (default: 1 for single-tenant)
     */
    constructor(db, tableName, companyId = 1) {
        this.db = db;
        this.tableName = tableName;
        this.companyId = companyId;
    }

    /**
     * Find a single row by ID within the current tenant.
     * @param {number|string} id
     * @returns {Promise<Object|undefined>}
     */
    async findById(id) {
        return this.db.get(
            `SELECT * FROM ${this.tableName} WHERE company_id = ? AND id = ?`,
            [this.companyId, id]
        );
    }

    /**
     * Find all rows for the current tenant, optionally ordered.
     * @param {string} [orderBy='id ASC'] - ORDER BY clause
     * @returns {Promise<Array>}
     */
    async findAll(orderBy = 'id ASC') {
        return this.db.all(
            `SELECT * FROM ${this.tableName} WHERE company_id = ? ORDER BY ${orderBy}`,
            [this.companyId]
        );
    }

    /**
     * Insert a new row, automatically tagging with company_id.
     * @param {Object} data - Column-value pairs to insert
     * @returns {Promise<Object>} The inserted data with its new ID
     */
    async create(data) {
        const dataWithCompany = { company_id: this.companyId, ...data };
        const columns = Object.keys(dataWithCompany);
        const placeholders = columns.map(() => '?').join(', ');
        const values = Object.values(dataWithCompany);

        const result = await this.db.run(
            `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return { id: result.lastID, ...data };
    }

    /**
     * Update a row by ID within the current tenant.
     * @param {number|string} id
     * @param {Object} data - Column-value pairs to update
     * @returns {Promise<number>} Number of rows changed
     */
    async update(id, data) {
        const columns = Object.keys(data);
        const setClauses = columns.map(col => `${col} = ?`).join(', ');
        const values = [...Object.values(data), this.companyId, id];

        const result = await this.db.run(
            `UPDATE ${this.tableName} SET ${setClauses} WHERE company_id = ? AND id = ?`,
            values
        );
        return result.changes;
    }

    /**
     * Delete a row by ID within the current tenant.
     * @param {number|string} id
     * @returns {Promise<number>} Number of rows deleted
     */
    async delete(id) {
        const result = await this.db.run(
            `DELETE FROM ${this.tableName} WHERE company_id = ? AND id = ?`,
            [this.companyId, id]
        );
        return result.changes;
    }
}

module.exports = BaseRepository;
