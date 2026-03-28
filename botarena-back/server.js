require('./instrument');
// Sentry must be initialized before all other modules

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allows dashboard to connect
        methods: ['GET', 'POST']
    }
});

const PORT = 3000;

// ==========================================
// 🗄️ SQLITE DATABASE SETUP
// ==========================================
const dbPath = path.join(__dirname, 'database', 'botarena.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ [DB] Error opening database:', err);
    else console.log('✅ [DB] Connected to SQLite database.');
});

// DB schema is managed externally via sql_scripts/schema.sql

// Helper to Read Config from DB (Promise-based)
function getConfigDB() {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM settings WHERE id = 1', (err, row) => {
            if (err) reject(err);
            else resolve({
                ...row,
                bot_active: Boolean(row?.bot_active) // 1/0 -> true/false
            });
        });
    });
}
function updateConfigDB(newConfig) {
    return new Promise((resolve, reject) => {
        // Build dynamic query to avoid overwriting with NULL if partial payload
        const stmt = db.prepare(`UPDATE settings SET 
            empresa = COALESCE(?, empresa),
            pix = COALESCE(?, pix),
            cardapio_url = COALESCE(?, cardapio_url),
            boas_vindas = COALESCE(?, boas_vindas),
            bot_active = CASE 
                WHEN ? IS NOT NULL THEN ? 
                ELSE bot_active 
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`);
        
        const botVal = newConfig.bot_active !== undefined ? (newConfig.bot_active ? 1 : 0) : null;
        
        stmt.run(
            newConfig.empresa || null, 
            newConfig.pix || null, 
            newConfig.cardapio_url || null, 
            newConfig.boas_vindas || null, 
            botVal,
            botVal,
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
        stmt.finalize();
    });
}

// ==========================================
// 📚 KNOWLEDGE BASE DB HELPERS
// ==========================================
function getAllKnowledge() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM knowledge_base ORDER BY id DESC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}
function addKnowledge(keyword, response, category = 'faq') {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO knowledge_base (keyword, response, category) VALUES (?, ?, ?)',
            [keyword, response, category],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, keyword, response, category });
            }
        );
    });
}
function deleteKnowledge(id) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM knowledge_base WHERE id = ?', [id], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}
function findKnowledgeByKeyword(text) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM knowledge_base', (err, rows) => {
            if (err) reject(err);
            else {
                const normalized = text.toLowerCase().trim();
                const match = (rows || []).find(row =>
                    normalized.includes(row.keyword.toLowerCase())
                );
                resolve(match || null);
            }
        });
    });
}

// ==========================================
// 🍽️ DAILY MENU DB HELPERS
// ==========================================
function getActiveMenu() {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM daily_menu WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1', (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}
function addMenu(extractedText, filePath = null) {
    return new Promise((resolve, reject) => {
        // Deactivate previous menus
        db.run('UPDATE daily_menu SET is_active = 0', [], (err) => {
            if (err) return reject(err);
            db.run(
                'INSERT INTO daily_menu (file_path, extracted_text, is_active) VALUES (?, ?, 1)',
                [filePath, extractedText],
                function(err2) {
                    if (err2) reject(err2);
                    else resolve({ id: this.lastID, extracted_text: extractedText, is_active: true });
                }
            );
        });
    });
}
function deleteMenu(id) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM daily_menu WHERE id = ?', [id], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// 🌐 STATIC FRONTEND FILES
// ==========================================
// Serve all CSS, JS, and image assets from the frontend directory
app.use(express.static(path.join(__dirname, '../botarena-front')));

// Helper: Serve HTML with injected Sentry DSN
function serveHTMLWithSentryDSN(res, filePath) {
    const dsn = process.env.SENTRY_DSN || '';
    const injection = `<script>window.__SENTRY_DSN__="${dsn}";</script>`;
    
    fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) {
            console.error('❌ [Static] Error reading HTML:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Inject DSN script right before the closing </head> tag
        const injectedHTML = html.replace('</head>', `    ${injection}\n</head>`);
        res.type('html').send(injectedHTML);
    });
}

// Map explicit routes to HTML files
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
    serveHTMLWithSentryDSN(res, path.join(__dirname, '../botarena-front/dashboard.html'));
});

app.get('/chat', (req, res) => {
    serveHTMLWithSentryDSN(res, path.join(__dirname, '../botarena-front/chat.html'));
});

// ==========================================
// 🚀 EXPRESS API LOGIC
// ==========================================
app.get('/api/debug-sentry', (req, res) => {
    console.log('🐞 [API] Triggering Sentry debug error...');
    throw new Error('Sentry Backend Test Error - BotArena');
});

app.get('/api/config', async (req, res) => {
    console.log('📡 [API] GET /api/config requested.');
    try {
        const configData = await getConfigDB();
        res.json(configData);
    } catch (e) {
        console.error('❌ [API] Error fetching config:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/config', async (req, res) => {
    console.log('📡 [API] POST /api/config received new payload.');
    try {
        await updateConfigDB(req.body);
        const updatedConfig = await getConfigDB();
        
        console.log('✅ [API] database config updated successfully.');
        res.json({ success: true, message: 'Config updated', config: updatedConfig });
        
        // Broadcast new config/state if needed
        io.emit('config_updated', updatedConfig);
    } catch (err) {
        console.error('❌ [API] Error saving config into DB:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// 📚 KNOWLEDGE BASE API
// ==========================================
app.get('/api/knowledge', async (req, res) => {
    console.log('📡 [API] GET /api/knowledge requested.');
    try {
        const entries = await getAllKnowledge();
        res.json(entries);
    } catch (e) {
        console.error('❌ [API] Error fetching knowledge:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/knowledge', async (req, res) => {
    console.log('📡 [API] POST /api/knowledge received.');
    try {
        const { keyword, response, category } = req.body;
        if (!keyword || !response) {
            return res.status(400).json({ error: 'keyword and response are required' });
        }
        const entry = await addKnowledge(keyword, response, category);
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
        const changes = await deleteKnowledge(req.params.id);
        res.json({ success: true, deleted: changes });
    } catch (e) {
        console.error('❌ [API] Error deleting knowledge:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// 🍽️ DAILY MENU API
// ==========================================
app.get('/api/menu', async (req, res) => {
    console.log('📡 [API] GET /api/menu requested.');
    try {
        const menu = await getActiveMenu();
        res.json(menu || { message: 'No active menu' });
    } catch (e) {
        console.error('❌ [API] Error fetching menu:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/menu', async (req, res) => {
    console.log('📡 [API] POST /api/menu received.');
    try {
        const { extracted_text, file_path } = req.body;
        if (!extracted_text) {
            return res.status(400).json({ error: 'extracted_text is required' });
        }
        const menu = await addMenu(extracted_text, file_path);
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
        const changes = await deleteMenu(req.params.id);
        res.json({ success: true, deleted: changes });
    } catch (e) {
        console.error('❌ [API] Error deleting menu:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// 📱 WHATSAPP WEB LOGIC
// ==========================================
console.log('🔄 [WhatsApp] Initializing Client...');
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let lastQR = '';

client.on('qr', (qr) => {
    console.log('📱 [WhatsApp] QR Code generated! Awaiting scan...');
    qrcode.generate(qr, { small: true });
    
    // Cache the QR code for connecting clients
    lastQR = qr;
    
    // Emit QR to Socket.io for the frontend
    io.emit('qr', qr);
    console.log('📡 [Socket] Emitted "qr" event to frontend.');
});

client.on('ready', async () => {
    console.log('✅ [WhatsApp] Bot is Online!');
    
    // Auto-update config to set bot_active true
    await updateConfigDB({ bot_active: true });
    
    io.emit('bot_online', { status: 'Bot Ativo', active: true });
    console.log('📡 [Socket] Emitted "bot_online" event.');
});

client.on('authenticated', () => {
    console.log('🔐 [WhatsApp] Session Authenticated successfully.');
    lastQR = ''; // clear cache once authenticated
});

client.on('auth_failure', msg => {
    console.error('❌ [WhatsApp] Authentication failure:', msg);
});

client.on('disconnected', async (reason) => {
    console.log('⚠️ [WhatsApp] Client Disconnected:', reason);
    
    await updateConfigDB({ bot_active: false });
    
    io.emit('bot_disconnected', { status: 'Bot Inativo', active: false });
});

// ==========================================
// 🤖 BOT INTELLIGENCE (Smart Auto-Reply)
// ==========================================
const seenContacts = new Set(); // Track greeted contacts (resets on restart)

client.on('message_create', async (msg) => {
    console.log(`💬 [WhatsApp] Message ${msg.fromMe ? 'Sent' : 'Received'} - ID: ${msg.id.id}`);
    
    // Broadcast every message to the dashboard
    if (msg.body) {
        io.emit('new_message', {
            id: msg.id._serialized,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            fromMe: msg.fromMe,
            timestamp: msg.timestamp
        });
    }

    // Only auto-reply to INCOMING messages (not our own)
    if (msg.fromMe || !msg.body) return;

    try {
        const config = await getConfigDB();

        // Skip auto-reply if bot is deactivated
        if (!config.bot_active) {
            console.log('🔇 [Bot] Bot is OFF — skipping auto-reply.');
            return;
        }

        const contactId = msg.from;

        // --- Welcome Message (first contact only) ---
        if (!seenContacts.has(contactId)) {
            seenContacts.add(contactId);
            const greeting = (config.boas_vindas || 'Olá! Como podemos ajudar?')
                .replace(/\{\{empresa\}\}/g, config.empresa || 'BotArena');
            await msg.reply(greeting);
            console.log(`👋 [Bot] Welcome message sent to ${contactId}`);
        }

        const text = msg.body.toLowerCase().trim();

        // --- Cardápio / Menu trigger ---
        const menuKeywords = ['cardapio', 'cardápio', 'menu', '!cardapio'];
        if (menuKeywords.includes(text)) {
            // Try daily_menu first, fallback to cardapio_url
            const dailyMenu = await getActiveMenu();
            if (dailyMenu && dailyMenu.extracted_text) {
                await msg.reply(dailyMenu.extracted_text);
                console.log(`🍽️ [Bot] Daily menu sent to ${contactId}`);
            } else if (config.cardapio_url) {
                await msg.reply(`📋 Confira nosso cardápio: ${config.cardapio_url}`);
                console.log(`🔗 [Bot] Cardápio URL sent to ${contactId}`);
            } else {
                await msg.reply('Nosso cardápio ainda não está disponível. Tente novamente mais tarde!');
            }
            return;
        }

        // --- Pix trigger ---
        if (text.includes('pix') && config.pix) {
            await msg.reply(`💰 Nossa chave PIX é: ${config.pix}`);
            console.log(`💰 [Bot] Pix key sent to ${contactId}`);
            return;
        }

        // --- Knowledge Base lookup ---
        const kbMatch = await findKnowledgeByKeyword(text);
        if (kbMatch) {
            await msg.reply(kbMatch.response);
            console.log(`📚 [Bot] KB match "${kbMatch.keyword}" → replied to ${contactId}`);
            return;
        }

        // No match — stay silent (avoid spam)
        console.log(`🔍 [Bot] No keyword match for: "${text.substring(0, 50)}"`);

    } catch (err) {
        console.error('❌ [Bot] Error in auto-reply:', err);
    }
});

client.initialize();

// ==========================================
// 🔌 SOCKET.IO LOGIC
// ==========================================
io.on('connection', async (socket) => {
    console.log(`🔌 [Socket] New frontend connection established: ${socket.id}`);
    
    // Send current bot_active status from config
    const currentConfig = await getConfigDB();
    console.log(`📡 [Socket] Sending initial bot_active status: ${currentConfig.bot_active}`);
    socket.emit('bot_status', { 
        active: currentConfig.bot_active === true, 
        message: currentConfig.bot_active ? 'Bot Ativo' : 'Bot Inativo' 
    });

    // If there is a pending QR code and bot isn't active, send it immediately
    if (lastQR && !currentConfig.bot_active) {
        console.log(`📡 [Socket] Sending cached QR code to ${socket.id}`);
        socket.emit('qr', lastQR);
    }

    socket.on('disconnect', () => {
        console.log(`🔌 [Socket] Frontend disconnected: ${socket.id}`);
    });

    // Handle outbound messages from the frontend Chat Interface
    socket.on('send_message', async (data) => {
        console.log(`💬 [Frontend] Outbound message received: ${data.body.substring(0, 30)}...`);
        
        try {
            // Send the real WhatsApp message!
            if (client && client.info) {
                // Determine the target (usually a chat ID passed from frontend, or a default)
                const target = data.to || 'status@broadcast'; // Fallback
                await client.sendMessage(target, data.body);
                console.log(`✅ [WhatsApp] Message sent to ${target}`);
            }
        } catch (err) {
            console.error('❌ [WhatsApp] Error sending message:', err);
        }

        // Broadcast it back so the UI displays it immediately
        io.emit('new_message', {
            id: 'mw_' + Date.now(),
            from: 'me',
            to: data.to || 'customer',
            body: data.body,
            fromMe: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    });
});

// ==========================================
// 🛡️ SENTRY ERROR HANDLER (must be after all routes)
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
