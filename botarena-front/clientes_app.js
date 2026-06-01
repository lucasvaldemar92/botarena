/**
 * 👤 BotArena - Client Registration Logic (Light Mode Single Column Modal)
 * Compliance: dynamic-dom-frontend.md, IIFE Isolation
 */
(function() {
    'use strict';

    // --- DOM Elements ---
    const elements = {
        modal:              document.getElementById('modal-registration'),
        modalTitle:         document.getElementById('modal-title'),
        btnNew:             document.getElementById('btn-new-client'),
        btnClose:           document.getElementById('modal-close'),
        btnCancel:          document.getElementById('btn-cancel'),
        btnSubmit:          document.getElementById('btn-submit'),
        form:               document.getElementById('form-client'),
        sourceBadge:        document.getElementById('client-source-badge'),
        inputName:          document.getElementById('client-name'),
        inputBirth:         document.getElementById('client-birth'),
        inputPhone:         document.getElementById('client-phone'),
        inputCEP:           document.getElementById('client-cep'),
        inputAddress:       document.getElementById('client-address'),
        inputNumber:        document.getElementById('client-number'),
        tableBody:          document.getElementById('clients-table-body'),
        clientCount:        document.getElementById('client-count'),
        paginationControls: document.getElementById('pagination-controls'),
        paginationInfo:     document.getElementById('pagination-info'),
        paginationLimit:    document.getElementById('pagination-limit'),
        btnPrevPage:        document.getElementById('btn-prev-page'),
        btnNextPage:        document.getElementById('btn-next-page'),
        currentPageNum:     document.getElementById('current-page-num')
    };

    // --- State Management ---
    const state = {
        isWhatsAppSource: false,
        editingId: null,   // null = novo cadastro, number = editando
        clients: [],
        socket: null,
        redirectAfterSave: null,
        currentPage: 1,
        itemsPerPage: 10
    };

    // --- API Calls ---
    const api = {
        fetchClients: async () => {
            try {
                const response = await window.utils.apiFetch('/clients');
                state.clients = response;
                ui.renderTable();
            } catch (err) {
                console.error('❌ Error fetching clients:', err);
            }
        },
        saveClient: async (payload) => {
            try {
                let response;
                if (state.editingId) {
                    response = await window.utils.apiFetch(`/clients/${state.editingId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                } else {
                    response = await window.utils.apiFetch('/clients', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                }
                if (response.success) {
                    await api.fetchClients();
                    ui.closeModal();
                    if (state.redirectAfterSave) {
                        const dest = state.redirectAfterSave;
                        state.redirectAfterSave = null;
                        window.location.href = dest;
                    }
                }
            } catch (err) {
                console.error('❌ Error saving client:', err);
                alert(err.message || 'Erro ao salvar cliente. Verifique o console.');
            }
        },
        deleteClient: async (id) => {
            if (!confirm('Deseja realmente excluir este cliente?')) return;
            try {
                const response = await window.utils.apiFetch(`/clients/${id}`, { method: 'DELETE' });
                if (response.success) await api.fetchClients();
            } catch (err) {
                console.error('❌ Error deleting client:', err);
            }
        }
    };

    // --- UI Rendering ---
    const ui = {
        openModal: (client = null, prefillData = null) => {
            state.editingId = client ? client.id : null;

            const doOpen = () => {
                elements.modal.classList.add('active');
                if (client) {
                    // Modo edição
                    elements.modalTitle.textContent = 'Editar Cliente';
                    elements.btnSubmit.textContent = 'Salvar Alterações';
                    elements.inputName.value    = client.name || '';
                    elements.inputBirth.value   = client.birth_date || '';
                    elements.inputPhone.value   = window.utils.masks.phone(client.phone || '');
                    elements.inputCEP.value     = window.utils.masks.cep(client.zip_code || '');
                    elements.inputAddress.value = client.address || '';
                    elements.inputNumber.value  = client.number || '';
                    ui.setSource(client.source === 'whatsapp');
                } else {
                    // Modo criação
                    elements.modalTitle.textContent = 'Cadastro de Cliente';
                    elements.btnSubmit.textContent = 'Salvar Cliente';
                    elements.form.reset();
                    if (elements.inputNumber) elements.inputNumber.value = '';
                    
                    // Se recebemos dados vindos do atendimento para pré-preenchimento automático (contato)
                    if (prefillData) {
                        elements.inputName.value = prefillData.name || '';
                        elements.inputPhone.value = window.utils.masks.phone(prefillData.phone || '');
                        ui.setSource(true); // Se vem do atendimento, a origem é WhatsApp!
                    } else {
                        ui.setSource(false); // Caso contrário, manual
                    }
                }
            };

            if (window.utils && window.utils.modalManager) {
                window.utils.modalManager.open('modal-registration', doOpen, () => {
                    elements.modal.classList.remove('active');
                    elements.form.reset();
                    state.editingId = null;
                });
            } else {
                doOpen();
            }
        },
        closeModal: () => {
            elements.modal.classList.remove('active');
            elements.form.reset();
            state.editingId = null;
            if (window.utils && window.utils.modalManager) {
                window.utils.modalManager.close('modal-registration');
            }
        },
        setSource: (fromWhatsApp) => {
            state.isWhatsAppSource = fromWhatsApp;
            if (fromWhatsApp) {
                elements.sourceBadge.className = 'source-badge source-badge--whatsapp';
                elements.sourceBadge.innerHTML = '<i class="fa-brands fa-whatsapp"></i> [WhatsApp]';
            } else {
                elements.sourceBadge.className = 'source-badge source-badge--manual';
                elements.sourceBadge.innerHTML = '<i class="fa-solid fa-pen"></i> [Manual]';
            }
        },
        renderTable: () => {
            const totalClients = state.clients.length;
            elements.clientCount.innerText = `${totalClients} cadastrados`;

            if (totalClients === 0) {
                elements.tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state">Nenhum cliente cadastrado.</td>
                    </tr>
                `;
                if (elements.paginationControls) {
                    elements.paginationControls.style.display = 'none';
                }
                return;
            }

            // Paginação Dinâmica
            const limitVal = elements.paginationLimit ? elements.paginationLimit.value : '10';
            state.itemsPerPage = limitVal === 'all' ? totalClients : parseInt(limitVal, 10);
            
            const totalPages = Math.ceil(totalClients / state.itemsPerPage) || 1;
            if (state.currentPage > totalPages) {
                state.currentPage = totalPages;
            }
            if (state.currentPage < 1) {
                state.currentPage = 1;
            }

            const start = (state.currentPage - 1) * state.itemsPerPage;
            const end = start + state.itemsPerPage;
            const paginatedClients = state.clients.slice(start, end);

            elements.tableBody.innerHTML = paginatedClients.map(client => `
                <tr data-id="${client.id}" data-testid="client-row-${client.id}">
                    <td>${client.name || '---'}</td>
                    <td>${client.birth_date || '---'}</td>
                    <td>${client.phone || '---'}</td>
                    <td>
                        <span class="source-badge ${client.source === 'whatsapp' ? 'source-badge--whatsapp' : 'source-badge--manual'}" style="margin-bottom:0">
                            ${client.source === 'whatsapp' ? '[WhatsApp]' : '[Manual]'}
                        </span>
                    </td>
                    <td>${client.address || '---'}</td>
                    <td>${client.number || '---'}</td>
                    <td>${client.zip_code || '---'}</td>
                    <td style="display:flex; gap:0.5rem; align-items:center;">
                        <button style="background:none; border:none; color:#3b82f6; cursor:pointer; padding:0.25rem;"
                            data-action="edit" data-id="${client.id}" data-testid="btn-edit-client-${client.id}" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button style="background:none; border:none; color:#ef4444; cursor:pointer; padding:0.25rem;"
                            data-action="delete" data-id="${client.id}" data-testid="btn-delete-client-${client.id}" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');

            // Atualiza os controles de paginação
            if (elements.paginationControls) {
                elements.paginationControls.style.display = 'flex';
                
                const showFrom = totalClients === 0 ? 0 : start + 1;
                const showTo = Math.min(end, totalClients);
                
                if (elements.paginationInfo) {
                    elements.paginationInfo.textContent = `Mostrando ${showFrom}-${showTo} de ${totalClients} clientes`;
                }
                
                if (elements.currentPageNum) {
                    elements.currentPageNum.textContent = state.currentPage;
                }
                
                if (elements.btnPrevPage) {
                    elements.btnPrevPage.disabled = state.currentPage === 1;
                }
                
                if (elements.btnNextPage) {
                    elements.btnNextPage.disabled = state.currentPage === totalPages;
                }
            }
        }
    };

    document.addEventListener('click', (e) => {
        const target = e.target;

        if (target.closest('#btn-new-client')) {
            ui.openModal();
        }

        if (target.closest('#btn-sync-whatsapp')) {
            const btnSync = target.closest('#btn-sync-whatsapp');
            const originalHTML = btnSync.innerHTML;
            btnSync.disabled = true;
            btnSync.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
            
            window.utils.apiFetch('/clients/sync', { method: 'POST' })
                .then(res => {
                    alert(res.message || 'Sincronização concluída com sucesso!');
                    return api.fetchClients();
                })
                .catch(err => {
                    console.error('❌ Error during synchronization:', err);
                    alert(err.message || 'Erro ao sincronizar contatos do WhatsApp. Verifique se o bot está conectado.');
                })
                .finally(() => {
                    btnSync.disabled = false;
                    btnSync.innerHTML = originalHTML;
                });
        }

        if (target.closest('#modal-close') || target.closest('#btn-cancel') || target === elements.modal) {
            ui.closeModal();
            if (state.redirectAfterSave) {
                const dest = state.redirectAfterSave;
                state.redirectAfterSave = null;
                window.location.href = dest;
            }
        }

        if (target.closest('#btn-back')) {
            if (state.redirectAfterSave) {
                e.preventDefault();
                const dest = state.redirectAfterSave;
                state.redirectAfterSave = null;
                window.location.href = dest;
            }
        }

        if (target.closest('#btn-prev-page')) {
            if (state.currentPage > 1) {
                state.currentPage--;
                ui.renderTable();
            }
        }

        if (target.closest('#btn-next-page')) {
            const totalClients = state.clients.length;
            const totalPages = Math.ceil(totalClients / state.itemsPerPage) || 1;
            if (state.currentPage < totalPages) {
                state.currentPage++;
                ui.renderTable();
            }
        }

        const editBtn = target.closest('[data-action="edit"]');
        if (editBtn) {
            const client = state.clients.find(c => c.id === parseInt(editBtn.dataset.id));
            if (client) ui.openModal(client);
        }

        const deleteBtn = target.closest('[data-action="delete"]');
        if (deleteBtn) api.deleteClient(deleteBtn.dataset.id);
    });

    // Máscaras em tempo real
    elements.inputPhone.addEventListener('input', (e) => {
        e.target.value = window.utils.masks.phone(e.target.value);
    });
    elements.inputCEP.addEventListener('input', (e) => {
        e.target.value = window.utils.masks.cep(e.target.value);
    });

    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = {
            name:    elements.inputName.value,
            birth:   elements.inputBirth.value,
            phone:   elements.inputPhone.value.replace(/[^\d+]/g, ""), // Limpa mas mantém o + se for internacional
            cep:     elements.inputCEP.value,
            address: elements.inputAddress.value,
            number:  elements.inputNumber.value,
            notes:   null, // O campo de observações foi removido
            source:  state.isWhatsAppSource ? 'whatsapp' : 'manual'
        };
        api.saveClient(payload);
    });

    if (elements.paginationLimit) {
        elements.paginationLimit.addEventListener('change', () => {
            state.currentPage = 1;
            ui.renderTable();
        });
    }

    // --- Initialization ---
    const init = async () => {
        console.log('🚀 Client Registration Initializing...');
        await api.fetchClients();

        // Check for pending CRM sync from Chat (puxa sozinho e traz preenchido de forma robusta)
        const pendingSync = localStorage.getItem('botarena_pending_sync');
        if (pendingSync) {
            try {
                const data = JSON.parse(pendingSync);
                
                // Limpa telefones para comparação robusta (somente números) utilizando a mesma máscara do input
                const cleanPhone = (p) => p ? p.replace(/[^\d]/g, '') : '';
                const cleanPrefillPhone = cleanPhone(window.utils.masks.phone(data.phone));
                
                const existingClient = state.clients.find(c => cleanPhone(c.phone) === cleanPrefillPhone);

                if (existingClient) {
                    ui.openModal(existingClient);
                } else {
                    ui.openModal(null, data);
                }
                
                state.redirectAfterSave = 'atendimento.html';
            } catch (e) {
                console.error('Error parsing pending sync:', e);
            }
            localStorage.removeItem('botarena_pending_sync');
        }
    };

    init();

})();
