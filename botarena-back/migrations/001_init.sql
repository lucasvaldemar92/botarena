-- ==========================================
-- 📐 MIGRATION 001: Initial Schema
-- BotArena — Portable SQLite Schema
-- Compatible with future PostgreSQL migration.
-- ==========================================

-- ==========================================
-- 1. SETTINGS (Singleton row: id must = 1)
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
    id            INTEGER  PRIMARY KEY CHECK (id = 1),
    empresa       TEXT     NOT NULL DEFAULT 'BotArena',
    pix           TEXT,
    nome_favorecido TEXT,
    cardapio_url  TEXT,
    boas_vindas   TEXT     DEFAULT 'Olá! Como podemos ajudar?',
    bot_active    BOOLEAN  DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. KNOWLEDGE BASE
-- ==========================================
CREATE TABLE IF NOT EXISTS knowledge_base (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    keyword    TEXT     NOT NULL,
    response   TEXT     NOT NULL,
    category   TEXT     DEFAULT 'faq',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster keyword lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_keyword ON knowledge_base (keyword);

-- ==========================================
-- 3. DAILY MENU
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_menu (
    id             INTEGER  PRIMARY KEY AUTOINCREMENT,
    file_path      TEXT,
    extracted_text TEXT,
    is_active      BOOLEAN  DEFAULT 1,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for filtering active menu
CREATE INDEX IF NOT EXISTS idx_menu_is_active ON daily_menu (is_active);

-- ==========================================
-- 4. SEED DATA (idempotent — skip if exists)
-- ==========================================
INSERT OR IGNORE INTO settings (id, empresa, pix, boas_vindas)
VALUES (1, 'Arena Juvenal', '000.000.000-00', 'Bem-vindo à Arena Juvenal! 🏟️');

INSERT OR IGNORE INTO knowledge_base (keyword, response) VALUES
    ('horário',    'Funcionamos todos os dias das 08:00 às 22:00!'),
    ('localização','Estamos localizados em Itapoá, SC.'),
    ('pix',        'Aceitamos Pix! A chave é o nosso CNPJ.');
