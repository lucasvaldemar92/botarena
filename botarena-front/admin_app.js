// ==========================================
// 📡 GLOBALS AND DOM ELEMENTS
// ==========================================
const socket = window.io ? io(window.BASE_URL) : null;

// Helper function to debounce input changes and avoid rate limiting
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

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
        updateConnectionStatus(false);
        updateQRCode(qrData);
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
            loadDeliveryRanges();
            
            // Inicializa controles de ativação e horários dos cardápios
            const slots = ['lunch', 'acai', 'events'];
            slots.forEach(slot => {
                const activeCheckbox = document.getElementById(`menu-${slot}-active`);
                const startTimeInput = document.getElementById(`menu-${slot}-start`);
                const endTimeInput = document.getElementById(`menu-${slot}-end`);
                const statusTextSpan = document.getElementById(`status-text-menu-${slot}`);

                if (activeCheckbox && config[`menu_${slot}_active`] !== undefined) {
                    activeCheckbox.checked = Boolean(config[`menu_${slot}_active`]);
                    if (statusTextSpan) {
                        statusTextSpan.textContent = activeCheckbox.checked ? 'Ativo' : 'Inativo';
                    }
                }
                if (startTimeInput && config[`menu_${slot}_start`]) {
                    startTimeInput.value = config[`menu_${slot}_start`].substring(0, 5);
                }
                if (endTimeInput && config[`menu_${slot}_end`]) {
                    endTimeInput.value = config[`menu_${slot}_end`].substring(0, 5);
                }
            });

            // Configura listeners para auto-salvamento dos cardápios
            slots.forEach(slot => {
                const activeCheckbox = document.getElementById(`menu-${slot}-active`);
                const startTimeInput = document.getElementById(`menu-${slot}-start`);
                const endTimeInput = document.getElementById(`menu-${slot}-end`);
                const statusTextSpan = document.getElementById(`status-text-menu-${slot}`);

                const saveChange = async () => {
                    const payload = {};
                    if (activeCheckbox) {
                        payload[`menu_${slot}_active`] = activeCheckbox.checked;
                    }
                    if (startTimeInput) payload[`menu_${slot}_start`] = startTimeInput.value;
                    if (endTimeInput) payload[`menu_${slot}_end`] = endTimeInput.value;

                    try {
                        const res = await window.utils.apiFetch('/config', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });
                        if (res) {
                            showToast('Configuração salva!');
                        }
                    } catch (err) {
                        console.error(`Erro ao salvar config para o slot ${slot}:`, err);
                        showToast('Erro ao salvar configuração');
                    }
                };

                const saveChangeDebounced = debounce(saveChange, 800);

                if (activeCheckbox) {
                    activeCheckbox.addEventListener('change', () => {
                        if (statusTextSpan) {
                            statusTextSpan.textContent = activeCheckbox.checked ? 'Ativo' : 'Inativo';
                        }
                        saveChangeDebounced();
                    });
                }
                if (startTimeInput) startTimeInput.addEventListener('change', saveChangeDebounced);
                if (endTimeInput) endTimeInput.addEventListener('change', saveChangeDebounced);
            });
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
            
            let addressCount = 0;
            if (stats.bySource && stats.bySource.address) {
                addressCount = Object.values(stats.bySource.address).reduce((acc, val) => acc + val, 0);
            }
            
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
            
            const addressEl = document.getElementById('rag-address-count');
            if (addressEl) addressEl.textContent = `${addressCount} blocos`;
            
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

        // Sincroniza controles de ativação e horários dos cardápios
        const slots = ['lunch', 'acai', 'events'];
        slots.forEach(slot => {
            const activeCheckbox = document.getElementById(`menu-${slot}-active`);
            const startTimeInput = document.getElementById(`menu-${slot}-start`);
            const endTimeInput = document.getElementById(`menu-${slot}-end`);
            const statusTextSpan = document.getElementById(`status-text-menu-${slot}`);

            if (activeCheckbox && config[`menu_${slot}_active`] !== undefined) {
                activeCheckbox.checked = Boolean(config[`menu_${slot}_active`]);
                if (statusTextSpan) {
                    statusTextSpan.textContent = activeCheckbox.checked ? 'Ativo' : 'Inativo';
                }
            }
            if (startTimeInput && config[`menu_${slot}_start`]) {
                startTimeInput.value = config[`menu_${slot}_start`].substring(0, 5);
            }
            if (endTimeInput && config[`menu_${slot}_end`]) {
                endTimeInput.value = config[`menu_${slot}_end`].substring(0, 5);
            }
        });
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
        inputAddr:     document.getElementById('delivery-address'),
        inputZip:      document.getElementById('delivery-zip-code'),
        inputDist:     document.getElementById('delivery-distance'),
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
                    <td colspan="6" style="padding: 2rem; text-align: center; color: #ef4444;">
                        Erro ao carregar taxas de entrega.
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Consulta localmente as faixas de KM carregadas e retorna a taxa correspondente à distância.
     * @param {number} distanceKm
     * @returns {number|null} fee ou null se nenhuma faixa ativa contém a distância
     */
    function getFeeFromRanges(distanceKm) {
        if (!deliveryRangesState || !deliveryRangesState.ranges) return null;
        const activeRanges = deliveryRangesState.ranges.filter(r => r.is_active === 1);
        const match = activeRanges.find(r => distanceKm >= r.min_km && distanceKm <= r.max_km);
        return match ? match.fee : null;
    }

    function getMatchingRange(distanceKm) {
        if (!deliveryRangesState || !deliveryRangesState.ranges || typeof distanceKm !== 'number') return null;
        const activeRanges = deliveryRangesState.ranges.filter(r => r.is_active === 1);
        return activeRanges.find(r => distanceKm >= r.min_km && distanceKm <= r.max_km);
    }

    function updateModalFeeLock() {
        const dist = parseFloat(deliveryElements.inputDist.value);
        if (!isNaN(dist) && dist >= 0) {
            const range = getMatchingRange(dist);
            if (range) {
                deliveryElements.inputFee.value = range.fee.toFixed(2);
                deliveryElements.inputFee.disabled = true;
                deliveryElements.inputFee.style.background = '#f1f5f9';
                deliveryElements.inputFee.style.cursor = 'not-allowed';
                deliveryElements.inputFee.classList.add('input-locked-by-range');
                deliveryElements.inputFee.setAttribute('title', 'Taxa gerenciada automaticamente pelas faixas de KM globais.');
                return;
            }
        }
        deliveryElements.inputFee.disabled = false;
        deliveryElements.inputFee.style.background = '';
        deliveryElements.inputFee.style.cursor = '';
        deliveryElements.inputFee.classList.remove('input-locked-by-range');
        deliveryElements.inputFee.removeAttribute('title');
    }


    function renderDeliveryFeesTable() {
        if (!deliveryElements.tableBody) return;
        const fees = deliveryFeesState.fees;

        if (fees.length === 0) {
            deliveryElements.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                        Nenhuma taxa de entrega cadastrada.
                    </td>
                </tr>
            `;
            return;
        }

        deliveryElements.tableBody.innerHTML = fees.map(item => {
            const range = getMatchingRange(item.distance_km);
            const feeVal = range ? range.fee : item.fee;
            const formattedFee = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(feeVal);
            const formattedDistance = typeof item.distance_km === 'number' ? `${item.distance_km.toFixed(1)} km` : '---';
            
            let badgeHtml = '';
            let lockClass = '';
            if (range) {
                badgeHtml = `<span class="badge badge-locked" style="font-size: 0.7rem; padding: 0.15rem 0.35rem; border-radius: var(--radius-sm); background: #fee2e2; color: #ef4444; margin-left: 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem;" title="Bloqueado por faixa de KM"><i class="fa-solid fa-lock" style="font-size: 0.65rem;"></i> Auto</span>`;
                lockClass = ' locked-cell';
            }

            return `
                <tr style="border-bottom: 1px solid var(--border-color);" data-id="${item.id}">
                    <td style="padding: 0.75rem 1rem; font-weight: 500;">${item.neighborhood || '---'}</td>
                    <td class="editable-cell" data-field="address" style="padding: 0.75rem 1rem; color: var(--text-muted); cursor: pointer;">${item.address || '---'}</td>
                    <td class="editable-cell" data-field="zip_code" style="padding: 0.75rem 1rem; color: var(--text-muted); cursor: pointer;">${item.zip_code || '---'}</td>
                    <td class="editable-cell" data-field="distance_km" style="padding: 0.75rem 1rem; color: var(--text-muted); cursor: pointer;">${formattedDistance}</td>
                    <td class="editable-cell${lockClass}" data-field="fee" style="padding: 0.75rem 1rem; color: #16a34a; font-weight: 600; cursor: pointer;">${formattedFee}${badgeHtml}</td>
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
                deliveryElements.inputAddr.value = item.address || '';
                deliveryElements.inputZip.value = window.utils.masks.cep(item.zip_code || '');
                deliveryElements.inputDist.value = item.distance_km !== undefined ? item.distance_km : '';
                deliveryElements.inputFee.value = item.fee;
                updateModalFeeLock();
            } else {
                deliveryElements.modalTitle.textContent = 'Nova Taxa de Entrega';
                deliveryElements.form.reset();
                updateModalFeeLock();
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

    // ==========================================
    // 📂 IMPORTAÇÃO DE ARQUIVOS DE ENDEREÇOS NO RAG
    // ==========================================
    const btnImportDelivery = document.getElementById('btn-import-delivery');
    const deliveryFileUpload = document.getElementById('delivery-file-upload');

    if (btnImportDelivery && deliveryFileUpload) {
        btnImportDelivery.addEventListener('click', () => {
            deliveryFileUpload.click();
        });

        deliveryFileUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const originalHTML = btnImportDelivery.innerHTML;
            btnImportDelivery.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
            btnImportDelivery.disabled = true;

            try {
                const name = file.name.toLowerCase();
                let chunks = [];
                let sourceId = 'imported_sheet';

                if (name.endsWith('.kml')) {
                    sourceId = 'imported_kml';
                    chunks = await parseKmlFile(file);
                } else if (name.endsWith('.csv')) {
                    chunks = await parseCsvFile(file);
                } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                    chunks = await parseExcelFile(file);
                } else {
                    throw new Error('Formato de arquivo não suportado. Use .xlsx, .xls, .csv ou .kml');
                }

                if (chunks.length === 0) {
                    throw new Error('Nenhum endereço válido com CEP, Bairro ou Rua foi encontrado no arquivo.');
                }

                // Envia para o RAG no backend
                const res = await window.utils.apiFetch('/rag/upload-address-batch', {
                    method: 'POST',
                    body: JSON.stringify({ sourceId, chunks })
                });

                if (res && res.success) {
                    showToast(`Sucesso! ${chunks.length} endereços gravados na memória inteligente.`);
                    
                    // Recarrega as estatísticas do RAG se a função existir
                    if (typeof loadRagStats === 'function') {
                        await loadRagStats();
                    }
                } else {
                    throw new Error('Resposta de erro do servidor.');
                }
            } catch (err) {
                console.error('Erro na importação:', err);
                alert('Erro na importação de arquivo: ' + err.message);
            } finally {
                btnImportDelivery.innerHTML = originalHTML;
                btnImportDelivery.disabled = false;
                deliveryFileUpload.value = '';
            }
        });
    }

    function parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (rows.length < 2) {
                        return resolve([]);
                    }
                    
                    const headers = rows[0].map(h => String(h).trim().toLowerCase());
                    
                    const colIndex = {
                        cep: headers.findIndex(h => h.includes('cep')),
                        bairro: headers.findIndex(h => h.includes('bairro') || h.includes('bair')),
                        rua: headers.findIndex(h => h.includes('rua') || h.includes('logradouro') || h.includes('endereco') || h.includes('endereço') || h.includes('via') || h.includes('denomina')),
                        taxa: headers.findIndex(h => h.includes('taxa') || h.includes('valor') || h.includes('frete') || h.includes('preco') || h.includes('preço')),
                        latitude: headers.findIndex(h => h.includes('latitude') || h.includes('lat')),
                        longitude: headers.findIndex(h => h.includes('longitude') || h.includes('lon') || h.includes('lng')),
                        coordenadas: headers.findIndex(h => h.includes('coordenada') || h.includes('coord'))
                    };
                    
                    const chunks = [];
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;
                        
                        // 1. Tratamento para coluna única contendo WKT (Geometria + Bairro concatenados na coluna A)
                        const firstColVal = String(row[0] || '').trim();
                        if (firstColVal.toUpperCase().startsWith('POLYGON') || firstColVal.toUpperCase().startsWith('MULTIPOLYGON') || firstColVal.toUpperCase().startsWith('GEOMETRYCOLLECTION')) {
                            const wktMatch = firstColVal.match(/(?:POLYGON|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(.+\),\s*([^,]+)/i);
                            if (wktMatch) {
                                const bairro = wktMatch[1].trim();
                                chunks.push(`Bairro: ${bairro}`);
                                continue;
                            }
                        }

                        const cep = colIndex.cep !== -1 ? String(row[colIndex.cep] || '').trim() : '';
                        const bairro = colIndex.bairro !== -1 ? String(row[colIndex.bairro] || '').trim() : '';
                        const rua = colIndex.rua !== -1 ? String(row[colIndex.rua] || '').trim() : '';
                        const taxaVal = colIndex.taxa !== -1 ? parseFloat(row[colIndex.taxa]) : null;
                        
                        let latitude = colIndex.latitude !== -1 ? parseFloat(row[colIndex.latitude]) : null;
                        let longitude = colIndex.longitude !== -1 ? parseFloat(row[colIndex.longitude]) : null;
                        
                        // 2. Extração inteligente de coordenadas complexas (lista de pontos / WKT no Excel)
                        if (colIndex.coordenadas !== -1) {
                            const coordStr = String(row[colIndex.coordenadas] || '').trim();
                            if (coordStr) {
                                const cleanCoords = coordStr.replace(/[()]/g, '').trim();
                                const firstPoint = cleanCoords.split(',')[0].trim();
                                const coordParts = firstPoint.split(/\s+/);
                                if (coordParts.length >= 2) {
                                    const p1 = parseFloat(coordParts[0]);
                                    const p2 = parseFloat(coordParts[1]);
                                    if (!isNaN(p1) && !isNaN(p2)) {
                                        // Inferência baseada em magnitude para o sul do Brasil (Long ~ -48, Lat ~ -26)
                                        if (Math.abs(p1) > Math.abs(p2)) {
                                            longitude = p1;
                                            latitude = p2;
                                        } else {
                                            latitude = p1;
                                            longitude = p2;
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (!cep && !bairro && !rua) continue;
                        
                        const chunkParts = [];
                        if (cep) chunkParts.push(`CEP: ${cep}`);
                        if (bairro) chunkParts.push(`Bairro: ${bairro}`);
                        if (rua) chunkParts.push(`Rua: ${rua}`);
                        if (!isNaN(latitude) && !isNaN(longitude) && latitude !== null && longitude !== null) {
                            chunkParts.push(`Coordenadas: ${latitude}, ${longitude}`);
                        }
                        if (taxaVal !== null && !isNaN(taxaVal)) {
                            chunkParts.push(`Taxa: ${taxaVal.toFixed(2)}`);
                        }
                        
                        chunks.push(chunkParts.join(' | '));
                    }
                    resolve(chunks);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    function parseCsvFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r?\n/);
                    if (lines.length < 2) return resolve([]);
                    
                    const firstLine = lines[0];
                    const sep = firstLine.includes(';') ? ';' : ',';
                    
                    const rows = lines.map(line => {
                        return line.split(sep).map(field => field.replace(/^["']|["']$/g, '').trim());
                    });
                    
                    const headers = rows[0].map(h => String(h).trim().toLowerCase());
                    
                    const colIndex = {
                        cep: headers.findIndex(h => h.includes('cep')),
                        bairro: headers.findIndex(h => h.includes('bairro') || h.includes('bair')),
                        rua: headers.findIndex(h => h.includes('rua') || h.includes('logradouro') || h.includes('endereco') || h.includes('endereço') || h.includes('via') || h.includes('denomina')),
                        taxa: headers.findIndex(h => h.includes('taxa') || h.includes('valor') || h.includes('frete') || h.includes('preco') || h.includes('preço')),
                        latitude: headers.findIndex(h => h.includes('latitude') || h.includes('lat')),
                        longitude: headers.findIndex(h => h.includes('longitude') || h.includes('lon') || h.includes('lng')),
                        coordenadas: headers.findIndex(h => h.includes('coordenada') || h.includes('coord'))
                    };
                    
                    const chunks = [];
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;
                        
                        // 1. Tratamento para coluna única contendo WKT (Geometria + Bairro concatenados na coluna A)
                        const firstColVal = String(row[0] || '').trim();
                        if (firstColVal.toUpperCase().startsWith('POLYGON') || firstColVal.toUpperCase().startsWith('MULTIPOLYGON') || firstColVal.toUpperCase().startsWith('GEOMETRYCOLLECTION')) {
                            const wktMatch = firstColVal.match(/(?:POLYGON|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(.+\),\s*([^,]+)/i);
                            if (wktMatch) {
                                const bairro = wktMatch[1].trim();
                                chunks.push(`Bairro: ${bairro}`);
                                continue;
                            }
                        }

                        const cep = colIndex.cep !== -1 ? String(row[colIndex.cep] || '').trim() : '';
                        const bairro = colIndex.bairro !== -1 ? String(row[colIndex.bairro] || '').trim() : '';
                        const rua = colIndex.rua !== -1 ? String(row[colIndex.rua] || '').trim() : '';
                        const taxaVal = colIndex.taxa !== -1 ? parseFloat(String(row[colIndex.taxa]).replace(',', '.')) : null;
                        
                        let latitude = colIndex.latitude !== -1 ? parseFloat(String(row[colIndex.latitude]).replace(',', '.')) : null;
                        let longitude = colIndex.longitude !== -1 ? parseFloat(String(row[colIndex.longitude]).replace(',', '.')) : null;
                        
                        // 2. Extração inteligente de coordenadas complexas (lista de pontos / WKT no CSV)
                        if (colIndex.coordenadas !== -1) {
                            const coordStr = String(row[colIndex.coordenadas] || '').trim();
                            if (coordStr) {
                                const cleanCoords = coordStr.replace(/[()]/g, '').trim();
                                const firstPoint = cleanCoords.split(',')[0].trim();
                                const coordParts = firstPoint.split(/\s+/);
                                if (coordParts.length >= 2) {
                                    const p1 = parseFloat(coordParts[0].trim().replace(',', '.'));
                                    const p2 = parseFloat(coordParts[1].trim().replace(',', '.'));
                                    if (!isNaN(p1) && !isNaN(p2)) {
                                        if (Math.abs(p1) > Math.abs(p2)) {
                                            longitude = p1;
                                            latitude = p2;
                                        } else {
                                            latitude = p1;
                                            longitude = p2;
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (!cep && !bairro && !rua) continue;
                        
                        const chunkParts = [];
                        if (cep) chunkParts.push(`CEP: ${cep}`);
                        if (bairro) chunkParts.push(`Bairro: ${bairro}`);
                        if (rua) chunkParts.push(`Rua: ${rua}`);
                        if (!isNaN(latitude) && !isNaN(longitude) && latitude !== null && longitude !== null) {
                            chunkParts.push(`Coordenadas: ${latitude}, ${longitude}`);
                        }
                        if (taxaVal !== null && !isNaN(taxaVal)) {
                            chunkParts.push(`Taxa: ${taxaVal.toFixed(2)}`);
                        }
                        
                        chunks.push(chunkParts.join(' | '));
                    }
                    resolve(chunks);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsText(file, 'utf-8');
        });
    }

    function parseKmlFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, 'text/xml');
                    
                    const placemarks = xmlDoc.getElementsByTagName('Placemark');
                    const chunks = [];
                    
                    for (let i = 0; i < placemarks.length; i++) {
                        const pm = placemarks[i];
                        
                        const nameNode = pm.getElementsByTagName('name')[0];
                        const descNode = pm.getElementsByTagName('description')[0];
                        const pointNode = pm.getElementsByTagName('Point')[0];
                        
                        const bairro = nameNode ? nameNode.textContent.trim() : '';
                        const description = descNode ? descNode.textContent.trim() : '';
                        
                        let cep = '';
                        let rua = '';
                        let taxaVal = null;
                        
                        if (description) {
                            const cepMatch = description.match(/cep:\s*([0-9]{5}-?[0-9]{3})/i);
                            if (cepMatch) cep = cepMatch[1];
                            
                            const ruaMatch = description.match(/(?:rua|logradouro|endereco|endereço):\s*([^|\n]+)/i);
                            if (ruaMatch) rua = ruaMatch[1].trim();
                            
                            const taxaMatch = description.match(/(?:taxa|valor|frete):\s*([0-9]+(?:[.,][0-9]+)?)/i);
                            if (taxaMatch) taxaVal = parseFloat(taxaMatch[1].replace(',', '.'));
                        }
                        
                        let latitude = null;
                        let longitude = null;
                        
                        if (pointNode) {
                            const coordsNode = pointNode.getElementsByTagName('coordinates')[0];
                            if (coordsNode) {
                                const coordsStr = coordsNode.textContent.trim();
                                const parts = coordsStr.split(',');
                                if (parts.length >= 2) {
                                    longitude = parseFloat(parts[0].trim());
                                    latitude = parseFloat(parts[1].trim());
                                }
                            }
                        }
                        
                        if (!cep && !bairro && !rua) continue;
                        
                        const chunkParts = [];
                        if (cep) chunkParts.push(`CEP: ${cep}`);
                        if (bairro) chunkParts.push(`Bairro: ${bairro}`);
                        if (rua) chunkParts.push(`Rua: ${rua}`);
                        if (latitude !== null && longitude !== null && !isNaN(latitude) && !isNaN(longitude)) {
                            chunkParts.push(`Coordenadas: ${latitude}, ${longitude}`);
                        }
                        if (taxaVal !== null && !isNaN(taxaVal)) {
                            chunkParts.push(`Taxa: ${taxaVal.toFixed(2)}`);
                        }
                        
                        chunks.push(chunkParts.join(' | '));
                    }
                    resolve(chunks);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsText(file, 'utf-8');
        });
    }

    // CEP mask input helper
    if (deliveryElements.inputZip) {
        deliveryElements.inputZip.addEventListener('input', (e) => {
            e.target.value = window.utils.masks.cep(e.target.value);
        });
    }

    // Auto-preenchimento bidirecional de CEP e Endereço
    let cachedCompanyCityState = null;
    
    async function getCompanyCityState() {
        if (cachedCompanyCityState) return cachedCompanyCityState;
        
        const baseCepInput = document.getElementById('base-cep') || document.getElementById('company-base-cep');
        const rawCep = baseCepInput ? baseCepInput.value : '';
        const cleanCep = rawCep.replace(/\D/g, '');
        
        if (cleanCep && cleanCep.length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && !data.erro) {
                        cachedCompanyCityState = {
                            city: data.localidade,
                            uf: data.uf
                        };
                        return cachedCompanyCityState;
                    }
                }
            } catch (e) {
                console.error('Erro ao buscar Cidade/UF da empresa pelo CEP:', e);
            }
        }
        return { city: 'Joinville', uf: 'SC' }; // Fallback
    }

    async function calculateDistanceForModal() {
        const zipCode = deliveryElements.inputZip.value;
        const neighborhood = deliveryElements.inputNeigh.value || 'Desconhecido';
        const address = deliveryElements.inputAddr.value;
        
        if (!zipCode || !address) return;
        
        try {
            const res = await window.utils.apiFetch('/delivery-fees/calculate-distance', {
                method: 'POST',
                body: JSON.stringify({ zipCode, neighborhood, address })
            });
            if (res && res.success && typeof res.distanceKm === 'number') {
                deliveryElements.inputDist.value = res.distanceKm;
                updateModalFeeLock();
            }
        } catch (e) {
            console.error('Erro ao calcular distância para o modal:', e);
        }
    }

    if (deliveryElements.inputZip) {
        deliveryElements.inputZip.addEventListener('input', async (e) => {
            const cep = e.target.value.replace(/\D/g, '');
            if (cep.length === 8) {
                try {
                    // 🧠 Busca local na memória RAG primeiro
                    const ragRes = await window.utils.apiFetch(`/rag/lookup-address?query=${cep}`);
                    if (ragRes && ragRes.success && ragRes.results.length > 0) {
                        const match = ragRes.results[0];
                        console.log('⚡ [RAG Lookup] CEP encontrado no RAG local. Aplicando bypass do ViaCEP.');
                        
                        if (deliveryElements.inputNeigh && match.bairro) {
                            deliveryElements.inputNeigh.value = match.bairro;
                        }
                        if (deliveryElements.inputAddr && match.rua) {
                            deliveryElements.inputAddr.value = match.rua;
                        }
                        await calculateDistanceForModal();
                        if (match.taxa !== null && match.taxa !== undefined) {
                            deliveryElements.inputFee.value = match.taxa;
                        }
                        return; // ⛔ Bypass
                    }
                } catch (err) {
                    console.warn('Erro ao buscar CEP no RAG:', err);
                }

                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && !data.erro) {
                            if (deliveryElements.inputNeigh && data.bairro) {
                                deliveryElements.inputNeigh.value = data.bairro;
                            }
                            if (deliveryElements.inputAddr && data.logradouro) {
                                deliveryElements.inputAddr.value = data.logradouro;
                            }
                            await calculateDistanceForModal();
                        }
                    }
                } catch (err) {
                    console.error('Erro ao autocompletar CEP:', err);
                }
            }
        });
        deliveryElements.inputZip.addEventListener('blur', calculateDistanceForModal);
    }

    if (deliveryElements.inputAddr) {
        deliveryElements.inputAddr.addEventListener('blur', async (e) => {
            const street = e.target.value.trim();
            const currentCep = deliveryElements.inputZip.value.replace(/\D/g, '');
            
            if (street.length >= 3 && currentCep.length < 8) {
                try {
                    // 🧠 Busca local na memória RAG por rua
                    const ragRes = await window.utils.apiFetch(`/rag/lookup-address?query=${encodeURIComponent(street)}`);
                    if (ragRes && ragRes.success && ragRes.results.length > 0) {
                        const match = ragRes.results[0];
                        console.log('⚡ [RAG Lookup] Rua encontrada no RAG local. Aplicando bypass do ViaCEP.');
                        
                        if (deliveryElements.inputZip && match.cep) {
                            deliveryElements.inputZip.value = window.utils.masks.cep(match.cep);
                        }
                        if (deliveryElements.inputNeigh && match.bairro) {
                            deliveryElements.inputNeigh.value = match.bairro;
                        }
                        await calculateDistanceForModal();
                        if (match.taxa !== null && match.taxa !== undefined) {
                            deliveryElements.inputFee.value = match.taxa;
                        }
                        return; // ⛔ Bypass
                    }
                } catch (err) {
                    console.warn('Erro ao buscar Rua no RAG:', err);
                }

                try {
                    const loc = await getCompanyCityState();
                    const cleanStreet = street.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const url = `https://viacep.com.br/ws/${loc.uf}/${encodeURIComponent(loc.city)}/${encodeURIComponent(cleanStreet)}/json/`;
                    
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.length > 0) {
                            const first = data[0];
                            if (deliveryElements.inputZip) {
                                deliveryElements.inputZip.value = window.utils.masks.cep(first.cep);
                            }
                            if (deliveryElements.inputNeigh && !deliveryElements.inputNeigh.value) {
                                deliveryElements.inputNeigh.value = first.bairro || '';
                            }
                            await calculateDistanceForModal();
                        }
                    }
                } catch (err) {
                    console.error('Erro ao buscar CEP por rua:', err);
                }
            } else {
                await calculateDistanceForModal();
            }
        });
    }

    // Auto-preencher taxa quando a distância mudar no modal
    if (deliveryElements.inputDist) {
        deliveryElements.inputDist.addEventListener('input', () => {
            updateModalFeeLock();
        });
    }

    if (deliveryElements.form) {
        deliveryElements.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                neighborhood: deliveryElements.inputNeigh.value || 'Desconhecido',
                address:      deliveryElements.inputAddr.value,
                zipCode:      deliveryElements.inputZip.value,
                distanceKm:   parseFloat(deliveryElements.inputDist.value) || 0
            };

            // Só envia fee se o usuário preencheu manualmente (não-zero)
            const manualFee = parseFloat(deliveryElements.inputFee.value);
            if (manualFee > 0) {
                payload.fee = manualFee;
            }
            // Se não informou fee, o backend auto-preenche a partir das faixas de KM

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

    // Edição inline por duplo clique
    if (deliveryElements.tableBody) {
        deliveryElements.tableBody.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('td.editable-cell');
            if (!cell) return;
            
            const tr = cell.closest('tr');
            const id = tr.dataset.id;
            const field = cell.dataset.field;
            
            if (cell.querySelector('input')) return;
            
            const item = deliveryFeesState.fees.find(x => x.id === parseInt(id));
            if (!item) return;
            
            // Se o campo for 'fee' e existir uma faixa de KM correspondente ativa, não permite edição inline!
            if (field === 'fee') {
                const range = getMatchingRange(item.distance_km);
                if (range) {
                    alert('Esta taxa é gerenciada automaticamente pelas faixas de KM globais e não pode ser editada manualmente.');
                    return;
                }
            }
            
            let originalValue = '';
            let inputType = 'text';
            let inputStep = '';
            
            if (field === 'zip_code') {
                originalValue = item.zip_code || '';
            } else if (field === 'address') {
                originalValue = item.address || '';
            } else if (field === 'fee') {
                originalValue = item.fee;
                inputType = 'number';
                inputStep = '0.01';
            } else if (field === 'distance_km') {
                originalValue = item.distance_km;
                inputType = 'number';
                inputStep = '0.1';
            }
            
            const input = document.createElement('input');
            input.type = inputType;
            if (inputStep) input.step = inputStep;
            input.value = originalValue;
            input.style.width = '100%';
            input.style.padding = '0.25rem 0.5rem';
            input.style.fontSize = 'inherit';
            input.style.fontFamily = 'inherit';
            input.style.border = '1px solid var(--accent-dark)';
            input.style.borderRadius = 'var(--radius-sm)';
            input.style.background = 'white';
            input.style.color = 'var(--text-main)';
            input.style.outline = 'none';
            input.style.boxSizing = 'border-box';
            
            if (field === 'zip_code') {
                input.addEventListener('input', (event) => {
                    event.target.value = window.utils.masks.cep(event.target.value);
                });
            }
            
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            
            let isSaving = false;
            
            const saveValue = async () => {
                if (isSaving) return;
                isSaving = true;
                
                const newValue = input.value.trim();
                
                if (newValue == originalValue || (field === 'fee' && parseFloat(newValue) === originalValue) || (field === 'distance_km' && parseFloat(newValue) === originalValue)) {
                    renderCellOriginal(cell, field, originalValue);
                    return;
                }
                
                cell.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i></span>';
                
                try {
                    const payload = {
                        neighborhood: item.neighborhood,
                        address: item.address,
                        zipCode: item.zip_code,
                        fee: item.fee,
                        distanceKm: item.distance_km
                    };
                    
                    if (field === 'zip_code') {
                        const clean = newValue.replace(/\D/g, '');
                        if (clean.length !== 8) throw new Error('CEP deve possuir 8 dígitos');
                        payload.zipCode = `${clean.substring(0, 5)}-${clean.substring(5)}`;
                        // Remover fee do payload para que o backend auto-preencha ao recalcular distância
                        delete payload.fee;
                    } else if (field === 'address') {
                        if (newValue.length < 3) throw new Error('Endereço deve ter pelo menos 3 caracteres');
                        payload.address = newValue;
                        // Remover fee do payload para que o backend auto-preencha ao recalcular distância
                        delete payload.fee;
                    } else if (field === 'fee') {
                        payload.fee = parseFloat(newValue) || 0;
                    } else if (field === 'distance_km') {
                        payload.distanceKm = parseFloat(newValue) || 0;
                        // Remover fee do payload para que o backend auto-preencha com base nas faixas de KM
                        delete payload.fee;
                    }
                    
                    const response = await window.utils.apiFetch(`/delivery-fees/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    
                    if (response.success) {
                        await loadDeliveryFees();
                    } else {
                        throw new Error(response.error || 'Erro ao atualizar');
                    }
                } catch (err) {
                    console.error('Erro ao atualizar campo inline:', err);
                    alert(err.message || 'Erro ao atualizar campo.');
                    renderCellOriginal(cell, field, originalValue);
                }
            };
            
            input.addEventListener('blur', saveValue);
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    isSaving = true;
                    renderCellOriginal(cell, field, originalValue);
                }
            });
        });
    }
    
    function renderCellOriginal(cell, field, value) {
        if (field === 'fee') {
            cell.innerHTML = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        } else if (field === 'distance_km') {
            cell.innerHTML = typeof value === 'number' ? `${value.toFixed(1)} km` : '---';
        } else {
            cell.innerHTML = value || '---';
        }
    }
    // ==========================================
    // 📏 GESTÃO DE FAIXAS DE KM (DELIVERY RANGES)
    // ==========================================

    const rangeElements = {
        tableBody:  document.getElementById('delivery-ranges-table-body'),
        inputMin:   document.getElementById('range-min-km'),
        inputMax:   document.getElementById('range-max-km'),
        inputFee:   document.getElementById('range-fee'),
        btnAdd:     document.getElementById('btn-add-delivery-range'),
    };

    let deliveryRangesState = {
        ranges: []
    };

    async function loadDeliveryRanges() {
        if (!rangeElements.tableBody) return;
        try {
            const ranges = await window.utils.apiFetch('/delivery-ranges');
            deliveryRangesState.ranges = ranges;
            renderDeliveryRangesTable();
        } catch (err) {
            console.error('Erro ao buscar faixas de KM:', err);
            rangeElements.tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 2rem; text-align: center; color: #ef4444;">
                        Erro ao carregar faixas de KM.
                    </td>
                </tr>
            `;
        }
    }

    function renderDeliveryRangesTable() {
        if (!rangeElements.tableBody) return;
        const ranges = deliveryRangesState.ranges;

        if (ranges.length === 0) {
            rangeElements.tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                        Nenhuma faixa de KM cadastrada. Adicione uma faixa acima.
                    </td>
                </tr>
            `;
            return;
        }

        rangeElements.tableBody.innerHTML = ranges.map(item => {
            const formattedFee = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.fee);
            const isActive = item.is_active === 1;
            const rowOpacity = isActive ? '1' : '0.5';
            const statusColor = isActive ? '#16a34a' : '#ef4444';
            const statusLabel = isActive ? 'Ativo' : 'Inativo';
            const statusIcon = isActive ? 'fa-circle-check' : 'fa-circle-xmark';

            return `
                <tr style="border-bottom: 1px solid var(--border-color); opacity: ${rowOpacity}; transition: opacity 0.3s ease;" data-range-id="${item.id}">
                    <td class="range-editable" data-field="min_km" style="padding: 0.75rem 1rem; font-weight: 500; cursor: pointer;">${item.min_km.toFixed(1)} km</td>
                    <td class="range-editable" data-field="max_km" style="padding: 0.75rem 1rem; font-weight: 500; cursor: pointer;">${item.max_km.toFixed(1)} km</td>
                    <td class="range-editable" data-field="fee" style="padding: 0.75rem 1rem; color: #16a34a; font-weight: 600; cursor: pointer;">${formattedFee}</td>
                    <td style="padding: 0.75rem 1rem; text-align: center;">
                        <button data-action="toggle-range" data-id="${item.id}" data-active="${isActive ? '1' : '0'}"
                            style="background: none; border: none; cursor: pointer; font-size: 1.1rem; color: ${statusColor}; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); transition: all 0.2s ease;"
                            title="${statusLabel}">
                            <i class="fa-solid ${statusIcon}"></i>
                            <span style="font-size: 0.75rem; font-weight: 600;">${statusLabel}</span>
                        </button>
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: right;">
                        <button style="background:none; border:none; color:#ef4444; cursor:pointer; padding:0.25rem;"
                            data-action="delete-range" data-id="${item.id}" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Botão adicionar faixa
    if (rangeElements.btnAdd) {
        rangeElements.btnAdd.addEventListener('click', async () => {
            const minKm = parseFloat(rangeElements.inputMin.value);
            const maxKm = parseFloat(rangeElements.inputMax.value);
            const fee = parseFloat(rangeElements.inputFee.value) || 0;

            if (isNaN(minKm) || isNaN(maxKm)) {
                alert('Preencha os campos KM Mín e KM Máx com valores numéricos.');
                return;
            }
            if (minKm >= maxKm) {
                alert('KM Mínimo deve ser menor que KM Máximo.');
                return;
            }

            try {
                const response = await window.utils.apiFetch('/delivery-ranges', {
                    method: 'POST',
                    body: JSON.stringify({ minKm, maxKm, fee })
                });

                if (response.success) {
                    rangeElements.inputMin.value = '';
                    rangeElements.inputMax.value = '';
                    rangeElements.inputFee.value = '';
                    await loadDeliveryRanges();
                }
            } catch (err) {
                console.error('Erro ao adicionar faixa de KM:', err);
                alert(err.message || 'Erro ao adicionar faixa de KM.');
            }
        });
    }

    // Delegated click actions for Toggle/Delete in ranges table
    document.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('[data-action="toggle-range"]');
        if (toggleBtn) {
            const id = toggleBtn.dataset.id;
            const currentActive = toggleBtn.dataset.active === '1';
            try {
                const response = await window.utils.apiFetch(`/delivery-ranges/${id}/toggle`, {
                    method: 'PATCH',
                    body: JSON.stringify({ isActive: !currentActive })
                });
                if (response.success) {
                    await loadDeliveryRanges();
                }
            } catch (err) {
                console.error('Erro ao alterar status da faixa:', err);
                alert(err.message || 'Erro ao alterar status.');
            }
        }

        const deleteRangeBtn = e.target.closest('[data-action="delete-range"]');
        if (deleteRangeBtn) {
            const id = deleteRangeBtn.dataset.id;
            if (confirm('Tem certeza que deseja excluir esta faixa de KM?')) {
                try {
                    const response = await window.utils.apiFetch(`/delivery-ranges/${id}`, { method: 'DELETE' });
                    if (response.success) {
                        await loadDeliveryRanges();
                    }
                } catch (err) {
                    console.error('Erro ao excluir faixa de KM:', err);
                    alert(err.message || 'Erro ao excluir faixa de KM.');
                }
            }
        }
    });

    // Edição inline por duplo clique nas faixas de KM
    if (rangeElements.tableBody) {
        rangeElements.tableBody.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('td.range-editable');
            if (!cell) return;

            const tr = cell.closest('tr');
            const id = tr.dataset.rangeId;
            const field = cell.dataset.field;

            if (cell.querySelector('input')) return;

            const item = deliveryRangesState.ranges.find(x => x.id === parseInt(id));
            if (!item) return;

            let originalValue = item[field];
            const input = document.createElement('input');
            input.type = 'number';
            input.step = field === 'fee' ? '0.01' : '0.1';
            input.value = originalValue;
            input.style.width = '100%';
            input.style.padding = '0.25rem 0.5rem';
            input.style.fontSize = 'inherit';
            input.style.fontFamily = 'inherit';
            input.style.border = '1px solid var(--accent-dark)';
            input.style.borderRadius = 'var(--radius-sm)';
            input.style.background = 'white';
            input.style.color = 'var(--text-main)';
            input.style.outline = 'none';
            input.style.boxSizing = 'border-box';

            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            input.select();

            let isSaving = false;

            const saveRangeValue = async () => {
                if (isSaving) return;
                isSaving = true;

                const newValue = parseFloat(input.value);

                if (newValue === originalValue || isNaN(newValue)) {
                    renderRangeCellOriginal(cell, field, originalValue);
                    return;
                }

                cell.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i></span>';

                try {
                    const payload = {
                        minKm: item.min_km,
                        maxKm: item.max_km,
                        fee: item.fee
                    };

                    if (field === 'min_km') payload.minKm = newValue;
                    else if (field === 'max_km') payload.maxKm = newValue;
                    else if (field === 'fee') payload.fee = newValue;

                    if (payload.minKm >= payload.maxKm) {
                        throw new Error('KM Mínimo deve ser menor que KM Máximo.');
                    }

                    const response = await window.utils.apiFetch(`/delivery-ranges/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });

                    if (response.success) {
                        await loadDeliveryRanges();
                    } else {
                        throw new Error(response.error || 'Erro ao atualizar');
                    }
                } catch (err) {
                    console.error('Erro ao atualizar faixa inline:', err);
                    alert(err.message || 'Erro ao atualizar faixa.');
                    renderRangeCellOriginal(cell, field, originalValue);
                }
            };

            input.addEventListener('blur', saveRangeValue);
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    isSaving = true;
                    renderRangeCellOriginal(cell, field, originalValue);
                }
            });
        });
    }

    function renderRangeCellOriginal(cell, field, value) {
        if (field === 'fee') {
            cell.innerHTML = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        } else {
            cell.innerHTML = typeof value === 'number' ? `${value.toFixed(1)} km` : '---';
        }
    }

    // ==========================================
    // 🍴 MENU CATALOG (V2) LOGIC
    // ==========================================
    
    let catalogItems = [];
    let catalogCategories = [];
    let currentCategoryFilter = 'all';
    let catalogCurrentPage = 1;
    let catalogItemsPerPage = 10;
    
    const tableCatalogBody = document.getElementById('catalog-table-body');
    const categoryChipsContainer = document.getElementById('category-chips-container');
    const countAll = document.getElementById('count-all');
    const chipAdicionaisTrigger = document.getElementById('chip-adicionais-trigger');
    const countAdicionais = document.getElementById('count-adicionais');
    const searchInput = document.getElementById('catalog-search-input');
    const emptyState = document.getElementById('catalog-empty-state');
    const bannerAdicionais = document.getElementById('banner-adicionais-info');

    // Referências do DOM da Paginação do Catálogo
    const catalogPaginationControls = document.getElementById('catalog-pagination-controls');
    const catalogPaginationInfo     = document.getElementById('catalog-pagination-info');
    const catalogPaginationLimit    = document.getElementById('catalog-pagination-limit');
    const catalogBtnPrevPage        = document.getElementById('catalog-btn-prev-page');
    const catalogBtnNextPage        = document.getElementById('catalog-btn-next-page');
    const catalogCurrentPageNum     = document.getElementById('catalog-current-page-num');
    
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
            catalogCategories = categoriesResponse;
            
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
            btn.dataset.filter = cat.nome;
            btn.style.cssText = 'padding: 0.4rem 1rem; border-radius: 20px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-weight: 600;';
            
            const countSpan = document.createElement('span');
            countSpan.className = 'counter';
            countSpan.style.cssText = 'background: var(--bg-main); padding: 0.1rem 0.5rem; border-radius: 10px; font-size: 0.8rem;';
            
            btn.textContent = cat.nome + ' ';
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
                catalogCurrentPage = 1; // Reset para página 1
                applyFiltersAndRender();
            });
        });
    }
    
    function applyFiltersAndRender() {
        if (!tableCatalogBody) return;
        
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        // Count totals
        const totalAdicionais = catalogItems.filter(i => i.is_adicional === 1).length;
        const countAdicionaisEl = document.getElementById('count-adicionais');
        if (countAdicionaisEl) countAdicionaisEl.textContent = totalAdicionais;
        
        const totalNormal = catalogItems.filter(i => i.is_adicional === 0).length;
        const countAllEl = document.getElementById('count-all');
        if (countAllEl) countAllEl.textContent = totalNormal;
        
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
        const totalItems = items.length;
        
        if (totalItems === 0) {
            emptyState.style.display = 'block';
            if (catalogPaginationControls) {
                catalogPaginationControls.style.display = 'none';
            }
            return;
        }
        
        emptyState.style.display = 'none';

        // Lógica de Paginação Dinâmica
        if (catalogPaginationControls) {
            if (totalItems <= 10) {
                catalogPaginationControls.style.display = 'none';
                catalogItemsPerPage = totalItems;
                catalogCurrentPage = 1;
            } else {
                catalogPaginationControls.style.display = 'flex';
                
                if (catalogPaginationLimit) {
                    const previousValue = catalogPaginationLimit.value;
                    const defaultLimits = [10, 25, 50];
                    const availableLimits = defaultLimits.filter(limit => limit < totalItems);
                    
                    let optionsHTML = '';
                    availableLimits.forEach(limit => {
                        optionsHTML += `<option value="${limit}">${limit} por página</option>`;
                    });
                    optionsHTML += `<option value="all">Ver todos</option>`;
                    
                    catalogPaginationLimit.innerHTML = optionsHTML;
                    
                    // Tenta manter o valor anterior
                    const hasPrevious = Array.from(catalogPaginationLimit.options).some(opt => opt.value === previousValue);
                    if (hasPrevious) {
                        catalogPaginationLimit.value = previousValue;
                    } else {
                        catalogPaginationLimit.value = '10';
                    }
                }
            }
        }

        const limitVal = catalogPaginationLimit ? catalogPaginationLimit.value : '10';
        catalogItemsPerPage = limitVal === 'all' ? totalItems : parseInt(limitVal, 10);

        const totalPages = Math.ceil(totalItems / catalogItemsPerPage) || 1;
        if (catalogCurrentPage > totalPages) {
            catalogCurrentPage = totalPages;
        }
        if (catalogCurrentPage < 1) {
            catalogCurrentPage = 1;
        }

        const start = (catalogCurrentPage - 1) * catalogItemsPerPage;
        const end = start + catalogItemsPerPage;
        const paginatedItems = items.slice(start, end);

        paginatedItems.forEach(item => {
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
                    <button class="btn btn--outline" data-action="edit-catalog-item" data-id="${item.id}" style="padding: 0.3rem 0.6rem; margin-right: 0.25rem;" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn--outline" data-action="duplicate-catalog-item" data-id="${item.id}" style="padding: 0.3rem 0.6rem; margin-right: 0.25rem; color: #4f46e5; border-color: #e0e7ff;" title="Duplicar"><i class="fa-solid fa-copy"></i></button>
                    <button class="btn btn--outline" data-action="delete-catalog-item" data-id="${item.id}" style="padding: 0.3rem 0.6rem; color: #e11d48; border-color: #ffe4e6;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tableCatalogBody.appendChild(tr);
        });

        // Atualiza os controles de paginação
        if (catalogPaginationControls && totalItems > 10) {
            catalogPaginationControls.style.display = 'flex';
            
            const showFrom = totalItems === 0 ? 0 : start + 1;
            const showTo = Math.min(end, totalItems);
            
            if (catalogPaginationInfo) {
                catalogPaginationInfo.textContent = `Mostrando ${showFrom}-${showTo} de ${totalItems} itens`;
            }
            
            if (catalogCurrentPageNum) {
                catalogCurrentPageNum.textContent = catalogCurrentPage;
            }
            
            if (catalogBtnPrevPage) {
                catalogBtnPrevPage.disabled = catalogCurrentPage === 1;
            }
            
            if (catalogBtnNextPage) {
                catalogBtnNextPage.disabled = catalogCurrentPage === totalPages;
            }
        }
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            catalogCurrentPage = 1; // Reset para página 1
            applyFiltersAndRender();
        });
    }

    if (catalogPaginationLimit) {
        catalogPaginationLimit.addEventListener('change', () => {
            catalogCurrentPage = 1;
            applyFiltersAndRender();
        });
    }

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('#catalog-btn-prev-page')) {
            if (catalogCurrentPage > 1) {
                catalogCurrentPage--;
                applyFiltersAndRender();
            }
        }
        if (target.closest('#catalog-btn-next-page')) {
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const filteredCount = catalogItems.filter(item => {
                if (currentCategoryFilter === 'adicionais' && item.is_adicional === 0) return false;
                if (currentCategoryFilter !== 'adicionais' && currentCategoryFilter !== 'all' && item.categoria !== currentCategoryFilter) return false;
                if (currentCategoryFilter === 'all' && item.is_adicional === 1) return false;
                if (searchTerm) {
                    const searchMatch = (
                        (item.nome && item.nome.toLowerCase().includes(searchTerm)) ||
                        (item.descricao && item.descricao.toLowerCase().includes(searchTerm)) ||
                        (item.cod_pdv && String(item.cod_pdv).toLowerCase().includes(searchTerm))
                    );
                    if (!searchMatch) return false;
                }
                return true;
            }).length;

            const totalPages = Math.ceil(filteredCount / catalogItemsPerPage) || 1;
            if (catalogCurrentPage < totalPages) {
                catalogCurrentPage++;
                applyFiltersAndRender();
            }
        }
    });
    
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

        const duplicateBtn = e.target.closest('[data-action="duplicate-catalog-item"]');
        if (duplicateBtn) {
            const id = parseInt(duplicateBtn.dataset.id);
            const item = catalogItems.find(x => x.id === id);
            if (item) {
                if (confirm(`Deseja duplicar o item "${item.nome}" e copiar todos os seus vínculos?`)) {
                    const payload = {
                        cod_pdv: null, // Evita duplicar código PDV único
                        nome: `${item.nome} (Cópia)`,
                        preco: Number(item.preco) || 0,
                        categoria: item.categoria,
                        descricao: item.descricao, // Mantém os vínculos serializados na descrição
                        is_adicional: item.is_adicional === 1 || item.is_adicional === true,
                        disponivel: item.disponivel === 1 || item.disponivel === true
                    };
                    
                    try {
                        await window.utils.apiFetch('/catalog', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });
                        await loadCatalog();
                        showToast('Item duplicado com sucesso!');
                    } catch (err) {
                        console.error('Erro ao duplicar item:', err);
                        alert('Erro ao duplicar item: ' + err.message);
                    }
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
                categories.map(cat => `<option value="${cat.id}">${cat.nome}</option>`).join('') +
                '<option value="__NEW_CATEGORY__" style="font-weight: 600; color: #4f46e5;">+ Nova categoria...</option>';
        }
        
        if (adicionalCatSelect) {
            adicionalCatSelect.innerHTML = categories.map(cat => `<option value="${cat.nome}">${cat.nome}</option>`).join('');
        }
    }

    // Modal de Produto (Novo Item / Editar Item)
    function openProductModal(item = null) {
        const modal = document.getElementById('modal-produto');
        const form = document.getElementById('form-product');
        const title = document.getElementById('product-modal-title');
        
        currentProductId = item ? item.id : null;
        
        populateCategoriesDropdowns(catalogCategories);

        const doOpen = () => {
            if (modal) modal.style.display = 'flex';
            if (item) {
                if (title) title.innerHTML = '<i class="fa-solid fa-utensils"></i> Editar Item';
                document.getElementById('product-cod-pdv').value = item.cod_pdv || '';
                document.getElementById('product-nome').value = item.nome || '';
                document.getElementById('product-preco').value = item.preco || 0;
                
                const itemCat = catalogCategories.find(c => c.id === item.categoria_id || c.nome === item.categoria);
                document.getElementById('product-categoria').value = itemCat ? itemCat.id : '';
                
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
        
        populateCategoriesDropdowns(catalogCategories);

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

    // Impedir fisicamente a digitação de letras no código PDV
    const productCodPdvInput = document.getElementById('product-cod-pdv');
    if (productCodPdvInput) {
        productCodPdvInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        });
    }

    const adicionalCodPdvInput = document.getElementById('adicional-cod-pdv');
    if (adicionalCodPdvInput) {
        adicionalCodPdvInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        });
    }

    // Envio do formulário do Produto
    const formProduct = document.getElementById('form-product');
    if (formProduct) {
        formProduct.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const codPdv = document.getElementById('product-cod-pdv').value.trim();
            const nome = document.getElementById('product-nome').value.trim();
            const preco = parseFloat(document.getElementById('product-preco').value) || 0;

            if (codPdv && !/^\d+$/.test(codPdv)) {
                alert("O código do item (PDV) deve conter apenas números.");
                document.getElementById('product-cod-pdv').focus();
                return;
            }
            if (preco <= 0) {
                alert("O preço do produto deve ser maior que zero.");
                document.getElementById('product-preco').focus();
                return;
            }

            const categoriaVal = document.getElementById('product-categoria').value;
            const categoriaId = parseInt(categoriaVal, 10);
            const selectedCat = catalogCategories.find(c => c.id === categoriaId);
            const categoriaName = selectedCat ? selectedCat.nome : 'Geral';
            const descInput = document.getElementById('product-descricao').value;
            
            // Serializar adicionais vinculados na descrição
            const adIds = selectedAdicionais.map(x => x.id);
            const metadataStr = JSON.stringify({ adicionalIds: adIds });
            const finalDesc = descInput ? `${descInput} ||| ${metadataStr}` : ` ||| ${metadataStr}`;
            
            const payload = {
                cod_pdv: codPdv || null,
                nome,
                preco,
                categoria_id: isNaN(categoriaId) ? null : categoriaId,
                categoria: categoriaName,
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
            
            const codPdv = document.getElementById('adicional-cod-pdv').value.trim();
            const nome = document.getElementById('adicional-nome').value.trim();
            const preco = parseFloat(document.getElementById('adicional-preco').value) || 0;

            if (codPdv && !/^\d+$/.test(codPdv)) {
                alert("O código do adicional (PDV) deve conter apenas números.");
                document.getElementById('adicional-cod-pdv').focus();
                return;
            }
            if (preco <= 0) {
                alert("O preço do adicional deve ser maior que zero.");
                document.getElementById('adicional-preco').focus();
                return;
            }

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
    // 📁 GERENCIADOR DE CATEGORIAS (MODAL PREMIUM)
    // ==========================================

    function openCategoryManagerModal() {
        const modal = document.getElementById('modal-gerenciar-categorias');
        const doOpen = () => {
            if (modal) modal.style.display = 'flex';
            renderCategoryManagerList();
        };

        if (window.utils && window.utils.modalManager) {
            window.utils.modalManager.open('modal-gerenciar-categorias', doOpen, closeCategoryManagerModal);
        } else {
            doOpen();
        }
    }

    function closeCategoryManagerModal() {
        const modal = document.getElementById('modal-gerenciar-categorias');
        if (modal) modal.style.display = 'none';
        
        const form = document.getElementById('form-create-category');
        if (form) form.reset();
        
        if (window.utils && window.utils.modalManager) {
            window.utils.modalManager.close('modal-gerenciar-categorias');
        }
    }

    function renderCategoryManagerList() {
        const listContainer = document.getElementById('category-manager-list');
        if (!listContainer) return;
        
        if (catalogCategories.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin: 1rem 0;">Nenhuma categoria cadastrada.</p>';
            return;
        }
        
        listContainer.innerHTML = catalogCategories.map(cat => {
            const isGeral = cat.nome.toLowerCase() === 'geral';
            
            return `
                <div class="category-item-row" data-id="${cat.id}" style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); gap: 0.5rem;">
                    <!-- Nome normal -->
                    <span class="category-name-span" style="font-weight: 600; flex: 1; color: var(--text-main);">${cat.nome}</span>
                    
                    <!-- Input para edição -->
                    <input type="text" class="category-edit-input input-row-style" value="${cat.nome}" style="display: none; flex: 1; height: 32px; padding: 0.25rem 0.5rem;" />
                    
                    <div class="category-action-buttons" style="display: flex; gap: 0.25rem;">
                        <!-- Botões Modo Visualização -->
                        <button type="button" class="btn-edit-category btn btn-outline" data-id="${cat.id}" style="padding: 0.25rem 0.5rem; height: 32px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Editar"><i class="fa-solid fa-pen" style="font-size: 0.8rem;"></i></button>
                        ${isGeral ? '' : `
                            <button type="button" class="btn-delete-category btn btn-outline" data-id="${cat.id}" style="padding: 0.25rem 0.5rem; height: 32px; border-radius: var(--radius-sm); border-color: #feb2b2; color: #c53030; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Excluir"><i class="fa-solid fa-trash" style="font-size: 0.8rem;"></i></button>
                        `}
                        
                        <!-- Botões Modo Edição -->
                        <button type="button" class="btn-save-category btn" data-id="${cat.id}" style="display: none; padding: 0.25rem 0.5rem; height: 32px; border-radius: var(--radius-sm); background: #38A169; color: white; border: none; align-items: center; justify-content: center; cursor: pointer;" title="Salvar"><i class="fa-solid fa-check" style="font-size: 0.8rem;"></i></button>
                        <button type="button" class="btn-cancel-edit-category btn btn-outline" data-id="${cat.id}" style="display: none; padding: 0.25rem 0.5rem; height: 32px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Cancelar"><i class="fa-solid fa-xmark" style="font-size: 0.8rem;"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Event listeners para o Modal de Gerenciamento de Categorias
    const btnCloseCategoryManagerModal = document.getElementById('btn-close-category-manager-modal');
    if (btnCloseCategoryManagerModal) btnCloseCategoryManagerModal.addEventListener('click', closeCategoryManagerModal);
    
    const btnCloseCategoryManagerFooter = document.getElementById('btn-close-category-manager-footer');
    if (btnCloseCategoryManagerFooter) btnCloseCategoryManagerFooter.addEventListener('click', closeCategoryManagerModal);

    // Registro do modal no manager
    if (window.utils && window.utils.modalManager) {
        window.utils.modalManager.register('modal-gerenciar-categorias', closeCategoryManagerModal);
    }

    // Formulário de criar nova categoria (dentro do modal)
    const formCreateCategory = document.getElementById('form-create-category');
    if (formCreateCategory) {
        formCreateCategory.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('new-category-name');
            const name = input ? input.value.trim() : '';
            if (name) {
                try {
                    await window.utils.apiFetch('/catalog/categories', {
                        method: 'POST',
                        body: JSON.stringify({ nome: name })
                    });
                    input.value = '';
                    await loadCatalog(); // recarrega categorias locais
                    renderCategoryManagerList(); // re-renderiza lista no modal
                    showToast(`Categoria "${name}" criada com sucesso!`);
                } catch (err) {
                    alert(err.message || 'Erro ao criar categoria.');
                }
            }
        });
    }

    // Delegação de cliques na lista de categorias (Editar / Excluir / Salvar / Cancelar)
    const categoryManagerList = document.getElementById('category-manager-list');
    if (categoryManagerList) {
        categoryManagerList.addEventListener('click', async (e) => {
            const row = e.target.closest('.category-item-row');
            if (!row) return;
            
            const id = parseInt(row.dataset.id, 10);
            const spanName = row.querySelector('.category-name-span');
            const inputEdit = row.querySelector('.category-edit-input');
            const btnEdit = row.querySelector('.btn-edit-category');
            const btnDelete = row.querySelector('.btn-delete-category');
            const btnSave = row.querySelector('.btn-save-category');
            const btnCancel = row.querySelector('.btn-cancel-edit-category');
            
            // Ação: Iniciar Edição
            if (e.target.closest('.btn-edit-category')) {
                if (spanName) spanName.style.display = 'none';
                if (inputEdit) {
                    inputEdit.style.display = 'block';
                    inputEdit.focus();
                }
                if (btnEdit) btnEdit.style.display = 'none';
                if (btnDelete) btnDelete.style.display = 'none';
                if (btnSave) btnSave.style.display = 'flex';
                if (btnCancel) btnCancel.style.display = 'flex';
            }
            
            // Ação: Cancelar Edição
            else if (e.target.closest('.btn-cancel-edit-category')) {
                if (spanName) spanName.style.display = 'block';
                if (inputEdit) {
                    inputEdit.style.display = 'none';
                    inputEdit.value = spanName.textContent; // restaura valor anterior
                }
                if (btnEdit) btnEdit.style.display = 'flex';
                if (btnDelete) btnDelete.style.display = 'flex';
                if (btnSave) btnSave.style.display = 'none';
                if (btnCancel) btnCancel.style.display = 'none';
            }
            
            // Ação: Salvar Edição
            else if (e.target.closest('.btn-save-category')) {
                const novoNome = inputEdit ? inputEdit.value.trim() : '';
                if (!novoNome) {
                    alert('O nome da categoria não pode ser vazio.');
                    return;
                }
                try {
                    await window.utils.apiFetch(`/catalog/categories/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ nome: novoNome })
                    });
                    await loadCatalog(); // recarrega categorias
                    renderCategoryManagerList(); // atualiza modal
                    showToast('Categoria atualizada com sucesso!');
                } catch (err) {
                    alert(err.message || 'Erro ao atualizar categoria.');
                }
            }
            
            // Ação: Excluir Categoria
            else if (e.target.closest('.btn-delete-category')) {
                const cat = catalogCategories.find(c => c.id === id);
                const nomeCat = cat ? cat.nome : '';
                if (confirm(`Tem certeza que deseja excluir a categoria "${nomeCat}"?\nNota: Só é possível excluir categorias que não possuam produtos vinculados.`)) {
                    try {
                        await window.utils.apiFetch(`/catalog/categories/${id}`, {
                            method: 'DELETE'
                        });
                        await loadCatalog(); // recarrega categorias e produtos
                        renderCategoryManagerList(); // atualiza modal
                        showToast('Categoria excluída com sucesso!');
                    } catch (err) {
                        alert(err.message || 'Erro ao excluir categoria.');
                    }
                }
            }
        });
    }

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
            openCategoryManagerModal();
        });
    }

    const productCatSelect = document.getElementById('product-categoria');
    if (productCatSelect) {
        productCatSelect.addEventListener('change', async (e) => {
            if (e.target.value === '__NEW_CATEGORY__') {
                e.target.value = ''; // Reseta valor provisório
                const name = prompt('Digite o nome da nova categoria:');
                if (name && name.trim()) {
                    const trimmed = name.trim();
                    try {
                        const newCat = await window.utils.apiFetch('/catalog/categories', {
                            method: 'POST',
                            body: JSON.stringify({ nome: trimmed })
                        });
                        
                        await loadCatalog();
                        populateCategoriesDropdowns(catalogCategories);
                        e.target.value = newCat.id;
                        
                        showToast(`Categoria "${trimmed}" criada com sucesso!`);
                    } catch (err) {
                        alert(err.message || 'Erro ao criar categoria.');
                    }
                }
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
                    let skippedCount = 0;
                    let invalidPdvCount = 0;
                    let invalidPriceCount = 0;
                    
                    for (const row of json) {
                        const name = row[0] ? String(row[0]).trim() : '';
                        if (!name) continue; // Pula linha vazia
                        
                        const pdv = row[1] ? String(row[1]).trim() : '';
                        if (!pdv) {
                            console.log(`⚠️ [Importação] Pulando item "${name}" porque o código PDV está vazio na planilha.`);
                            skippedCount++;
                            continue; // Ignora se o código PDV for nulo/vazio para evitar duplicação
                        }
                        
                        // Validação de letras no código PDV
                        if (!/^\d+$/.test(pdv)) {
                            console.warn(`⚠️ [Importação] Pulando item "${name}" porque o código PDV "${pdv}" contém letras ou caracteres especiais.`);
                            invalidPdvCount++;
                            continue;
                        }
                        
                        const category = row[2] ? String(row[2]).trim() : '';
                        const priceStr = row[3] ? String(row[3]).trim() : '0';
                        const desc = row[4] ? String(row[4]).trim() : '';
                        
                        const priceMatches = priceStr.match(/\d+([.,]\d+)?/);
                        const price = priceMatches ? parseFloat(priceMatches[0].replace(',', '.')) : 0;
                        
                        // Validação de preço maior que zero
                        if (price <= 0) {
                            console.warn(`⚠️ [Importação] Pulando item "${name}" porque o preço (${price}) deve ser maior que zero.`);
                            invalidPriceCount++;
                            continue;
                        }

                        // Verifica se já existe um item com esse código PDV
                        const existingItem = catalogItems.find(item => item.cod_pdv && String(item.cod_pdv).trim() === pdv);

                        if (existingItem) {
                            // Atualiza mantendo metadados de adicionais vinculados se houver
                            let finalDesc = desc;
                            const parts = (existingItem.descricao || '').split(' ||| ');
                            if (parts[1]) {
                                finalDesc = desc ? `${desc} ||| ${parts[1]}` : ` ||| ${parts[1]}`;
                            }

                            const payload = {
                                nome: name,
                                cod_pdv: pdv,
                                categoria: category || existingItem.categoria || 'Geral',
                                preco: price,
                                descricao: finalDesc || null,
                                is_adicional: existingItem.is_adicional === 1 || existingItem.is_adicional === true,
                                disponivel: existingItem.disponivel === 1 || existingItem.disponivel === true
                            };

                            await window.utils.apiFetch(`/catalog/${existingItem.id}`, {
                                method: 'PUT',
                                body: JSON.stringify(payload)
                            });
                        } else {
                            // Cria um novo item se não existir
                            const payload = {
                                nome: name,
                                cod_pdv: pdv,
                                categoria: category || 'Geral',
                                preco: price,
                                descricao: desc || null,
                                is_adicional: false,
                                disponivel: true
                            };

                            await window.utils.apiFetch('/catalog', {
                                method: 'POST',
                                body: JSON.stringify(payload)
                            });
                        }
                        importCount++;
                    }

                    excelUploadInput.value = ''; // reseta
                    if (importCount > 0) {
                        let msg = `${importCount} item(ns) importado(s) com sucesso!`;
                        if (invalidPdvCount > 0 || invalidPriceCount > 0 || skippedCount > 0) {
                            msg += `\n(${invalidPdvCount} ignorado(s) por código inválido, ${invalidPriceCount} por preço inválido, ${skippedCount} sem código).`;
                        }
                        alert(msg);
                        await loadCatalog(); // Recarrega a tabela e pills
                    } else {
                        let msg = 'Nenhum item válido importado do Excel.';
                        if (invalidPdvCount > 0 || invalidPriceCount > 0 || skippedCount > 0) {
                            msg += `\nMotivos: ${invalidPdvCount} código(s) inválido(s), ${invalidPriceCount} preço(s) inválido(s), ${skippedCount} sem código.`;
                        }
                        alert(msg);
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
