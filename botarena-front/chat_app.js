// ==========================================
// 📡 GLOBALS AND DOM ELEMENTS
// ==========================================
const BASE_URL = 'http://localhost:3000';
const socket = io(BASE_URL);

// Header Elements
const headerCompanyPlaceholder = document.querySelectorAll('.header__info h2');
const headerStatusBadge = document.querySelector('.header__status-badge');
const headerStatusText = document.querySelector('.header__status-text');

// Settings Elements
const inputEmpresa = document.querySelector('[data-testid="cfg-company-name"]');
const inputPix = document.querySelector('[data-testid="pix-input-masked"]');
const inputCardapio = document.querySelector('[data-testid="cfg-menu-link"]');
const btnSaveConfig = document.querySelector('[data-testid="btn-save-config"]');

// Header Unified Elements
const headerCompanyLogo = document.getElementById('header-company-logo');
const headerBotToggle = document.getElementById('header-bot-toggle');
const headerBotLed = document.getElementById('header-bot-led');
const headerBotText = document.getElementById('header-bot-text');

// Chat / Simulation
const simCompanyName = document.querySelector('[data-testid="sim-company-name"]');
const simCardapioLink = document.querySelector('[data-testid="sim-cardapio-link"]');
const simPix = document.querySelector('[data-testid="sim-pix"]');

const chatHistory = document.querySelector('[data-testid="chat-history"]');
const chatInput = document.querySelector('.chat-input');
const btnQuickPix = document.querySelector('[data-testid="quick-reply-pix"]');
const btnSendMessage = document.querySelector('[data-testid="send-message-btn"]');

// ==========================================
// 🔄 FETCH AND POPULATE SETTINGS (API)
// ==========================================
let currentConfig = null;

async function fetchConfig() {
    try {
        const response = await fetch(`${BASE_URL}/api/config`);
        if (!response.ok) throw new Error('Failed to fetch config');
        
        currentConfig = await response.json();
        populateUI(currentConfig);
    } catch (err) {
        console.error('❌ [Config] Error fetching:', err);
    }
}

function populateUI(config) {
    if (!config) return;
    currentConfig = config; // Keep global updated

    // 1. Settings Inputs
    if (inputEmpresa) inputEmpresa.value = config.empresa || '';
    if (inputPix) inputPix.value = config.pix || '';
    if (inputCardapio) inputCardapio.value = config.cardapio_url || '';

    // 2. Header and Chat Placeholders
    const companyName = config.empresa || 'botarena';
    
    // Update Branding Logo (Cyberpunk Style)
    if (headerCompanyLogo) headerCompanyLogo.textContent = companyName;
    
    // Dynamic Footer Branding (if present)
    const footerText = document.querySelector('.footer__text');
    if (footerText) footerText.textContent = `© 2026 ${companyName}`;

    // Update main header title (if present)
    if (headerCompanyPlaceholder) {
        headerCompanyPlaceholder.forEach(h2 => {
            if(h2.childNodes.length > 0) h2.childNodes[0].textContent = companyName + ' ';
        });
    }

    if (simCompanyName) simCompanyName.textContent = companyName;
    if (simCardapioLink) simCardapioLink.href = config.cardapio_url || '#';

    // 3. Bot Status & Toggle
    if (headerBotToggle) headerBotToggle.checked = !!config.bot_active;
    updateStatus(config.bot_active);
}

// ==========================================
// 💾 SAVE SETTINGS (API)
// ==========================================
if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
        const newBtnText = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        const originalText = btnSaveConfig.innerHTML;
        btnSaveConfig.innerHTML = newBtnText;
        btnSaveConfig.disabled = true;

        const payload = {
            empresa: inputEmpresa.value,
            pix: inputPix.value,
            cardapio_url: inputCardapio.value
        };

        try {
            const response = await fetch(`${BASE_URL}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                populateUI(result.config);
                
                // Visual feedback
                btnSaveConfig.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
                setTimeout(() => {
                    btnSaveConfig.innerHTML = originalText;
                    btnSaveConfig.disabled = false;
                    
                    // Close modal
                    const modal = document.getElementById('settings-modal');
                    if(modal) modal.classList.remove('settings-modal--active');
                }, 1500);
            }
        } catch (err) {
            console.error('❌ [Config] Error saving:', err);
            btnSaveConfig.innerHTML = 'Erro ao Salvar';
            setTimeout(() => {
                btnSaveConfig.innerHTML = originalText;
                btnSaveConfig.disabled = false;
            }, 2000);
        }
    });
}

// ==========================================
// 🔌 SOCKET.IO EVENTS (REALTIME)
// ==========================================
function updateStatus(isActive) {
    // Dashboard Header (if present)
    if(headerStatusBadge && headerStatusText) {
        if (isActive) {
            headerStatusBadge.className = 'header__status-badge header__status-badge--online pulse';
            headerStatusText.textContent = 'Bot Ativado';
            headerStatusText.style.color = '#4ade80'; // --green
        } else {
            headerStatusBadge.className = 'header__status-badge header__status-badge--offline';
            headerStatusText.textContent = 'Bot Desativado';
            headerStatusText.style.color = '#ff3131'; // --red
        }
    }

    // Chat Header (Minimal)
    if(headerBotLed && headerBotText) {
        if (isActive) {
            headerBotLed.className = 'control__led control__led--online pulse';
            headerBotText.textContent = 'Bot Ativado';
            headerBotText.style.color = '#4ade80';
        } else {
            headerBotLed.className = 'control__led control__led--offline';
            headerBotText.textContent = 'Bot Desativado';
            headerBotText.style.color = '#ff3131';
        }
    }
}

socket.on('connect', () => {
    console.log('✅ Connected to BotArena Backend:', socket.id);
});

socket.on('bot_status', (data) => {
    console.log('📡 [Socket] bot_status:', data);
    updateStatus(data.active);
});

socket.on('bot_online', (data) => {
    console.log('✅ [Socket] bot_online:', data);
    updateStatus(true);
});

socket.on('bot_disconnected', (data) => {
    console.log('⚠️ [Socket] bot_disconnected:', data);
    updateStatus(false);
});

socket.on('config_updated', (newConfig) => {
    console.log('🔄 [Socket] config updated remotely:', newConfig);
    populateUI(newConfig);
});

socket.on('new_message', (msg) => {
    console.log('💬 [Socket] new_message received:', msg);
    if (!chatHistory) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isSentByMe = msg.fromMe;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isSentByMe ? 'message--sent' : 'message--received'} fade-in-section`;
    
    let checkmarks = '';
    if (isSentByMe) {
        checkmarks = `<span class="message__status"><i class="fa-solid fa-check" style="color: #64748b;"></i></span>`;
    }

    msgDiv.innerHTML = `
        <div class="message__bubble">
            <p class="message__text">${msg.body || '...'}</p>
            <span class="message__time">${timeString}</span>
            ${checkmarks}
        </div>
    `;
    
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll
});

// ==========================================
// ⚡ QUICK REPLIES (CHAT INTERFACE)
// ==========================================
if (btnQuickPix && chatInput) {
    btnQuickPix.addEventListener('click', async () => {
        try {
            // Task 2: Use the cached Pix key from currentConfig
            const pixKey = (currentConfig && currentConfig.pix) ? currentConfig.pix : 'Não configurada';
            chatInput.value = `Nossa chave PIX comercial é: ${pixKey}. Após o pagamento, envie o comprovante por aqui! 🚀`;
            chatInput.focus();
        } catch (err) {
            console.error('❌ [Quick Reply] Error fetching Pix Config:', err);
        }
    });

    // Handle "Enter" key press
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    // Handle Button Click
    if(btnSendMessage) {
        btnSendMessage.addEventListener('click', () => {
            sendMessage();
        });
    }
}

// 🔘 Bot Toggle Interaction (Header)
if (headerBotToggle) {
    headerBotToggle.addEventListener('change', async (e) => {
        const isActive = e.target.checked;
        
        // Optimistic UI update
        updateStatus(isActive);

        try {
            await fetch(`${BASE_URL}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_active: isActive })
            });
        } catch (err) {
            console.error('❌ [Toggle] Error updating status:', err);
            // Revert on error
            headerBotToggle.checked = !isActive;
            updateStatus(!isActive);
        }
    });
}

function sendMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    // Send the message payload via Socket.io
    socket.emit('send_message', {
        body: text,
        fromMe: true
    });

    // Clear input
    chatInput.value = '';
    
    // (Note: The message will appear in the UI automatically because the backend 
    // will echo it back via the 'new_message' event we already setup)
}

// ==========================================
// 🛡️ DYNAMIC PIX MASK (Refined & Alphanumeric)
// ==========================================
function formatPixKey(value) {
    if (!value) return '';
    if (value.includes('@')) return value.replace(/\s/g, '').toLowerCase();
    let clean = value.replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length === 14) {
        return clean.toUpperCase().replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11 && (clean[2] !== '9' || /^\d+$/.test(clean) === false)) {
         if (/^\d+$/.test(clean)) return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    if ((clean.length === 10 || clean.length === 11) && /^\d+$/.test(clean)) {
         if (clean.length === 11) return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
         return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    }
    return value;
}

if (inputPix) {
    inputPix.addEventListener('input', (e) => {
        e.target.value = formatPixKey(e.target.value);
    });
    inputPix.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = (e.clipboardData || window.clipboardData).getData('text');
        const sanitized = pastedData.replace(/[^a-zA-Z0-9@.-]/g, '');
        e.target.value = formatPixKey(sanitized);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', fetchConfig);
