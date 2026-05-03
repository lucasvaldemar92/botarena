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

// ==========================================
// 🛡️ CORS CONFIGURATION (SEC-001)
// ==========================================
const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',') 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
};

const jwt = require('jsonwebtoken');

const io     = new Server(server, {
    cors: corsOptions
});

// ==========================================
// 🔐 SOCKET AUTH MIDDLEWARE
// ==========================================
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error: token required'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Autenticação inválida'));
  }
});

const PORT = 3000;

// ==========================================
// 🛡️ MIDDLEWARE
// ==========================================
app.use(cors(corsOptions));
app.use(express.json());

// ==========================================
// 🌐 STATIC FRONTEND FILES
// ==========================================
app.use(express.static(path.join(__dirname, '../botarena-front')));

// ==========================================
// 🚀 IN-MEMORY HTML CACHE (PERF-001)
// ==========================================
const htmlCache = {};
const dsn = process.env.SENTRY_DSN || '';
const injection = `<script>window.__SENTRY_DSN__="${dsn}";</script>`;

try {
    const dashboardPath = path.join(__dirname, '../botarena-front/dashboard.html');
    const chatPath = path.join(__dirname, '../botarena-front/chat.html');
    
    htmlCache['dashboard'] = fs.readFileSync(dashboardPath, 'utf8').replace('</head>', `    ${injection}\n</head>`);
    htmlCache['chat'] = fs.readFileSync(chatPath, 'utf8').replace('</head>', `    ${injection}\n</head>`);
    console.log('✅ [Cache] Static HTML files loaded into memory.');
} catch (err) {
    console.error('❌ [Cache] Error loading HTML files:', err);
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
    
    // Dynamic read in development, memory cache in production
    if (process.env.NODE_ENV !== 'production') {
        const dashboardPath = path.join(__dirname, '../botarena-front/dashboard.html');
        const content = fs.readFileSync(dashboardPath, 'utf8').replace('</head>', `    ${injection}\n</head>`);
        return res.type('html').send(content);
    }
    
    res.type('html').send(htmlCache['dashboard']);
});

app.get('/chat', (req, res) => {
    // Dynamic read in development, memory cache in production
    if (process.env.NODE_ENV !== 'production') {
        const chatPath = path.join(__dirname, '../botarena-front/chat.html');
        const content = fs.readFileSync(chatPath, 'utf8').replace('</head>', `    ${injection}\n</head>`);
        return res.type('html').send(content);
    }
    
    res.type('html').send(htmlCache['chat']);
});

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
setupSocket(io, { getClient, isClientReady, getLastQR, settingsRepo, menuRepo });

// ==========================================
// 🚀 SERVER START
// ==========================================
server.listen(PORT, () => {
    console.log('==========================================');
    console.log(`🚀 [Server] Running on http://localhost:${PORT}`);
    console.log(`📡 [Socket] WebSocket listening on port ${PORT}`);
    console.log('==========================================');
});
