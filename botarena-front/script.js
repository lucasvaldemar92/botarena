const BASE_URL = 'http://localhost:3000';
// Only connect socket if io is available (socket.io script included in dashboard/chat)
const socket = window.io ? io(BASE_URL) : null;

document.addEventListener('DOMContentLoaded', async () => {
    // --- Shared State & Global Sync ---
    const headerCompanyLogo = document.getElementById('header-company-logo');

    async function syncGlobalHeader() {
        try {
            const response = await fetch(`${BASE_URL}/api/config`);
            if (response.ok) {
                const config = await response.json();
                const company = config.empresa || 'botarena';
                if (headerCompanyLogo) headerCompanyLogo.textContent = company;
                
                // Dynamic Footer Branding
                const footerText = document.querySelector('.footer__text');
                if (footerText) footerText.textContent = `© 2026 ${company}`;

                // Trigger dashboard specific updates if elements exist
                if (typeof updateBotStatus === 'function') updateBotStatus(config.bot_active);
                
                // Populate inputs if they exist (settings modal)
                const inputEmpresa = document.getElementById('cfg-company-name');
                const inputPix = document.getElementById('cfg-pix-key');
                if (inputEmpresa) inputEmpresa.value = config.empresa || '';
                if (inputPix) inputPix.value = config.pix || '';
            }
        } catch (err) { console.log('Backend not reached for sync'); }
    }
    syncGlobalHeader();

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
    const statusLed = document.querySelector('[data-testid="status-led"]');
    const statusText = document.querySelector('[data-testid="status-text"]');
    const botToggleSwitch = document.querySelector('[data-testid="bot-toggle-switch"]');
    const qrLoader = document.getElementById('qr-loader');
    const qrImage = document.getElementById('qr-image');
    const qrStatusText = document.getElementById('qr-status-text');

    function updateBotStatus(isActive) {
        if (!statusLed || !statusText || !botToggleSwitch) return;
        
        if (isActive) {
            statusLed.className = 'control__led control__led--online pulse';
            statusText.textContent = 'Bot Ativado';
            statusText.style.color = '#4ade80'; // --green
            botToggleSwitch.checked = true;
            if(qrStatusText) qrStatusText.textContent = 'WhatsApp Conectado!';
        } else {
            statusLed.className = 'control__led control__led--offline';
            statusText.textContent = 'Bot Desativado';
            statusText.style.color = '#ff3131'; // --red
            botToggleSwitch.checked = false;
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
            } catch (err) { e.target.checked = !isActive; updateBotStatus(!isActive); }
        });
    }

    if (socket) {
        socket.on('qr', (qrData) => {
            if (qrImage && qrLoader) {
                qrLoader.classList.add('hidden');
                qrImage.classList.remove('hidden');
                qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}&color=ffffff&bgcolor=0f172a`;
                if(qrStatusText) qrStatusText.textContent = 'Escaneie o QR Code:';
            }
        });
        socket.on('bot_status', (data) => updateBotStatus(data.active));
        socket.on('bot_online', () => updateBotStatus(true));
        socket.on('bot_disconnected', () => updateBotStatus(false));
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

    // Override syncGlobalHeader to populate inputs
    async function syncGlobalHeader() {
        try {
            const response = await fetch(`${BASE_URL}/api/config`);
            if (response.ok) {
                const config = await response.json();
                if (headerCompanyLogo) headerCompanyLogo.textContent = config.empresa || 'botarena';
                if (inputEmpresa) inputEmpresa.value = config.empresa || '';
                if (inputPix) inputPix.value = config.pix || '';
                updateBotStatus(config.bot_active);
            }
        } catch (err) { console.log('Backend not reached'); }
    }

    // Initialize View
    if (gridQr) {
        updateCount();
        renderGrid();
    }
    syncGlobalHeader(); // Initial load
});
