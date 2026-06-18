-- =======================================================
-- 🛡️ MIGRATION 014: Users Table (RBAC System)
-- =======================================================
-- Strict runtime enum verification via CHECK constraint.
-- Indexed by email (login lookup) and role (RBAC filter).

CREATE TABLE IF NOT EXISTS users (
    id               INTEGER  PRIMARY KEY AUTOINCREMENT,
    company_id       INTEGER  NOT NULL DEFAULT 1,
    name             TEXT     NOT NULL,
    email            TEXT     NOT NULL,
    password_hash    TEXT     NOT NULL,
    role             TEXT     NOT NULL DEFAULT 'basico'
                              CHECK (role IN ('basico', 'premium', 'admin')),
    is_active        INTEGER  NOT NULL DEFAULT 1,
    last_login_at    DATETIME,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, email)
);

-- ── Index: email lookup (authentication hot path)
CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (company_id, email);

-- ── Index: role-based filtering
CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (company_id, role);

-- ── Trigger: keep updated_at in sync
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- =======================================================
-- 🌱 SEED: default admin user (password: Admin@BotArena1)
-- Hash generated with bcrypt, saltRounds=10.
-- CHANGE THIS PASSWORD immediately after first login!
-- =======================================================
INSERT OR IGNORE INTO users (id, company_id, name, email, password_hash, role, is_active)
VALUES (
    1,
    1,
    'Administrador',
    'admin@botarena.local',
    '$2b$10$eW5zK9mXqP7rN3vL8tYuOeD1fA6gH2jI4kM5nQ8oR0sT3uV7wX9yZ',
    'admin',
    1
);
-- NOTE: The hash above is a PLACEHOLDER. Run the seed script to generate a real hash:
--   node botarena-back/scripts/seed_admin_user.js
