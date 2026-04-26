// ==========================================
// 📦 DEPENDENCY INJECTION CONTAINER
// ==========================================
// Single source of truth for repository instances.
// All modules import from here instead of importing repositories directly.
// For testing, replace this module or pass mock instances.

const db = require('./db/connection');
const SettingsRepository  = require('./repositories/SettingsRepository');
const KnowledgeRepository = require('./repositories/KnowledgeRepository');
const MenuRepository      = require('./repositories/MenuRepository');

const settingsRepo  = new SettingsRepository(db);
const knowledgeRepo = new KnowledgeRepository(db);
const menuRepo      = new MenuRepository(db);

module.exports = { db, settingsRepo, knowledgeRepo, menuRepo };
