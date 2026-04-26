// ==========================================
// ⚙️ SETTINGS REPOSITORY
// ==========================================
// Encapsulates all SQL for the `settings` table.
// One row per company (filtered by company_id from BaseRepository).

const BaseRepository = require('./BaseRepository');

class SettingsRepository extends BaseRepository {
    constructor(db, companyId) {
        super(db, 'settings', companyId);
    }

    /**
     * Retrieve the settings row for this tenant.
     * @returns {Promise<Object>}
     */
    async get() {
        const row = await this.db.get(
            'SELECT * FROM settings WHERE company_id = ?',
            [this.companyId]
        );
        return {
            ...row,
            bot_active: Boolean(row?.bot_active) // 1/0 → true/false
        };
    }

    /**
     * Partially update settings. Only non-null fields are written.
     * @param {Object} fields - { empresa, pix, cardapio_url, boas_vindas, bot_active }
     * @returns {Promise<number>} Number of rows changed
     */
    async update(fields) {
        const botVal = fields.bot_active !== undefined
            ? (fields.bot_active ? 1 : 0)
            : null;

        const result = await this.db.run(`
            UPDATE settings SET
                empresa        = COALESCE(?, empresa),
                pix            = COALESCE(?, pix),
                cardapio_url   = COALESCE(?, cardapio_url),
                boas_vindas    = COALESCE(?, boas_vindas),
                bot_active     = CASE WHEN ? IS NOT NULL THEN ? ELSE bot_active END,
                updated_at     = CURRENT_TIMESTAMP
            WHERE company_id = ?
        `, [
            fields.empresa      || null,
            fields.pix          || null,
            fields.cardapio_url || null,
            fields.boas_vindas  || null,
            botVal,
            botVal,
            this.companyId
        ]);
        return result.changes;
    }
}

module.exports = SettingsRepository;
