// ==========================================
// 📡 GLOBALS AND DOM ELEMENTS
// ==========================================
const socket = window.io ? io(window.BASE_URL) : null;

// The badge is now a button, we don't store it statically since we use event delegation, 
// but we keep a reference for direct updates.
const botStatusBadge = document.getElementById('bot-status-badge');

// QR Code Elements
const qrContainer = document.getElementById('qr-container');
const qrLoader = document.getElementById('qr-loader');
const qrImage = document.getElementById('qr-image');
const qrError = document.getElementById('qr-error');
const qrStatusText = document.getElementById('qr-status-text');
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
    if (qrStatusText) {
        qrStatusText.textContent = 'Escaneie o QR Code abaixo:';
        qrStatusText.style.color = 'var(--text-main)';
    }
}

function updateConnectionStatus(isConnected) {
    if (isConnected) {
        if (qrLoader) qrLoader.style.display = 'none';
        if (qrImage) qrImage.style.display = 'none';
        if (qrError) qrError.style.display = 'none';
        if (qrContainer) qrContainer.style.display = 'none';
        if (qrStatusText) {
            qrStatusText.textContent = '✅ WhatsApp Conectado!';
            qrStatusText.style.color = '#22c55e';
        }
    } else {
        if (qrImage) qrImage.style.display = 'none';
        if (qrError) qrError.style.display = 'none';
        if (qrLoader) qrLoader.style.display = 'block';
        if (qrContainer) qrContainer.style.display = 'flex';
        if (qrStatusText) {
            qrStatusText.textContent = 'Aguardando leitura...';
            qrStatusText.style.color = 'var(--text-main)';
        }
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
        })
        .catch(err => console.error('Erro ao carregar inicial:', err));

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
    document.getElementById('btn-usuarios').onclick = () => {
        alert('Redirecionando para gestão de usuários...');
    };

    document.getElementById('btn-cadastro').onclick = () => {
        window.location.href = 'cardapio.html';
    };
});
