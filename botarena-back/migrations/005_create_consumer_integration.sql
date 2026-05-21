-- ==========================================
-- Migration 005: Integração Consumer
-- ==========================================

ALTER TABLE settings ADD COLUMN consumer_client_id TEXT;
ALTER TABLE settings ADD COLUMN consumer_client_secret TEXT;
ALTER TABLE settings ADD COLUMN consumer_integration_active INTEGER DEFAULT 0;
