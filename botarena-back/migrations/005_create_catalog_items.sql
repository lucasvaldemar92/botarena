-- 005_create_catalog_items.sql
CREATE TABLE IF NOT EXISTS catalog_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER DEFAULT 1,
    cod_pdv TEXT,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL DEFAULT 0,
    categoria TEXT NOT NULL,
    is_adicional INTEGER DEFAULT 0,  -- 0 = Item Normal, 1 = Adicional Global
    disponivel INTEGER DEFAULT 1,    -- 0 = Indisponível, 1 = Disponível
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexação para buscas de alto desempenho (RAG / Interceptação do Bot)
CREATE INDEX IF NOT EXISTS idx_catalog_company ON catalog_items(company_id);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON catalog_items(categoria);
CREATE INDEX IF NOT EXISTS idx_catalog_adicional ON catalog_items(is_adicional);
CREATE INDEX IF NOT EXISTS idx_catalog_cod_pdv ON catalog_items(cod_pdv);
