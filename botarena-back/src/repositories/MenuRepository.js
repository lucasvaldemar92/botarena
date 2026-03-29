// ==========================================
// 🍽️ MENU REPOSITORY
// ==========================================
// Encapsulates all SQL for the `daily_menu` table.
// `setNewActive` uses a serialized transaction to guarantee consistency.

const db = require('../db/connection');

const MenuRepository = {
    /**
     * Get the currently active menu entry.
     * @returns {Promise<Object|null>}
     */
    getActive() {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM daily_menu WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1',
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Deactivate all menus and insert a new active one — in a transaction.
     * @param {string} extractedText
     * @param {string|null} [filePath]
     * @returns {Promise<Object>} The new menu entry
     */
    setNewActive(extractedText, filePath = null) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                db.run('UPDATE daily_menu SET is_active = 0', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    db.run(
                        'INSERT INTO daily_menu (file_path, extracted_text, is_active) VALUES (?, ?, 1)',
                        [filePath, extractedText],
                        function (err2) {
                            if (err2) {
                                db.run('ROLLBACK');
                                return reject(err2);
                            }

                            db.run('COMMIT');
                            resolve({
                                id: this.lastID,
                                file_path: filePath,
                                extracted_text: extractedText,
                                is_active: true
                            });
                        }
                    );
                });
            });
        });
    },

    /**
     * Delete a menu entry by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    remove(id) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM daily_menu WHERE id = ?', [id], function (err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    }
};

module.exports = MenuRepository;
