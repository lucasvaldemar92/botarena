// ==========================================
// ⚙️ SETTINGS REPOSITORY
// ==========================================
// Encapsulates all SQL for the `settings` table.
// Only one row ever exists (id = 1, enforced by CHECK constraint in schema).

const BaseRepository = require('./BaseRepository');

class SettingsRepository extends BaseRepository {
    constructor(db) {
        super(db, 'settings');
    }

    /**
     * Retrieve the single settings row.
     * @returns {Promise<Object>}
     */
    get() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM settings WHERE id = 1', (err, row) => {
                if (err) return reject(err);
                resolve({
                    ...row,
                    bot_active: Boolean(row?.bot_active) // 1/0 → true/false
                });
            });
        });
    }

    /**
     * Partially update settings. Only non-null fields are written.
     * @param {Object} fields - { empresa, pix, cardapio_url, boas_vindas, bot_active }
     * @returns {Promise<number>} Number of rows changed
     */
    update(fields) {
        return new Promise((resolve, reject) => {
            const botVal = fields.bot_active !== undefined
                ? (fields.bot_active ? 1 : 0)
                : null;

            const stmt = this.db.prepare(`
                UPDATE settings SET
                    empresa        = COALESCE(?, empresa),
                    pix            = COALESCE(?, pix),
                    cardapio_url   = COALESCE(?, cardapio_url),
                    boas_vindas    = COALESCE(?, boas_vindas),
                    bot_active     = CASE WHEN ? IS NOT NULL THEN ? ELSE bot_active END,
                    updated_at     = CURRENT_TIMESTAMP
                WHERE id = 1
            `);

            stmt.run(
                fields.empresa      || null,
                fields.pix          || null,
                fields.cardapio_url || null,
                fields.boas_vindas  || null,
                botVal,
                botVal,
                function (err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
            stmt.finalize();
        });
    }
}

module.exports = SettingsRepository;
