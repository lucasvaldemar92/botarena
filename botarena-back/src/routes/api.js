const express = require('express');
const authMiddleware       = require('../middleware/auth');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const { validate }         = require('../middleware/validate');
const AuthService          = require('../services/AuthService');
const { configSchema }     = require('../schemas/configSchema');
const { knowledgeSchema }  = require('../schemas/knowledgeSchema');
const { menuSchema }       = require('../schemas/menuSchema');

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
 * @param {Object}   deps.clientRepo      - ClientRepository instance
 * @returns {Router}
 */
function createApiRouter({ io, getClient, isClientReady, setClientReady, settingsRepo, knowledgeRepo, menuRepo, clientRepo, deliveryFeeRepo, ragRepo, ragService }) {
    const router = express.Router();

    // ==========================================
    // 📊 STATUS ROUTE (public)
    // ==========================================
    router.get('/status', async (req, res) => {
        // // console.log('📡 [API] GET /api/status');
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
        // // console.log('🐞 [API] Triggering Sentry debug error...');
        throw new Error('Sentry Backend Test Error - BotArena');
    });

    // ==========================================
    // 🔐 AUTH — DEV LOGIN (public, dev-only)
    // ==========================================
    router.post('/auth/dev-login', (req, res) => {
        if (process.env.NODE_ENV === 'production') {
            return res.status(404).json({ error: 'Not found' });
        }
        const { email, password } = req.body;
        
        // Permite "teste" ou "teste@exemplo.com" com senha "12345"
        const normalizedEmail = email ? email.trim().toLowerCase() : '';
        const isMockUser = normalizedEmail === 'teste' || normalizedEmail === 'teste@exemplo.com';
        const isMockPassword = password === '12345';

        if (isMockUser && isMockPassword) {
            const token = AuthService.generateMockToken();
            return res.json({ token });
        }
        
        // Se não for o usuário "teste", aceita qualquer credencial padrão do dev-login antigo para desenvolvimento
        if (!isMockUser && password) {
            const token = AuthService.generateMockToken();
            return res.json({ token });
        }

        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    });

    // ==========================================
    // ⚙️ SETTINGS ROUTES  (🔒 Protected)
    // ==========================================
    router.get('/config', authMiddleware, async (req, res) => {
        // // console.log('📡 [API] GET /api/config');
        try {
            res.json(await settingsRepo.get());
        } catch (e) {
            console.error('❌ [API] Error fetching config:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/config', sensitiveLimiter, authMiddleware, validate(configSchema), async (req, res) => {
        // // console.log('📡 [API] POST /api/config');
        try {
            await settingsRepo.update(req.body);
            const updatedConfig = await settingsRepo.get();

            // // console.log('✅ [API] Config updated successfully.');
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
        // // console.log('📡 [API] POST /api/logout');
        try {
            await settingsRepo.update({ bot_active: false });
            setClientReady(false);
            const client = getClient();
            if (client?.info) {
                await client.logout(); // Clears auth data natively in whatsapp-web.js
                // // console.log('🚪 [WhatsApp] Client logged out manually.');
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
        // // console.log('📡 [API] GET /api/knowledge');
        try {
            res.json(await knowledgeRepo.getAll());
        } catch (e) {
            console.error('❌ [API] Error fetching knowledge:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/knowledge', sensitiveLimiter, authMiddleware, validate(knowledgeSchema), async (req, res) => {
        // // console.log('📡 [API] POST /api/knowledge');
        try {
            const { keyword, response, category } = req.body;
            const entry = await knowledgeRepo.add(keyword, response, category);
            
            // Ingerir dinamicamente os chunks semânticos do FAQ no RAG
            try {
                const rawText = `Pergunta/Palavra-chave: ${keyword}\nRespostas/Informações: ${response}`;
                const chunks = ragService.generateSemanticChunks(rawText);
                await ragRepo.saveChunks('faq', entry.id.toString(), chunks);
                // // console.log(`✅ [RAG Ingest] ${chunks.length} chunks saved for FAQ ID: ${entry.id}`);
            } catch (ragErr) {
                console.error(`❌ [RAG Ingest] Error ingesting FAQ RAG chunks for ID ${entry.id}:`, ragErr);
            }

            // // console.log(`✅ [API] Knowledge entry added: "${keyword}"`);
            res.json({ success: true, entry });
        } catch (e) {
            console.error('❌ [API] Error adding knowledge:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.delete('/knowledge/:id', sensitiveLimiter, authMiddleware, async (req, res) => {
        // // console.log(`📡 [API] DELETE /api/knowledge/${req.params.id}`);
        try {
            const changes = await knowledgeRepo.remove(req.params.id);
            
            // Remover dinamicamente os chunks semânticos do RAG
            try {
                await ragRepo.deleteChunksBySource('faq', req.params.id.toString());
                // // console.log(`✅ [RAG Clean] Chunks removed for FAQ ID: ${req.params.id}`);
            } catch (ragErr) {
                console.error(`❌ [RAG Clean] Error removing RAG chunks for FAQ ID ${req.params.id}:`, ragErr);
            }

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
        // // console.log('📡 [API] GET /api/menu');
        try {
            const slot = req.query.slot || 'lunch';
            const menu = await menuRepo.getActive(slot);
            res.json(menu || { message: 'No active menu' });
        } catch (e) {
            console.error('❌ [API] Error fetching menu:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/menu', sensitiveLimiter, authMiddleware, validate(menuSchema), async (req, res) => {
        // // console.log('📡 [API] POST /api/menu');
        try {
            const { slot, extracted_text, mimetype, base64_data } = req.body;
            const menu = await menuRepo.setNewActive(extracted_text, mimetype, base64_data, slot);
            
            // Ingerir dinamicamente os chunks semânticos no RAG
            try {
                const rawText = extracted_text || '';
                const chunks = ragService.generateSemanticChunks(rawText);
                await ragRepo.saveChunks('menu_slot', slot, chunks);
                // // console.log(`✅ [RAG Ingest] ${chunks.length} chunks saved for menu slot: ${slot}`);
            } catch (ragErr) {
                console.error(`❌ [RAG Ingest] Error ingesting menu RAG chunks for ${slot}:`, ragErr);
            }

            // // console.log('✅ [API] Daily menu updated.');
            res.json({ success: true, menu });
        } catch (e) {
            console.error('❌ [API] Error adding menu:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.delete('/menu/:id', sensitiveLimiter, authMiddleware, async (req, res) => {
        // // console.log(`📡 [API] DELETE /api/menu/${req.params.id}`);
        try {
            const changes = await menuRepo.remove(req.params.id);
            res.json({ success: true, deleted: changes });
        } catch (e) {
            console.error('❌ [API] Error deleting menu:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ==========================================
    // 👥 CLIENTS ROUTES (🔒 Protected)
    // ==========================================
    async function syncClientToDeliveryFee(clientData) {
        if (!clientData.cep || !clientData.address) return;

        // Validate CEP: must contain exactly 8 digits after removing non-digits
        const cleanCep = clientData.cep.replace(/[^\d]/g, '');
        const hasValidCep = cleanCep.length === 8;

        // Validate Street Name: must be a string of at least 3 characters after trimming
        const cleanAddress = clientData.address.trim();
        const hasValidAddress = cleanAddress.length >= 3;

        if (hasValidCep && hasValidAddress) {
            // Format CEP to standard format XXXXX-XXX
            const formattedCep = `${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}`;
            
            try {
                // Check if CEP already exists in delivery_fees
                const existingFee = await deliveryFeeRepo.findByZipCode(formattedCep);
                if (!existingFee) {
                    // CEP does not exist: insert a new row with R$ 0,00 as the default fee
                    await deliveryFeeRepo.add({
                        neighborhood: cleanAddress,
                        zipCode: formattedCep,
                        fee: 0.00
                    });
                    console.log(`✅ [Sync] Sincronizado CEP ${formattedCep} (${cleanAddress}) para taxas de entrega.`);
                } else {
                    console.log(`⏭️ [Sync] CEP ${formattedCep} já cadastrado na tabela de taxas, ignorando.`);
                }
            } catch (err) {
                console.error('❌ [Sync] Erro ao sincronizar cliente com taxas de entrega:', err);
            }
        }
    }

    router.get('/clients', authMiddleware, async (req, res) => {
        try {
            res.json(await clientRepo.getAll());
        } catch (e) {
            console.error('❌ [API] Error fetching clients:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/clients', sensitiveLimiter, authMiddleware, async (req, res) => {
        try {
            const client = await clientRepo.add(req.body);
            await syncClientToDeliveryFee(req.body);
            res.json({ success: true, client });
        } catch (e) {
            if (e.message && e.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Telefone já cadastrado para outro cliente.' });
            }
            console.error('❌ [API] Erro ao criar cliente:', e);
            res.status(500).json({ error: 'Erro interno no servidor', message: e.message });
        }
    });

    router.put('/clients/:id', sensitiveLimiter, authMiddleware, async (req, res) => {
        try {
            const changes = await clientRepo.edit(parseInt(req.params.id), req.body);
            await syncClientToDeliveryFee(req.body);
            res.json({ success: true, changes });
        } catch (e) {
            if (e.message && e.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Telefone já cadastrado para outro cliente.' });
            }
            console.error('❌ [API] Erro ao editar cliente:', e);
            res.status(500).json({ error: 'Erro interno no servidor', message: e.message });
        }
    });

    router.delete('/clients/:id', sensitiveLimiter, authMiddleware, async (req, res) => {
        try {
            const changes = await clientRepo.remove(req.params.id);
            res.json({ success: true, deleted: changes });
        } catch (e) {
            console.error('❌ [API] Error deleting client:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ==========================================
    // 🛵 DELIVERY FEES ROUTES (🔒 Protected)
    // ==========================================
    router.get('/delivery-fees', authMiddleware, async (req, res) => {
        try {
            res.json(await deliveryFeeRepo.getAll());
        } catch (e) {
            console.error('❌ [API] Error fetching delivery fees:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/delivery-fees', sensitiveLimiter, authMiddleware, async (req, res) => {
        try {
            const { zipCode, neighborhood } = req.body;
            if (!neighborhood || neighborhood.trim().length < 3) {
                return res.status(400).json({ error: 'Nome de rua/bairro deve ter pelo menos 3 caracteres.' });
            }
            if (!zipCode) {
                return res.status(400).json({ error: 'CEP é obrigatório.' });
            }
            
            const clean = zipCode.replace(/[^\d]/g, '');
            if (clean.length !== 8) {
                return res.status(400).json({ error: 'CEP inválido. Deve possuir 8 dígitos.' });
            }

            const formatted = `${clean.substring(0, 5)}-${clean.substring(5)}`;
            const existing = await deliveryFeeRepo.findByZipCode(formatted);
            if (existing) {
                return res.status(409).json({ error: 'CEP já cadastrado para outra região.' });
            }
            
            const item = await deliveryFeeRepo.add({
                ...req.body,
                zipCode: formatted
            });
            res.json({ success: true, deliveryFee: item });
        } catch (e) {
            if (e.message && e.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'CEP já cadastrado para outra região.' });
            }
            console.error('❌ [API] Erro ao criar taxa de entrega:', e);
            res.status(500).json({ error: 'Erro interno no servidor', message: e.message });
        }
    });

    router.put('/delivery-fees/:id', sensitiveLimiter, authMiddleware, async (req, res) => {
        try {
            const { zipCode, neighborhood } = req.body;
            if (neighborhood && neighborhood.trim().length < 3) {
                return res.status(400).json({ error: 'Nome de rua/bairro deve ter pelo menos 3 caracteres.' });
            }

            if (zipCode) {
                const clean = zipCode.replace(/[^\d]/g, '');
                if (clean.length !== 8) {
                    return res.status(400).json({ error: 'CEP inválido. Deve possuir 8 dígitos.' });
                }

                const formatted = `${clean.substring(0, 5)}-${clean.substring(5)}`;
                const existing = await deliveryFeeRepo.findByZipCode(formatted);
                if (existing && existing.id !== parseInt(req.params.id)) {
                    return res.status(409).json({ error: 'CEP já cadastrado para outra região.' });
                }
                req.body.zipCode = formatted;
            }

            const changes = await deliveryFeeRepo.edit(parseInt(req.params.id), req.body);
            res.json({ success: true, changes });
        } catch (e) {
            if (e.message && e.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'CEP já cadastrado para outra região.' });
            }
            console.error('❌ [API] Erro ao editar taxa de entrega:', e);
            res.status(500).json({ error: 'Erro interno no servidor', message: e.message });
        }
    });

    router.delete('/delivery-fees/:id', sensitiveLimiter, authMiddleware, async (req, res) => {
        try {
            const changes = await deliveryFeeRepo.remove(req.params.id);
            res.json({ success: true, deleted: changes });
        } catch (e) {
            console.error('❌ [API] Error deleting delivery fee:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post('/clients/sync', authMiddleware, async (req, res) => {
        if (!isClientReady()) {
            if (process.env.NODE_ENV === 'development') {
                // Modo teste/desenvolvimento: simula contatos
                const mockContacts = [
                    { name: 'Ana Silva', phone: '5511999998888', jid: '5511999998888@c.us', source: 'whatsapp' },
                    { name: 'Bruno Oliveira', phone: '5521988887777', jid: '5521988887777@c.us', source: 'whatsapp' },
                    { name: 'Carlos Santos', phone: '5531977776666', jid: '5531977776666@c.us', source: 'whatsapp' }
                ];
                let addedCount = 0;
                for (const contact of mockContacts) {
                    const existing = await clientRepo.findByIdentifier(contact.phone);
                    if (!existing) {
                        await clientRepo.add(contact);
                        addedCount++;
                    }
                }
                return res.json({ success: true, message: `Sincronização concluída (Modo Teste). ${addedCount} novos contatos adicionados.`, addedCount });
            }
            return res.status(503).json({ error: 'WhatsApp desconectado. Conecte o WhatsApp para sincronizar.' });
        }
        try {
            const client = getClient();
            const allContacts = await client.getContacts();
            const filtered = allContacts
                .filter(c => c.isWAContact && !c.isGroup && c.id.server === 'c.us')
                .map(c => ({
                    name: c.name || c.pushname || 'Sem nome',
                    phone: c.number || '',
                    jid: c.id._serialized,
                    source: 'whatsapp'
                }));

            let addedCount = 0;
            for (const contact of filtered) {
                const existing = await clientRepo.findByIdentifier(contact.phone);
                if (!existing) {
                    await clientRepo.add(contact);
                    addedCount++;
                }
            }

            res.json({ success: true, message: `Sincronização concluída. ${addedCount} novos contatos adicionados.`, addedCount });
        } catch (e) {
            console.error('❌ [API] Error syncing clients:', e);
            res.status(500).json({ error: 'Erro ao sincronizar contatos.' });
        }
    });

    router.post('/clients/clear-cache', authMiddleware, async (req, res) => {
        try {
            res.json({ success: true, message: 'Cache de contatos limpo com sucesso.' });
        } catch (e) {
            console.error('❌ [API] Error clearing cache:', e);
            res.status(500).json({ error: 'Erro ao limpar cache.' });
        }
    });

    // ==========================================
    // 👥 WHATSAPP CONTACTS ROUTES (🔒 Protected)
    // ==========================================
    router.get('/contacts', authMiddleware, async (req, res) => {
        // // console.log('📡 [API] GET /api/contacts');
        
        if (!isClientReady()) {
            if (process.env.NODE_ENV === 'development') {
                // Modo teste/desenvolvimento: retorna contatos fictícios
                const mockContacts = [
                    { id: '5511999998888@c.us', name: 'Ana Silva', pushname: 'Ana', number: '5511999998888' },
                    { id: '5521988887777@c.us', name: 'Bruno Oliveira', pushname: 'Bruno', number: '5521988887777' },
                    { id: '5531977776666@c.us', name: 'Carlos Santos', pushname: 'Carlos', number: '5531977776666' }
                ];
                return res.json(mockContacts);
            }
            return res.status(503).json({ error: 'Bot desconectado. Conecte o WhatsApp para ver os contatos.' });
        }

        try {
            const client = getClient();
            const allContacts = await client.getContacts();

            // Filter: WA Contacts only, No Groups, Individual server only
            const filtered = allContacts
                .filter(c => c.isWAContact && !c.isGroup && c.id.server === 'c.us')
                .map(c => ({
                    id: c.id._serialized,
                    name: c.name || c.pushname || 'Sem nome',
                    pushname: c.pushname || '',
                    number: c.number || ''
                }))
                // Sort alphabetically by name
                .sort((a, b) => a.name.localeCompare(b.name))
                // Limit to 200 to prevent frontend lag
                .slice(0, 200);

            res.json(filtered);
        } catch (e) {
            console.error('❌ [API] Error fetching contacts:', e);
            res.status(500).json({ error: 'Erro ao buscar contatos no WhatsApp.' });
        }
    });

    // ==========================================
    // 🧠 RAG STATUS ROUTE (🔒 Protected)
    // ==========================================
    router.get('/rag/status', authMiddleware, async (req, res) => {
        try {
            const rawStats = await ragRepo.getStats();
            
            // Format the statistics grouped by source_type
            const stats = {
                totalChunks: 0,
                bySource: {}
            };
            
            for (const item of rawStats) {
                stats.totalChunks += item.count;
                if (!stats.bySource[item.source_type]) {
                    stats.bySource[item.source_type] = {};
                }
                stats.bySource[item.source_type][item.source_id] = item.count;
            }
            
            res.json(stats);
        } catch (e) {
            console.error('❌ [API] Error fetching RAG stats:', e);
            res.status(500).json({ error: 'Erro interno ao buscar estatísticas de RAG.' });
        }
    });

    return router;
}

module.exports = { createApiRouter };
