// ==========================================
// 📚 KNOWLEDGE REPOSITORY
// ==========================================
// Encapsulates all SQL for the `knowledge_base` table.

const db = require('../db/connection');

const KnowledgeRepository = {
    /**
     * Get all knowledge entries, newest first.
     * @returns {Promise<Array>}
     */
    getAll() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM knowledge_base ORDER BY id DESC', (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Add a new knowledge entry.
     * @param {string} keyword
     * @param {string} response
     * @param {string} [category='faq']
     * @returns {Promise<Object>} Created entry
     */
    add(keyword, response, category = 'faq') {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO knowledge_base (keyword, response, category) VALUES (?, ?, ?)',
                [keyword, response, category],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID, keyword, response, category });
                }
            );
        });
    },

    /**
     * Delete a knowledge entry by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    remove(id) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM knowledge_base WHERE id = ?', [id], function (err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    },

    /**
     * Find the first entry whose keyword is contained in the given text.
     * Performs an in-memory match after fetching all entries.
     * @param {string} text - Normalized (lowercase) message body
     * @returns {Promise<Object|null>}
     */
    findByKeyword(text) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM knowledge_base', (err, rows) => {
                if (err) return reject(err);
                const normalized = text.toLowerCase().trim();
                const match = (rows || []).find(row =>
                    normalized.includes(row.keyword.toLowerCase())
                );
                resolve(match || null);
            });
        });
    }
};

module.exports = KnowledgeRepository;
