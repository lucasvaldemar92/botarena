// ==========================================
// 📚 KNOWLEDGE REPOSITORY
// ==========================================
// Encapsulates all SQL for the `knowledge_base` table.

const BaseRepository = require('./BaseRepository');

class KnowledgeRepository extends BaseRepository {
    constructor(db) {
        super(db, 'knowledge_base');
    }

    /**
     * Get all knowledge entries, newest first.
     * @returns {Promise<Array>}
     */
    getAll() {
        return this.findAll('id DESC');
    }

    /**
     * Add a new knowledge entry.
     * @param {string} keyword
     * @param {string} response
     * @param {string} [category='faq']
     * @returns {Promise<Object>} Created entry
     */
    add(keyword, response, category = 'faq') {
        return this.create({ keyword, response, category });
    }

    /**
     * Delete a knowledge entry by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    remove(id) {
        return this.delete(id);
    }

    /**
     * Find the first entry whose keyword is contained in the given text.
     * Performs an in-memory match after fetching all entries.
     * @param {string} text - Normalized (lowercase) message body
     * @returns {Promise<Object|null>}
     */
    findByKeyword(text) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM knowledge_base', (err, rows) => {
                if (err) return reject(err);
                const normalized = text.toLowerCase().trim();
                const match = (rows || []).find(row =>
                    normalized.includes(row.keyword.toLowerCase())
                );
                resolve(match || null);
            });
        });
    }
}

module.exports = KnowledgeRepository;
