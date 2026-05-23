const jwt = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');

/**
 * setupSocket — Configures Socket.IO authentication and connection handlers.
 * @param {Server} io    - Socket.IO server instance
 * @param {Object} deps  - Injected dependencies
 * @param {Function} deps.getClient       - Returns the WhatsApp client
 * @param {Function} deps.isClientReady   - Returns true when WA client is ready
 * @param {Function} deps.getLastQR       - Returns the last cached QR code string
 * @param {Object}   deps.settingsRepo    - SettingsRepository instance
 * @param {Object}   deps.menuRepo        - MenuRepository instance
 */
function setupSocket(io, { getClient, isClientReady, getLastQR, settingsRepo, menuRepo }) {

    // ==========================================
    // 🔐 SOCKET AUTH MIDDLEWARE
    // ==========================================
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token
            || socket.handshake.headers?.authorization?.split(' ')[1];
        if (!token) return next(new Error('Authentication error: token required'));
        try {
            socket.user = jwt.verify(token, process.env.JWT_SECRET);
            next();
        } catch {
            next(new Error('Authentication error: invalid token'));
        }
    });

    // ==========================================
    // 🔌 CONNECTION HANDLERS
    // ==========================================
    io.on('connection', async (socket) => {
        // console.log(`🔌 [Socket] Authenticated connection: ${socket.id} (user: ${socket.user?.email || 'unknown'})`);

        const currentConfig = await settingsRepo.get();
        // console.log(`📡 [Socket] Sending bot_active = ${currentConfig.bot_active}`);
        socket.emit('bot_status', {
            active:  currentConfig.bot_active === true,
            message: currentConfig.bot_active ? 'Bot Ativo' : 'Bot Inativo'
        });

        const lastQR = getLastQR();
        if (lastQR && !currentConfig.bot_active) {
            // console.log(`📡 [Socket] Sending cached QR to ${socket.id}`);
            socket.emit('qr', lastQR);
        }

        socket.on('disconnect', () => {
            // console.log(`🔌 [Socket] Disconnected: ${socket.id}`);
        });

        socket.on('send_message', async (data) => {
            if (data.body) {
                data.body = sanitizeHtml(data.body, { allowedTags: [], allowedAttributes: {} });
            }
            // console.log(`💬 [Frontend] Outbound: ${data.body.substring(0, 30)}...`);
            try {
                if (!isClientReady()) {
                    console.error('🚫 [Frontend] send_message blocked — client not ready.');
                    socket.emit('message_error', { error: 'WhatsApp client not ready. Try again.' });
                    return;
                }

                let target = data.to || 'status@broadcast';

                // Task 1: JID Sanitizer Middleware
                const formatJID = (id) => {
                    if (!id.includes('@')) return `${id}@c.us`;
                    return id;
                };
                target = formatJID(target);

                // 🔒 Sandbox Lock Mode (Evita envios para outros números)
                if (process.env.SANDBOX_MODE === 'true') {
                    if (!global.sandboxTargetJid) {
                        global.sandboxTargetJid = target;
                        console.log(`🔒 [Sandbox] Chat travado globalmente para o contato: ${global.sandboxTargetJid}`);
                    }
                    if (target !== global.sandboxTargetJid) {
                        console.error(`🚫 [Sandbox] Envio bloqueado para ${target} (travado em ${global.sandboxTargetJid})`);
                        socket.emit('message_error', { error: 'Envio bloqueado em Modo Sandbox' });
                        return;
                    }
                }

                // Task 1: TRAVA DE SEGURANÇA GLOBAL
                const blockedTargets = ['status@broadcast', 'g.us'];
                if (blockedTargets.some(bTarget => target.includes(bTarget))) {
                    console.error(`❌ [Security] Bloqueio de envio detectado para: ${target}`);
                    socket.emit('message_error', { error: 'Target Bloqueado' });
                    return { error: 'Target Bloqueado' };
                }

                const client = getClient();
                await client.sendMessage(target, data.body);
                // console.log(`✅ [WhatsApp] Message sent to ${target}`);
            } catch (err) {
                console.error('❌ [WhatsApp] Error sending message:', err.message);
            }

            io.emit('new_message', {
                id:        'mw_' + Date.now(),
                from:      'me',
                to:        data.to || 'customer',
                body:      data.body,
                fromMe:    true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        });

        // --- Sprint: Menu Asset Management (Direct Trigger) ---
        socket.on('send_menu_media', async (data) => {
            // console.log(`🍽️ [Socket] Triggering media menu send to ${data.to}...`);
            try {
                if (!isClientReady()) return;
                
                const slot = data.slot || 'lunch';
                const dailyMenu = await menuRepo.getLatestAsset(slot);
                if (dailyMenu && dailyMenu.base64_data && dailyMenu.mimetype) {
                    const { MessageMedia } = require('whatsapp-web.js');
                    const client = getClient();
                    const media = new MessageMedia(dailyMenu.mimetype, dailyMenu.base64_data, 'cardapio');
                    
                    const target = (data.to && !data.to.includes('@')) ? `${data.to}@c.us` : data.to;

                    // 🔒 Sandbox Lock Mode (Evita envios para outros números)
                    if (process.env.SANDBOX_MODE === 'true') {
                        if (!global.sandboxTargetJid) {
                            global.sandboxTargetJid = target;
                            console.log(`🔒 [Sandbox] Chat travado globalmente para o contato: ${global.sandboxTargetJid}`);
                        }
                        if (target !== global.sandboxTargetJid) {
                            console.error(`🚫 [Sandbox] Envio de mídia bloqueado para ${target} (travado em ${global.sandboxTargetJid})`);
                            socket.emit('message_error', { error: 'Envio de mídia bloqueado em Modo Sandbox' });
                            return;
                        }
                    }

                    await client.sendMessage(target, media);
                    
                    // console.log(`✅ [WhatsApp] Media menu sent to ${target}`);
                    
                    // Notify UI of the media message
                    io.emit('new_message', {
                        id:        'mm_' + Date.now(),
                        from:      'me',
                        to:        target,
                        body:      '📎 Cardápio (Arquivo Enviado)',
                        fromMe:    true,
                        timestamp: Math.floor(Date.now() / 1000)
                    });
                } else {
                    console.warn('⚠️ [Socket] No binary menu found to send.');
                    socket.emit('message_error', { error: 'Nenhum arquivo de cardápio anexado.' });
                }
            } catch (err) {
                console.error('❌ [Socket] Error sending menu media:', err);
            }
        });
        // ==========================================
        // 🧪 SIMULATION ENGINE (Test only)
        // ==========================================
        socket.on('simulate_inbound_message', async (data) => {
            // console.log(`🧪 [Simulation] Incoming virtual message: "${data.body}" from ${data.pushname}`);
            
            // Mocking the WhatsApp Message object for the handler
            const mockMsg = {
                id: { _serialized: 'sim_' + Date.now(), fromMe: false },
                from: data.from || '5511999999999@c.us',
                to: 'me',
                body: data.body,
                pushname: data.pushname || 'Cliente Simulado',
                timestamp: Math.floor(Date.now() / 1000),
                fromMe: false,
                isStatus: false,
                // Mocking the reply function to redirect to Socket.IO instead of WhatsApp
                reply: async (text) => {
                    // console.log(`🤖 [Bot Simulation] Replying: "${text}"`);
                    io.emit('new_message', {
                        id: 'sim_reply_' + Date.now(),
                        from: 'me',
                        to: data.from || '5511999999999@c.us',
                        body: text,
                        fromMe: true,
                        timestamp: Math.floor(Date.now() / 1000)
                    });
                }
            };

            // Trigger the bot logic manually
            // We need to access the bot logic. Since it's attached via client.on, 
            // we can just emit it on the client if we have it, or call the handler logic.
            const client = getClient();
            if (client) {
                client.emit('message_create', mockMsg);
            }
        });
    });
}

module.exports = { setupSocket };
