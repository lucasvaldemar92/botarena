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
                empresa         = CASE WHEN ? IS NOT NULL THEN ? ELSE empresa END,
                pix             = CASE WHEN ? IS NOT NULL THEN ? ELSE pix END,
                nome_favorecido  = CASE WHEN ? IS NOT NULL THEN ? ELSE nome_favorecido END,
                cardapio_url    = CASE WHEN ? IS NOT NULL THEN ? ELSE cardapio_url END,
                boas_vindas     = CASE WHEN ? IS NOT NULL THEN ? ELSE boas_vindas END,
                bot_active      = CASE WHEN ? IS NOT NULL THEN ? ELSE bot_active END,
                operation_days  = CASE WHEN ? IS NOT NULL THEN ? ELSE operation_days END,
                operation_start = CASE WHEN ? IS NOT NULL THEN ? ELSE operation_start END,
                operation_end   = CASE WHEN ? IS NOT NULL THEN ? ELSE operation_end END,
                mensagem_ausencia = CASE WHEN ? IS NOT NULL THEN ? ELSE mensagem_ausencia END,
                operation_periods = CASE WHEN ? IS NOT NULL THEN ? ELSE operation_periods END,
                updated_at      = CURRENT_TIMESTAMP
            WHERE company_id = ?
        `, [
            fields.empresa      !== undefined ? fields.empresa : null,
            fields.empresa      !== undefined ? fields.empresa : null,
            fields.pix          !== undefined ? fields.pix : null,
            fields.pix          !== undefined ? fields.pix : null,
            fields.nome_favorecido !== undefined ? fields.nome_favorecido : null,
            fields.nome_favorecido !== undefined ? fields.nome_favorecido : null,
            fields.cardapio_url !== undefined ? fields.cardapio_url : null,
            fields.cardapio_url !== undefined ? fields.cardapio_url : null,
            fields.boas_vindas  !== undefined ? fields.boas_vindas : null,
            fields.boas_vindas  !== undefined ? fields.boas_vindas : null,
            botVal,
            botVal,
            fields.operation_days !== undefined ? fields.operation_days : null,
            fields.operation_days !== undefined ? fields.operation_days : null,
            fields.operation_start !== undefined ? fields.operation_start : null,
            fields.operation_start !== undefined ? fields.operation_start : null,
            fields.operation_end !== undefined ? fields.operation_end : null,
            fields.operation_end !== undefined ? fields.operation_end : null,
            fields.mensagem_ausencia !== undefined ? fields.mensagem_ausencia : null,
            fields.mensagem_ausencia !== undefined ? fields.mensagem_ausencia : null,
            fields.operation_periods !== undefined ? fields.operation_periods : null,
            fields.operation_periods !== undefined ? fields.operation_periods : null,
            this.companyId
        ]);
        return result.changes;
    }
}

module.exports = SettingsRepository;
