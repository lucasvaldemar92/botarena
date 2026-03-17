// ==========================================
// 📡 GLOBALS AND DOM ELEMENTS
// ==========================================
const BASE_URL = 'http://localhost:3000';
const socket = io(BASE_URL);

// QR Code Elements
const qrContainer = document.getElementById('qr-container');
const qrLoader = document.getElementById('qr-loader');
const qrImage = document.getElementById('qr-image');
const qrError = document.getElementById('qr-error');
const qrStatusText = document.getElementById('qr-status-text');

// Control Elements
const statusLed = document.querySelector('[data-testid="status-led"]');
const statusText = document.querySelector('[data-testid="status-text"]');
const botToggleSwitch = document.querySelector('[data-testid="bot-toggle-switch"]');

// ==========================================
// 🔄 FETCH AND POPULATE DASHBOARD
// ==========================================
async function fetchDashboardConfig() {
    try {
        const response = await fetch(`${BASE_URL}/api/config`);
        if (!response.ok) throw new Error('Failed to fetch config');
        
        const config = await response.json();
        updateBotStatus(config.bot_active);
    } catch (err) {
        console.error('❌ [Config] Error fetching:', err);
        showErrorState();
    }
}

// ==========================================
// 🔌 SOCKET.IO EVENTS (REALTIME)
// ==========================================

function updateBotStatus(isActive) {
    if (isActive) {
        statusLed.className = 'control__led control__led--online pulse';
        statusText.textContent = 'Online';
        statusText.style.color = 'var(--color-success)';
        botToggleSwitch.checked = true;
        
        // Hide QR loader and show success message if it was waiting
        qrLoader.classList.add('hidden');
        qrImage.classList.add('hidden');
        qrError.classList.add('hidden');
        qrStatusText.textContent = 'WhatsApp Conectado!';
        qrStatusText.style.color = 'var(--color-success)';
    } else {
        statusLed.className = 'control__led control__led--offline';
        statusText.textContent = 'Offline';
        statusText.style.color = 'var(--color-text-muted)';
        botToggleSwitch.checked = false;
        
        // Show QR Loader assuming it's disconnected and waiting for re-auth
        qrImage.classList.add('hidden');
        qrError.classList.add('hidden');
        qrLoader.classList.remove('hidden');
        qrStatusText.textContent = 'Aguardando leitura...';
        qrStatusText.style.color = 'var(--color-text-muted)';
    }
}

function updateQRCode(qrData) {
    // Generate QR Image URL using an external API for simplicity, 
    // or we could use the qrcode.js library. For now, since the backend uses qrcode-terminal,
    // we will generate a visual QR on the client using the raw qr string
    
    qrLoader.classList.add('hidden');
    qrError.classList.add('hidden');
    qrImage.classList.remove('hidden');
    
    // Using a public QR generator API to turn the raw string into an image
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}&color=ffffff&bgcolor=0f172a`;
    qrStatusText.textContent = 'Escaneie o QR Code abaixo:';
}

function showErrorState() {
    qrLoader.classList.add('hidden');
    qrImage.classList.add('hidden');
    qrError.classList.remove('hidden');
    qrStatusText.textContent = 'Erro de Conexão. O Backend está rodando?';
}

// Socket Bindings
socket.on('connect', () => {
    console.log('✅ Dashboard Connected to BotArena Backend');
});

socket.on('bot_status', (data) => {
    console.log('📡 [Socket] bot_status:', data);
    updateBotStatus(data.active);
});

socket.on('bot_online', (data) => {
    console.log('✅ [Socket] bot_online:', data);
    updateBotStatus(true);
});

socket.on('bot_disconnected', (data) => {
    console.log('⚠️ [Socket] bot_disconnected:', data);
    updateBotStatus(false);
});

socket.on('qr', (qrData) => {
    console.log('📱 [Socket] QR Code Received from WhatsApp:', qrData.substring(0, 20) + '...');
    updateQRCode(qrData);
});

socket.on('config_updated', (newConfig) => {
    console.log('🔄 [Socket] config updated remotely:', newConfig);
    updateBotStatus(newConfig.bot_active);
});

// Initialize Settings
document.addEventListener('DOMContentLoaded', fetchDashboardConfig);

// Toggle Handling
if (botToggleSwitch) {
    botToggleSwitch.addEventListener('change', async (e) => {
        const isActive = e.target.checked;
        
        try {
            await fetch(`${BASE_URL}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_active: isActive })
            });
        } catch (err) {
            console.error('❌ [Config] Error saving toggle state:', err);
            e.target.checked = !isActive; // Revert on failure
        }
    });
}
