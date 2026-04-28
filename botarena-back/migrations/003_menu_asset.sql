-- ==========================================
-- 📐 MIGRATION 003: Menu Asset Storage
-- Adds support for storing file mimetype and base64 data
-- ==========================================

ALTER TABLE daily_menu ADD COLUMN mimetype TEXT;
ALTER TABLE daily_menu ADD COLUMN base64_data TEXT;
