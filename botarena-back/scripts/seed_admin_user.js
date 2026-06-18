/**
 * 🌱 Seed Script — Admin User
 * Generates a real bcrypt hash and inserts the default admin user
 * into the SQLite database.
 *
 * Usage:
 *   node botarena-back/scripts/seed_admin_user.js
 *
 * Options (env vars):
 *   ADMIN_EMAIL    — defaults to admin@botarena.local
 *   ADMIN_PASSWORD — defaults to Admin@BotArena1  (CHANGE THIS!)
 *   ADMIN_NAME     — defaults to Administrador
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const db     = require('../src/db/drivers/sqlite');

const SALT_ROUNDS    = 10;
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@botarena.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@BotArena1';
const ADMIN_NAME     = process.env.ADMIN_NAME     || 'Administrador';
const COMPANY_ID     = 1;

(async () => {
    try {
        console.log('🌱 [Seed] Gerando hash bcrypt para o usuário admin...');

        const hash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

        console.log(`📧 [Seed] Email : ${ADMIN_EMAIL}`);
        console.log(`🔑 [Seed] Hash  : ${hash}`);

        // Create table if not yet migrated
        await db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER  PRIMARY KEY AUTOINCREMENT,
                company_id    INTEGER  NOT NULL DEFAULT 1,
                name          TEXT     NOT NULL,
                email         TEXT     NOT NULL,
                password_hash TEXT     NOT NULL,
                role          TEXT     NOT NULL DEFAULT 'basico'
                              CHECK (role IN ('basico', 'premium', 'admin')),
                is_active     INTEGER  NOT NULL DEFAULT 1,
                last_login_at DATETIME,
                created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (company_id, email)
            )
        `);

        // Upsert admin user
        const existing = await db.get(
            'SELECT id FROM users WHERE company_id = ? AND email = ? COLLATE NOCASE',
            [COMPANY_ID, ADMIN_EMAIL]
        );

        if (existing) {
            await db.run(
                'UPDATE users SET password_hash = ?, role = ?, is_active = 1 WHERE id = ?',
                [hash, 'admin', existing.id]
            );
            console.log(`✅ [Seed] Usuário admin atualizado (ID: ${existing.id}).`);
        } else {
            const result = await db.run(
                `INSERT INTO users (company_id, name, email, password_hash, role, is_active)
                 VALUES (?, ?, ?, ?, 'admin', 1)`,
                [COMPANY_ID, ADMIN_NAME, ADMIN_EMAIL, hash]
            );
            console.log(`✅ [Seed] Usuário admin criado (ID: ${result.lastID}).`);
        }

        console.log('\n🔐 IMPORTANTE: Altere a senha padrão após o primeiro login!');
        process.exit(0);
    } catch (err) {
        console.error('❌ [Seed] Falha:', err);
        process.exit(1);
    }
})();
