-- ==========================================
-- Migration 006: Código PDV no Cardápio
-- ==========================================

ALTER TABLE menu_items ADD COLUMN codigo_pdv TEXT;
