-- ==========================================
-- 📐 MIGRATION 009: Catalog Categories Table
-- Introduce category entity for menu catalog items
-- ==========================================

CREATE TABLE IF NOT EXISTS catalog_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER DEFAULT 1,
    nome       TEXT NOT NULL UNIQUE COLLATE NOCASE, -- Evita categorias duplicadas mesmo com diferenças de maiúsculas/minúsculas
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_company ON catalog_categories (company_id);
