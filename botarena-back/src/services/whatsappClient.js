const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { setupBotHandler } = require('../handlers/botHandler');

// ==========================================
// 📱 WHATSAPP WEB CLIENT
// ==========================================
let client;
let lastQR = '';
let _isClientReady = false; // 🔒 Safety flag — true only when client.on('ready') fires

/**
 * initWhatsApp — Creates and initializes the WhatsApp client.
 * Hooks up all lifecycle events and the bot auto-reply handler.
 * @param {Server} io    - Socket.IO server instance (for emitting events to frontend)
 * @param {Object} repos - Injected repository instances
 * @param {Object} repos.settingsRepo
 * @param {Object} repos.knowledgeRepo
 * @param {Object} repos.menuRepo
 */
function initWhatsApp(io, repos) {
    const { settingsRepo } = repos;

    console.log('🔄 [WhatsApp] Initializing Client...');
    client = new Client({
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

    client.on('qr', (qr) => {
        console.log('📱 [WhatsApp] QR Code generated! Awaiting scan...');
        qrcode.generate(qr, { small: true });
        lastQR = qr;
        io.emit('qr', qr);
        console.log('📡 [Socket] Emitted "qr" event.');
    });

    client.on('ready', async () => {
        console.log('✅ [WhatsApp] Bot is Online!');
        _isClientReady = true;  // ✅ Client fully ready — safe to send messages
        lastQR = '';            // ✅ Clear QR cache — no QR needed while connected
        await settingsRepo.update({ bot_active: true });
        io.emit('bot_online', { status: 'Bot Ativo', active: true });

        // Task 3: Connection Handshake Fix (Small delay)
        setTimeout(() => {
            io.emit('auth_success');
            console.log('📡 [Socket] Emitted "auth_success" event after delay.');
        }, 500);
        console.log('📡 [Socket] Emitted "bot_online" + "auth_success" events.');
    });

    client.on('authenticated', () => {
        console.log('🔐 [WhatsApp] Session Authenticated.');
        lastQR = '';

        // Task 3: Connection Handshake Fix
        setTimeout(() => {
            io.emit('auth_success');
            console.log('📡 [Socket] Emitted "auth_success" event after delay.');
        }, 500);
        console.log('📡 [Socket] Emitted "auth_success" event.');
    });

    client.on('auth_failure', msg => {
        _isClientReady = false; // ❌ Auth failed — block outgoing messages
        console.error('❌ [WhatsApp] Authentication failure:', msg);
    });

    client.on('disconnected', async (reason) => {
        _isClientReady = false; // ❌ Disconnected — block outgoing messages
        console.log('⚠️ [WhatsApp] Client Disconnected:', reason);
        await settingsRepo.update({ bot_active: false });
        io.emit('bot_disconnected', { status: 'Bot Inativo', active: false });
    });

    // Attach bot auto-reply handler
    setupBotHandler(client, io, isClientReady, repos);

    client.initialize();
}

// ==========================================
// 📦 EXPORTED ACCESSORS
// ==========================================
function getClient()       { return client; }
function isClientReady()   { return _isClientReady; }
function setClientReady(v) { _isClientReady = v; }
function getLastQR()       { return lastQR; }

module.exports = { initWhatsApp, getClient, isClientReady, setClientReady, getLastQR };
