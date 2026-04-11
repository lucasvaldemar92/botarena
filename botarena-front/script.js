const BASE_URL = 'http://localhost:3000';
// Only connect socket if io is available (socket.io script included in dashboard/chat)
const socket = window.io ? io(BASE_URL) : null;

document.addEventListener('DOMContentLoaded', async () => {
    // --- Theme Persistence ---
    const themeSelect = document.getElementById('theme-select');
    const savedTheme = localStorage.getItem('botarena-theme') || 'theme-dark';
    document.documentElement.className = savedTheme;
    document.body.className = savedTheme;
    if (themeSelect) themeSelect.value = savedTheme;

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.documentElement.className = newTheme;
            document.body.className = newTheme;
            localStorage.setItem('botarena-theme', newTheme);
        });
    }

    // --- Shared State & Global Sync ---
    const headerCompanyLogo = document.getElementById('header-company-logo');

    // --- State (QR Library) ---
    const STORAGE_KEY = 'qr_manager_data';
    let qrLibrary = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let currentPreviewQRCode = null;

    // --- DOM Elements ---
    const inputQrText = document.getElementById('qr-text');
    const inputQrLabel = document.getElementById('qr-label');
    const btnGenerate = document.getElementById('generate-qr');
    const btnSave = document.getElementById('save-qr');
    const boxPreview = document.getElementById('preview-box');
    const gridQr = document.getElementById('qr-grid');
    const textLibraryCount = document.getElementById('library-count');

    // --- Core Functions ---

    /**
     * Renders a QR code onto a specified DOM element
     */
    function renderQRCode(element, text, size = 180) {
        element.innerHTML = ''; // clear previous
        return new QRCode(element, {
            text: text,
            width: size,
            height: size,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    /**
     * Updates the main library count text
     */
    function updateCount() {
        if (textLibraryCount) {
            textLibraryCount.textContent = `${qrLibrary.length} item${qrLibrary.length !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Saves library state to LocalStorage
     */
    function persistData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(qrLibrary));
        updateCount();
    }

    /**
     * Deletes an item from the library
     */
    window.deleteItem = (id) => {
        qrLibrary = qrLibrary.filter(item => item.id !== id);
        persistData();
        renderGrid();
    };

    /**
     * Downloads the QR code image by extracting the canvas basic64 data
     */
    window.downloadItem = (id) => {
        const item = qrLibrary.find(i => i.id === id);
        if (!item) return;

        // Find the canvas inside the card
        const cardElement = document.querySelector(`[data-card-id="${id}"]`);
        if (!cardElement) return;

        const canvas = cardElement.querySelector('canvas');
        if (!canvas) {
            alert("Image not ready to download.");
            return;
        }

        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `QR_${item.label || 'Code'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    /**
     * Renders the grid of QR Cards
     */
    function renderGrid() {
        if (!gridQr) return;
        gridQr.innerHTML = '';
        if (qrLibrary.length === 0) {
            gridQr.innerHTML = `<p style="color: var(--color-text-muted); grid-column: 1 / -1; text-align: center; padding: 2rem;">Your library is empty. Generate a QR code to start building your collection.</p>`;
            return;
        }

        qrLibrary.forEach(item => {
            // Create Card Container
            const card = document.createElement('div');
            card.className = 'qr-card zoom-in-section';
            card.setAttribute('data-card-id', item.id);
            card.setAttribute('data-testid', `card-qr-${item.id}`);

            // Create Image Container
            const imgContainer = document.createElement('div');
            imgContainer.className = 'qr-card__image';

            // Render actual QR instance inside the image container
            renderQRCode(imgContainer, item.text, 160);

            // Create Content Container
            const contentContainer = document.createElement('div');
            contentContainer.className = 'qr-card__content';

            contentContainer.innerHTML = `
                <div class="qr-card__label" data-testid="label-qr-${item.id}">${item.label || 'Unlabeled Code'}</div>
                <div class="qr-card__data" data-testid="data-qr-${item.id}">${item.text}</div>
                <div class="qr-card__actions">
                    <button class="qr-card__btn qr-card__btn--download" onclick="downloadItem('${item.id}')" data-testid="btn-download-${item.id}">
                        <i class="fa-solid fa-download"></i> Save PNG
                    </button>
                    <button class="qr-card__btn qr-card__btn--delete" onclick="deleteItem('${item.id}')" data-testid="btn-delete-${item.id}">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            `;

            card.appendChild(imgContainer);
            card.appendChild(contentContainer);
            gridQr.appendChild(card);
        });
    }

    // --- Event Listeners (QR Manager) ---

    if (btnGenerate) {
        btnGenerate.addEventListener('click', () => {
            const text = inputQrText.value.trim();
            if (!text) {
                alert('Please enter a URL, text, or data to generate a QR Code.');
                inputQrText.focus();
                return;
            }

            // Render preview
            currentPreviewQRCode = renderQRCode(boxPreview, text, 200);

            // Enable save button
            if (btnSave) {
                btnSave.removeAttribute('disabled');
                btnSave.classList.remove('btn-secondary');
            }
        });
    }

    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const text = inputQrText.value.trim();
            const label = inputQrLabel.value.trim();
            if (!text) return;

            const newItem = {
                id: Date.now().toString(),
                text: text,
                label: label,
                createdAt: new Date().toISOString()
            };

            qrLibrary.unshift(newItem);
            persistData();
            renderGrid();

            inputQrText.value = '';
            inputQrLabel.value = '';
            boxPreview.innerHTML = `
                <div class="generate-preview__placeholder">
                    <i class="fa-solid fa-qrcode"></i>
                    <p>Code Saved to Library</p>
                </div>
            `;
            btnSave.setAttribute('disabled', 'true');
            btnSave.classList.add('btn-secondary');
        });
    }

    // --- Dashboard Specific Logic (BEM) ---
    const statusLed      = document.querySelector('[data-testid="status-led"]');
    const statusText     = document.querySelector('[data-testid="status-text"]');
    const botToggleSwitch = document.querySelector('[data-testid="bot-toggle-switch"]');
    const qrLoader       = document.getElementById('qr-loader');
    const qrImage        = document.getElementById('qr-image');
    const qrStatusText   = document.getElementById('qr-status-text');
    const qrContainer    = document.getElementById('qr-container');

    // Tracks whether QR was actually shown to the user (user needs to scan)
    let qrWasVisible = false;

    // ==========================================
    // 🔁 MUTUALLY EXCLUSIVE CONNECTION STATES
    // ==========================================

    /** State 1 — Loading / waiting for QR */
    function showLoaderState() {
        if (qrLoader)  qrLoader.classList.remove('hidden');
        if (qrImage)   qrImage.classList.add('hidden');
        hideConnectedState();
        if (qrStatusText) {
            qrStatusText.textContent = 'Aguardando QR Code...';
            qrStatusText.style.color = '';
        }
    }

    /** State 2 — QR Code ready for scanning */
    function showQRState(qrData) {
        hideConnectedState();
        if (qrLoader) qrLoader.classList.add('hidden');
        if (qrImage) {
            qrImage.style.opacity = '1';
            qrImage.classList.remove('hidden');
            qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}&color=ffffff&bgcolor=0f172a`;
        }
        if (qrStatusText) {
            qrStatusText.textContent = 'Escaneie o QR Code com o WhatsApp:';
            qrStatusText.style.color = '';
        }
        qrWasVisible = true;
    }

    /** State 3 — Connected (check icon) */
    function showConnectedState() {
        if (qrLoader) qrLoader.classList.add('hidden');
        if (qrImage)  qrImage.classList.add('hidden');

        let el = document.getElementById('qr-connected-state');
        if (!el) {
            el = document.createElement('div');
            el.id = 'qr-connected-state';
            el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.75rem;height:100%;width:100%;';
            el.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24"
                     fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span style="color:#4ade80;font-weight:600;font-size:0.95rem;">WhatsApp Conectado</span>
            `;
            if (qrContainer) qrContainer.appendChild(el);
        } else {
            el.style.display = 'flex';
        }

        if (qrStatusText) {
            qrStatusText.textContent = 'WhatsApp Conectado!';
            qrStatusText.style.color = '#4ade80';
        }
    }

    /** Utility — hide connected state without changing other states */
    function hideConnectedState() {
        const el = document.getElementById('qr-connected-state');
        if (el) el.style.display = 'none';
    }

    function updateBotStatus(isActive) {
        if (!statusLed || !statusText || !botToggleSwitch) return;

        if (isActive) {
            statusLed.className = 'control__led control__led--online pulse';
            statusText.textContent = 'Bot Ativado';
            statusText.style.color = '#4ade80';
            botToggleSwitch.checked = true;
            showConnectedState();
        } else {
            statusLed.className = 'control__led control__led--offline';
            statusText.textContent = 'Bot Desativado';
            statusText.style.color = '#ff3131';
            botToggleSwitch.checked = false;
            showLoaderState();
        }
    }

    if (botToggleSwitch) {
        botToggleSwitch.addEventListener('change', async (e) => {
            const isActive = e.target.checked;
            updateBotStatus(isActive);
            try {
                await fetch(`${BASE_URL}/api/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bot_active: isActive })
                });
            } catch (err) { e.target.checked = !isActive; updateBotStatus(!isActive); if (typeof Sentry !== 'undefined') Sentry.captureException(err); }
        });
    }

    if (socket) {
        // QR recebido: renderiza o QR garantindo que estado "Conectado" foi removido
        socket.on('qr', (qrData) => {
            console.log('📱 [Socket] QR Code received — switching to QR state');
            showQRState(qrData);
        });

        // Estado inicial do bot enviado pelo servidor ao conectar o socket
        socket.on('bot_status', (data) => {
            console.log('📡 [Socket] bot_status:', data.active);
            updateBotStatus(data.active);
        });

        // Bot ficou online (após autenticação ou restart)
        socket.on('bot_online', () => {
            console.log('✅ [Socket] bot_online');
            updateBotStatus(true);
        });

        // Bot desconectou
        socket.on('bot_disconnected', () => {
            console.log('⚠️ [Socket] bot_disconnected');
            qrWasVisible = false;
            updateBotStatus(false);
        });

        // Auth success: só redireciona se o QR foi exibido nesta sessão
        // (evita redirect ao abrir o dashboard quando já estava conectado)
        socket.on('auth_success', () => {
            console.log('🔐 [Socket] auth_success — qrWasVisible:', qrWasVisible);
            if (qrWasVisible) {
                if (qrStatusText) qrStatusText.textContent = '✅ Conectado! Redirecionando...';
                if (qrImage) qrImage.style.opacity = '0.3';
                setTimeout(() => { window.location.href = '/chat'; }, 1500);
            }
            // Se qrWasVisible === false, sessão já estava ativa:
            // updateBotStatus(true) já foi chamado pelo bot_status — sem redirect
        });
    }

    // --- Settings Modal Logic (Dashboard) ---
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsBackdrop = document.getElementById('settings-backdrop');
    const btnSaveConfig = document.getElementById('btn-save-config');

    const inputEmpresa = document.getElementById('cfg-company-name');
    const inputPix = document.getElementById('cfg-pix-key');

    function openModal() {
        if (!settingsModal) return;
        settingsModal.classList.add('settings-modal--active');
        // Fetch latest to be sure
        syncGlobalHeader();
    }

    function closeModal() {
        if (!settingsModal) return;
        settingsModal.classList.remove('settings-modal--active');
    }

    if (openSettingsBtn) openSettingsBtn.addEventListener('click', openModal);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeModal);
    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeModal);
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeModal);

    // --- Logout Functionality ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (!confirm('Deseja realmente desconectar o WhatsApp? Isso exigirá um novo scan do QR Code.')) return;
            btnLogout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Desconectando...';
            btnLogout.disabled = true;
            try {
                await fetch(`${BASE_URL}/api/logout`, { method: 'POST' });
                // force_logout socket event will handle the UI update
            } catch (err) {
                console.error('❌ [Logout] Error:', err);
                btnLogout.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Desconectar WhatsApp';
                btnLogout.disabled = false;
            }
        });
    }

    socket.on('force_logout', () => {
        closeModal();
        showLoaderState();
    });

    // Save Config Action
    if (btnSaveConfig) {
        btnSaveConfig.addEventListener('click', async () => {
            const originalText = btnSaveConfig.innerHTML;
            btnSaveConfig.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
            btnSaveConfig.disabled = true;

            const payload = {
                empresa: inputEmpresa ? inputEmpresa.value : undefined,
                pix: inputPix ? inputPix.value : undefined
            };

            try {
                const response = await fetch(`${BASE_URL}/api/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    btnSaveConfig.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
                    setTimeout(() => {
                        btnSaveConfig.innerHTML = originalText;
                        btnSaveConfig.disabled = false;
                        closeModal();
                        syncGlobalHeader(); // Refresh header
                    }, 1000);
                }
            } catch (err) {
                console.error('Error saving config:', err);
                btnSaveConfig.innerHTML = 'Erro!';
                btnSaveConfig.disabled = false;
                if (typeof Sentry !== 'undefined') Sentry.captureException(err);
                setTimeout(() => btnSaveConfig.innerHTML = originalText, 2000);
            }
        });
    }

    // Pix Masking Engine (Consolidated & Alphanumeric)
    function formatPixKey(value) {
        if (!value) return '';
        // Email: strip spaces and lowercase
        if (value.includes('@')) return value.replace(/\s/g, '').toLowerCase();

        // Strip everything except alphanumeric for processing
        let clean = value.replace(/[^a-zA-Z0-9]/g, '');

        // Alphanumeric CNPJ (14 chars) - Supports letters
        if (clean.length === 14) {
            return clean.toUpperCase().replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
        }

        // CPF (11 digits) - Check if starts like CPF (not a phone with 11 digits starting with 9)
        if (clean.length === 11 && (clean[2] !== '9' || /^\d+$/.test(clean) === false)) {
             if (/^\d+$/.test(clean)) {
                return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
             }
        }

        // Phone (10 or 11 digits)
        if ((clean.length === 10 || clean.length === 11) && /^\d+$/.test(clean)) {
             if (clean.length === 11) {
                 return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
             } else {
                 return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
             }
        }
        
        // Random Key or incomplete
        return value;
    }

    if (inputPix) {
        inputPix.addEventListener('input', (e) => {
            e.target.value = formatPixKey(e.target.value);
        });
        inputPix.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            // Sanitize: strip characters that aren't letters, numbers or @
            const sanitized = pastedData.replace(/[^a-zA-Z0-9@.-]/g, '');
            e.target.value = formatPixKey(sanitized);
        });
    }

    // Consolidated syncGlobalHeader (single definition)
    async function syncGlobalHeader() {
        try {
            const response = await fetch(`${BASE_URL}/api/config`);
            if (response.ok) {
                const config = await response.json();
                const company = config.empresa || 'botarena';
                if (headerCompanyLogo) headerCompanyLogo.textContent = company;
                if (inputEmpresa) inputEmpresa.value = config.empresa || '';
                if (inputPix) inputPix.value = config.pix || '';

                // Dynamic Footer Branding
                const footerText = document.querySelector('.footer__text');
                if (footerText) footerText.textContent = `© 2026 ${company}`;

                updateBotStatus(config.bot_active);
            }
        } catch (err) { console.log('Backend not reached'); if (typeof Sentry !== 'undefined') Sentry.captureException(err); }
    }

    // Initialize View
    if (gridQr) {
        updateCount();
        renderGrid();
    }
    syncGlobalHeader(); // Initial load
});
