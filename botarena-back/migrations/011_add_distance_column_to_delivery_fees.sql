-- =======================================================
-- 📐 MIGRATION 011: Delivery Fees Distance Column
-- =======================================================

ALTER TABLE delivery_fees ADD COLUMN distance_km REAL DEFAULT 0.0;
