-- Migration: Add address column to delivery_fees table
ALTER TABLE delivery_fees ADD COLUMN address TEXT;
