// ==========================================
// 📚 KNOWLEDGE REPOSITORY
// ==========================================
// Encapsulates all SQL for the `knowledge_base` table.

const BaseRepository = require('./BaseRepository');

class KnowledgeRepository extends BaseRepository {
    constructor(db, companyId) {
        super(db, 'knowledge_base', companyId);
    }

    /**
     * Get all knowledge entries for this tenant, newest first.
     * @returns {Promise<Array>}
     */
    async getAll() {
        return this.findAll('id DESC');
    }

    /**
     * Add a new knowledge entry.
     * @param {string} keyword
     * @param {string} response
     * @param {string} [category='faq']
     * @returns {Promise<Object>} Created entry
     */
    async add(keyword, response, category = 'faq') {
        return this.create({ keyword, response, category });
    }

    /**
     * Delete a knowledge entry by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    async remove(id) {
        return this.delete(id);
    }

    /**
     * Find the first entry whose keyword is contained in the given text.
     * Scoped to the current tenant. Performs an in-memory match.
     * @param {string} text - Normalized (lowercase) message body
     * @returns {Promise<Object|null>}
     */
    async findByKeyword(text) {
        const rows = await this.db.all(
            'SELECT * FROM knowledge_base WHERE company_id = ?',
            [this.companyId]
        );
        const normalized = text.toLowerCase().trim();
        const match = rows.find(row =>
            normalized.includes(row.keyword.toLowerCase())
        );
        return match || null;
    }
}

module.exports = KnowledgeRepository;
