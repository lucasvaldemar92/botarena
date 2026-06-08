-- ==========================================
-- 📐 MIGRATION 010: Menu Activation and Schedule
-- Adds status active and start/end operation times for daily menu slots
-- ==========================================

ALTER TABLE settings ADD COLUMN menu_lunch_active BOOLEAN DEFAULT 1;
ALTER TABLE settings ADD COLUMN menu_lunch_start TEXT DEFAULT '10:00';
ALTER TABLE settings ADD COLUMN menu_lunch_end TEXT DEFAULT '14:00';

ALTER TABLE settings ADD COLUMN menu_acai_active BOOLEAN DEFAULT 1;
ALTER TABLE settings ADD COLUMN menu_acai_start TEXT DEFAULT '14:00';
ALTER TABLE settings ADD COLUMN menu_acai_end TEXT DEFAULT '22:00';

ALTER TABLE settings ADD COLUMN menu_events_active BOOLEAN DEFAULT 1;
ALTER TABLE settings ADD COLUMN menu_events_start TEXT DEFAULT '08:00';
ALTER TABLE settings ADD COLUMN menu_events_end TEXT DEFAULT '22:00';

-- Garantir que a linha singleton de id = 1 tenha os valores populados por padrão
UPDATE settings 
SET menu_lunch_active = 1, menu_lunch_start = '10:00', menu_lunch_end = '14:00',
    menu_acai_active = 1, menu_acai_start = '14:00', menu_acai_end = '22:00',
    menu_events_active = 1, menu_events_start = '08:00', menu_events_end = '22:00'
WHERE id = 1;
