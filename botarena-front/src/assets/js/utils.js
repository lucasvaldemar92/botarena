const BASE_URL = window.location.hostname === 'localhost' && window.location.port === '8080'
    ? 'http://localhost:3000'
    : window.location.origin;

window.BASE_URL = BASE_URL;

// --- AUTO DEV LOGIN ---
let token = localStorage.getItem('botarena-token');
if (!token) {
    fetch(`${BASE_URL}/api/auth/dev-login`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            localStorage.setItem('botarena-token', data.token);
            window.location.reload();
        });
}
const originalFetch = window.fetch;
window.fetch = async function() {
    let [resource, config] = arguments;
    if(typeof resource === 'string' && resource.startsWith(BASE_URL) && !resource.includes('/dev-login')) {
        config = config || {};
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${localStorage.getItem('botarena-token')}`;
    }
    return originalFetch(resource, config);
};
if (window.io) {
    const originalIo = window.io;
    window.io = function(url, opts) {
        // If url is missing or relative, force BASE_URL
        const targetUrl = (url && url.startsWith('http')) ? url : BASE_URL;
        opts = opts || {};
        opts.auth = opts.auth || {};
        opts.auth.token = localStorage.getItem('botarena-token');
        console.log(`🔌 [Socket] Connecting to: ${targetUrl}`);
        return originalIo(targetUrl, opts);
    };
}
// --- END AUTO DEV LOGIN ---

document.addEventListener('DOMContentLoaded', () => {


    // --- Settings Modal Logic ---
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsBackdrop = document.getElementById('settings-backdrop');
    const btnSaveConfig = document.getElementById('btn-save-config');
    const btnLogout = document.getElementById('btn-logout');

    const inputEmpresa = document.getElementById('cfg-company-name');
    const inputPix = document.getElementById('cfg-pix-key');
    const inputPixName = document.getElementById('cfg-pix-name');
    const inputCardapio = document.querySelector('[data-testid="cfg-menu-link"]');
    const headerCompanyLogo = document.getElementById('header-company-logo');

    function openModal() {
        if (!settingsModal) return;
        settingsModal.classList.add('settings-modal--active');
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

    // Logout Functionality
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (!confirm('Deseja realmente desconectar o WhatsApp? Isso exigirá um novo scan do QR Code.')) return;
            btnLogout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Desconectando...';
            btnLogout.disabled = true;
            try {
                await fetch(`${BASE_URL}/api/logout`, { method: 'POST' });
                // Socket force_logout handles the rest
            } catch (err) {
                console.error('❌ [Logout] Error:', err);
                btnLogout.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Desconectar WhatsApp';
                btnLogout.disabled = false;
            }
        });
    }

    // Save Config Action
    if (btnSaveConfig) {
        btnSaveConfig.addEventListener('click', async () => {
            const originalText = btnSaveConfig.innerHTML;
            btnSaveConfig.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
            btnSaveConfig.disabled = true;

            const payload = {
                empresa: inputEmpresa ? inputEmpresa.value : undefined,
                pix: inputPix ? inputPix.value : undefined,
                nome_favorecido: inputPixName ? inputPixName.value : undefined
            };

            try {
                // --- Asset Management: Menu File Upload ---
                const menuFile = document.getElementById('menuFile');
                if (menuFile && menuFile.files.length > 0) {
                    const file = menuFile.files[0];
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(file);
                    });

                    await fetch(`${BASE_URL}/api/menu`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            extracted_text: `Arquivo: ${file.name}`,
                            mimetype: file.type,
                            base64_data: base64
                        })
                    });
                    console.log('✅ [Assets] Menu file uploaded successfully.');
                }

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
                        syncGlobalHeader(); 
                    }, 1000);
                }
            } catch (err) {
                console.error('Error saving config:', err);
                btnSaveConfig.innerHTML = 'Erro!';
                btnSaveConfig.disabled = false;
                if (typeof window.Sentry !== 'undefined') window.Sentry.captureException(err);
                setTimeout(() => btnSaveConfig.innerHTML = originalText, 2000);
            }
        });
    }

    // Pix Masking Engine
    function formatPixKey(value) {
        if (!value) return '';
        if (value.includes('@')) return value.replace(/\s/g, '').toLowerCase();
        let clean = value.replace(/[^a-zA-Z0-9]/g, '');

        if (clean.length === 14) {
            return clean.toUpperCase().replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
        }
        if (clean.length === 11 && (clean[2] !== '9' || /^\d+$/.test(clean) === false)) {
             if (/^\d+$/.test(clean)) {
                return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
             }
        }
        if ((clean.length === 10 || clean.length === 11) && /^\d+$/.test(clean)) {
             if (clean.length === 11) {
                 return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
             } else {
                 return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
             }
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

    function updateInitials(companyName) {
        const initialsEl = document.getElementById('profile-initials');
        if (!initialsEl || !companyName) return;
        
        const words = companyName.trim().split(/\s+/);
        let initials = '';
        if (words.length === 1) {
            initials = words[0].substring(0, 2).toUpperCase();
        } else if (words.length > 1) {
            initials = (words[0][0] + words[1][0]).toUpperCase();
        }
        initialsEl.textContent = initials;
    }

    async function syncGlobalHeader() {
        try {
            const response = await fetch(`${BASE_URL}/api/config`);
            if (response.ok) {
                const config = await response.json();
                const company = config.empresa || 'botarena';
                if (headerCompanyLogo) headerCompanyLogo.textContent = company;
                if (inputEmpresa) inputEmpresa.value = config.empresa || '';
                if (inputPix) inputPix.value = config.pix || '';
                if (inputPixName) inputPixName.value = config.nome_favorecido || '';
                if (inputCardapio) inputCardapio.value = config.cardapio_url || '';

                if (config.empresa) {
                    updateInitials(config.empresa);
                }

                const footerText = document.querySelector('.footer__text');
                if (footerText) footerText.textContent = `© 2026 ${company}`;

                // Fire custom event to notify apps to update specific toggles
                window.dispatchEvent(new CustomEvent('configLoaded', { detail: config }));
            }
        } catch (err) { 
            console.log('Backend not reached'); 
            if (typeof window.Sentry !== 'undefined') window.Sentry.captureException(err); 
        }
    }

    // Expose globals for specific apps
    window.syncGlobalHeader = syncGlobalHeader;
    window.closeModal = closeModal;

    syncGlobalHeader(); // Initial load
});
