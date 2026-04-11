require('./instrument');
// Sentry must be initialized before all other modules

const express = require('express');
const http    = require('http');
const { Server }        = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs   = require('fs');
const path = require('path');
const cors = require('cors');

// ==========================================
// 🗄️ REPOSITORIES  (no raw SQL in this file)
// ==========================================
const SettingsRepository  = require('./src/repositories/SettingsRepository');
const KnowledgeRepository = require('./src/repositories/KnowledgeRepository');
const MenuRepository      = require('./src/repositories/MenuRepository');

// ==========================================
// 🚀 EXPRESS + SOCKET.IO SETUP
// ==========================================
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = 3000;

// ==========================================
// 🛡️ MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());

// ==========================================
// 🌐 STATIC FRONTEND FILES
// ==========================================
app.use(express.static(path.join(__dirname, '../botarena-front')));

// Helper: Serve HTML with injected Sentry DSN
function serveHTMLWithSentryDSN(res, filePath) {
    const dsn       = process.env.SENTRY_DSN || '';
    const injection = `<script>window.__SENTRY_DSN__="${dsn}";</script>`;

    fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) {
            console.error('❌ [Static] Error reading HTML:', err);
            return res.status(500).send('Internal Server Error');
        }
        const injectedHTML = html.replace('</head>', `    ${injection}\n</head>`);
        res.type('html').send(injectedHTML);
    });
}

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', (req, res) =>
    serveHTMLWithSentryDSN(res, path.join(__dirname, '../botarena-front/dashboard.html'))
);

app.get('/chat', (req, res) =>
    serveHTMLWithSentryDSN(res, path.join(__dirname, '../botarena-front/chat.html'))
);

// ==========================================
// 📊 STATUS ROUTE
// ==========================================
app.get('/api/status', async (req, res) => {
    console.log('📡 [API] GET /api/status');
    try {
        const config = await SettingsRepository.get();
        const isConnected = config.bot_active === true;
        // Never expose QR payload to REST — QR is socket-only
        res.json({
            connected: isConnected,
            status:    isConnected ? 'CONNECTED' : 'WAITING_QR',
            message:   isConnected ? 'Bot Ativo e Conectado' : 'Aguardando autenticação WhatsApp'
        });
    } catch (e) {
        console.error('❌ [API] Error fetching status:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// 🐞 DEBUG / SENTRY
// ==========================================
app.get('/api/debug-sentry', (req, res) => {
    console.log('🐞 [API] Triggering Sentry debug error...');
    throw new Error('Sentry Backend Test Error - BotArena');
});

// ==========================================
// ⚙️ SETTINGS ROUTES
// ==========================================
app.get('/api/config', async (req, res) => {
    console.log('📡 [API] GET /api/config');
    try {
        res.json(await SettingsRepository.get());
    } catch (e) {
        console.error('❌ [API] Error fetching config:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/config', async (req, res) => {
    console.log('📡 [API] POST /api/config');
    try {
        await SettingsRepository.update(req.body);
        const updatedConfig = await SettingsRepository.get();

        console.log('✅ [API] Config updated successfully.');
        res.json({ success: true, message: 'Config updated', config: updatedConfig });

        io.emit('config_updated', updatedConfig);
    } catch (err) {
        console.error('❌ [API] Error saving config:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// 🚪 LOGOUT ROUTE
// ==========================================
app.post('/api/logout', async (req, res) => {
    console.log('📡 [API] POST /api/logout');
    try {
        await SettingsRepository.update({ bot_active: false });
        isClientReady = false;
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
// 📚 KNOWLEDGE BASE ROUTES
// ==========================================
app.get('/api/knowledge', async (req, res) => {
    console.log('📡 [API] GET /api/knowledge');
    try {
        res.json(await KnowledgeRepository.getAll());
    } catch (e) {
        console.error('❌ [API] Error fetching knowledge:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/knowledge', async (req, res) => {
    console.log('📡 [API] POST /api/knowledge');
    try {
        const { keyword, response, category } = req.body;
        if (!keyword || !response)
            return res.status(400).json({ error: 'keyword and response are required' });

        const entry = await KnowledgeRepository.add(keyword, response, category);
        console.log(`✅ [API] Knowledge entry added: "${keyword}"`);
        res.json({ success: true, entry });
    } catch (e) {
        console.error('❌ [API] Error adding knowledge:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/api/knowledge/:id', async (req, res) => {
    console.log(`📡 [API] DELETE /api/knowledge/${req.params.id}`);
    try {
        const changes = await KnowledgeRepository.remove(req.params.id);
        res.json({ success: true, deleted: changes });
    } catch (e) {
        console.error('❌ [API] Error deleting knowledge:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// 🍽️ DAILY MENU ROUTES
// ==========================================
app.get('/api/menu', async (req, res) => {
    console.log('📡 [API] GET /api/menu');
    try {
        const menu = await MenuRepository.getActive();
        res.json(menu || { message: 'No active menu' });
    } catch (e) {
        console.error('❌ [API] Error fetching menu:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/menu', async (req, res) => {
    console.log('📡 [API] POST /api/menu');
    try {
        const { extracted_text, file_path } = req.body;
        if (!extracted_text)
            return res.status(400).json({ error: 'extracted_text is required' });

        const menu = await MenuRepository.setNewActive(extracted_text, file_path);
        console.log('✅ [API] Daily menu updated.');
        res.json({ success: true, menu });
    } catch (e) {
        console.error('❌ [API] Error adding menu:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/api/menu/:id', async (req, res) => {
    console.log(`📡 [API] DELETE /api/menu/${req.params.id}`);
    try {
        const changes = await MenuRepository.remove(req.params.id);
        res.json({ success: true, deleted: changes });
    } catch (e) {
        console.error('❌ [API] Error deleting menu:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// 📱 WHATSAPP WEB CLIENT
// ==========================================
console.log('🔄 [WhatsApp] Initializing Client...');
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let lastQR = '';
let isClientReady = false; // 🔒 Safety flag — true only when client.on('ready') fires

client.on('qr', (qr) => {
    console.log('📱 [WhatsApp] QR Code generated! Awaiting scan...');
    qrcode.generate(qr, { small: true });
    lastQR = qr;
    io.emit('qr', qr);
    console.log('📡 [Socket] Emitted "qr" event.');
});

client.on('ready', async () => {
    console.log('✅ [WhatsApp] Bot is Online!');
    isClientReady = true;  // ✅ Client fully ready — safe to send messages
    lastQR = '';           // ✅ Clear QR cache — no QR needed while connected
    await SettingsRepository.update({ bot_active: true });
    io.emit('bot_online', { status: 'Bot Ativo', active: true });
    io.emit('auth_success');
    console.log('📡 [Socket] Emitted "bot_online" + "auth_success" events.');
});

client.on('authenticated', () => {
    console.log('🔐 [WhatsApp] Session Authenticated.');
    lastQR = '';
    io.emit('auth_success');
    console.log('📡 [Socket] Emitted "auth_success" event.');
});

client.on('auth_failure', msg => {
    isClientReady = false; // ❌ Auth failed — block outgoing messages
    console.error('❌ [WhatsApp] Authentication failure:', msg);
});

client.on('disconnected', async (reason) => {
    isClientReady = false; // ❌ Disconnected — block outgoing messages
    console.log('⚠️ [WhatsApp] Client Disconnected:', reason);
    await SettingsRepository.update({ bot_active: false });
    io.emit('bot_disconnected', { status: 'Bot Inativo', active: false });
});

// ==========================================
// 🤖 BOT INTELLIGENCE (Smart Auto-Reply)
// ==========================================
const seenContacts = new Set();

/**
 * safeReply — Wraps msg.reply() with a client readiness guard.
 * Prevents Puppeteer crashes when the client disconnects mid-session.
 * @param {Message} msg  - The incoming whatsapp-web.js message object
 * @param {string}  text - The reply text to send
 * @returns {Promise<boolean>} true if sent, false if blocked
 */
async function safeReply(msg, text) {
    if (!isClientReady) {
        console.error('🚫 [Bot] safeReply blocked — client not ready. Message was:', text.substring(0, 60));
        return false;
    }
    try {
        await msg.reply(text);
        return true;
    } catch (err) {
        console.error('❌ [Bot] safeReply failed:', err.message);
        return false;
    }
}

client.on('message_create', async (msg) => {
    // Se a mensagem vier de um grupo, ignora imediatamente
    if (msg.from.endsWith('@g.us')) {
        return; 
    }

    console.log(`💬 [WhatsApp] Message ${msg.fromMe ? 'Sent' : 'Received'} - ID: ${msg.id.id}`);

    if (msg.body) {
        io.emit('new_message', {
            id:        msg.id._serialized,
            from:      msg.from,
            to:        msg.to,
            body:      msg.body,
            fromMe:    msg.fromMe,
            timestamp: msg.timestamp
        });
    }

    if (msg.fromMe || !msg.body) return;

    try {
        const config = await SettingsRepository.get();

        if (!config.bot_active) {
            console.log('🔇 [Bot] Bot is OFF — skipping auto-reply.');
            return;
        }

        const contactId = msg.from;

        // Welcome message (first contact only)
        if (!seenContacts.has(contactId)) {
            seenContacts.add(contactId);
            const greeting = (config.boas_vindas || 'Olá! Como podemos ajudar?')
                .replace(/\{\{empresa\}\}/g, config.empresa || 'BotArena');
            const sent = await safeReply(msg, greeting);
            if (sent) console.log(`👋 [Bot] Welcome message sent to ${contactId}`);
        }

        const text = msg.body.toLowerCase().trim();

        // Cardápio trigger
        if (['cardapio', 'cardápio', 'menu', '!cardapio'].includes(text)) {
            const dailyMenu = await MenuRepository.getActive();
            if (dailyMenu?.extracted_text) {
                if (await safeReply(msg, dailyMenu.extracted_text))
                    console.log(`🍽️ [Bot] Daily menu sent to ${contactId}`);
            } else if (config.cardapio_url) {
                if (await safeReply(msg, `📋 Confira nosso cardápio: ${config.cardapio_url}`))
                    console.log(`🔗 [Bot] Cardápio URL sent to ${contactId}`);
            } else {
                await safeReply(msg, 'Nosso cardápio ainda não está disponível. Tente novamente mais tarde!');
            }
            return;
        }

        // Pix trigger
        if (text.includes('pix') && config.pix) {
            if (await safeReply(msg, `💰 Nossa chave PIX é: ${config.pix}`))
                console.log(`💰 [Bot] Pix key sent to ${contactId}`);
            return;
        }

        // Knowledge Base lookup
        const kbMatch = await KnowledgeRepository.findByKeyword(text);
        if (kbMatch) {
            if (await safeReply(msg, kbMatch.response))
                console.log(`📚 [Bot] KB match "${kbMatch.keyword}" → replied to ${contactId}`);
            return;
        }

        console.log(`🔍 [Bot] No keyword match for: "${text.substring(0, 50)}"`);

    } catch (err) {
        console.error('❌ [Bot] Error in auto-reply:', err);
    }
});

client.initialize();

// ==========================================
// 🔌 SOCKET.IO — Connection Handlers
// ==========================================
io.on('connection', async (socket) => {
    console.log(`🔌 [Socket] New connection: ${socket.id}`);

    const currentConfig = await SettingsRepository.get();
    console.log(`📡 [Socket] Sending bot_active = ${currentConfig.bot_active}`);
    socket.emit('bot_status', {
        active:  currentConfig.bot_active === true,
        message: currentConfig.bot_active ? 'Bot Ativo' : 'Bot Inativo'
    });

    if (lastQR && !currentConfig.bot_active) {
        console.log(`📡 [Socket] Sending cached QR to ${socket.id}`);
        socket.emit('qr', lastQR);
    }

    socket.on('disconnect', () => {
        console.log(`🔌 [Socket] Disconnected: ${socket.id}`);
    });

    socket.on('send_message', async (data) => {
        console.log(`💬 [Frontend] Outbound: ${data.body.substring(0, 30)}...`);
        try {
            if (!isClientReady) {
                console.error('🚫 [Frontend] send_message blocked — client not ready.');
                socket.emit('message_error', { error: 'WhatsApp client not ready. Try again.' });
                return;
            }
            const target = data.to || 'status@broadcast';
            await client.sendMessage(target, data.body);
            console.log(`✅ [WhatsApp] Message sent to ${target}`);
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
});

// ==========================================
// 🛡️ SENTRY ERROR HANDLER (after all routes)
// ==========================================
const Sentry = require('@sentry/node');
Sentry.setupExpressErrorHandler(app);

// ==========================================
// 🚀 SERVER START
// ==========================================
server.listen(PORT, () => {
    console.log('==========================================');
    console.log(`🚀 [Server] Running on http://localhost:${PORT}`);
    console.log(`📡 [Socket] WebSocket listening on port ${PORT}`);
    console.log('==========================================');
});
