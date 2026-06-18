// ==========================================
// 🛡️ USER REPOSITORY
// ==========================================
// CRUD decoupled from auth logic.
// Wraps SQLite queries for the `users` table.
// Inherits multi-tenant filtering from BaseRepository.
// password_hash is NEVER returned in list queries.

const BaseRepository = require('./BaseRepository');

class UserRepository extends BaseRepository {
    /**
     * @param {object} db        - The database driver (SQLite or Postgres)
     * @param {number} companyId - The tenant ID (default: 1 for single-tenant)
     */
    constructor(db, companyId = 1) {
        super(db, 'users', companyId);
    }

    /**
     * Find a single user by email within the current tenant.
     * Returns password_hash for authentication comparison.
     * @param {string} email
     * @returns {Promise<Object|undefined>}
     */
    async findByEmail(email) {
        return this.db.get(
            `SELECT id, company_id, name, email, password_hash, role, is_active, last_login_at, created_at
             FROM users
             WHERE company_id = ? AND email = ? COLLATE NOCASE`,
            [this.companyId, email.trim().toLowerCase()]
        );
    }

    /**
     * Update last_login_at timestamp to NOW for the given user id.
     * @param {number} id
     * @returns {Promise<void>}
     */
    async touchLastLogin(id) {
        await this.db.run(
            `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE company_id = ? AND id = ?`,
            [this.companyId, id]
        );
    }

    /**
     * List all users for the current tenant.
     * Excludes password_hash from results for security.
     * @returns {Promise<Array>}
     */
    async listAll() {
        return this.db.all(
            `SELECT id, company_id, name, email, role, is_active, last_login_at, created_at, updated_at
             FROM users
             WHERE company_id = ?
             ORDER BY id ASC`,
            [this.companyId]
        );
    }

    /**
     * Create a new user with hashed password and role.
     * @param {object} data - { name, email, password_hash, role }
     * @returns {Promise<Object>} The new user (without password_hash)
     */
    async create(data) {
        const { name, email, password_hash, role = 'basico' } = data;

        const result = await this.db.run(
            `INSERT INTO users (company_id, name, email, password_hash, role, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [this.companyId, name, email.trim().toLowerCase(), password_hash, role]
        );

        return { id: result.lastID, name, email: email.trim().toLowerCase(), role, is_active: 1 };
    }

    /**
     * Update a user's profile fields (name, role).
     * Does NOT update password — use a dedicated changePassword method for that.
     * @param {number} id
     * @param {object} data - { name?, role? }
     * @returns {Promise<number>} Number of rows changed
     */
    async update(id, data) {
        const allowed = ['name', 'role'];
        const fields  = Object.keys(data).filter(k => allowed.includes(k));

        if (fields.length === 0) return 0;

        const setClauses = fields.map(f => `${f} = ?`).join(', ');
        const values     = [...fields.map(f => data[f]), this.companyId, id];

        const result = await this.db.run(
            `UPDATE users SET ${setClauses} WHERE company_id = ? AND id = ?`,
            values
        );
        return result.changes;
    }

    /**
     * Update password hash for a user.
     * @param {number} id
     * @param {string} newPasswordHash
     * @returns {Promise<number>} Number of rows changed
     */
    async updatePassword(id, newPasswordHash) {
        const result = await this.db.run(
            `UPDATE users SET password_hash = ? WHERE company_id = ? AND id = ?`,
            [newPasswordHash, this.companyId, id]
        );
        return result.changes;
    }

    /**
     * Toggle the is_active flag for a user.
     * @param {number} id
     * @returns {Promise<number>} Number of rows changed
     */
    async toggleActive(id) {
        const result = await this.db.run(
            `UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
             WHERE company_id = ? AND id = ?`,
            [this.companyId, id]
        );
        return result.changes;
    }

    /**
     * Hard-delete a user by id within the current tenant.
     * @param {number} id
     * @returns {Promise<number>} Number of rows deleted
     */
    async delete(id) {
        const result = await this.db.run(
            `DELETE FROM users WHERE company_id = ? AND id = ?`,
            [this.companyId, id]
        );
        return result.changes;
    }
}

module.exports = UserRepository;
