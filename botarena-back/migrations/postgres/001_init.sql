-- ==========================================
-- 📐 MIGRATION 001: Initial Schema (PostgreSQL)
-- BotArena — PostgreSQL Schema
-- Equivalent to migrations/001_init.sql (SQLite)
-- ==========================================

-- ==========================================
-- 1. SETTINGS (Singleton row: id must = 1)
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
    id              INTEGER  PRIMARY KEY CHECK (id = 1),
    company_id      INTEGER  NOT NULL DEFAULT 1,
    empresa         TEXT     NOT NULL DEFAULT 'BotArena',
    pix             TEXT,
    nome_favorecido TEXT,
    cardapio_url    TEXT,
    boas_vindas     TEXT     DEFAULT 'Olá! Como podemos ajudar?',
    bot_active      BOOLEAN  DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. KNOWLEDGE BASE
-- ==========================================
CREATE TABLE IF NOT EXISTS knowledge_base (
    id         SERIAL   PRIMARY KEY,
    company_id INTEGER  NOT NULL DEFAULT 1,
    keyword    TEXT     NOT NULL,
    response   TEXT     NOT NULL,
    category   TEXT     DEFAULT 'faq',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster keyword lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_keyword ON knowledge_base (keyword);

-- ==========================================
-- 3. DAILY MENU
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_menu (
    id             SERIAL   PRIMARY KEY,
    company_id     INTEGER  NOT NULL DEFAULT 1,
    file_path      TEXT,
    extracted_text TEXT,
    is_active      BOOLEAN  DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering active menu
CREATE INDEX IF NOT EXISTS idx_menu_is_active ON daily_menu (is_active);

-- ==========================================
-- 4. SEED DATA (idempotent — skip if exists)
-- ==========================================
INSERT INTO settings (id, company_id, empresa, pix, boas_vindas)
VALUES (1, 1, 'Arena Juvenal', '000.000.000-00', 'Bem-vindo à Arena Juvenal! 🏟️')
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_base (company_id, keyword, response) VALUES
    (1, 'horário',    'Funcionamos todos os dias das 08:00 às 22:00!'),
    (1, 'localização','Estamos localizados em Itapoá, SC.'),
    (1, 'pix',        'Aceitamos Pix! A chave é o nosso CNPJ.')
ON CONFLICT DO NOTHING;
