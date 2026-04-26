require('./instrument');
// Sentry must be initialized before all other modules

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const fs   = require('fs');
const path = require('path');
const cors = require('cors');
const Sentry = require('@sentry/node');

// ==========================================
// 📦 MODULAR IMPORTS
// ==========================================
const { createApiRouter } = require('./src/routes/api');
const { initWhatsApp, getClient, isClientReady, setClientReady, getLastQR } = require('./src/services/whatsappClient');
const { setupSocket }     = require('./src/socket/events');
const { settingsRepo, knowledgeRepo, menuRepo } = require('./src/container');

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

app.get('/dashboard', async (req, res) => {
    try {
        const config = await settingsRepo.get();
        if (config.bot_active) {
            return res.redirect('/chat');
        }
    } catch (err) {
        console.error('❌ Middleware checking config failed:', err);
    }
    serveHTMLWithSentryDSN(res, path.join(__dirname, '../botarena-front/dashboard.html'))
});

app.get('/chat', (req, res) =>
    serveHTMLWithSentryDSN(res, path.join(__dirname, '../botarena-front/chat.html'))
);

// ==========================================
// 📡 API ROUTES (modular)
// ==========================================
const repos = { settingsRepo, knowledgeRepo, menuRepo };

app.use('/api', createApiRouter({
    io, getClient, isClientReady, setClientReady,
    ...repos
}));

// ==========================================
// 🛡️ SENTRY ERROR HANDLER (after all routes)
// ==========================================
Sentry.setupExpressErrorHandler(app);

// ==========================================
// 📱 WHATSAPP CLIENT (modular)
// ==========================================
initWhatsApp(io, repos);

// ==========================================
// 🔌 SOCKET.IO (modular)
// ==========================================
setupSocket(io, { getClient, isClientReady, getLastQR, settingsRepo });

// ==========================================
// 🚀 SERVER START
// ==========================================
server.listen(PORT, () => {
    console.log('==========================================');
    console.log(`🚀 [Server] Running on http://localhost:${PORT}`);
    console.log(`📡 [Socket] WebSocket listening on port ${PORT}`);
    console.log('==========================================');
});
