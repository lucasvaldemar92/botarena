const BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `http://${window.location.hostname}:${window.location.port}`
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
    const response = await originalFetch(resource, config);
    if (response.status === 401 && typeof resource === 'string' && !resource.includes('/dev-login')) {
        console.warn('⚠️ [Auth] Token inválido ou expirado. Removendo e recarregando...');
        localStorage.removeItem('botarena-token');
        window.location.reload();
    }
    return response;
};
// --- SHARED UTILS ---
window.utils = {
    /**
     * Standardized API fetch wrapper.
     * Automatically prepends BASE_URL/api and handles auth tokens.
     */
    apiFetch: async (endpoint, options = {}) => {
        const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}/api${endpoint}`;
        // Auto-inject Content-Type for JSON bodies
        if (options.body && typeof options.body === 'string') {
            options.headers = options.headers || {};
            options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown Error' }));
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
};

if (window.io) {
    const originalIo = window.io;
    window.io = function(url, opts) {
        // Handle case where first arg is an options object (no URL given)
        if (url && typeof url === 'object') {
            opts = url;
            url = BASE_URL;
        }
        const targetUrl = (typeof url === 'string' && url.startsWith('http')) ? url : BASE_URL;
        opts = opts || {};
        opts.auth = opts.auth || {};
        opts.auth.token = localStorage.getItem('botarena-token');
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

    const inputPix = document.getElementById('cfg-pix-key');
    const inputPixName = document.getElementById('cfg-pix-name');
    const headerCompanyLogo = document.getElementById('header-company-logo');

    // Operation Hours Elements
    const periodsContainer = document.getElementById('operation-periods-container');
    const btnAddPeriod = document.getElementById('btn-add-period');
    const inputOpAbsence = document.getElementById('cfg-op-absence');

    function createPeriodBlock(period = { days: '1,2,3,4,5', start: '08:00', end: '18:00' }) {
        if (!periodsContainer) return;
        
        const block = document.createElement('div');
        block.className = 'operation-period-block';
        block.style.cssText = 'background: #fcfcfc; border: 1px solid #e9edef; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.02);';
        
        const daySet = new Set(period.days ? period.days.split(',') : []);
        
        block.innerHTML = `
            <button type="button" class="btn-remove-period" title="Remover Período" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #dc3545; cursor: pointer; font-size: 1.1rem; padding: 0.25rem;">
                <i class="fa-solid fa-trash-can"></i>
            </button>
            
            <div class="settings-form__group">
                <label class="settings-form__label" style="margin-right: 2rem;">Dias de Funcionamento</label>
                <div class="days-pills" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button type="button" class="day-pill ${daySet.has('0') ? 'active' : ''}" data-day="0">Dom</button>
                    <button type="button" class="day-pill ${daySet.has('1') ? 'active' : ''}" data-day="1">Seg</button>
                    <button type="button" class="day-pill ${daySet.has('2') ? 'active' : ''}" data-day="2">Ter</button>
                    <button type="button" class="day-pill ${daySet.has('3') ? 'active' : ''}" data-day="3">Qua</button>
                    <button type="button" class="day-pill ${daySet.has('4') ? 'active' : ''}" data-day="4">Qui</button>
                    <button type="button" class="day-pill ${daySet.has('5') ? 'active' : ''}" data-day="5">Sex</button>
                    <button type="button" class="day-pill ${daySet.has('6') ? 'active' : ''}" data-day="6">Sáb</button>
                </div>
            </div>

            <div style="display: flex; gap: 1rem; width: 100%;">
                <div class="settings-form__group" style="margin-bottom: 0; flex: 1;">
                    <label class="settings-form__label">Início</label>
                    <input type="time" class="settings-form__input period-start" value="${period.start || '08:00'}">
                </div>
                <div class="settings-form__group" style="margin-bottom: 0; flex: 1;">
                    <label class="settings-form__label">Término</label>
                    <input type="time" class="settings-form__input period-end" value="${period.end || '18:00'}">
                </div>
            </div>
        `;

        const pills = block.querySelectorAll('.day-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => pill.classList.toggle('active'));
        });

        const removeBtn = block.querySelector('.btn-remove-period');
        removeBtn.addEventListener('click', () => block.remove());

        periodsContainer.appendChild(block);
    }

    if (btnAddPeriod) {
        btnAddPeriod.addEventListener('click', () => createPeriodBlock());
    }

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

            const periods = [];
            if (periodsContainer) {
                const blocks = periodsContainer.querySelectorAll('.operation-period-block');
                blocks.forEach(block => {
                    const activeDays = Array.from(block.querySelectorAll('.day-pill.active'))
                                            .map(p => p.dataset.day)
                                            .join(',');
                    const start = block.querySelector('.period-start').value;
                    const end = block.querySelector('.period-end').value;
                    if (activeDays || (start && end)) {
                        periods.push({ days: activeDays, start, end });
                    }
                });
            }

            const payload = {
                pix: inputPix ? inputPix.value : undefined,
                nome_favorecido: inputPixName ? inputPixName.value : undefined,
                operation_periods: JSON.stringify(periods),
                mensagem_ausencia: inputOpAbsence ? inputOpAbsence.value : undefined
            };

            try {
                // --- Asset Management: Menu File Upload ---
                const menuFile = document.getElementById('menuFile');
                if (menuFile && menuFile.files.length > 0) {
                    await window.uploadMenuFile(menuFile.files[0]);
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
                } else {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Erro ao salvar configurações');
                }
            } catch (err) {
                console.error('Error saving config:', err);
                btnSaveConfig.textContent = 'Erro!';
                btnSaveConfig.classList.add('btn--error');
                if (typeof window.showToast === 'function') {
                    window.showToast(`Erro ao salvar: ${err.message}`, 'error');
                } else {
                    alert(`Erro ao salvar: ${err.message}`);
                }
                if (typeof window.Sentry !== 'undefined') window.Sentry.captureException(err);
                setTimeout(() => {
                    btnSaveConfig.innerHTML = originalText;
                    btnSaveConfig.disabled = false;
                    btnSaveConfig.classList.remove('btn--error');
                }, 2000);
            }
        });
    }


    // Pix Masking Engine
    function formatPixKey(value) {
        if (!value) return '';
        
        // Se for email (contém @)
        if (value.includes('@')) return value.replace(/\s/g, '').toLowerCase();

        // Se começar com + (telefone E.164)
        if (value.trim().startsWith('+')) {
            const digits = value.replace(/\D/g, '');
            return digits ? '+' + digits : '+';
        }

        const cleanDigits = value.replace(/\D/g, '');
        const cleanAlphanum = value.replace(/[^a-zA-Z0-9]/g, '');

        // Se tem letra, consideramos Chave Aleatória (UUID)
        if (/[a-zA-Z]/.test(cleanAlphanum)) {
            let v = cleanAlphanum.toLowerCase().substring(0, 32);
            v = v.replace(/^([a-z0-9]{8})([a-z0-9]{1,4})?([a-z0-9]{1,4})?([a-z0-9]{1,4})?([a-z0-9]{1,12})?$/, (m, p1, p2, p3, p4, p5) => {
                let f = p1;
                if (p2) f += '-' + p2;
                if (p3) f += '-' + p3;
                if (p4) f += '-' + p4;
                if (p5) f += '-' + p5;
                return f;
            });
            return v;
        }

        // Apenas números: Telefone, CPF ou CNPJ
        let v = cleanDigits;
        if (v.length <= 11) {
            // Se o tamanho for 11 e o 3º digito for 9, é celular
            if (v.length === 11 && v[2] === '9') {
                return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            }
            // Se o tamanho for 10, é telefone fixo
            if (v.length === 10) {
                return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            }
            // Caso contrário, formata dinamicamente como CPF
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            return v;
        } else {
            // Formata dinamicamente como CNPJ
            v = v.substring(0, 14);
            v = v.replace(/(\d{2})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1/$2');
            v = v.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
            return v;
        }
    }

    if (inputPix) {
        inputPix.addEventListener('input', (e) => {
            e.target.value = formatPixKey(e.target.value);
        });
        inputPix.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            // Sanitizar: delegamos a sanitização principal para a função de formatação
            // Mas removemos quebras de linha e espaços excedentes nas pontas
            const sanitized = pastedData.replace(/[\r\n]+/g, '').trim();
            e.target.value = formatPixKey(sanitized);
            e.target.dispatchEvent(new Event('input', { bubbles: true }));
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

    // --- SHARED ASSET HELPERS ---
    window.uploadMenuFile = async function(file) {
        if (!file) return;
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        const response = await fetch(`${BASE_URL}/api/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                extracted_text: `Arquivo: ${file.name}`,
                mimetype: file.type,
                base64_data: base64
            })
        });

        if (response.ok) {
            // Notify all parts of the app that menu was updated
            const menuData = await response.json();
            window.dispatchEvent(new CustomEvent('menuUpdated', { detail: menuData.menu }));
            return menuData.menu;
        } else {
            if (response.status === 413) {
                throw new Error('Arquivo muito grande. O limite é 10MB.');
            }
            throw new Error('Falha ao fazer upload do cardápio');
        }
    };

    async function syncGlobalHeader() {
        try {
            const response = await fetch(`${BASE_URL}/api/config`);
            if (response.ok) {
                const config = await response.json();
                const company = config.empresa || 'botarena';
                if (headerCompanyLogo) headerCompanyLogo.textContent = company;
                if (inputPix) inputPix.value = config.pix || '';
                if (inputPixName) inputPixName.value = config.nome_favorecido || '';
                if (inputOpAbsence) inputOpAbsence.value = config.mensagem_ausencia || '';
                
                if (periodsContainer) {
                    periodsContainer.innerHTML = '';
                    let periods = [];
                    try {
                        if (config.operation_periods) {
                            periods = JSON.parse(config.operation_periods);
                        } else if (config.operation_start) {
                            periods = [{ days: config.operation_days, start: config.operation_start, end: config.operation_end }];
                        }
                    } catch (e) {
                        console.error('Failed to parse periods', e);
                    }
                    if (periods.length === 0) {
                        createPeriodBlock(); // Default 1 period
                    } else {
                        periods.forEach(p => createPeriodBlock(p));
                    }
                }

                if (config.empresa) {
                    updateInitials(config.empresa);
                }

                const footerText = document.querySelector('.footer__text');
                if (footerText) footerText.textContent = `© 2026 ${company}`;

                // Fire custom event to notify apps to update specific toggles
                window.dispatchEvent(new CustomEvent('configLoaded', { detail: config }));
            }

            // Also sync current menu
            const menuRes = await fetch(`${BASE_URL}/api/menu`);
            if (menuRes.ok) {
                const menu = await menuRes.json();
                if (menu && menu.extracted_text) {
                    window.dispatchEvent(new CustomEvent('menuUpdated', { detail: menu }));
                }
            }
        } catch (err) { 
            // console.log('Backend not reached'); 
            if (typeof window.Sentry !== 'undefined') window.Sentry.captureException(err); 
        }
    }

    // Expose globals for specific apps
    window.syncGlobalHeader = syncGlobalHeader;
    window.openModal = openModal;
    window.closeModal = closeModal;

    // Handle menu updates globally for the settings modal
    window.addEventListener('menuUpdated', (e) => {
        const menu = e.detail;
        const filePreview = document.getElementById('filePreview');
        if (filePreview && menu && menu.extracted_text) {
            const fileName = menu.extracted_text.replace('Arquivo: ', '');
            filePreview.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #25d366;"></i> <span>${fileName}</span>`;
            filePreview.classList.add('visible');
        }
    });

    syncGlobalHeader(); // Initial load
});
