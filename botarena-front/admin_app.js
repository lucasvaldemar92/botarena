// ==========================================
// 📡 GLOBALS AND DOM ELEMENTS
// ==========================================
const socket = window.io ? io(window.BASE_URL) : null;

// The badge is now a button, we don't store it statically since we use event delegation, 
// but we keep a reference for direct updates.
const botStatusBadge = document.getElementById('bot-status-badge');


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

    socket.on('config_updated', (newConfig) => {
        updateBotStatus(newConfig.bot_active);
    });
}

// ==========================================
// 🚀 INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initial status check via API
    fetch(`${window.BASE_URL}/api/config`)
        .then(res => res.json())
        .then(config => {
            updateBotStatus(config.bot_active);
        })
        .catch(err => console.error('Erro ao carregar config inicial:', err));

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
    // 📎 ANEXO DE CARDÁPIO
    // ==========================================
    const btnAnexar       = document.getElementById('btn-anexar');
    const btnAnexarIcon   = document.getElementById('btn-anexar-icon');
    const btnAnexarLabel  = document.getElementById('btn-anexar-label');
    const inputFile       = document.getElementById('input-file-cardapio');
    const filePreview     = document.getElementById('file-preview');
    const filePreviewName = document.getElementById('file-preview-name');
    const cardAnexo       = document.getElementById('card-anexo');
    const txtAnexoDesc    = document.getElementById('txt-anexo-desc');
    const toast           = document.getElementById('toast-upload');
    const toastMessage    = document.getElementById('toast-message');

    let toastTimer = null;

    function showToast(msg) {
        toastMessage.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
    }

    function updateMenuUI(menu) {
        if (!menu || !menu.extracted_text) return;
        
        const fileName = menu.extracted_text.replace('Arquivo: ', '');
        
        // Atualiza o botão → "Trocar arquivo"
        if (btnAnexarIcon) btnAnexarIcon.className = 'fa-solid fa-arrow-up-from-bracket';
        if (btnAnexarLabel) btnAnexarLabel.textContent = 'Trocar arquivo';

        // Exibe o preview com o nome do arquivo
        if (filePreviewName) filePreviewName.textContent = fileName;
        if (filePreview) filePreview.classList.add('visible');

        // Adiciona borda verde no card
        if (cardAnexo) cardAnexo.classList.add('card--selected');
        if (txtAnexoDesc) txtAnexoDesc.textContent = 'Cardápio atualizado e ativo';
    }

    // Listen for global menu updates
    window.addEventListener('menuUpdated', (e) => {
        updateMenuUI(e.detail);
    });

    if (btnAnexar && inputFile) {
        // Botão dispara o input oculto
        btnAnexar.addEventListener('click', () => inputFile.click());

        // Ao selecionar arquivo
        inputFile.addEventListener('change', async () => {
            const file = inputFile.files[0];
            if (!file) return;

            try {
                // Desabilita o botão durante o upload
                btnAnexar.disabled = true;
                btnAnexarLabel.textContent = 'Enviando...';

                await window.uploadMenuFile(file);
                
                // O evento 'menuUpdated' disparado pelo utils.js cuidará de chamar updateMenuUI
                showToast(`Cardápio enviado com sucesso!`);
            } catch (err) {
                console.error('Erro no upload:', err);
                showToast('Falha ao enviar cardápio');
                btnAnexarLabel.textContent = 'Tentar novamente';
            } finally {
                btnAnexar.disabled = false;
            }
        });
    }

    // Event listeners para os outros botões
    document.getElementById('btn-usuarios').onclick = () => {
        alert('Redirecionando para gestão de usuários...');
    };

    document.getElementById('btn-cadastro').onclick = () => {
        window.location.href = 'cardapio.html';
    };
});
