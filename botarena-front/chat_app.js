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
const inputPix = document.querySelector('[data-testid="cfg-pix-key"]');
const inputCardapio = document.querySelector('[data-testid="cfg-menu-link"]');
const btnSaveConfig = document.querySelector('[data-testid="btn-save-config"]');

// Chat / Simulation
const simCompanyNameTags = document.querySelectorAll('#test-bot-bubble strong');

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

    // Update Simulation placeholder 
    simCompanyNameTags.forEach(tag => {
        if(tag.textContent.includes('{{ company_name }}') || tag.textContent.includes('Lanchonete') || tag.textContent.includes('Arena')) {
            tag.textContent = companyName;
        }
    });

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

// Initialize
document.addEventListener('DOMContentLoaded', fetchConfig);
