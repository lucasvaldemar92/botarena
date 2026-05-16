// ==========================================
// 🍽️ MENU REPOSITORY
// ==========================================
// Encapsulates all SQL for the `daily_menu` table.
// `setNewActive` uses the driver's transaction() method for consistency.

const BaseRepository = require('./BaseRepository');

class MenuRepository extends BaseRepository {
    constructor(db, companyId) {
        super(db, 'daily_menu', companyId);
    }

    /**
     * Get the currently active menu entry for this tenant, including binary data.
     * @returns {Promise<Object|null>}
     */
    async getActive(slot = 'lunch') {
        const row = await this.db.get(
            'SELECT * FROM daily_menu WHERE company_id = ? AND is_active = 1 AND slot = ? ORDER BY created_at DESC LIMIT 1',
            [this.companyId, slot]
        );
        return row || null;
    }

    /**
     * Alias for getActive() for asset-focused calls.
     */
    async getLatestAsset(slot = 'lunch') {
        return this.getActive(slot);
    }

    /**
     * Deactivate all menus and insert a new active one — in a transaction.
     * Scoped to the current tenant.
     * @param {string} extractedText
     * @param {string|null} [mimetype]
     * @param {string|null} [base64Data]
     * @returns {Promise<Object>} The new menu entry
     */
    async setNewActive(extractedText, mimetype = null, base64Data = null, slot = 'lunch') {
        return this.db.transaction(async () => {
            await this.db.run(
                'UPDATE daily_menu SET is_active = 0 WHERE company_id = ? AND slot = ?',
                [this.companyId, slot]
            );
            const result = await this.db.run(
                'INSERT INTO daily_menu (company_id, mimetype, base64_data, extracted_text, is_active, slot) VALUES (?, ?, ?, ?, 1, ?)',
                [this.companyId, mimetype, base64Data, extractedText, slot]
            );
            return {
                id: result.lastID,
                mimetype,
                base64_data: base64Data,
                extracted_text: extractedText,
                is_active: true,
                slot
            };
        });
    }

    /**
     * Delete a menu entry by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    async remove(id) {
        return this.delete(id);
    }
}

module.exports = MenuRepository;
