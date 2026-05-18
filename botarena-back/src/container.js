// ==========================================
// 📦 DEPENDENCY INJECTION CONTAINER
// ==========================================
// Single source of truth for repository instances.
// All modules import from here instead of importing repositories directly.
// For testing, replace this module or pass mock instances with a fake db.

const db = require('./db/connection');
const SettingsRepository  = require('./repositories/SettingsRepository');
const KnowledgeRepository = require('./repositories/KnowledgeRepository');
const MenuRepository      = require('./repositories/MenuRepository');
const ClientRepository    = require('./repositories/ClientRepository');
const RagRepository       = require('./repositories/ragRepository');
const RagService          = require('./services/ragService');

// Multi-tenant: default company ID for single-restaurant mode.
// In the future, this will come from JWT claims or request context.
const DEFAULT_COMPANY_ID = 1;

const settingsRepo  = new SettingsRepository(db, DEFAULT_COMPANY_ID);
const knowledgeRepo = new KnowledgeRepository(db, DEFAULT_COMPANY_ID);
const menuRepo      = new MenuRepository(db, DEFAULT_COMPANY_ID);
const clientRepo    = new ClientRepository(db, DEFAULT_COMPANY_ID);
const ragRepo       = new RagRepository(db, DEFAULT_COMPANY_ID);
const ragService    = new RagService(ragRepo);

module.exports = {
    db,
    settingsRepo,
    knowledgeRepo,
    menuRepo,
    clientRepo,
    ragRepo,
    ragService,
    DEFAULT_COMPANY_ID
};
