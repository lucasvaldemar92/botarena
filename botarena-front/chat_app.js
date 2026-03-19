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
async function fetchConfig() {
    try {
        const response = await fetch(`${BASE_URL}/api/config`);
        if (!response.ok) throw new Error('Failed to fetch config');
        
        const config = await response.json();
        populateUI(config);
    } catch (err) {
        console.error('❌ [Config] Error fetching:', err);
    }
}

function populateUI(config) {
    if (!config) return;

    // 1. Settings Inputs
    if (inputEmpresa) inputEmpresa.value = config.empresa || '';
    if (inputPix) inputPix.value = config.pix || '';
    if (inputCardapio) inputCardapio.value = config.cardapio_url || '';

    // 2. Header and Chat Placeholders
    const companyName = config.empresa || 'Empresa';
    
    // Update main header title (Note: we have to keep the badge HTML intact)
    headerCompanyPlaceholder.forEach(h2 => {
        // The first child is the text node, second is the span badge
        if(h2.childNodes.length > 0) {
            h2.childNodes[0].textContent = companyName + ' ';
        }
    });

    // Update Simulation placeholders 
    if (simCompanyName) simCompanyName.textContent = companyName;
    if (simCardapioLink) simCardapioLink.href = config.cardapio_url || '#';
    if (simPix) simPix.textContent = config.pix || 'Não definido';

    // 3. Status Badge
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
    if(!headerStatusBadge || !headerStatusText) return;

    if (isActive) {
        headerStatusBadge.className = 'header__status-badge header__status-badge--online pulse';
        headerStatusText.textContent = 'Bot Ativo';
        headerStatusText.style.color = 'var(--color-success)';
    } else {
        headerStatusBadge.className = 'header__status-badge header__status-badge--offline';
        headerStatusText.textContent = 'Bot Inativo';
        headerStatusText.style.color = 'var(--color-text-muted)';
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
            // Task 2: Fetch the current Pix key from the settings table in the DB
            const response = await fetch(`${BASE_URL}/api/config`);
            if (response.ok) {
                const config = await response.json();
                let textToInsert = `Nossa chave PIX é: ${config.pix || 'Não configurada'}`;
                
                // Automatically insert this key into the message input field
                chatInput.value = textToInsert;
                chatInput.focus();
            }
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
// 🛡️ DYNAMIC PIX MASK
// ==========================================
function formatPixKey(value) {
    if (!value) return '';

    // Standard Email verification
    if (value.includes('@')) return value.replace(/\s/g, '');

    // Heuristics
    const looksLikePhone = /\(|\)|\+/.test(value);
    const looksLikeCPF = /\./.test(value) && !value.includes('/');

    // Strip everything to alphanumeric
    let clean = value.replace(/[^a-zA-Z0-9]/g, '');

    // Alphanumeric keys (Random Key or new CNPJ rules)
    if (/[a-zA-Z]/.test(clean)) {
        if (clean.length === 14) {
            // Letters allowed in CNPJ by new rules
            return clean.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
        }
        // Random 32 key
        return value.replace(/\s/g, ''); 
    }

    // Number formats
    if (looksLikePhone || (!looksLikeCPF && clean.length === 11 && clean[2] === '9')) {
        // Cellphone & Landline
        if (clean.length <= 10) {
            return clean.replace(/^(\d{2})(\d{0,4})(\d{0,4}).*/, (match, p1, p2, p3) => {
                let res = `(${p1}`;
                if (p2) res += `) ${p2}`;
                if (p3) res += `-${p3}`;
                return res;
            });
        } else {
            return clean.replace(/^(\d{2})(\d{0,5})(\d{0,4}).*/, (match, p1, p2, p3) => {
                let res = `(${p1}`;
                if (p2) res += `) ${p2}`;
                if (p3) res += `-${p3}`;
                return res;
            });
        }
    }

    // CPF and CNPJ
    if (clean.length <= 11) {
        return clean
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
            .substring(0, 14);
    } else {
        return clean
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
            .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5')
            .substring(0, 18);
    }
}

if (inputPix) {
    inputPix.addEventListener('input', (e) => {
        e.target.value = formatPixKey(e.target.value);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', fetchConfig);
