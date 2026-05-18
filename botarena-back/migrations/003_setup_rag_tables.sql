-- ==========================================
-- 📐 MIGRATION 003: Setup RAG Tables
-- Creates the rag_chunks table to support localized document search
-- ==========================================

CREATE TABLE IF NOT EXISTS rag_chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id    INTEGER DEFAULT 1,
    source_type   TEXT NOT NULL, -- e.g., 'menu_slot', 'faq'
    source_id     TEXT,          -- e.g., 'lunch', 'dinner', 'dessert', or asset identifier
    chunk_index   INTEGER NOT NULL,
    content       TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rag_company_source ON rag_chunks (company_id, source_type, source_id);
