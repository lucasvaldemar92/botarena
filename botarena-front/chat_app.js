(function() {
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

    // Internal State (Protected by IIFE scope)
    let activeChatID = '554499824696@c.us'; // Real developer sandbox ID
    let currentConfig = null; // Store fetched settings

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
    // 🔄 UI POPULATION
    // ==========================================
    function populateUI(config) {
        if (!config) return;
        currentConfig = config;

        const companyName = config.empresa || 'botarena';
        
        if (headerCompanyPlaceholder) {
            headerCompanyPlaceholder.forEach(h2 => {
                if(h2.childNodes.length > 0) h2.childNodes[0].textContent = companyName + ' ';
            });
        }

        if (simCompanyName) simCompanyName.textContent = companyName;
        if (simCardapioLink) simCardapioLink.href = config.cardapio_url || '#';
        if (simPix) simPix.textContent = config.pix || '';

        if (headerBotToggle) headerBotToggle.checked = !!config.bot_active;
        updateStatus(config.bot_active);
    }

    window.addEventListener('configLoaded', (e) => {
        populateUI(e.detail);
    });

    // ==========================================
    // 🔌 SOCKET.IO EVENTS (REALTIME)
    // ==========================================
    function updateStatus(isActive) {
        // Sincroniza o checkbox do toggle (sem disparar o evento 'change')
        if (headerBotToggle && headerBotToggle.checked !== isActive) {
            headerBotToggle.checked = isActive;
        }

        if(headerStatusBadge && headerStatusText) {
            if (isActive) {
                headerStatusBadge.className = 'header__status-badge header__status-badge--online pulse';
                headerStatusText.textContent = 'Bot Ativado';
                headerStatusText.style.color = '#4ade80';
            } else {
                headerStatusBadge.className = 'header__status-badge header__status-badge--offline';
                headerStatusText.textContent = 'Bot Desativado';
                headerStatusText.style.color = '#ff3131';
            }
        }

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

    if (socket) {
        socket.on('bot_status', (data) => updateStatus(data.active));

        // Sincroniza quando o admin salva configurações
        socket.on('config_updated', (newConfig) => {
            if (typeof newConfig.bot_active !== 'undefined') {
                updateStatus(newConfig.bot_active);
            }
        });

        socket.on('bot_online',      () => updateStatus(true));
        socket.on('bot_disconnected', () => updateStatus(false));

        socket.on('new_message', (msg) => {
            const chatHistory = document.querySelector('.chat-messages');
            if (!chatHistory) return;

            const msgId = msg.id || ('temp_' + Date.now());
            if (document.querySelector(`[data-msg-id="${msgId}"]`)) return;

            if (!msg.fromMe && msg.from && !msg.from.includes('broadcast')) {
                activeChatID = msg.from;
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
    }

    function scrollToBottom() {
        const container = document.querySelector('.chat-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    // ==========================================
    // 🖱️ INTERACTION HANDLERS (DELEGATED)
    // ==========================================

    document.addEventListener('click', (e) => {
        // --- CRM Direct Sync & Navigate Logic ---
        const btnMenu = e.target.closest('#btn-chat-menu') || e.target.closest('.chat-main__contact');
        if (btnMenu) {
            const contactName = document.querySelector('.chat-main__contact span')?.textContent || '';
            const contactPhone = activeChatID ? activeChatID.replace('@c.us', '') : '';
            
            // Store data for cross-page sync and navigate
            localStorage.setItem('botarena_pending_sync', JSON.stringify({
                name: contactName,
                phone: contactPhone
            }));
            window.location.href = 'clientes.html';
            return;
        }


        // 1. Chat Contact Selection
        const item = e.target.closest('.chat-item');
        if (item) {
            document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('chat-item--active'));
            item.classList.add('chat-item--active');
            
            activeChatID = item.getAttribute('data-chat-id');
            
            const chatInput = document.getElementById('main-chat-input');
            const btnSend = document.getElementById('main-send-btn');
            const btnPix = document.getElementById('quick-reply-pix');

            const isBlocked = activeChatID && (activeChatID.includes('broadcast') || activeChatID.includes('@g.us'));
            
            if (chatInput) {
                chatInput.disabled = isBlocked;
                chatInput.placeholder = isBlocked ? "🚫 Não é permitido enviar mensagens aqui." : "Digite uma mensagem";
                if (isBlocked) chatInput.value = "";
            }
            if (btnSend) btnSend.disabled = isBlocked;
            if (btnPix) btnPix.disabled = isBlocked;
        }

        // 2. Quick Replies
        const chatInput = document.getElementById('main-chat-input');
        if (!chatInput) return;

        if (e.target.id === 'quick-reply-pix' || e.target.closest('#quick-reply-pix')) {
            if (activeChatID?.includes('broadcast')) return;
            const pixKey = (currentConfig && currentConfig.pix) ? currentConfig.pix : 'Não configurada';
            chatInput.value = `Nossa chave PIX:\n- Favorecido: ${currentConfig?.empresa || 'Arena Juvenal'}\n- Chave: ${pixKey}\n- Banco: Digital`;
            chatInput.focus();
            chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (e.target.id === 'quick-reply-rota') {
            if (activeChatID?.includes('broadcast')) return;
            chatInput.value = `Seu pedido já saiu para entrega e deve chegar em instantes! 🛵💨`;
            chatInput.focus();
            chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const btnMenuQuick = e.target.closest('#quick-reply-menu');
        const menuDropdown = document.getElementById('menu-choice-dropdown');

        if (btnMenuQuick) {
            if (activeChatID?.includes('broadcast')) return;
            const isOpen = menuDropdown.style.display !== 'none';
            if (!isOpen) {
                // Abre o dropdown, fechando outros modais
                if (window.utils && window.utils.modalManager) {
                    window.utils.modalManager.open(
                        'chat-menu-dropdown',
                        () => { menuDropdown.style.display = 'block'; },
                        () => { menuDropdown.style.display = 'none'; }
                    );
                } else {
                    menuDropdown.style.display = 'block';
                }
            } else {
                menuDropdown.style.display = 'none';
                if (window.utils && window.utils.modalManager) {
                    window.utils.modalManager.close('chat-menu-dropdown');
                }
            }
        } else if (menuDropdown && !e.target.closest('#menu-choice-dropdown')) {
            menuDropdown.style.display = 'none';
            if (window.utils && window.utils.modalManager) {
                window.utils.modalManager.close('chat-menu-dropdown');
            }
        }

        const sendMenuItem = e.target.closest('.chat-dropdown__item[data-action="send-menu"]');
        if (sendMenuItem) {
            const slot = sendMenuItem.dataset.slot;
            if (activeChatID && !activeChatID.includes('broadcast') && socket) {
                socket.emit('send_menu_media', { to: activeChatID, slot: slot });
            }
            if (menuDropdown) menuDropdown.style.display = 'none';
        }

        // 3. Send Message Click
        const btn = e.target.closest('#main-send-btn');
        if (btn) sendMessage();
    });

    document.addEventListener('keypress', (e) => {
        if (e.target.id === 'main-chat-input' && e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.id === 'main-chat-input') {
            const input = e.target;
            const btnSend = document.getElementById('main-send-btn');
            if (btnSend) {
                const icon = btnSend.querySelector('i');
                if (icon) {
                    if (input.value.trim().length > 0) {
                        btnSend.classList.add('send-btn--active');
                        icon.classList.replace('fa-microphone', 'fa-chevron-right');
                    } else {
                        btnSend.classList.remove('send-btn--active');
                        icon.classList.replace('fa-chevron-right', 'fa-microphone');
                    }
                }
            }
        }
    });

    // ==========================================
    // 🚀 MAIN FUNCTIONS
    // ==========================================

    async function sendMessage() {
        const chatInput = document.getElementById('main-chat-input');
        const btnSend = document.getElementById('main-send-btn');
        
        if (!chatInput || !chatInput.value.trim() || !activeChatID) return;
        const text = chatInput.value.trim();

        if (socket) {
            socket.emit('send_message', {
                to: activeChatID,
                body: text,
                fromMe: true
            });
        }

        chatInput.value = '';
        const icon = btnSend?.querySelector('i');
        if (icon) {
            btnSend.classList.remove('send-btn--active');
            icon.classList.replace('fa-chevron-right', 'fa-microphone');
        }
    }

    // 🔘 Bot Toggle Interaction
    if (headerBotToggle) {
        headerBotToggle.addEventListener('change', async (e) => {
            const isActive = e.target.checked;
            updateStatus(isActive);
            try {
                await fetch(`${window.BASE_URL}/api/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bot_active: isActive })
                });
            } catch (err) {
                console.error('❌ Error updating status:', err);
                headerBotToggle.checked = !isActive;
                updateStatus(!isActive);
            }
        });
    }

    // ==========================================
    // 🛠️ MISC UI LOGIC (Modal, Masks, etc.)
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        const openSettingsBtnRail = document.getElementById('open-settings-btn-rail');
        if (openSettingsBtnRail && window.openModal) {
            openSettingsBtnRail.addEventListener('click', window.openModal);
        }

        const newChatModal = document.getElementById('new-chat-modal');
        const openNewChatBtn = document.getElementById('open-new-chat-btn');
        const closeNewChatBtn = document.getElementById('close-new-chat-btn');
        
        const _closeNewChat = () => newChatModal?.classList.remove('settings-modal--active');
        const _openNewChat  = () => newChatModal?.classList.add('settings-modal--active');

        if (openNewChatBtn) {
            openNewChatBtn.onclick = () => {
                if (window.utils && window.utils.modalManager) {
                    window.utils.modalManager.open('new-chat-modal', _openNewChat, _closeNewChat);
                } else {
                    _openNewChat();
                }
            };
        }
        if (closeNewChatBtn) {
            closeNewChatBtn.onclick = () => {
                if (window.utils && window.utils.modalManager) {
                    window.utils.modalManager.close('new-chat-modal');
                } else {
                    _closeNewChat();
                }
            };
        }

        window.selectContact = (id, name) => {
            activeChatID = id;
            _closeNewChat();
            if (window.utils && window.utils.modalManager) {
                window.utils.modalManager.close('new-chat-modal');
            }
            const headerSpan = document.querySelector('.chat-main__header span');
            if (headerSpan) headerSpan.textContent = name;
            
            const history = document.querySelector('.chat-messages');
            if (history) history.innerHTML = '';
            
            const chatInput = document.getElementById('main-chat-input');
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.placeholder = "Digite uma mensagem";
            }
        };
    });

})();
