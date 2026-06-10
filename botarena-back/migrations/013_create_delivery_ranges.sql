-- =======================================================
-- 📐 MIGRATION 013: Delivery Ranges (Dynamic KM Intervals)
-- =======================================================

CREATE TABLE IF NOT EXISTS delivery_ranges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER DEFAULT 1,
    min_km REAL NOT NULL DEFAULT 0.0,
    max_km REAL NOT NULL DEFAULT 0.0,
    fee REAL DEFAULT 0.00,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for active range lookups
CREATE INDEX IF NOT EXISTS idx_delivery_ranges_active ON delivery_ranges (company_id, is_active);

-- Seed initial example ranges
INSERT OR IGNORE INTO delivery_ranges (id, company_id, min_km, max_km, fee, is_active) VALUES
(1, 1, 0.0, 3.0, 5.00, 1),
(2, 1, 3.0, 7.0, 10.00, 1),
(3, 1, 7.0, 15.0, 15.00, 1);
