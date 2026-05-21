-- ==========================================
-- 📐 MIGRATION 004: Company Settings
-- Add separate latitude and longitude REAL columns
-- ==========================================

ALTER TABLE settings ADD COLUMN company_name TEXT;
ALTER TABLE settings ADD COLUMN trade_name TEXT;
ALTER TABLE settings ADD COLUMN cnpj TEXT;
ALTER TABLE settings ADD COLUMN base_cep TEXT;
ALTER TABLE settings ADD COLUMN company_street TEXT;
ALTER TABLE settings ADD COLUMN company_number TEXT;
ALTER TABLE settings ADD COLUMN company_neighborhood TEXT;
ALTER TABLE settings ADD COLUMN company_phone TEXT;
ALTER TABLE settings ADD COLUMN company_email TEXT;
ALTER TABLE settings ADD COLUMN latitude REAL;
ALTER TABLE settings ADD COLUMN longitude REAL;
