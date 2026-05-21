-- =======================================================
-- 📐 MIGRATION 005: Delivery Fees & Client Address Number
-- =======================================================

-- 1. Add number column to clients (handled conditionally in JS for SQLite safety)
-- ALTER TABLE clients ADD COLUMN number TEXT;

-- 2. Create delivery_fees table
CREATE TABLE IF NOT EXISTS delivery_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER DEFAULT 1,
    neighborhood TEXT,
    zip_code TEXT UNIQUE,
    fee REAL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for ZIP code searches
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_fees_zip ON delivery_fees (zip_code);

-- 3. Seed initial static values if empty
INSERT OR IGNORE INTO delivery_fees (id, company_id, neighborhood, zip_code, fee) VALUES
(1, 1, 'Centro', '87055-520', 5.00),
(2, 1, 'Jardim América', '15084-120', 7.50),
(3, 1, 'Vila Nova', '12345-000', 10.00);
