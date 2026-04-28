// ==========================================
// 📡 GLOBALS AND DOM ELEMENTS (CHAT ONLY)
// ==========================================
const socket = window.io ? io(window.BASE_URL) : null;

// Header Elements
const headerCompanyPlaceholder = document.querySelectorAll('.header__info h2');
const headerStatusBadge = document.querySelector('.header__status-badge');
const headerStatusText = document.querySelector('.header__status-text');

// Header Unified Elements
const headerBotToggle = document.getElementById('header-bot-toggle');
const headerBotLed = document.getElementById('header-bot-led');
const headerBotText = document.getElementById('header-bot-text');

// Chat / Simulation Elements
const simCompanyName = document.querySelector('[data-testid="sim-company-name"]');
const simCardapioLink = document.querySelector('[data-testid="sim-cardapio-link"]');
const simPix = document.querySelector('[data-testid="sim-pix"]');

const chatHistory = document.querySelector('[data-testid="chat-history"]');
const chatInput = document.querySelector('.chat-input');
const btnQuickPix = document.querySelector('[data-testid="quick-reply-pix"]');
const btnSendMessage = document.querySelector('[data-testid="send-message-btn"]');

// ==========================================
// 🛡️ SECURITY HELPERS (XSS PROTECTION)
// ==========================================
function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==========================================
// 🔄 UI POPULATION (Fired by utils.js)
// ==========================================
let currentConfig = null;

function populateUI(config) {
    if (!config) return;
    currentConfig = config;

    const companyName = config.empresa || 'botarena';
    
    // Update main header title (if present)
    if (headerCompanyPlaceholder) {
        headerCompanyPlaceholder.forEach(h2 => {
            if(h2.childNodes.length > 0) h2.childNodes[0].textContent = companyName + ' ';
        });
    }

    if (simCompanyName) simCompanyName.textContent = companyName;
    if (simCardapioLink) simCardapioLink.href = config.cardapio_url || '#';
    if (simPix) simPix.textContent = config.pix || '';

    // Bot Status & Toggle
    if (headerBotToggle) headerBotToggle.checked = !!config.bot_active;
    updateStatus(config.bot_active);
}

// Listen to Global Config Updates
window.addEventListener('configLoaded', (e) => {
    populateUI(e.detail);
});

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

    const msgId = msg.id || ('temp_' + Date.now());

    // Task 3: Prevent rendering duplicate messages based on ID
    if (document.querySelector(`[data-msg-id="${msgId}"]`)) {
        return; // Already exists in DOM
    }

    // Dynamic Binding: update the active target to the last person who texted!
    if (!msg.fromMe && msg.from && !msg.from.includes('broadcast')) {
        activeChatID = msg.from;
        console.log('🔄 [UI] Chat ativo atualizado dinamicamente para:', activeChatID);
    }

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isSentByMe = msg.fromMe;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isSentByMe ? 'message--sent' : 'message--received'} fade-in-section`;
    msgDiv.setAttribute('data-msg-id', msgId);
    
    let checkmarks = '';
    if (isSentByMe) {
        checkmarks = `<span class="message__status"><i class="fa-solid fa-check" style="color: #64748b;"></i></span>`;
    }

    msgDiv.innerHTML = `
        <div class="message__bubble">
            <p class="message__text">${sanitizeHTML(msg.body) || '...'}</p>
            <span class="message__time">${timeString}</span>
            ${checkmarks}
        </div>
    `;
    
    chatHistory.appendChild(msgDiv);
    scrollToBottom();
});

// Helper for Task 2
function scrollToBottom() {
    // Dynamic query guarantees it catches layout re-renders
    const container = document.querySelector('.chat-messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// ==========================================
// ⚡ CONTEXT LOCK & CLICK LISTENERS (UI)
// ==========================================
let activeChatID = '554499824696@c.us'; // Real developer sandbox ID

document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', function() {
        // Remove active class from all
        document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('chat-item--active'));
        this.classList.add('chat-item--active');
        
        activeChatID = this.getAttribute('data-chat-id');
        
        // Task 2: Block input if it's a broadcast/story
        if (activeChatID && (activeChatID.includes('broadcast') || activeChatID.includes('@g.us'))) {
            if (chatInput) {
                chatInput.disabled = true;
                chatInput.placeholder = "🚫 Não é permitido enviar mensagens aqui.";
                chatInput.value = "";
            }
            if (btnSendMessage) btnSendMessage.disabled = true;
            if (btnQuickPix) btnQuickPix.disabled = true;
        } else {
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.placeholder = "Type a message";
            }
            if (btnSendMessage) btnSendMessage.disabled = false;
            if (btnQuickPix) btnQuickPix.disabled = false;
        }
    });
});

// ==========================================
// ⚡ QUICK REPLIES (CHAT INTERFACE)
// ==========================================
    if (btnQuickPix && chatInput) {
        // --- Shortcut: Chave Pix ---
        btnQuickPix.addEventListener('click', () => {
            if (activeChatID && (activeChatID.includes('broadcast') || activeChatID.includes('@g.us'))) return;
            const pixKey = (currentConfig && currentConfig.pix) ? currentConfig.pix : 'Não configurada';
            chatInput.value = `Nossa chave PIX comercial é: ${pixKey}. Após o pagamento, envie o comprovante por aqui! 🚀`;
            chatInput.focus();
        });

        // --- Shortcut: Pedido em Rota ---
        const btnQuickRota = document.getElementById('quick-reply-rota');
        if (btnQuickRota) {
            btnQuickRota.addEventListener('click', () => {
                if (activeChatID && (activeChatID.includes('broadcast') || activeChatID.includes('@g.us'))) return;
                chatInput.value = `Seu pedido já saiu para entrega e deve chegar em instantes! 🛵💨`;
                chatInput.focus();
            });
        }

        // --- Shortcut: Cardápio (Direct Media Trigger) ---
        const btnQuickMenu = document.getElementById('quick-reply-menu');
        if (btnQuickMenu) {
            // Use .onclick to guarantee only one listener exists (Phase 2 correction)
            btnQuickMenu.onclick = () => {
                if (activeChatID && (activeChatID.includes('broadcast') || activeChatID.includes('@g.us'))) return;
                socket.emit('send_menu_media', { to: activeChatID });
                console.log('🍽️ [Frontend] Triggered send_menu_media event.');
            };
        }

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
            if (typeof Sentry !== 'undefined') Sentry.captureException(err);
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

    if (activeChatID && (activeChatID.includes('broadcast') || activeChatID.includes('@g.us'))) {
        console.warn('Block Triggered in sendMessage manually.');
        return;
    }

    // Send the message payload via Socket.io
    socket.emit('send_message', {
        to: activeChatID, // Bind to active chat!
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

// Initialize Specific Chat Logic
document.addEventListener('DOMContentLoaded', () => {
    // --- Test Bot Simulation Toggle ---
    const testBotBtn = document.getElementById('test-bot-btn');
    const testBotBubble = document.getElementById('test-bot-bubble');
    const closeTestBotBtn = document.getElementById('close-test-bot-btn');

    if (testBotBtn && testBotBubble) {
        testBotBtn.addEventListener('click', () => {
            testBotBubble.classList.toggle('test-bot-bubble--active');
        });
    }
    if (closeTestBotBtn && testBotBubble) {
        closeTestBotBtn.addEventListener('click', () => {
            testBotBubble.classList.remove('test-bot-bubble--active');
        });
    }

    // --- Mobile View-State Toggle ---
    const chatLayout = document.querySelector('.chat-layout');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const chatItems = document.querySelectorAll('.chat-item');

    // Clicking a chat item opens the conversation on mobile
    chatItems.forEach(item => {
        item.addEventListener('click', () => {
            if (chatLayout) chatLayout.classList.add('chat-layout--conversation');
        });
    });

    // Back button returns to the sidebar list
    if (backToListBtn) {
        backToListBtn.addEventListener('click', () => {
            if (chatLayout) chatLayout.classList.remove('chat-layout--conversation');
        });
    }
    
    // Redirect when backend confirms logout via socket (force_logout)
    if (socket) {
        socket.on('force_logout', () => {
            window.location.href = 'dashboard.html';
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
