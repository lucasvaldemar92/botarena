/**
 * 👤 BotArena - Client Registration Logic
 * Feature: Busca em tempo real + Filtros multi-select (Contato, Bairro, Endereço, CEP)
 * Compliance: IIFE Isolation
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
        inputNeighborhood:  document.getElementById('client-neighborhood'),
        tableBody:          document.getElementById('clients-table-body'),
        clientCount:        document.getElementById('client-count'),
        paginationControls: document.getElementById('pagination-controls'),
        paginationInfo:     document.getElementById('pagination-info'),
        paginationLimit:    document.getElementById('pagination-limit'),
        btnPrevPage:        document.getElementById('btn-prev-page'),
        btnNextPage:        document.getElementById('btn-next-page'),
        currentPageNum:     document.getElementById('current-page-num'),
        // Filtros
        searchInput:        document.getElementById('client-search'),
        activeTagsRow:      document.getElementById('active-tags-row'),
        activeTags:         document.getElementById('active-tags'),
        resultsCounter:     document.getElementById('results-counter')
    };

    // --- State Management ---
    const state = {
        isWhatsAppSource: false,
        editingId: null,
        clients: [],      // Todos os clientes da API
        filtered: [],     // Resultado após aplicar filtros
        socket: null,
        redirectAfterSave: null,
        currentPage: 1,
        itemsPerPage: 10,
        // Filtros ativos
        searchQuery: '',
        activeFilters: {
            source:       new Set(),  // 'manual' | 'whatsapp'
            neighborhood: new Set(),
            address:      new Set(),
            zip:          new Set()
        }
    };

    // ─────────────────────────────────────────────
    //  API Calls
    // ─────────────────────────────────────────────
    const api = {
        fetchClients: async () => {
            try {
                const response = await window.utils.apiFetch('/clients');
                state.clients = response;
                filters.apply(); // buildDropdownOptions é chamado internamente
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

    // ─────────────────────────────────────────────
    //  Filter Engine
    // ─────────────────────────────────────────────
    const filters = {
        /**
         * Filtra state.clients aplicando TODOS os critérios, opcionalmente
         * excluindo um filtro específico (usado para calcular opções contextuais).
         *
         * @param {string|null} excludeFilterKey  - chave a ignorar ('neighborhood'|'address'|'zip'|'source'|null)
         * @returns {Array} clientes correspondentes
         */
        _applySubset: (excludeFilterKey = null) => {
            const q = state.searchQuery.toLowerCase().trim();
            const { source, neighborhood, address, zip } = state.activeFilters;

            return state.clients.filter(c => {
                // Busca textual
                if (q) {
                    const haystack = [
                        c.name, c.phone, c.address, c.neighborhood,
                        c.zip_code, c.birth_date, c.source
                    ].map(v => (v || '').toLowerCase()).join(' ');
                    if (!haystack.includes(q)) return false;
                }

                // Contato
                if (excludeFilterKey !== 'source' && source.size > 0) {
                    const clientSource = (c.source || 'manual').toLowerCase();
                    if (!source.has(clientSource)) return false;
                }

                // Bairro
                if (excludeFilterKey !== 'neighborhood' && neighborhood.size > 0) {
                    if (!neighborhood.has((c.neighborhood || '').trim())) return false;
                }

                // Endereço
                if (excludeFilterKey !== 'address' && address.size > 0) {
                    if (!address.has((c.address || '').trim())) return false;
                }

                // CEP
                if (excludeFilterKey !== 'zip' && zip.size > 0) {
                    if (!zip.has((c.zip_code || '').trim())) return false;
                }

                return true;
            });
        },

        /**
         * Reconstrói as opções dos dropdowns de forma contextual:
         * cada dropdown só exibe valores presentes nos clientes filtrados
         * pelos DEMAIS filtros ativos (excluindo ele mesmo).
         */
        buildDropdownOptions: () => {
            // Para cada filtro dinâmico, calcula os valores disponíveis
            // ignorando o filtro do próprio dropdown
            const contexts = {
                source:       filters._applySubset('source'),
                neighborhood: filters._applySubset('neighborhood'),
                address:      filters._applySubset('address'),
                zip:          filters._applySubset('zip')
            };

            const build = (dropdownId, filterKey, clientsSubset, getValue) => {
                const dropdown = document.getElementById(`filter-dropdown-${dropdownId}`);
                if (!dropdown) return;

                const unique = new Set();
                clientsSubset.forEach(c => {
                    const val = getValue(c);
                    if (val && val !== '---') unique.add(val.trim());
                });

                const sorted = [...unique].sort((a, b) => a.localeCompare(b, 'pt-BR'));

                if (sorted.length === 0) {
                    dropdown.innerHTML = `<div class="filter-dropdown__empty">Nenhum dado disponível</div>`;
                    return;
                }

                dropdown.innerHTML = sorted.map(val => {
                    const isChecked = state.activeFilters[filterKey].has(val);
                    return `
                        <label class="filter-dropdown__item">
                            <input type="checkbox" value="${val}" data-filter="${filterKey}"
                                ${isChecked ? 'checked' : ''}>
                            ${val}
                        </label>`;
                }).join('');
            };

            // Contato: fixo (só Manual e WhatsApp), mas respeita contexto dos outros filtros
            (() => {
                const dd = document.getElementById('filter-dropdown-source');
                if (!dd) return;
                const available = new Set(contexts.source.map(c => (c.source || 'manual').toLowerCase()));
                const items = [
                    { value: 'manual',    label: 'Manual' },
                    { value: 'whatsapp',  label: 'WhatsApp' }
                ].filter(item => available.has(item.value));

                if (items.length === 0) {
                    dd.innerHTML = `<div class="filter-dropdown__empty">Nenhum dado disponível</div>`;
                    return;
                }
                dd.innerHTML = items.map(item => `
                    <label class="filter-dropdown__item">
                        <input type="checkbox" value="${item.value}" data-filter="source"
                            ${state.activeFilters.source.has(item.value) ? 'checked' : ''}>
                        ${item.label}
                    </label>`).join('');
            })();

            build('neighborhood', 'neighborhood', contexts.neighborhood, c => c.neighborhood);
            build('address',      'address',      contexts.address,      c => c.address);
            build('zip',          'zip',          contexts.zip,          c => c.zip_code);
        },

        /**
         * Aplica todos os filtros ativos sobre state.clients
         * e chama renderTable com o resultado
         */
        apply: () => {
            // Resultado completo (todos os filtros aplicados)
            state.filtered = filters._applySubset(null);

            // Recalcula opções contextuais dos dropdowns
            filters.buildDropdownOptions();

            // Reset paginação ao filtrar
            state.currentPage = 1;
            filters.updateUI();
            ui.renderTable();
        },

        /**
         * Atualiza contadores dos botões e tags ativas
         */
        updateUI: () => {
            const hasAnyFilter = state.searchQuery.trim() !== '' ||
                Object.values(state.activeFilters).some(s => s.size > 0);

            // Atualiza cada botão de filtro
            const filterDefs = [
                { key: 'source',       id: 'source',       labelMap: { manual: 'Manual', whatsapp: 'WhatsApp' } },
                { key: 'neighborhood', id: 'neighborhood',  labelMap: null },
                { key: 'address',      id: 'address',       labelMap: null },
                { key: 'zip',          id: 'zip',           labelMap: null }
            ];

            filterDefs.forEach(({ key, id }) => {
                const btn   = document.getElementById(`filter-btn-${id}`);
                const count = document.getElementById(`filter-count-${id}`);
                const size  = state.activeFilters[key].size;

                if (!btn || !count) return;

                if (size > 0) {
                    btn.classList.add('active');
                    count.style.display = 'inline';
                    count.textContent = size;
                } else {
                    btn.classList.remove('active');
                    count.style.display = 'none';
                }
            });

            // Monta tags ativas
            if (elements.activeTags) {
                const tags = [];

                filterDefs.forEach(({ key, id, labelMap }) => {
                    state.activeFilters[key].forEach(val => {
                        const label = labelMap ? (labelMap[val] || val) : val;
                        tags.push(`
                            <span class="filter-tag">
                                ${label}
                                <button class="filter-tag__remove"
                                    data-remove-filter="${key}"
                                    data-remove-value="${val}"
                                    title="Remover filtro">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </span>
                        `);
                    });
                });

                elements.activeTags.innerHTML = tags.join('');
            }

            // Linha de tags + contador
            if (elements.activeTagsRow) {
                elements.activeTagsRow.style.display = hasAnyFilter ? 'flex' : 'none';
                elements.activeTagsRow.style.gap = '0.5rem';
                elements.activeTagsRow.style.alignItems = 'center';
                elements.activeTagsRow.style.flexWrap = 'wrap';
            }

            if (elements.resultsCounter) {
                if (hasAnyFilter) {
                    const total = state.clients.length;
                    const found = state.filtered.length;
                    elements.resultsCounter.innerHTML =
                        `<strong>${found}</strong> de ${total} cliente${total !== 1 ? 's' : ''}`;
                } else {
                    elements.resultsCounter.textContent = '';
                }
            }
        },

        /**
         * Remove um valor de um filtro e reaplica
         */
        removeValue: (filterKey, value) => {
            state.activeFilters[filterKey].delete(value);
            // Atualiza checkbox correspondente
            const checkbox = document.querySelector(
                `input[type="checkbox"][data-filter="${filterKey}"][value="${value}"]`
            );
            if (checkbox) checkbox.checked = false;
            filters.apply();
        }
    };

    // ─────────────────────────────────────────────
    //  Dropdown Toggle Logic
    // ─────────────────────────────────────────────
    const dropdowns = {
        closeAll: () => {
            document.querySelectorAll('.filter-btn.open').forEach(btn => btn.classList.remove('open'));
            document.querySelectorAll('.filter-dropdown.open').forEach(dd => dd.classList.remove('open'));
        },
        toggle: (filterKey) => {
            const btn      = document.getElementById(`filter-btn-${filterKey}`);
            const dropdown = document.getElementById(`filter-dropdown-${filterKey}`);
            if (!btn || !dropdown) return;

            const isOpen = btn.classList.contains('open');
            dropdowns.closeAll();

            if (!isOpen) {
                btn.classList.add('open');
                dropdown.classList.add('open');
            }
        }
    };

    // ─────────────────────────────────────────────
    //  UI Rendering
    // ─────────────────────────────────────────────
    const ui = {
        openModal: (client = null, prefillData = null) => {
            state.editingId = client ? client.id : null;

            const doOpen = () => {
                elements.modal.classList.add('active');
                if (client) {
                    elements.modalTitle.textContent = 'Editar Cliente';
                    elements.btnSubmit.textContent = 'Salvar Alterações';
                    elements.inputName.value    = client.name || '';
                    elements.inputBirth.value   = client.birth_date || '';
                    elements.inputPhone.value   = window.utils.masks.phone(client.phone || '');
                    elements.inputCEP.value     = window.utils.masks.cep(client.zip_code || '');
                    elements.inputAddress.value = client.address || '';
                    elements.inputNeighborhood.value = client.neighborhood || '';
                    ui.setSource(client.source === 'whatsapp');
                } else {
                    elements.modalTitle.textContent = 'Cadastro de Cliente';
                    elements.btnSubmit.textContent = 'Salvar Cliente';
                    elements.form.reset();
                    if (elements.inputNeighborhood) elements.inputNeighborhood.value = '';

                    if (prefillData) {
                        elements.inputName.value = prefillData.name || '';
                        elements.inputPhone.value = window.utils.masks.phone(prefillData.phone || '');
                        ui.setSource(true);
                    } else {
                        ui.setSource(false);
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
            const dataToRender = state.filtered;
            const totalFiltered = dataToRender.length;
            const totalAll = state.clients.length;

            // Atualiza contador do header
            elements.clientCount.innerText = `${totalAll} cadastrados`;

            // Estado vazio
            if (totalAll === 0) {
                elements.tableBody.innerHTML = `
                    <tr><td colspan="8" class="empty-state">Nenhum cliente cadastrado.</td></tr>
                `;
                if (elements.paginationControls) elements.paginationControls.style.display = 'none';
                return;
            }

            // Nenhum resultado nos filtros
            if (totalFiltered === 0) {
                elements.tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state--filter">
                            <i class="fa-solid fa-filter-circle-xmark"></i>
                            <p>Nenhum cliente encontrado com os filtros aplicados.</p>
                            <span>Tente remover algum filtro ou alterar a busca.</span>
                        </td>
                    </tr>
                `;
                if (elements.paginationControls) elements.paginationControls.style.display = 'none';
                return;
            }

            // Paginação sobre dados filtrados
            if (elements.paginationControls) {
                if (totalFiltered <= 10) {
                    elements.paginationControls.style.display = 'none';
                    state.itemsPerPage = totalFiltered;
                    state.currentPage = 1;
                } else {
                    elements.paginationControls.style.display = 'flex';

                    if (elements.paginationLimit) {
                        const previousValue = elements.paginationLimit.value;
                        const defaultLimits = [10, 25, 50];
                        const availableLimits = defaultLimits.filter(limit => limit < totalFiltered);

                        let optionsHTML = '';
                        availableLimits.forEach(limit => {
                            optionsHTML += `<option value="${limit}">${limit} por página</option>`;
                        });
                        optionsHTML += `<option value="all">Ver todos</option>`;

                        elements.paginationLimit.innerHTML = optionsHTML;

                        const hasPrevious = Array.from(elements.paginationLimit.options)
                            .some(opt => opt.value === previousValue);
                        elements.paginationLimit.value = hasPrevious ? previousValue : '10';
                    }
                }
            }

            const limitVal = elements.paginationLimit ? elements.paginationLimit.value : '10';
            state.itemsPerPage = limitVal === 'all' ? totalFiltered : parseInt(limitVal, 10);

            const totalPages = Math.ceil(totalFiltered / state.itemsPerPage) || 1;
            if (state.currentPage > totalPages) state.currentPage = totalPages;
            if (state.currentPage < 1)          state.currentPage = 1;

            const start = (state.currentPage - 1) * state.itemsPerPage;
            const end   = start + state.itemsPerPage;
            const paginated = dataToRender.slice(start, end);

            elements.tableBody.innerHTML = paginated.map(client => `
                <tr data-id="${client.id}" data-testid="client-row-${client.id}">
                    <td>${client.name || '---'}</td>
                    <td>${client.birth_date || '---'}</td>
                    <td>${client.phone || '---'}</td>
                    <td>
                        <span class="source-badge ${client.source === 'whatsapp' ? 'source-badge--whatsapp' : 'source-badge--manual'}" style="margin-bottom:0">
                            ${client.source === 'whatsapp' ? '[WhatsApp]' : '[Manual]'}
                        </span>
                    </td>
                    <td>${client.neighborhood || '---'}</td>
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

            // Atualiza controles de paginação
            if (elements.paginationControls && totalFiltered > 10) {
                const showFrom = start + 1;
                const showTo   = Math.min(end, totalFiltered);

                if (elements.paginationInfo) {
                    elements.paginationInfo.textContent =
                        `Mostrando ${showFrom}-${showTo} de ${totalFiltered} clientes`;
                }
                if (elements.currentPageNum) elements.currentPageNum.textContent = state.currentPage;
                if (elements.btnPrevPage)    elements.btnPrevPage.disabled = state.currentPage === 1;
                if (elements.btnNextPage)    elements.btnNextPage.disabled = state.currentPage === totalPages;
            }
        }
    };

    // ─────────────────────────────────────────────
    //  Event Listeners
    // ─────────────────────────────────────────────

    // Busca em tempo real
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            filters.apply();
        });
    }

    // Cliques globais
    document.addEventListener('click', (e) => {
        const target = e.target;

        // ─ Botão novo cliente ─
        if (target.closest('#btn-new-client')) {
            ui.openModal();
        }

        // ─ Sincronizar ─
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
                    alert(err.message || 'Erro ao sincronizar contatos do WhatsApp.');
                })
                .finally(() => {
                    btnSync.disabled = false;
                    btnSync.innerHTML = originalHTML;
                });
        }

        // ─ Fechar modal ─
        if (target.closest('#modal-close') || target.closest('#btn-cancel') || target === elements.modal) {
            ui.closeModal();
            if (state.redirectAfterSave) {
                const dest = state.redirectAfterSave;
                state.redirectAfterSave = null;
                window.location.href = dest;
            }
        }

        // ─ Botão voltar ─
        if (target.closest('#btn-back')) {
            if (state.redirectAfterSave) {
                e.preventDefault();
                const dest = state.redirectAfterSave;
                state.redirectAfterSave = null;
                window.location.href = dest;
            }
        }

        // ─ Paginação ─
        if (target.closest('#btn-prev-page')) {
            if (state.currentPage > 1) {
                state.currentPage--;
                ui.renderTable();
            }
        }
        if (target.closest('#btn-next-page')) {
            const totalPages = Math.ceil(state.filtered.length / state.itemsPerPage) || 1;
            if (state.currentPage < totalPages) {
                state.currentPage++;
                ui.renderTable();
            }
        }

        // ─ Editar cliente ─
        const editBtn = target.closest('[data-action="edit"]');
        if (editBtn) {
            const client = state.clients.find(c => c.id === parseInt(editBtn.dataset.id));
            if (client) ui.openModal(client);
        }

        // ─ Excluir cliente ─
        const deleteBtn = target.closest('[data-action="delete"]');
        if (deleteBtn) api.deleteClient(deleteBtn.dataset.id);

        // ─ Toggle dropdown de filtro (clique no botão pai) ─
        const filterBtnEl = target.closest('.filter-btn');
        if (filterBtnEl && !target.closest('.filter-dropdown') && !target.closest('input[type="checkbox"]')) {
            const filterKey = filterBtnEl.dataset.filter;
            if (filterKey) {
                dropdowns.toggle(filterKey);
                return;
            }
        }

        // ─ Fechar dropdowns ao clicar fora ─
        if (!target.closest('.filter-btn')) {
            dropdowns.closeAll();
        }

        // ─ Remover tag de filtro ─
        const removeBtn = target.closest('[data-remove-filter]');
        if (removeBtn) {
            filters.removeValue(removeBtn.dataset.removeFilter, removeBtn.dataset.removeValue);
        }
    });

    // Checkboxes dos filtros (delegado no document)
    document.addEventListener('change', (e) => {
        const cb = e.target;
        if (cb.type !== 'checkbox' || !cb.dataset.filter) return;

        const filterKey = cb.dataset.filter;
        const value     = cb.value;

        if (cb.checked) {
            state.activeFilters[filterKey].add(value);
        } else {
            state.activeFilters[filterKey].delete(value);
        }

        filters.apply();
    });

    // Máscaras em tempo real
    elements.inputPhone.addEventListener('input', (e) => {
        e.target.value = window.utils.masks.phone(e.target.value);
    });

    elements.inputCEP.addEventListener('input', async (e) => {
        const value = e.target.value;
        e.target.value = window.utils.masks.cep(value);

        const cep = value.replace(/\D/g, '');
        if (cep.length === 8) {
            try {
                const ragRes = await window.utils.apiFetch(`/rag/lookup-address?query=${cep}`);
                if (ragRes && ragRes.success && ragRes.results.length > 0) {
                    const match = ragRes.results[0];
                    console.log('⚡ [RAG Lookup] CEP encontrado no RAG local. Bypass ViaCEP.');
                    if (elements.inputNeighborhood && match.bairro) {
                        elements.inputNeighborhood.value = match.bairro;
                    }
                    if (elements.inputAddress && match.rua) {
                        elements.inputAddress.value = match.rua;
                    }
                    return;
                }
            } catch (err) {
                console.warn('Erro ao buscar CEP no RAG:', err);
            }

            try {
                const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && !data.erro) {
                        if (elements.inputNeighborhood && data.bairro) {
                            elements.inputNeighborhood.value = data.bairro;
                        }
                        if (elements.inputAddress && data.logradouro) {
                            elements.inputAddress.value = data.logradouro;
                        }
                    }
                }
            } catch (err) {
                console.error('Erro ao autocompletar CEP:', err);
            }
        }
    });

    // Formulário de salvar
    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = {
            name:         elements.inputName.value,
            birth:        elements.inputBirth.value,
            phone:        elements.inputPhone.value.replace(/[^\d+]/g, ''),
            cep:          elements.inputCEP.value,
            neighborhood: elements.inputNeighborhood.value,
            address:      elements.inputAddress.value,
            notes:        null,
            source:       state.isWhatsAppSource ? 'whatsapp' : 'manual'
        };
        api.saveClient(payload);
    });

    // Trocar limite por página
    if (elements.paginationLimit) {
        elements.paginationLimit.addEventListener('change', () => {
            state.currentPage = 1;
            ui.renderTable();
        });
    }

    // ─────────────────────────────────────────────
    //  Initialization
    // ─────────────────────────────────────────────
    const init = async () => {
        console.log('🚀 Client Registration Initializing (com filtros)...');
        await api.fetchClients();

        // Pending CRM sync do Chat
        const pendingSync = localStorage.getItem('botarena_pending_sync');
        if (pendingSync) {
            try {
                const data = JSON.parse(pendingSync);
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
