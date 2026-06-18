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
const { settingsRepo, knowledgeRepo, menuRepo, clientRepo, deliveryFeeRepo, deliveryRangeRepo, ragRepo, ragService, orderRepo, catalogRepo, userRepo } = require('./src/container');
const db                  = require('./src/db/drivers/sqlite');
const { autoSeed }        = require('./src/db/seed');

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
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080', 'http://127.0.0.1:8080'];

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

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ==========================================
// 🌐 STATIC FRONTEND FILES
// ==========================================
app.use(express.static(path.join(__dirname, '../botarena-front')));
app.use('/qa-evidence', express.static(path.join(__dirname, '../qa-evidence')));

// ==========================================
// 🚀 IN-MEMORY HTML CACHE (PERF-001)
// ==========================================
const htmlCache = {};
const dsn = process.env.SENTRY_DSN || '';
const sentryInjection = `<script>window.__SENTRY_DSN__="${dsn}";</script>`;

try {
    const dashboardPath = path.join(__dirname, '../botarena-front/painel-administrativo.html');
    const chatPath = path.join(__dirname, '../botarena-front/atendimento.html');
    const cardapioPath = path.join(__dirname, '../botarena-front/cardapio.html');
    
    htmlCache['dashboard'] = fs.readFileSync(dashboardPath, 'utf8');
    htmlCache['chat'] = fs.readFileSync(chatPath, 'utf8');
    htmlCache['cardapio'] = fs.readFileSync(cardapioPath, 'utf8');
} catch (err) {
    console.error('❌ [Cache] Error loading HTML files:', err);
}

async function renderHtml(pageName, isDev = false) {
    let content = '';
    if (isDev) {
        let filePath = '';
        if (pageName === 'dashboard') filePath = path.join(__dirname, '../botarena-front/painel-administrativo.html');
        else if (pageName === 'chat') filePath = path.join(__dirname, '../botarena-front/atendimento.html');
        else if (pageName === 'cardapio') filePath = path.join(__dirname, '../botarena-front/cardapio.html');
        content = fs.readFileSync(filePath, 'utf8');
    } else {
        content = htmlCache[pageName];
    }

    let config = {};
    try {
        config = await settingsRepo.get();
    } catch (e) {}

    let dynamicInjection = sentryInjection;

    if (config.google_analytics_id) {
        dynamicInjection += `\n    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${config.google_analytics_id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${config.google_analytics_id}');
    </script>`;
    }

    if (config.google_tag_manager_id) {
        dynamicInjection += `\n    <!-- Google Tag Manager -->
    <script>
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${config.google_tag_manager_id}');
    </script>`;
    }

    if (config.google_site_verification) {
        dynamicInjection += `\n    <meta name="google-site-verification" content="${config.google_site_verification}" />`;
    }

    let bodyInjection = '';
    if (config.google_tag_manager_id) {
        bodyInjection = `\n    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${config.google_tag_manager_id}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
    }

    let html = content.replace('</head>', `    ${dynamicInjection}\n</head>`);
    if (bodyInjection) {
        html = html.replace('<body>', `<body>${bodyInjection}`);
    }
    
    // Inject maps api key as global var if needed by frontend JS
    if (config.google_maps_api_key) {
        html = html.replace('</head>', `    <script>window.__GOOGLE_MAPS_API_KEY__="${config.google_maps_api_key}";</script>\n</head>`);
    }

    return html;
}


app.get('/', (req, res) => res.redirect('/dashboard/whatsapp'));

app.get(['/painel-administrativo', '/dashboard', '/dashboard/:tab'], async (req, res) => {
    try {
        const config = await settingsRepo.get();
        if (config.bot_active && process.env.NODE_ENV === 'production' && !req.path.startsWith('/dashboard')) {
            return res.redirect('/atendimento');
        }
    } catch (err) {
        console.error('❌ Middleware checking config failed:', err);
    }
    
    const isDev = process.env.NODE_ENV !== 'production';
    const html = await renderHtml('dashboard', isDev);
    res.type('html').send(html);
});

app.get('/atendimento', async (req, res) => {
    const isDev = process.env.NODE_ENV !== 'production';
    const html = await renderHtml('chat', isDev);
    res.type('html').send(html);
});

// Backward compatibility redirects
app.get('/admin', (req, res) => res.redirect('/dashboard/whatsapp'));
app.get('/chat', (req, res) => res.redirect('/atendimento'));

app.get('/cardapio', async (req, res) => {
    const isDev = process.env.NODE_ENV !== 'production';
    const html = await renderHtml('cardapio', isDev);
    res.type('html').send(html);
});

// ==========================================
// 📡 API ROUTES (modular)
// ==========================================
const repos = { settingsRepo, knowledgeRepo, menuRepo, clientRepo, deliveryFeeRepo, deliveryRangeRepo, ragRepo, ragService, orderRepo, catalogRepo, userRepo };

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
(async () => {
    // Executa o seed antes de subir — usa a mesma conexão do banco
    await autoSeed(db);

    server.listen(PORT, () => {
        console.log(`🚀 [Server] Running on http://localhost:${PORT}`);
    });
})();
