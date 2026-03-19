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
                bot_active: Boolean(row?.bot_active) // Convert 1/0 to true/false
            });
        });
    });
}
function updateConfigDB(newConfig) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`UPDATE settings SET 
            empresa = COALESCE(?, empresa),
            pix = COALESCE(?, pix),
            cardapio_url = COALESCE(?, cardapio_url),
            boas_vindas = COALESCE(?, boas_vindas),
            bot_active = COALESCE(?, bot_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`);
        
        stmt.run(
            newConfig.empresa, 
            newConfig.pix, 
            newConfig.cardapio_url, 
            newConfig.boas_vindas, 
            newConfig.bot_active !== undefined ? (newConfig.bot_active ? 1 : 0) : null,
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
        stmt.finalize();
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

// Map explicit routes to HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../botarena-front/index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../botarena-front/dashboard.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, '../botarena-front/chat.html'));
});

// ==========================================
// 🚀 EXPRESS API LOGIC
// ==========================================
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

client.on('message_create', async (msg) => {
    console.log(`💬 [WhatsApp] Message ${msg.fromMe ? 'Sent' : 'Received'} - ID: ${msg.id.id}`);
    
    // Only broadcast meaningful messages
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
        
        // --- REAL INTEGRATION TODO: ---
        // client.sendMessage(data.to, data.body);

        // For now, immediately broadcast it back so the UI displays it
        io.emit('new_message', {
            id: 'simulated_' + Date.now(),
            from: 'me',
            to: 'customer',
            body: data.body,
            fromMe: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    });
});

// ==========================================
// 🚀 SERVER START
// ==========================================
server.listen(PORT, () => {
    console.log('==========================================');
    console.log(`🚀 [Server] Running on http://localhost:${PORT}`);
    console.log(`📡 [Socket] WebSocket listening on port ${PORT}`);
    console.log('==========================================');
});
