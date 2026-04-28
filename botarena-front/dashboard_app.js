// ==========================================
// 📡 GLOBALS AND DOM ELEMENTS
// ==========================================
// BASE_URL and socket auth logic are now provided by utils.js
const socket = window.io ? io(window.BASE_URL) : null;

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
// 🛡️ PRE-FLIGHT AUTH CHECK
// ==========================================
async function checkAuthAndRedirect() {
    try {
        const response = await fetch(`${window.BASE_URL}/api/status`);
        const data = await response.json();
        if (data.status === 'CONNECTED') {
            if (qrContainer) qrContainer.style.display = 'none'; // Avoid flash
            window.location.replace('chat.html'); 
        }
    } catch (e) {}
}

// ==========================================
// 🔌 SOCKET.IO EVENTS & UI UPDATES
// ==========================================

function updateBotStatus(isActive) {
    if (!statusLed || !statusText || !botToggleSwitch) return;

    if (isActive) {
        statusLed.className = 'control__led control__led--online pulse';
        statusText.textContent = 'Bot Ativado';
        statusText.style.color = '#4ade80';
        botToggleSwitch.checked = true;
        
        if (qrLoader) qrLoader.classList.add('hidden');
        if (qrImage) qrImage.classList.add('hidden');
        if (qrError) qrError.classList.add('hidden');
        if (qrStatusText) {
            qrStatusText.textContent = 'WhatsApp Conectado!';
            qrStatusText.style.color = '#4ade80';
        }
        if (qrContainer) qrContainer.style.display = 'none';
    } else {
        statusLed.className = 'control__led control__led--offline';
        statusText.textContent = 'Bot Desativado';
        statusText.style.color = '#ff3131';
        botToggleSwitch.checked = false;
        
        if (qrImage) qrImage.classList.add('hidden');
        if (qrError) qrError.classList.add('hidden');
        if (qrLoader) qrLoader.classList.remove('hidden');
        if (qrStatusText) {
            qrStatusText.textContent = 'Aguardando leitura...';
            qrStatusText.style.color = 'var(--color-text-muted)';
        }
        if (qrContainer) qrContainer.style.display = 'flex';
    }
}

function updateQRCode(qrData) {
    if (qrLoader) qrLoader.classList.add('hidden');
    if (qrError) qrError.classList.add('hidden');
    if (qrImage) {
        qrImage.classList.remove('hidden');
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}&color=ffffff&bgcolor=0f172a`;
    }
    if (qrStatusText) {
        qrStatusText.textContent = 'Escaneie o QR Code abaixo:';
        qrStatusText.style.color = 'var(--color-text)';
    }
}

// Socket Bindings
if (socket) {
    socket.on('connect', () => {
        console.log('✅ Dashboard Connected to BotArena Backend');
        checkAuthAndRedirect();
    });

    socket.on('bot_status', (data) => {
        updateBotStatus(data.active);
    });

    socket.on('bot_online', () => {
        updateBotStatus(true);
    });

    socket.on('bot_disconnected', () => {
        updateBotStatus(false);
    });

    socket.on('qr', (qrData) => {
        updateQRCode(qrData);
    });

    socket.on('auth_success', () => {
        console.log('🔐 [Socket] auth_success triggered');
        if (qrContainer) qrContainer.style.display = 'none';
        window.location.replace('chat.html');
    });

    socket.on('force_logout', () => {
        if (window.closeModal) window.closeModal();
        updateBotStatus(false);
    });

    socket.on('config_updated', (newConfig) => {
        updateBotStatus(newConfig.bot_active);
    });
}

// ==========================================
// 🚀 INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndRedirect();

    // Listen to config loaded from utils.js
    window.addEventListener('configLoaded', (e) => {
        const config = e.detail;
        updateBotStatus(config.bot_active);
    });

    if (botToggleSwitch) {
        botToggleSwitch.addEventListener('change', async (e) => {
            const isActive = e.target.checked;
            updateBotStatus(isActive);
            try {
                await fetch(`${window.BASE_URL}/api/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bot_active: isActive })
                });
            } catch (err) { 
                updateBotStatus(!isActive); 
                if (typeof window.Sentry !== 'undefined') window.Sentry.captureException(err); 
            }
        });
    }


    // --- Menu File Preview (Sprint: Menu Asset Management) ---
    const menuFile = document.getElementById('menuFile');
    const filePreview = document.getElementById('filePreview');

    if (menuFile && filePreview) {
        menuFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                filePreview.classList.add('has-file');
                const isImg = file.type.startsWith('image/');
                const iconClass = isImg ? 'fa-image' : 'fa-file-pdf';
                const fileSize = (file.size / 1024).toFixed(1);
                
                filePreview.innerHTML = `
                    <i class="fa-solid ${iconClass}"></i>
                    <div style="text-align: center;">
                        <strong style="display: block; font-size: 0.9rem;">${file.name}</strong>
                        <small style="color: var(--color-text-muted);">${fileSize} KB</small>
                    </div>
                `;
            } else {
                filePreview.classList.remove('has-file');
                filePreview.innerHTML = `
                    <i class="fa-solid fa-file-pdf"></i>
                    <span>Selecione PDF ou Imagem</span>
                `;
            }
        });
    }
});
