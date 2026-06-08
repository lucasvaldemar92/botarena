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
            bot_active: Boolean(row?.bot_active), // 1/0 → true/false
            menu_lunch_active: row?.menu_lunch_active !== undefined ? Boolean(row.menu_lunch_active) : true,
            menu_lunch_start: row?.menu_lunch_start || '10:00',
            menu_lunch_end: row?.menu_lunch_end || '14:00',
            menu_acai_active: row?.menu_acai_active !== undefined ? Boolean(row.menu_acai_active) : true,
            menu_acai_start: row?.menu_acai_start || '14:00',
            menu_acai_end: row?.menu_acai_end || '22:00',
            menu_events_active: row?.menu_events_active !== undefined ? Boolean(row.menu_events_active) : true,
            menu_events_start: row?.menu_events_start || '08:00',
            menu_events_end: row?.menu_events_end || '22:00'
        };
    }

    /**
     * Partially update settings. Only non-null fields are written.
     * @param {Object} fields - { empresa, pix, cardapio_url, boas_vindas, bot_active, ... }
     * @returns {Promise<number>} Number of rows changed
     */
    async update(fields) {
        const botVal = fields.bot_active !== undefined
            ? (fields.bot_active ? 1 : 0)
            : null;

        const menuLunchActiveVal = fields.menu_lunch_active !== undefined
            ? (fields.menu_lunch_active ? 1 : 0)
            : null;

        const menuAcaiActiveVal = fields.menu_acai_active !== undefined
            ? (fields.menu_acai_active ? 1 : 0)
            : null;

        const menuEventsActiveVal = fields.menu_events_active !== undefined
            ? (fields.menu_events_active ? 1 : 0)
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
                menu_lunch_active = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_lunch_active END,
                menu_lunch_start  = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_lunch_start END,
                menu_lunch_end    = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_lunch_end END,
                menu_acai_active  = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_acai_active END,
                menu_acai_start   = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_acai_start END,
                menu_acai_end     = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_acai_end END,
                menu_events_active = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_events_active END,
                menu_events_start  = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_events_start END,
                menu_events_end    = CASE WHEN ? IS NOT NULL THEN ? ELSE menu_events_end END,
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
            menuLunchActiveVal,
            menuLunchActiveVal,
            fields.menu_lunch_start !== undefined ? fields.menu_lunch_start : null,
            fields.menu_lunch_start !== undefined ? fields.menu_lunch_start : null,
            fields.menu_lunch_end !== undefined ? fields.menu_lunch_end : null,
            fields.menu_lunch_end !== undefined ? fields.menu_lunch_end : null,
            menuAcaiActiveVal,
            menuAcaiActiveVal,
            fields.menu_acai_start !== undefined ? fields.menu_acai_start : null,
            fields.menu_acai_start !== undefined ? fields.menu_acai_start : null,
            fields.menu_acai_end !== undefined ? fields.menu_acai_end : null,
            fields.menu_acai_end !== undefined ? fields.menu_acai_end : null,
            menuEventsActiveVal,
            menuEventsActiveVal,
            fields.menu_events_start !== undefined ? fields.menu_events_start : null,
            fields.menu_events_start !== undefined ? fields.menu_events_start : null,
            fields.menu_events_end !== undefined ? fields.menu_events_end : null,
            fields.menu_events_end !== undefined ? fields.menu_events_end : null,
            this.companyId
        ]);
        return result.changes;
    }
}

module.exports = SettingsRepository;
