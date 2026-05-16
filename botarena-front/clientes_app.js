/**
 * 👤 BotArena - Client Registration Logic
 * Compliance: dynamic-dom-frontend.md, IIFE Isolation
 */
(function() {
    'use strict';

    // --- DOM Elements ---
    const elements = {
        modal:         document.getElementById('modal-registration'),
        modalTitle:    document.querySelector('#modal-registration h2'),
        btnNew:        document.getElementById('btn-new-client'),
        btnClose:      document.getElementById('modal-close'),
        btnCancel:     document.getElementById('btn-cancel'),
        btnSubmit:     document.querySelector('#form-client button[type="submit"]'),
        form:          document.getElementById('form-client'),
        sourceBadge:   document.getElementById('client-source-badge'),
        inputName:     document.getElementById('client-name'),
        inputBirth:    document.getElementById('client-birth'),
        inputPhone:    document.getElementById('client-phone'),
        inputCEP:      document.getElementById('client-cep'),
        inputAddress:  document.getElementById('client-address'),
        inputNotes:    document.getElementById('client-notes'),
        tableBody:     document.getElementById('clients-table-body'),
        clientCount:   document.getElementById('client-count')
    };

    // --- State Management ---
    const state = {
        isWhatsAppSource: false,
        editingId: null,   // null = novo cadastro, number = editando
        clients: [],
        socket: null
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
        openModal: (client = null) => {
            state.editingId = client ? client.id : null;
            elements.modal.classList.add('active');

            if (client) {
                // Modo edição: pré-preenche campos
                elements.modalTitle.textContent = 'Editar Cliente';
                elements.btnSubmit.textContent = 'Salvar Alterações';
                elements.inputName.value    = client.name || '';
                elements.inputBirth.value   = client.birth_date || '';
                elements.inputPhone.value   = window.utils.masks.phone(client.phone || '');
                elements.inputCEP.value     = window.utils.masks.cep(client.zip_code || '');
                elements.inputAddress.value = client.address || '';
                elements.inputNotes.value   = client.notes || '';
                ui.setSource(client.source === 'whatsapp');
            } else {
                // Modo criação
                elements.modalTitle.textContent = 'Cadastro de Cliente';
                elements.btnSubmit.textContent = 'Salvar Cliente';
                elements.form.reset();
                ui.setSource(false);
            }
        },
        closeModal: () => {
            elements.modal.classList.remove('active');
            elements.form.reset();
            state.editingId = null;
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
            elements.clientCount.innerText = `${state.clients.length} cadastrados`;

            if (state.clients.length === 0) {
                elements.tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state">Nenhum cliente cadastrado.</td>
                    </tr>
                `;
                return;
            }

            elements.tableBody.innerHTML = state.clients.map(client => `
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
        }
    };

    // --- Event Listeners (Event Delegation) ---
    document.addEventListener('click', (e) => {
        const target = e.target;

        if (target.closest('#btn-new-client')) ui.openModal();
        if (target.closest('#modal-close') || target.closest('#btn-cancel') || target === elements.modal) ui.closeModal();

        const editBtn = target.closest('[data-action="edit"]');
        if (editBtn) {
            const client = state.clients.find(c => c.id === parseInt(editBtn.dataset.id));
            if (client) ui.openModal(client);
        }

        const deleteBtn = target.closest('[data-action="delete"]');
        if (deleteBtn) api.deleteClient(deleteBtn.dataset.id);
    });

    // Mascaras em tempo real
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
            notes:   elements.inputNotes.value,
            source:  state.isWhatsAppSource ? 'whatsapp' : 'manual'
        };
        api.saveClient(payload);
    });

    // --- Initialization ---
    const init = async () => {
        console.log('🚀 Client Registration Initializing...');
        await api.fetchClients();

        const token = localStorage.getItem('botarena-token');
        if (token) {
            state.socket = io({ auth: { token } });

            state.socket.on('whatsapp_contact_sync', (data) => {
                if (elements.modal.classList.contains('active')) {
                    if (data.name) {
                        elements.inputName.value = data.name;
                        elements.inputName.classList.add('sync-flash');
                        setTimeout(() => elements.inputName.classList.remove('sync-flash'), 1000);
                    }
                    if (data.phone) {
                        elements.inputPhone.value = window.utils.masks.phone(data.phone);
                        elements.inputPhone.classList.add('sync-flash');
                        setTimeout(() => elements.inputPhone.classList.remove('sync-flash'), 1000);
                    }
                    ui.setSource(true);
                }
            });

            state.socket.on('connect', () => console.log('📡 [Socket] Connected for client sync.'));
        }

        // Check for pending CRM sync from Chat
        const pendingSync = localStorage.getItem('botarena_pending_sync');
        if (pendingSync) {
            try {
                const data = JSON.parse(pendingSync);
                ui.openModal();
                // We need a tiny delay to allow the modal to render before flashing
                setTimeout(() => {
                    if (window.syncFromWhatsApp) window.syncFromWhatsApp(data);
                }, 100);
            } catch (e) {
                console.error('Error parsing pending sync:', e);
            }
            localStorage.removeItem('botarena_pending_sync');
        }
    };

    init();

    // Hook global para sync externo
    window.syncFromWhatsApp = (data) => {
        if (elements.modal.classList.contains('active')) {
            if (data.name) {
                elements.inputName.value = data.name;
                elements.inputName.classList.add('sync-flash');
                setTimeout(() => elements.inputName.classList.remove('sync-flash'), 1000);
            }
            if (data.phone) {
                elements.inputPhone.value = window.utils.masks.phone(data.phone);
                elements.inputPhone.classList.add('sync-flash');
                setTimeout(() => elements.inputPhone.classList.remove('sync-flash'), 1000);
            }
            ui.setSource(true);
        }
    };

})();
