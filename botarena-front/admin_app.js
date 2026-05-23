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
        if (window.closeSettingsModal) window.closeSettingsModal();
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
            // Then fetch config to update bot status (using apiFetch to include JWT token)
            return window.utils.apiFetch('/config');
        })
        .then(config => {
            updateBotStatus(config.bot_active);
            loadRagStats();
            loadDeliveryFees();
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
            if (confirm('Tem certeza que deseja desconectar o WhatsApp? Isso exigirá um novo scan do QR Code.')) {
                const originalHTML = btnDisconnect.innerHTML;
                btnDisconnect.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Desconectando...';
                btnDisconnect.disabled = true;
                try {
                    if (window.utils && window.utils.apiFetch) {
                        await window.utils.apiFetch('/logout', { method: 'POST' });
                    } else {
                        await fetch(`${BASE_URL}/api/logout`, { method: 'POST' });
                    }
                } catch (err) {
                    console.error('❌ [Disconnect] Error:', err);
                    btnDisconnect.innerHTML = originalHTML;
                    btnDisconnect.disabled = false;
                    alert('Erro ao desconectar: ' + err.message);
                }
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

    const _closeModalLogout = () => { if (modalLogout) modalLogout.style.display = 'none'; };
    const _openModalLogout  = () => { if (modalLogout) modalLogout.style.display = 'flex'; };

    if (window.utils && window.utils.modalManager) {
        window.utils.modalManager.register('modal-logout', _closeModalLogout);
    }

    if (btnLogoutHeader && modalLogout) {
        btnLogoutHeader.addEventListener('click', () => {
            if (window.utils && window.utils.modalManager) {
                window.utils.modalManager.open('modal-logout', _openModalLogout, _closeModalLogout);
            } else {
                _openModalLogout();
            }
        });
    }

    if (btnLogoutCancel && modalLogout) {
        btnLogoutCancel.addEventListener('click', () => {
            if (window.utils && window.utils.modalManager) {
                window.utils.modalManager.close('modal-logout');
            } else {
                _closeModalLogout();
            }
        });
    }

    // Fecha o modal ao clicar fora dele
    if (modalLogout) {
        modalLogout.addEventListener('click', (e) => {
            if (e.target === modalLogout) {
                if (window.utils && window.utils.modalManager) {
                    window.utils.modalManager.close('modal-logout');
                } else {
                    _closeModalLogout();
                }
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

    // ==========================================
    // 🛵 GESTÃO DE TAXAS DE ENTREGA
    // ==========================================
    const deliveryElements = {
        tableBody:     document.getElementById('delivery-fees-table-body'),
        btnAdd:        document.getElementById('btn-add-delivery-fee'),
        modal:         document.getElementById('modal-delivery-fee'),
        modalTitle:    document.getElementById('delivery-fee-modal-title'),
        form:          document.getElementById('form-delivery-fee'),
        inputNeigh:    document.getElementById('delivery-neighborhood'),
        inputZip:      document.getElementById('delivery-zip-code'),
        inputFee:      document.getElementById('delivery-fee-value'),
        btnClose:      document.getElementById('btn-close-delivery-modal'),
        btnCancel:     document.getElementById('btn-cancel-delivery-modal'),
    };

    let deliveryFeesState = {
        editingId: null,
        fees: []
    };

    async function loadDeliveryFees() {
        if (!deliveryElements.tableBody) return;
        try {
            const fees = await window.utils.apiFetch('/delivery-fees');
            deliveryFeesState.fees = fees;
            renderDeliveryFeesTable();
        } catch (err) {
            console.error('Erro ao buscar taxas de entrega:', err);
            deliveryElements.tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 2rem; text-align: center; color: #ef4444;">
                        Erro ao carregar taxas de entrega.
                    </td>
                </tr>
            `;
        }
    }

    function renderDeliveryFeesTable() {
        if (!deliveryElements.tableBody) return;
        const fees = deliveryFeesState.fees;

        if (fees.length === 0) {
            deliveryElements.tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                        Nenhuma taxa de entrega cadastrada.
                    </td>
                </tr>
            `;
            return;
        }

        deliveryElements.tableBody.innerHTML = fees.map(item => {
            const formattedFee = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.fee);
            return `
                <tr style="border-bottom: 1px solid var(--border-color);" data-id="${item.id}">
                    <td style="padding: 0.75rem 1rem; font-weight: 500;">${item.neighborhood || '---'}</td>
                    <td style="padding: 0.75rem 1rem; color: var(--text-muted);">${item.zip_code || '---'}</td>
                    <td style="padding: 0.75rem 1rem; color: #16a34a; font-weight: 600;">${formattedFee}</td>
                    <td style="padding: 0.75rem 1rem; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                        <button style="background:none; border:none; color:#3b82f6; cursor:pointer; padding:0.25rem;"
                            data-action="edit-fee" data-id="${item.id}" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button style="background:none; border:none; color:#ef4444; cursor:pointer; padding:0.25rem;"
                            data-action="delete-fee" data-id="${item.id}" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openDeliveryModal(item = null) {
        if (!deliveryElements.modal) return;

        deliveryFeesState.editingId = item ? item.id : null;

        const doOpen = () => {
            deliveryElements.modal.style.display = 'flex';
            if (item) {
                deliveryElements.modalTitle.textContent = 'Editar Taxa de Entrega';
                deliveryElements.inputNeigh.value = item.neighborhood || '';
                deliveryElements.inputZip.value = window.utils.masks.cep(item.zip_code || '');
                deliveryElements.inputFee.value = item.fee;
            } else {
                deliveryElements.modalTitle.textContent = 'Nova Taxa de Entrega';
                deliveryElements.form.reset();
            }
        };

        if (window.utils && window.utils.modalManager) {
            window.utils.modalManager.open('modal-delivery-fee', doOpen, closeDeliveryModal);
        } else {
            doOpen();
        }
    }

    function closeDeliveryModal() {
        if (!deliveryElements.modal) return;
        deliveryElements.modal.style.display = 'none';
        deliveryElements.form.reset();
        deliveryFeesState.editingId = null;
        if (window.utils && window.utils.modalManager) {
            window.utils.modalManager.close('modal-delivery-fee');
        }
    }

    // Registra o modal de delivery no manager
    if (window.utils && window.utils.modalManager) {
        window.utils.modalManager.register('modal-delivery-fee', closeDeliveryModal);
    }

    // Bind listeners for delivery fees
    if (deliveryElements.btnAdd) {
        deliveryElements.btnAdd.addEventListener('click', () => openDeliveryModal());
    }
    if (deliveryElements.btnClose) {
        deliveryElements.btnClose.addEventListener('click', closeDeliveryModal);
    }
    if (deliveryElements.btnCancel) {
        deliveryElements.btnCancel.addEventListener('click', closeDeliveryModal);
    }

    // CEP mask input helper
    if (deliveryElements.inputZip) {
        deliveryElements.inputZip.addEventListener('input', (e) => {
            e.target.value = window.utils.masks.cep(e.target.value);
        });
    }

    if (deliveryElements.form) {
        deliveryElements.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                neighborhood: deliveryElements.inputNeigh.value,
                zipCode:      deliveryElements.inputZip.value,
                fee:          parseFloat(deliveryElements.inputFee.value) || 0
            };

            try {
                let response;
                if (deliveryFeesState.editingId) {
                    response = await window.utils.apiFetch(`/delivery-fees/${deliveryFeesState.editingId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                } else {
                    response = await window.utils.apiFetch('/delivery-fees', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                }

                if (response.success) {
                    closeDeliveryModal();
                    await loadDeliveryFees();
                }
            } catch (err) {
                console.error('Erro ao salvar taxa de entrega:', err);
                alert(err.message || 'Erro ao salvar taxa de entrega.');
            }
        });
    }

    // Delegated click actions for Edit/Delete in table
    document.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('[data-action="edit-fee"]');
        if (editBtn) {
            const item = deliveryFeesState.fees.find(x => x.id === parseInt(editBtn.dataset.id));
            if (item) openDeliveryModal(item);
        }

        const deleteBtn = e.target.closest('[data-action="delete-fee"]');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm('Tem certeza que deseja excluir esta taxa de entrega?')) {
                try {
                    const response = await window.utils.apiFetch(`/delivery-fees/${id}`, { method: 'DELETE' });
                    if (response.success) {
                        await loadDeliveryFees();
                    }
                } catch (err) {
                    console.error('Erro ao excluir taxa de entrega:', err);
                    alert(err.message || 'Erro ao excluir taxa de entrega.');
                }
            }
        }
    });

    // ==========================================
    // 🍴 MENU CATALOG (V2) LOGIC
    // ==========================================
    
    let catalogItems = [];
    let currentCategoryFilter = 'all';
    
    const tableCatalogBody = document.getElementById('catalog-table-body');
    const categoryChipsContainer = document.getElementById('category-chips-container');
    const countAll = document.getElementById('count-all');
    const chipAdicionaisTrigger = document.getElementById('chip-adicionais-trigger');
    const countAdicionais = document.getElementById('count-adicionais');
    const searchInput = document.getElementById('catalog-search-input');
    const emptyState = document.getElementById('catalog-empty-state');
    const bannerAdicionais = document.getElementById('banner-adicionais-info');
    
    async function loadCatalog() {
        try {
            // Wait for both main catalog items and categories
            const [itemsResponse, categoriesResponse, adicionaisResponse] = await Promise.all([
                window.utils.apiFetch('/catalog'),
                window.utils.apiFetch('/catalog/categories'),
                window.utils.apiFetch('/catalog/adicionais')
            ]);
            
            // Combine items since the backend split them up depending on logic
            // Actually /catalog already returns all items (both normal and adicionais).
            catalogItems = itemsResponse;
            
            renderCategoryChips(categoriesResponse);
            applyFiltersAndRender();
            
        } catch (err) {
            console.error('Erro ao carregar catálogo:', err);
        }
    }
    
    function renderCategoryChips(categories) {
        if (!categoryChipsContainer) return;
        
        // Remove old dynamic chips
        const dynamicChips = categoryChipsContainer.querySelectorAll('.dynamic-chip');
        dynamicChips.forEach(c => c.remove());
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'chip-btn dynamic-chip';
            btn.dataset.filter = cat;
            btn.style.cssText = 'padding: 0.4rem 1rem; border-radius: 20px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-weight: 600;';
            
            const countSpan = document.createElement('span');
            countSpan.className = 'counter';
            countSpan.style.cssText = 'background: var(--bg-main); padding: 0.1rem 0.5rem; border-radius: 10px; font-size: 0.8rem;';
            
            btn.textContent = cat + ' ';
            btn.appendChild(countSpan);
            
            categoryChipsContainer.appendChild(btn);
        });
        
        bindChipEvents();
    }
    
    function bindChipEvents() {
        const allChips = document.querySelectorAll('.chip-btn');
        allChips.forEach(chip => {
            // Remove previous event listener safely
            const newChip = chip.cloneNode(true);
            chip.parentNode.replaceChild(newChip, chip);
            
            newChip.addEventListener('click', (e) => {
                document.querySelectorAll('.chip-btn').forEach(c => {
                    c.classList.remove('active');
                    c.style.borderColor = c.dataset.filter === 'adicionais' ? 'var(--accent-amber)' : 'var(--border-color)';
                    const badge = c.querySelector('.counter');
                    if (badge) {
                        badge.style.background = c.dataset.filter === 'adicionais' ? 'var(--accent-amber)' : 'var(--bg-main)';
                        badge.style.color = 'var(--text-main)';
                    }
                });
                
                const target = e.currentTarget;
                target.classList.add('active');
                
                // Highlight active state
                if (target.dataset.filter === 'adicionais') {
                    target.style.borderColor = 'var(--accent-amber)';
                    target.querySelector('.counter').style.background = 'var(--accent-amber)';
                    target.querySelector('.counter').style.color = 'white';
                    bannerAdicionais.style.display = 'block';
                } else {
                    target.style.borderColor = 'var(--accent-dark)';
                    target.querySelector('.counter').style.background = 'var(--accent-dark)';
                    target.querySelector('.counter').style.color = 'white';
                    bannerAdicionais.style.display = 'none';
                }
                
                currentCategoryFilter = target.dataset.filter;
                applyFiltersAndRender();
            });
        });
    }
    
    function applyFiltersAndRender() {
        if (!tableCatalogBody) return;
        
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        // Count totals
        const totalAdicionais = catalogItems.filter(i => i.is_adicional === 1).length;
        if(countAdicionais) countAdicionais.textContent = totalAdicionais;
        
        const totalNormal = catalogItems.filter(i => i.is_adicional === 0).length;
        if(countAll) countAll.textContent = totalNormal;
        
        // Update category chip counts
        const dynamicChips = document.querySelectorAll('.dynamic-chip');
        dynamicChips.forEach(chip => {
            const cat = chip.dataset.filter;
            const catCount = catalogItems.filter(i => i.is_adicional === 0 && i.categoria === cat).length;
            const counter = chip.querySelector('.counter');
            if(counter) counter.textContent = catCount;
        });
        
        // Filter elements
        const filtered = catalogItems.filter(item => {
            // 1. Filter by category
            if (currentCategoryFilter === 'adicionais' && item.is_adicional === 0) return false;
            if (currentCategoryFilter !== 'adicionais' && currentCategoryFilter !== 'all' && item.categoria !== currentCategoryFilter) return false;
            if (currentCategoryFilter === 'all' && item.is_adicional === 1) return false; // "Todos" = "Todos Normais"
            
            // 2. Filter by search
            if (searchTerm) {
                const searchMatch = (
                    (item.nome && item.nome.toLowerCase().includes(searchTerm)) ||
                    (item.descricao && item.descricao.toLowerCase().includes(searchTerm)) ||
                    (item.cod_pdv && String(item.cod_pdv).toLowerCase().includes(searchTerm))
                );
                if (!searchMatch) return false;
            }
            return true;
        });
        
        renderTable(filtered);
    }
    
    function renderTable(items) {
        tableCatalogBody.innerHTML = '';
        
        if (items.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                
                const descParts = (item.descricao || '').split(' ||| ');
                const displayDesc = descParts[0] || '-';
                
                let totalPreco = Number(item.preco) || 0;
                if (item.is_adicional === 0 && descParts[1]) {
                    try {
                        const meta = JSON.parse(descParts[1]);
                        if (meta.adicionalIds && meta.adicionalIds.length > 0) {
                            const vinculados = catalogItems.filter(x => x.is_adicional === 1 && meta.adicionalIds.includes(x.id));
                            const somaAdicionais = vinculados.reduce((sum, ad) => sum + (Number(ad.preco) || 0), 0);
                            totalPreco += somaAdicionais;
                        }
                    } catch (e) {
                        console.warn('Falha ao calcular soma de adicionais no painel administrativo:', e);
                    }
                }
                
                tr.innerHTML = `
                    <td style="padding: 1rem; color: var(--text-muted); font-size: 0.9rem;">${item.cod_pdv || '-'}</td>
                    <td style="padding: 1rem; font-weight: 600; color: var(--text-main);">${item.nome}</td>
                    <td style="padding: 1rem; color: var(--text-muted); font-size: 0.9rem; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${displayDesc}">${displayDesc}</td>
                    <td style="padding: 1rem; font-weight: 600;">R$ ${Number(totalPreco).toFixed(2)}</td>
                    <td style="padding: 1rem; text-align: center;">
                        <label class="switch switch--small" style="margin: 0 auto; display: inline-block;">
                            <input type="checkbox" data-action="toggle-catalog-status" data-id="${item.id}" ${item.disponivel === 1 ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </td>
                    <td style="padding: 1rem; text-align: center;">
                        <button class="btn btn--outline" data-action="edit-catalog-item" data-id="${item.id}" style="padding: 0.3rem 0.6rem; margin-right: 0.25rem;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn--outline" data-action="delete-catalog-item" data-id="${item.id}" style="padding: 0.3rem 0.6rem; color: #e11d48; border-color: #ffe4e6;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tableCatalogBody.appendChild(tr);
            });
        }
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyFiltersAndRender();
        });
    }
    
    document.addEventListener('change', async (e) => {
        if (e.target && e.target.dataset.action === 'toggle-catalog-status') {
            const id = e.target.dataset.id;
            try {
                await window.utils.apiFetch(`/catalog/${id}/toggle`, { method: 'PATCH' });
                // Update local memory state without reloading full array
                const item = catalogItems.find(i => i.id == id);
                if (item) item.disponivel = e.target.checked ? 1 : 0;
            } catch (err) {
                alert('Erro ao atualizar disponibilidade: ' + err.message);
                e.target.checked = !e.target.checked; // revert UI
            }
        }
    });

    document.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('[data-action="delete-catalog-item"]');
        if (deleteBtn) {
            if (confirm('Deseja excluir este item do cardápio?')) {
                try {
                    await window.utils.apiFetch(`/catalog/${deleteBtn.dataset.id}`, { method: 'DELETE' });
                    await loadCatalog();
                } catch(err) {
                    alert('Erro ao excluir: ' + err.message);
                }
            }
        }
    });
    
    // Load when app starts if menu is the target route or on demand
    // For now we just eagerly load it, or rely on navigation clicks.
    window.addEventListener('popstate', (e) => {
        if (window.location.pathname.includes('/menu-catalog')) {
            loadCatalog();
        }
    });

    // Trigger initial load if we start on the route
    if (window.location.pathname.includes('/menu-catalog')) {
        loadCatalog();
    }
    
    // Bind sidebar clicks to also trigger load
    const menuCatBtns = document.querySelectorAll('.sidebar__item[data-tab="menu-catalog"]');
    menuCatBtns.forEach(btn => {
        btn.addEventListener('click', () => loadCatalog());
    });
    
    // ==========================================
    // 🍴 LÓGICA E CONTROLE DOS MODAIS DE CATÁLOGO
    // ==========================================
    let selectedAdicionais = [];
    let currentProductId = null;
    let currentAdicionalId = null;

    const productAdicionalSearch = document.getElementById('product-adicional-search');
    const autocompleteResults = document.getElementById('autocomplete-results-box');
    const productSelectedTagsContainer = document.getElementById('product-selected-adicionais-tags');

    // Auto-popula categorias no select dos modais
    function populateCategoriesDropdowns(categories) {
        const productCatSelect = document.getElementById('product-categoria');
        const adicionalCatSelect = document.getElementById('adicional-vinculo-categorias');
        
        if (productCatSelect) {
            productCatSelect.innerHTML = '<option value="" disabled selected>Selecione uma categoria...</option>' + 
                categories.map(cat => `<option value="${cat}">${cat}</option>`).join('') +
                '<option value="Geral">Geral</option>';
        }
        
        if (adicionalCatSelect) {
            adicionalCatSelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
    }

    // Modal de Produto (Novo Item / Editar Item)
    function openProductModal(item = null) {
        const modal = document.getElementById('modal-produto');
        const form = document.getElementById('form-product');
        const title = document.getElementById('product-modal-title');
        
        currentProductId = item ? item.id : null;
        
        // Obter categorias únicas existentes na memória
        const categories = [...new Set(catalogItems.filter(i => i.is_adicional === 0).map(i => i.categoria))];
        populateCategoriesDropdowns(categories);

        const doOpen = () => {
            if (modal) modal.style.display = 'flex';
            if (item) {
                if (title) title.innerHTML = '<i class="fa-solid fa-utensils"></i> Editar Item';
                document.getElementById('product-cod-pdv').value = item.cod_pdv || '';
                document.getElementById('product-nome').value = item.nome || '';
                document.getElementById('product-preco').value = item.preco || 0;
                document.getElementById('product-categoria').value = item.categoria || '';
                
                const parts = (item.descricao || '').split(' ||| ');
                document.getElementById('product-descricao').value = parts[0] || '';
                
                selectedAdicionais = [];
                if (parts[1]) {
                    try {
                        const meta = JSON.parse(parts[1]);
                        if (meta.adicionalIds) {
                            selectedAdicionais = catalogItems.filter(x => x.is_adicional === 1 && meta.adicionalIds.includes(x.id));
                        }
                    } catch (e) {
                        console.warn('Falha ao processar metadados de adicionais:', e);
                    }
                }
                renderSelectedAdicionaisTags();
            } else {
                if (title) title.innerHTML = '<i class="fa-solid fa-utensils"></i> Cadastro de Item';
                if (form) form.reset();
                selectedAdicionais = [];
                renderSelectedAdicionaisTags();
            }
        };

        if (window.utils && window.utils.modalManager) {
            window.utils.modalManager.open('modal-produto', doOpen, closeProductModal);
        } else {
            doOpen();
        }
    }

    function closeProductModal() {
        const modal = document.getElementById('modal-produto');
        if (modal) modal.style.display = 'none';
        const form = document.getElementById('form-product');
        if (form) form.reset();
        selectedAdicionais = [];
        currentProductId = null;
        if (productAdicionalSearch) productAdicionalSearch.value = '';
        if (autocompleteResults) autocompleteResults.style.display = 'none';
        if (window.utils && window.utils.modalManager) {
            window.utils.modalManager.close('modal-produto');
        }
    }

    // Modal de Adicional (Novo Adicional / Editar Adicional)
    function openAdicionalModal(item = null) {
        const modal = document.getElementById('modal-adicional');
        const form = document.getElementById('form-adicional');
        const title = document.getElementById('adicional-modal-title');
        
        currentAdicionalId = item ? item.id : null;
        
        const categories = [...new Set(catalogItems.filter(i => i.is_adicional === 0).map(i => i.categoria))];
        populateCategoriesDropdowns(categories);

        const doOpen = () => {
            if (modal) modal.style.display = 'flex';
            if (item) {
                if (title) title.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Editar Adicional Global';
                document.getElementById('adicional-cod-pdv').value = item.cod_pdv || '';
                document.getElementById('adicional-nome').value = item.nome || '';
                document.getElementById('adicional-preco').value = item.preco || 0;
                
                const parts = (item.descricao || '').split(' ||| ');
                let linkedCategories = [];
                if (parts[1]) {
                    try {
                        const meta = JSON.parse(parts[1]);
                        if (meta.categoryLinks) linkedCategories = meta.categoryLinks;
                    } catch (e) {
                        console.warn('Falha ao processar metadados de categorias:', e);
                    }
                }
                const select = document.getElementById('adicional-vinculo-categorias');
                if (select) {
                    Array.from(select.options).forEach(opt => {
                        opt.selected = linkedCategories.includes(opt.value);
                    });
                }
            } else {
                if (title) title.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Cadastro de Adicional Global';
                if (form) form.reset();
                const select = document.getElementById('adicional-vinculo-categorias');
                if (select) {
                    Array.from(select.options).forEach(opt => opt.selected = false);
                }
            }
        };

        if (window.utils && window.utils.modalManager) {
            window.utils.modalManager.open('modal-adicional', doOpen, closeAdicionalModal);
        } else {
            doOpen();
        }
    }

    function closeAdicionalModal() {
        const modal = document.getElementById('modal-adicional');
        if (modal) modal.style.display = 'none';
        const form = document.getElementById('form-adicional');
        if (form) form.reset();
        currentAdicionalId = null;
        if (window.utils && window.utils.modalManager) {
            window.utils.modalManager.close('modal-adicional');
        }
    }

    // Gerenciador de Autocomplete de Adicionais
    if (productAdicionalSearch) {
        productAdicionalSearch.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();
            if (!value) {
                if (autocompleteResults) autocompleteResults.style.display = 'none';
                return;
            }
            const filteredAdicionais = catalogItems.filter(item => 
                item.is_adicional === 1 && 
                ((item.nome && item.nome.toLowerCase().includes(value)) || 
                 (item.cod_pdv && String(item.cod_pdv).toLowerCase().includes(value)))
            );
            
            if (autocompleteResults) {
                if (filteredAdicionais.length === 0) {
                    autocompleteResults.innerHTML = '<div class="autocomplete-item" style="color: var(--text-muted); cursor: default;">Nenhum adicional encontrado</div>';
                } else {
                    autocompleteResults.innerHTML = filteredAdicionais.map(ad => `
                        <div class="autocomplete-item" data-id="${ad.id}">
                            <strong>${ad.nome}</strong> ${ad.cod_pdv ? `(PDV: ${ad.cod_pdv})` : ''} - R$ ${Number(ad.preco).toFixed(2)}
                        </div>
                    `).join('');
                }
                autocompleteResults.style.display = 'block';
            }
        });

        // Fechar autocomplete ao clicar fora
        document.addEventListener('click', (e) => {
            if (autocompleteResults && !productAdicionalSearch.contains(e.target) && !autocompleteResults.contains(e.target)) {
                autocompleteResults.style.display = 'none';
            }
        });
    }

    if (autocompleteResults) {
        autocompleteResults.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.autocomplete-item');
            if (itemEl && itemEl.dataset.id) {
                const id = parseInt(itemEl.dataset.id);
                const addition = catalogItems.find(x => x.id === id);
                if (addition) {
                    if (!selectedAdicionais.some(x => x.id === id)) {
                        selectedAdicionais.push(addition);
                        renderSelectedAdicionaisTags();
                    }
                    if (productAdicionalSearch) productAdicionalSearch.value = '';
                    autocompleteResults.style.display = 'none';
                }
            }
        });
    }

    // Vincular adicionais clicando no botão "Vincular"
    const btnAddAdicionalToItem = document.getElementById('btn-add-adicional-to-item');
    if (btnAddAdicionalToItem && productAdicionalSearch) {
        btnAddAdicionalToItem.addEventListener('click', () => {
            const searchValue = productAdicionalSearch.value.toLowerCase().trim();
            if (!searchValue) return;
            
            const found = catalogItems.find(item => 
                item.is_adicional === 1 && 
                ((item.nome && item.nome.toLowerCase() === searchValue) || 
                 (item.cod_pdv && String(item.cod_pdv).toLowerCase() === searchValue))
            );
            
            if (found) {
                if (!selectedAdicionais.some(x => x.id === found.id)) {
                    selectedAdicionais.push(found);
                    renderSelectedAdicionaisTags();
                }
                productAdicionalSearch.value = '';
                if (autocompleteResults) autocompleteResults.style.display = 'none';
            } else {
                const partial = catalogItems.find(item => 
                    item.is_adicional === 1 && 
                    ((item.nome && item.nome.toLowerCase().includes(searchValue)) || 
                     (item.cod_pdv && String(item.cod_pdv).toLowerCase().includes(searchValue)))
                );
                if (partial) {
                    if (!selectedAdicionais.some(x => x.id === partial.id)) {
                        selectedAdicionais.push(partial);
                        renderSelectedAdicionaisTags();
                    }
                    productAdicionalSearch.value = '';
                    if (autocompleteResults) autocompleteResults.style.display = 'none';
                } else {
                    alert('Nenhum adicional correspondente encontrado.');
                }
            }
        });
    }

    if (productSelectedTagsContainer) {
        productSelectedTagsContainer.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-tag');
            if (removeBtn) {
                const id = parseInt(removeBtn.dataset.id);
                selectedAdicionais = selectedAdicionais.filter(x => x.id !== id);
                renderSelectedAdicionaisTags();
            }
        });
    }

    function renderSelectedAdicionaisTags() {
        if (!productSelectedTagsContainer) return;
        if (selectedAdicionais.length === 0) {
            productSelectedTagsContainer.innerHTML = '<span style="font-size:0.85rem; color:var(--text-muted);">Nenhum adicional vinculado.</span>';
            return;
        }
        productSelectedTagsContainer.innerHTML = selectedAdicionais.map(ad => `
            <span class="tag-premium">
                <span>${ad.nome} (+R$ ${Number(ad.preco).toFixed(2)})</span>
                <span class="remove-tag" data-id="${ad.id}">&times;</span>
            </span>
        `).join('');
    }

    // Envio do formulário do Produto
    const formProduct = document.getElementById('form-product');
    if (formProduct) {
        formProduct.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const codPdv = document.getElementById('product-cod-pdv').value;
            const nome = document.getElementById('product-nome').value;
            const preco = parseFloat(document.getElementById('product-preco').value) || 0;
            const categoria = document.getElementById('product-categoria').value;
            const descInput = document.getElementById('product-descricao').value;
            
            // Serializar adicionais vinculados na descrição
            const adIds = selectedAdicionais.map(x => x.id);
            const metadataStr = JSON.stringify({ adicionalIds: adIds });
            const finalDesc = descInput ? `${descInput} ||| ${metadataStr}` : ` ||| ${metadataStr}`;
            
            const payload = {
                cod_pdv: codPdv || null,
                nome,
                preco,
                categoria,
                descricao: finalDesc,
                is_adicional: false,
                disponivel: true
            };
            
            try {
                if (currentProductId) {
                    await window.utils.apiFetch(`/catalog/${currentProductId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                } else {
                    await window.utils.apiFetch('/catalog', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                }
                
                closeProductModal();
                await loadCatalog();
                showToast(currentProductId ? 'Item atualizado!' : 'Item cadastrado!');
            } catch (err) {
                console.error('Erro ao salvar item:', err);
                alert(err.message || 'Erro ao salvar item.');
            }
        });
    }

    // Envio do formulário do Adicional
    const formAdicional = document.getElementById('form-adicional');
    if (formAdicional) {
        formAdicional.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const codPdv = document.getElementById('adicional-cod-pdv').value;
            const nome = document.getElementById('adicional-nome').value;
            const preco = parseFloat(document.getElementById('adicional-preco').value) || 0;
            const select = document.getElementById('adicional-vinculo-categorias');
            const selectedCategories = Array.from(select.selectedOptions).map(opt => opt.value);
            
            // Serializar categorias vinculadas na descrição
            const metadataStr = JSON.stringify({ categoryLinks: selectedCategories });
            const finalDesc = ` ||| ${metadataStr}`;
            
            const payload = {
                cod_pdv: codPdv || null,
                nome,
                preco,
                categoria: 'Adicionais',
                descricao: finalDesc,
                is_adicional: true,
                disponivel: true
            };
            
            try {
                if (currentAdicionalId) {
                    await window.utils.apiFetch(`/catalog/${currentAdicionalId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                } else {
                    await window.utils.apiFetch('/catalog', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                }
                
                closeAdicionalModal();
                await loadCatalog();
                showToast(currentAdicionalId ? 'Adicional atualizado!' : 'Adicional cadastrado!');
            } catch (err) {
                console.error('Erro ao salvar adicional:', err);
                alert(err.message || 'Erro ao salvar adicional.');
            }
        });
    }

    // Configurar botões de fechar/cancelar dos modais
    const btnCloseProductModal = document.getElementById('btn-close-product-modal');
    if (btnCloseProductModal) btnCloseProductModal.addEventListener('click', closeProductModal);
    
    const btnCancelProductModal = document.getElementById('btn-cancel-product-modal');
    if (btnCancelProductModal) btnCancelProductModal.addEventListener('click', closeProductModal);
    
    const btnCloseAdicionalModal = document.getElementById('btn-close-adicional-modal');
    if (btnCloseAdicionalModal) btnCloseAdicionalModal.addEventListener('click', closeAdicionalModal);
    
    const btnCancelAdicionalModal = document.getElementById('btn-cancel-adicional-modal');
    if (btnCancelAdicionalModal) btnCancelAdicionalModal.addEventListener('click', closeAdicionalModal);

    // Registro dos modais no manager global do app
    if (window.utils && window.utils.modalManager) {
        window.utils.modalManager.register('modal-produto', closeProductModal);
        window.utils.modalManager.register('modal-adicional', closeAdicionalModal);
    }

    // Delegador de cliques na tabela para ações de edição
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-catalog-item"]');
        if (editBtn) {
            const id = parseInt(editBtn.dataset.id);
            const item = catalogItems.find(x => x.id === id);
            if (item) {
                if (item.is_adicional === 1) {
                    openAdicionalModal(item);
                } else {
                    openProductModal(item);
                }
            }
        }
    });

    // ==========================================
    // 🍴 LÓGICA DOS BOTÕES DE AÇÕES DO CATÁLOGO
    // ==========================================
    
    const btnAddCategory = document.getElementById('btn-add-category');
    const btnDownloadModel = document.getElementById('btn-download-model');
    const btnImportExcel = document.getElementById('btn-import-excel');
    const btnCreateItem = document.getElementById('btn-create-item');
    const btnCreateAdicional = document.getElementById('btn-create-adicional');
    const excelUploadInput = document.getElementById('excel-upload');

    if (btnAddCategory) {
        btnAddCategory.addEventListener('click', () => {
            const newCat = prompt('Digite o nome da nova categoria:');
            if (newCat && newCat.trim()) {
                const trimmed = newCat.trim();
                const productCatSelect = document.getElementById('product-categoria');
                if (productCatSelect) {
                    const opt = document.createElement('option');
                    opt.value = trimmed;
                    opt.textContent = trimmed;
                    productCatSelect.appendChild(opt);
                    opt.selected = true;
                }
                const adicionalCatSelect = document.getElementById('adicional-vinculo-categorias');
                if (adicionalCatSelect) {
                    const opt = document.createElement('option');
                    opt.value = trimmed;
                    opt.textContent = trimmed;
                    adicionalCatSelect.appendChild(opt);
                }
                alert(`Categoria "${trimmed}" adicionada com sucesso localmente! Selecione-a ao cadastrar ou salvar o item.`);
            }
        });
    }

    if (btnCreateItem) {
        btnCreateItem.addEventListener('click', () => {
            openProductModal();
        });
    }

    if (btnCreateAdicional) {
        btnCreateAdicional.addEventListener('click', () => {
            openAdicionalModal();
        });
    }

    if (btnDownloadModel) {
        btnDownloadModel.addEventListener('click', () => {
            if (typeof XLSX === 'undefined') {
                alert('A biblioteca XLSX ainda não carregou.');
                return;
            }
            const ws_data = [
                ["Nome do Item", "Código PDV", "Categoria", "Preço", "Descrição"],
                ["Ex: Pizza Margherita", "1001", "Pizzas", "45.00", "Molho de tomate, muçarela e manjericão"]
            ];
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Modelo_Cardapio");
            XLSX.writeFile(wb, "Modelo_Importacao_Cardapio.xlsx");
        });
    }

    if (btnImportExcel && excelUploadInput) {
        btnImportExcel.addEventListener('click', () => {
            excelUploadInput.click();
        });

        excelUploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (typeof XLSX === 'undefined') {
                alert('A biblioteca XLSX não está disponível.');
                return;
            }

            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    // Remove cabeçalho
                    if (json.length > 0) json.shift();
                    
                    let importCount = 0;
                    for (const row of json) {
                        const name = row[0] ? String(row[0]).trim() : '';
                        if (!name) continue; // Pula linha vazia
                        
                        const pdv = row[1] ? String(row[1]).trim() : '';
                        const category = row[2] ? String(row[2]).trim() : '';
                        const priceStr = row[3] ? String(row[3]).trim() : '0';
                        const desc = row[4] ? String(row[4]).trim() : '';
                        
                        const priceMatches = priceStr.match(/\d+([.,]\d+)?/);
                        const price = priceMatches ? parseFloat(priceMatches[0].replace(',', '.')) : 0;

                        // API Create Request
                        const payload = {
                            nome: name,
                            cod_pdv: pdv || null,
                            categoria: category || 'Geral', // Fallback se vazia
                            preco: price,
                            descricao: desc || null,
                            is_adicional: false,
                            disponivel: true
                        };

                        await window.utils.apiFetch('/catalog', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });
                        importCount++;
                    }

                    excelUploadInput.value = ''; // reseta
                    if (importCount > 0) {
                        alert(importCount + ' item(ns) importado(s) com sucesso!');
                        await loadCatalog(); // Recarrega a tabela e pills
                    } else {
                        alert('Nenhum item válido encontrado no Excel.');
                    }
                } catch (err) {
                    console.error('Erro na importação:', err);
                    alert('Erro ao importar itens. Verifique o console.');
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
});
