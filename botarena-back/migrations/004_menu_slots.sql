-- ==========================================
-- 📐 MIGRATION 004: Multi-Menu Slots
-- Adds support for 3 independent menu categories
-- ==========================================

ALTER TABLE daily_menu ADD COLUMN slot TEXT DEFAULT 'lunch';
