// ==========================================
// 📡 GLOBALS AND DOM ELEMENTS
// ==========================================
const socket = window.io ? io(window.BASE_URL) : null;

// The badge is now a button, we don't store it statically since we use event delegation, 
// but we keep a reference for direct updates.
const botStatusBadge = document.getElementById('bot-status-badge');

// QR Code Elements
const viewDisconnected = document.getElementById('view-disconnected');
const viewConnected = document.getElementById('view-connected');
const statusPill = document.getElementById('status-pill');

const qrLoader = document.getElementById('qr-loader');
const qrImage = document.getElementById('qr-image');
const qrError = document.getElementById('qr-error');
const qrInstructions = document.getElementById('qr-instructions');
const qrActionsDisconnected = document.getElementById('qr-actions-disconnected');

const cardConexao = document.getElementById('card-conexao');


// ==========================================
// 🔌 UI UPDATES
// ==========================================

function updateBotStatus(isActive) {
    if (!botStatusBadge) return;
    
    // Store current state directly on the element for the toggle logic
    botStatusBadge.dataset.active = isActive;

    if (isActive) {
        botStatusBadge.textContent = '● Bot online';
        botStatusBadge.className = 'status-badge status-online btn-status';
    } else {
        botStatusBadge.textContent = '○ Bot offline';
        botStatusBadge.className = 'status-badge status-offline btn-status';
    }
}

function updateQRCode(qrData) {
    if (qrLoader) qrLoader.style.display = 'none';
    if (qrError) qrError.style.display = 'none';
    if (qrImage) {
        qrImage.style.display = 'block';
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}&color=ffffff&bgcolor=0f172a`;
    }
    if (qrInstructions) qrInstructions.style.display = 'block';
    if (qrActionsDisconnected) qrActionsDisconnected.style.display = 'flex';
}

function updateConnectionStatus(isConnected) {
    if (isConnected) {
        if (viewDisconnected) viewDisconnected.style.display = 'none';
        if (viewConnected) viewConnected.style.display = 'block';
        if (statusPill) {
            statusPill.style.display = 'none'; // Hide pill when connected to avoid redundancy
        }
        
        const phoneEl = document.getElementById('connected-phone');
        if (phoneEl) phoneEl.textContent = 'WhatsApp Business';
        
    } else {
        if (viewConnected) viewConnected.style.display = 'none';
        if (viewDisconnected) viewDisconnected.style.display = 'block';
        if (statusPill) {
            statusPill.style.display = 'flex'; // Show pill when disconnected
            statusPill.textContent = 'Aguardando';
            statusPill.className = 'status-pill status-pill--waiting';
        }
        
        // Reseta pra estado de loading até receber o QR real
        if (qrImage) qrImage.style.display = 'none';
        if (qrInstructions) qrInstructions.style.display = 'none';
        if (qrActionsDisconnected) qrActionsDisconnected.style.display = 'none';
        if (qrError) qrError.style.display = 'none';
        if (qrLoader) qrLoader.style.display = 'block';
    }
}

// ==========================================
// 🔌 SOCKET.IO EVENTS
// ==========================================

if (socket) {
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
        updateConnectionStatus(false);
    });

    socket.on('auth_success', () => {
        updateConnectionStatus(true);
    });

    socket.on('force_logout', () => {
        if (window.closeModal) window.closeModal();
        updateBotStatus(false);
        updateConnectionStatus(false);
    });

    socket.on('config_updated', (newConfig) => {
        updateBotStatus(newConfig.bot_active);
    });
}

// ==========================================
// 🚀 INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initial status check via API
    fetch(`${window.BASE_URL}/api/status`)
        .then(res => res.json())
        .then(data => {
            updateConnectionStatus(data.status === 'CONNECTED');
            // Then fetch config to update bot status
            return fetch(`${window.BASE_URL}/api/config`);
        })
        .then(res => res.json())
        .then(config => {
            updateBotStatus(config.bot_active);
            loadRagStats();
        })
        .catch(err => console.error('Erro ao carregar inicial:', err));

    // RAG Stats Fetching Function
    async function loadRagStats() {
        try {
            const stats = await window.utils.apiFetch('/rag/status');
            
            const totalEl = document.getElementById('rag-total-chunks');
            if (totalEl) totalEl.textContent = stats.totalChunks;
            
            const lunchCount = (stats.bySource && stats.bySource.menu_slot && stats.bySource.menu_slot.lunch) || 0;
            const acaiCount = (stats.bySource && stats.bySource.menu_slot && stats.bySource.menu_slot.acai) || 0;
            const eventsCount = (stats.bySource && stats.bySource.menu_slot && stats.bySource.menu_slot.events) || 0;
            
            let faqCount = 0;
            if (stats.bySource && stats.bySource.faq) {
                faqCount = Object.values(stats.bySource.faq).reduce((acc, val) => acc + val, 0);
            }
            
            const lunchEl = document.getElementById('rag-menu-lunch');
            if (lunchEl) lunchEl.textContent = `${lunchCount} blocos`;
            
            const acaiEl = document.getElementById('rag-menu-acai');
            if (acaiEl) acaiEl.textContent = `${acaiCount} blocos`;
            
            const eventsEl = document.getElementById('rag-menu-events');
            if (eventsEl) eventsEl.textContent = `${eventsCount} blocos`;
            
            const faqEl = document.getElementById('rag-faq-count');
            if (faqEl) faqEl.textContent = `${faqCount} blocos`;
            
        } catch (err) {
            console.error('Erro ao buscar status de RAG:', err);
        }
    }

    // Sync button event listener
    const btnSyncRag = document.getElementById('btn-sync-rag');
    if (btnSyncRag) {
        btnSyncRag.addEventListener('click', () => {
            const originalHTML = btnSyncRag.innerHTML;
            btnSyncRag.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...';
            btnSyncRag.disabled = true;
            loadRagStats().finally(() => {
                btnSyncRag.innerHTML = originalHTML;
                btnSyncRag.disabled = false;
            });
        });
    }

    // Listen to config loaded from utils.js
    window.addEventListener('configLoaded', (e) => {
        const config = e.detail;
        updateBotStatus(config.bot_active);
    });

    const qrRetryBtn = document.getElementById('qr-retry-btn');
    if (qrRetryBtn) {
        qrRetryBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    const btnDisconnect = document.getElementById('btn-disconnect-bot');
    if (btnDisconnect) {
        btnDisconnect.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
                // Here you would call an API endpoint to explicitly logout.
                // Since there is no /api/auth/logout currently, we assume socket.emit('logout') works.
                if (socket) socket.emit('logout');
            }
        });
    }

    // Global click delegation for bot status toggle
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('#bot-status-badge');
        if (target) {
            // Determine new state based on current dataset
            const currentlyActive = target.dataset.active === 'true';
            const newState = !currentlyActive;
            
            // Optimistic update
            updateBotStatus(newState);
            
            try {
                // If you want to use sockets as per spec: "emit a Socket.io event (toggle-bot-status) to the backend"
                // But the backend current expects config update via API, or we can use the existing API call.
                // The spec says: "emit a Socket.io event (toggle-bot-status) to the backend."
                // I'll keep the API call since it's proven, but if socket emission is strictly required, we can do both.
                // Let's use the API as it currently updates the config.
                const response = await fetch(`${window.BASE_URL}/api/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bot_active: newState })
                });
                
                if (!response.ok) throw new Error('Erro ao salvar no servidor');
                
                // Emitting socket event as requested by the spec
                if (socket) {
                    socket.emit('toggle-bot-status', { active: newState });
                }
                
            } catch (err) {
                console.error('Falha ao atualizar bot status:', err);
                updateBotStatus(currentlyActive); // Revert on failure
            }
        }
    });

    // ==========================================
    // 📎 GESTÃO DE CARDÁPIOS (MULTI-SLOT)
    // ==========================================
    const toast = document.getElementById('toast-upload');
    const toastMessage = document.getElementById('toast-message');
    let toastTimer = null;

    function showToast(msg) {
        if (!toast || !toastMessage) return;
        toastMessage.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
    }

    // Handles UI updates per slot
    function updateMenuUI({ menu, slot }) {
        if (!menu || !menu.extracted_text || !slot) return;
        
        const fileName = menu.extracted_text.replace('Arquivo: ', '');
        
        const previewEl = document.getElementById(`preview-menu-${slot}`);
        const nameEl = document.getElementById(`name-menu-${slot}`);
        const labelEl = document.getElementById(`label-menu-${slot}`);
        
        if (labelEl) labelEl.textContent = 'Trocar arquivo';
        if (nameEl) nameEl.textContent = fileName;
        if (previewEl) previewEl.classList.add('visible');
    }

    // Global listener for menu updates
    window.addEventListener('menuUpdated', (e) => {
        updateMenuUI(e.detail);
        loadRagStats();
    });

    // Delegated click and change events for multi-menu upload
    document.addEventListener('click', (e) => {
        const triggerBtn = e.target.closest('[data-action="trigger-upload"]');
        if (triggerBtn) {
            const targetId = triggerBtn.dataset.target;
            const inputEl = document.getElementById(targetId);
            if (inputEl) inputEl.click();
        }
    });

    document.addEventListener('change', async (e) => {
        const fileInput = e.target.closest('input[type="file"][data-slot]');
        if (fileInput) {
            const file = fileInput.files[0];
            const slot = fileInput.dataset.slot;
            if (!file || !slot) return;

            const labelEl = document.getElementById(`label-menu-${slot}`);
            const originalLabel = labelEl ? labelEl.textContent : 'Anexar cardápio';
            
            try {
                if (labelEl) labelEl.textContent = 'Enviando...';
                await window.uploadMenuFile(file, slot);
                showToast(`Cardápio de ${slot} enviado!`);
            } catch (err) {
                console.error(`Erro no upload (${slot}):`, err);
                showToast('Falha ao enviar cardápio');
                if (labelEl) labelEl.textContent = originalLabel;
            } finally {
                fileInput.value = ''; // Reset input to allow re-upload of same file
            }
        }
    });

    // Event listeners para os outros botões
    // Event listeners para os outros botões com verificação de existência
    const btnUsuarios = document.getElementById('btn-usuarios');
    if (btnUsuarios) {
        btnUsuarios.onclick = () => {
            alert('Redirecionando para gestão de usuários...');
        };
    }

    const btnCadastro = document.getElementById('btn-cadastro');
    if (btnCadastro) {
        btnCadastro.onclick = () => {
            window.location.href = 'cardapio.html';
        };
    }

    // --- Lógica do Modal de Sair (Logout) ---
    const btnLogoutHeader = document.getElementById('btn-system-logout');
    const modalLogout = document.getElementById('modal-logout-choice');
    const btnLogoutCancel = document.getElementById('btn-logout-cancel');
    const btnLogoutOnly = document.getElementById('btn-logout-only');
    const btnLogoutFull = document.getElementById('btn-logout-full');

    if (btnLogoutHeader && modalLogout) {
        btnLogoutHeader.addEventListener('click', () => {
            modalLogout.style.display = 'flex';
        });
    }

    if (btnLogoutCancel && modalLogout) {
        btnLogoutCancel.addEventListener('click', () => {
            modalLogout.style.display = 'none';
        });
    }

    // Fecha o modal ao clicar fora dele
    if (modalLogout) {
        modalLogout.addEventListener('click', (e) => {
            if (e.target === modalLogout) {
                modalLogout.style.display = 'none';
            }
        });
    }

    // Opção 1: Sair apenas do sistema (mantém whatsapp logado)
    if (btnLogoutOnly) {
        btnLogoutOnly.addEventListener('click', () => {
            localStorage.removeItem('botarena-token');
            window.location.href = '/index.html';
        });
    }

    // Opção 2: Sair e deslogar do WhatsApp (apaga dados, pausa bot)
    if (btnLogoutFull) {
        btnLogoutFull.addEventListener('click', async () => {
            const originalHTML = btnLogoutFull.innerHTML;
            btnLogoutFull.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Desconectando...';
            btnLogoutFull.disabled = true;
            if (btnLogoutOnly) btnLogoutOnly.disabled = true;
            if (btnLogoutCancel) btnLogoutCancel.disabled = true;
            
            try {
                // Chama rota de logout que seta bot_active: false e desconecta whatsapp-web.js
                await fetch(`${window.BASE_URL}/api/logout`, { method: 'POST' });
                
                // Limpa o token local e vai para a tela de login
                localStorage.removeItem('botarena-token');
                window.location.href = '/index.html';
            } catch (err) {
                console.error('❌ Erro ao desconectar do WhatsApp:', err);
                alert('Erro ao tentar desconectar o WhatsApp. Tente novamente.');
                btnLogoutFull.innerHTML = originalHTML;
                btnLogoutFull.disabled = false;
                if (btnLogoutOnly) btnLogoutOnly.disabled = false;
                if (btnLogoutCancel) btnLogoutCancel.disabled = false;
            }
        });
    }
});
