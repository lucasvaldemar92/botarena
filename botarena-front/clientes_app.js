/**
 * 👤 BotArena - Client Registration Logic (Step 2 - Integration)
 * Compliance: dynamic-dom-frontend.md, IIFE Isolation
 */
(function() {
    'use strict';

    // --- DOM Elements ---
    const elements = {
        modal:         document.getElementById('modal-registration'),
        btnNew:        document.getElementById('btn-new-client'),
        btnClose:       document.getElementById('modal-close'),
        btnCancel:      document.getElementById('btn-cancel'),
        form:          document.getElementById('form-client'),
        sourceBadge:    document.getElementById('client-source-badge'),
        inputName:      document.getElementById('client-name'),
        inputBirth:     document.getElementById('client-birth'),
        inputPhone:     document.getElementById('client-phone'),
        inputCEP:       document.getElementById('client-cep'),
        inputAddress:   document.getElementById('client-address'),
        inputNotes:     document.getElementById('client-notes'),
        tableBody:      document.getElementById('clients-table-body'),
        clientCount:    document.getElementById('client-count')
    };

    // --- State Management ---
    const state = {
        isWhatsAppSource: false,
        clients: []
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
                const response = await window.utils.apiFetch('/clients', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (response.success) {
                    await api.fetchClients();
                    ui.closeModal();
                }
            } catch (err) {
                console.error('❌ Error saving client:', err);
                alert('Erro ao salvar cliente. Verifique o console.');
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
        openModal: () => {
            elements.modal.classList.add('active');
            ui.setSource(false);
        },
        closeModal: () => {
            elements.modal.classList.remove('active');
            elements.form.reset();
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
                <tr data-id="${client.id}">
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
                    <td>
                        <button class="btn-delete" style="background:none; border:none; color:#ef4444; cursor:pointer;" data-action="delete" data-id="${client.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    };

    // --- Event Listeners ---
    document.addEventListener('click', (e) => {
        const target = e.target;

        if (target.closest('#btn-new-client')) ui.openModal();
        if (target.closest('#modal-close') || target.closest('#btn-cancel') || target === elements.modal) ui.closeModal();
        
        // Delete action
        const deleteBtn = target.closest('[data-action="delete"]');
        if (deleteBtn) {
            api.deleteClient(deleteBtn.dataset.id);
        }
    });

    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = {
            name: elements.inputName.value,
            birth: elements.inputBirth.value,
            phone: elements.inputPhone.value,
            cep: elements.inputCEP.value,
            address: elements.inputAddress.value,
            notes: elements.inputNotes.value,
            source: state.isWhatsAppSource ? 'whatsapp' : 'manual'
        };
        api.saveClient(payload);
    });

    // --- Initialization ---
    const init = async () => {
        console.log('🚀 Client Registration Initializing...');
        await api.fetchClients();
    };

    init();

    // Hook for WhatsApp Sync
    window.syncFromWhatsApp = (data) => {
        if (elements.modal.classList.contains('active')) {
            if (data.name) elements.inputName.value = data.name;
            if (data.phone) elements.inputPhone.value = data.phone;
            ui.setSource(true);
        }
    };

})();
