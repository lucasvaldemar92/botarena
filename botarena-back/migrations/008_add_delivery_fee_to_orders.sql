-- ==========================================
-- Migration 008: Add delivery_fee to orders
-- ==========================================

ALTER TABLE orders ADD COLUMN delivery_fee REAL DEFAULT 0;
