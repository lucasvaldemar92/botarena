const express = require('express');
const authMiddleware       = require('../middleware/auth');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const AuthService          = require('../services/AuthService');

/**
 * createApiRouter — Returns an Express Router with all API routes.
 * @param {object} deps
 * @param {Server}   deps.io              - Socket.IO server instance
 * @param {Function} deps.getClient       - Returns the WhatsApp client
 * @param {Function} deps.isClientReady   - Returns true when WA client is ready
 * @param {Function} deps.setClientReady  - Sets the WA client readiness flag
 * @param {Object}   deps.settingsRepo    - SettingsRepository instance
 * @param {Object}   deps.knowledgeRepo   - KnowledgeRepository instance
 * @param {Object}   deps.menuRepo        - MenuRepository instance
 * @returns {Router}
 */
function createApiRouter({ io, getClient, isClientReady, setClientReady, settingsRepo, knowledgeRepo, menuRepo }) {
    const router = express.Router();

    // ==========================================
    // 📊 STATUS ROUTE (public)
    // ==========================================
    router.get('/status', async (req, res) => {
        console.log('📡 [API] GET /api/status');
        try {
            const config = await settingsRepo.get();
            const isConnected = config.bot_active === true;
            // Never expose QR payload to REST — QR is socket-only
            res.json({
                connected: isConnected,
                isAuthenticated: isConnected, // Task 2: Persistent Auth State
                status:    isConnected ? 'CONNECTED' : 'WAITING_QR',
                message:   isConnected ? 'Bot Ativo e Conectado' : 'Aguardando autenticação WhatsApp'
            });
        } catch (e) {
            console.error('❌ [API] Error fetching status:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ==========================================
    // 🐞 DEBUG / SENTRY (public)
    // ==========================================
    router.get('/debug-sentry', (req, res) => {
        console.log('🐞 [API] Triggering Sentry debug error...');
        throw new Error('Sentry Backend Test Error - BotArena');
    });

    // ==========================================
    // 🔐 AUTH — DEV LOGIN (public, dev-only)
    // ==========================================
    router.post('/auth/dev-login', (req, res) => {
        const token = AuthService.generateMockToken();
        if (!token) return res.status(403).json({ error: 'Only available in development' });
        console.log('🔑 [Auth] Dev mock token generated.');
        res.json({ token });
    });

    // ==========================================
    // ⚙️ SETTINGS ROUTES  (🔒 Protected)
    // ==========================================
    router.get('/config', authMiddleware, async (req, res) => {
        console.log('📡 [API] GET /api/config');
        try {
            res.json(await settingsRepo.get());
        } catch (e) {
            console.error('❌ [API] Error fetching config:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/config', sensitiveLimiter, authMiddleware, async (req, res) => {
        console.log('📡 [API] POST /api/config');
        try {
            await settingsRepo.update(req.body);
            const updatedConfig = await settingsRepo.get();

            console.log('✅ [API] Config updated successfully.');
            res.json({ success: true, message: 'Config updated', config: updatedConfig });

            io.emit('config_updated', updatedConfig);
        } catch (err) {
            console.error('❌ [API] Error saving config:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ==========================================
    // 🚪 LOGOUT ROUTE (🔒 Protected)
    // ==========================================
    router.post('/logout', sensitiveLimiter, authMiddleware, async (req, res) => {
        console.log('📡 [API] POST /api/logout');
        try {
            await settingsRepo.update({ bot_active: false });
            setClientReady(false);
            const client = getClient();
            if (client?.info) {
                await client.logout(); // Clears auth data natively in whatsapp-web.js
                console.log('🚪 [WhatsApp] Client logged out manually.');
            }
            io.emit('force_logout');
            res.json({ success: true, message: 'Logged out successfully' });
        } catch (err) {
            console.error('❌ [API] Error during logout:', err);
            // Even if the client throws, force socket UI redirect
            io.emit('force_logout');
            res.status(500).json({ error: 'Error during logout' });
        }
    });

    // ==========================================
    // 📚 KNOWLEDGE BASE ROUTES (🔒 Protected)
    // ==========================================
    router.get('/knowledge', authMiddleware, async (req, res) => {
        console.log('📡 [API] GET /api/knowledge');
        try {
            res.json(await knowledgeRepo.getAll());
        } catch (e) {
            console.error('❌ [API] Error fetching knowledge:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/knowledge', sensitiveLimiter, authMiddleware, async (req, res) => {
        console.log('📡 [API] POST /api/knowledge');
        try {
            const { keyword, response, category } = req.body;
            if (!keyword || !response)
                return res.status(400).json({ error: 'keyword and response are required' });

            const entry = await knowledgeRepo.add(keyword, response, category);
            console.log(`✅ [API] Knowledge entry added: "${keyword}"`);
            res.json({ success: true, entry });
        } catch (e) {
            console.error('❌ [API] Error adding knowledge:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.delete('/knowledge/:id', sensitiveLimiter, authMiddleware, async (req, res) => {
        console.log(`📡 [API] DELETE /api/knowledge/${req.params.id}`);
        try {
            const changes = await knowledgeRepo.remove(req.params.id);
            res.json({ success: true, deleted: changes });
        } catch (e) {
            console.error('❌ [API] Error deleting knowledge:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ==========================================
    // 🍽️ DAILY MENU ROUTES (🔒 Protected)
    // ==========================================
    router.get('/menu', authMiddleware, async (req, res) => {
        console.log('📡 [API] GET /api/menu');
        try {
            const menu = await menuRepo.getActive();
            res.json(menu || { message: 'No active menu' });
        } catch (e) {
            console.error('❌ [API] Error fetching menu:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/menu', sensitiveLimiter, authMiddleware, async (req, res) => {
        console.log('📡 [API] POST /api/menu');
        try {
            const { extracted_text, file_path } = req.body;
            if (!extracted_text)
                return res.status(400).json({ error: 'extracted_text is required' });

            const menu = await menuRepo.setNewActive(extracted_text, file_path);
            console.log('✅ [API] Daily menu updated.');
            res.json({ success: true, menu });
        } catch (e) {
            console.error('❌ [API] Error adding menu:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.delete('/menu/:id', sensitiveLimiter, authMiddleware, async (req, res) => {
        console.log(`📡 [API] DELETE /api/menu/${req.params.id}`);
        try {
            const changes = await menuRepo.remove(req.params.id);
            res.json({ success: true, deleted: changes });
        } catch (e) {
            console.error('❌ [API] Error deleting menu:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    return router;
}

module.exports = { createApiRouter };
