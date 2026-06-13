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
        resultsCounter:     document.getElementById('results-counter'),
        // Excel
        excelToggle:        document.getElementById('btn-excel-toggle'),
        excelMenu:          document.getElementById('excel-menu'),
        btnExport:          document.getElementById('btn-export-excel'),
        btnImport:          document.getElementById('btn-import-excel'),
        fileInput:          document.getElementById('excel-file-input'),
        importOverlay:      document.getElementById('import-modal-overlay'),
        importPreviewBody:  document.getElementById('import-preview-body'),
        importSummary:      document.getElementById('import-summary'),
        importConfirm:      document.getElementById('import-modal-confirm'),
        importConfirmLabel: document.getElementById('import-confirm-label'),
        importClose:        document.getElementById('import-modal-close'),
        importCancel:       document.getElementById('import-modal-cancel')
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
    //  Excel: Export + Import
    // ─────────────────────────────────────────────
    const excel = {
        // Mapeamento de cabeçalho flexível para colunas do Excel
        COL_MAP: {
            // Nome
            nome: 'name', name: 'name', cliente: 'name',
            // Telefone
            telefone: 'phone', phone: 'phone', celular: 'phone', whatsapp: 'phone', contato: 'phone',
            // Nascimento
            nascimento: 'birth', 'data de nascimento': 'birth', birth: 'birth', 'data nascimento': 'birth',
            // CEP
            cep: 'cep', 'código postal': 'cep', 'cod postal': 'cep',
            // Bairro
            bairro: 'neighborhood', região: 'neighborhood', regiao: 'neighborhood', neighborhood: 'neighborhood', 'bairro / região': 'neighborhood',
            // Endereço
            'endereço': 'address', endereco: 'address', rua: 'address', logradouro: 'address', address: 'address', 'endereço / rua': 'address',
            // Origem
            contato: 'source', origem: 'source', source: 'source', tipo: 'source'
        },

        /**
         * Exporta os clientes filtrados para um arquivo .xlsx
         * Respeita os filtros ativos na tela
         */
        exportFiltered: () => {
            const data = state.filtered.length > 0 ? state.filtered : state.clients;

            if (data.length === 0) {
                alert('Nenhum cliente para exportar.');
                return;
            }

            const rows = data.map(c => ({
                'Nome':             c.name         || '',
                'Telefone':         c.phone        || '',
                'Nascimento':       c.birth_date   || '',
                'Contato':          c.source === 'whatsapp' ? 'WhatsApp' : 'Manual',
                'Bairro / Região': c.neighborhood || '',
                'Endereço / Rua':  c.address      || '',
                'CEP':              c.zip_code     || ''
            }));

            const ws  = XLSX.utils.json_to_sheet(rows);
            const wb  = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

            // Largura das colunas
            ws['!cols'] = [30, 18, 14, 12, 22, 28, 12].map(w => ({ wch: w }));

            const filename = `clientes_${new Date().toISOString().slice(0,10)}.xlsx`;
            XLSX.writeFile(wb, filename);
            console.log(`✅ [Export] ${rows.length} clientes exportados para ${filename}`);
        },

        /**
         * Lê o arquivo Excel e mapeia para o formato interno.
         * Detecta cabeçalho automaticamente (case-insensitive, sem acento).
         */
        readFile: (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                        const ws   = wb.Sheets[wb.SheetNames[0]];
                        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

                        const normalize = (str) =>
                            String(str).toLowerCase()
                                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                                .trim();

                        const mapped = rows.map(row => {
                            const out = {};
                            Object.keys(row).forEach(col => {
                                const key = excel.COL_MAP[normalize(col)];
                                if (key) out[key] = String(row[col]).trim();
                            });
                            return out;
                        }).filter(r => Object.keys(r).length > 0);

                        resolve(mapped);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        },

        /**
         * Exibe o modal de preview de importação.
         * Detecta duplicatas localmente (por telefone) antes de enviar.
         */
        showPreview: (rows) => {
            // Normaliza telefones existentes para comparação rápida
            const existingPhones = new Set(
                state.clients.map(c => (c.phone || '').replace(/[^\d]/g, ''))
            );

            let newCount = 0, dupCount = 0, errCount = 0;

            const annotated = rows.map(row => {
                const phone = (row.phone || '').replace(/[^\d+]/g, '');
                if (!phone) {
                    errCount++;
                    return { ...row, _status: 'err' };
                }
                const cleanPhone = phone.replace(/[^\d]/g, '');
                if (existingPhones.has(cleanPhone)) {
                    dupCount++;
                    return { ...row, _status: 'dup' };
                }
                newCount++;
                return { ...row, _status: 'new' };
            });

            // Atualiza summary pills
            elements.importSummary.innerHTML = `
                <span class="import-pill import-pill--total">
                    <i class="fa-solid fa-list"></i> ${rows.length} linhas
                </span>
                <span class="import-pill import-pill--new">
                    <i class="fa-solid fa-plus-circle"></i> ${newCount} novos
                </span>
                <span class="import-pill import-pill--dup">
                    <i class="fa-solid fa-copy"></i> ${dupCount} duplicados
                </span>
                ${errCount > 0 ? `<span class="import-pill import-pill--error">
                    <i class="fa-solid fa-triangle-exclamation"></i> ${errCount} com erro
                </span>` : ''}
            `;

            // Preenche tabela de preview
            elements.importPreviewBody.innerHTML = annotated.map(r => `
                <tr class="${r._status !== 'new' ? r._status : ''}">
                    <td>
                        <span class="status-badge status-badge--${r._status}">
                            ${r._status === 'new' ? 'Novo' : r._status === 'dup' ? 'Duplicado' : 'Erro'}
                        </span>
                    </td>
                    <td>${r.name || '---'}</td>
                    <td>${r.phone || '<em>ausente</em>'}</td>
                    <td>${r.cep || '---'}</td>
                    <td>${r.neighborhood || '---'}</td>
                    <td>${r.address || '---'}</td>
                </tr>
            `).join('');

            // Configura botão de confirmar
            elements.importConfirmLabel.textContent = `Importar ${newCount} novo${newCount !== 1 ? 's' : ''}`;
            elements.importConfirm.disabled = newCount === 0;

            // Salva linhas para uso no confirm
            elements.importConfirm._pendingRows = annotated.filter(r => r._status === 'new');

            // Abre modal
            elements.importOverlay.classList.add('active');
        },

        closePreview: () => {
            elements.importOverlay.classList.remove('active');
            elements.fileInput.value = ''; // permite re-selecionar o mesmo arquivo
        },

        /**
         * Envia os registros novos para a API e atualiza a lista
         */
        confirmImport: async () => {
            const rows = elements.importConfirm._pendingRows || [];
            if (rows.length === 0) return;

            elements.importConfirm.disabled = true;
            elements.importConfirmLabel.textContent = 'Importando...';
            elements.importConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importando...';

            try {
                const res = await window.utils.apiFetch('/clients/import', {
                    method: 'POST',
                    body: JSON.stringify({ clients: rows })
                });

                excel.closePreview();
                await api.fetchClients();

                const msg = [
                    `✅ Importação concluída!`,
                    `• Inseridos: ${res.inserted}`,
                    `• Ignorados (duplicados): ${res.skipped}`,
                    res.errors && res.errors.length > 0 ? `• Erros: ${res.errors.length}` : ''
                ].filter(Boolean).join('\n');

                alert(msg);
            } catch (err) {
                console.error('❌ [Import] Erro:', err);
                alert('Erro ao importar. Verifique o console.');
                elements.importConfirm.disabled = false;
                elements.importConfirmLabel.textContent = `Tentar novamente`;
            }
        }
    };

    // ─ Toggle menu Excel ─
    if (elements.excelToggle) {
        elements.excelToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.excelMenu.classList.toggle('open');
            // Fecha dropdowns de filtro
            dropdowns.closeAll();
        });
    }

    // ─ Fechar menu Excel ao clicar fora ─
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.excel-dropdown')) {
            if (elements.excelMenu) elements.excelMenu.classList.remove('open');
        }
    });

    // ─ Exportar ─
    if (elements.btnExport) {
        elements.btnExport.addEventListener('click', () => {
            elements.excelMenu.classList.remove('open');
            excel.exportFiltered();
        });
    }

    // ─ Importar: abre seletor de arquivo ─
    if (elements.btnImport) {
        elements.btnImport.addEventListener('click', () => {
            elements.excelMenu.classList.remove('open');
            elements.fileInput.click();
        });
    }

    // ─ Arquivo selecionado ─
    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const rows = await excel.readFile(file);
                if (rows.length === 0) {
                    alert('Nenhuma linha encontrada no arquivo. Verifique o formato.');
                    return;
                }
                excel.showPreview(rows);
            } catch (err) {
                console.error('❌ [Import] Erro ao ler arquivo:', err);
                alert('Erro ao ler o arquivo Excel. Verifique se é um .xlsx ou .xls válido.');
            }
        });
    }

    // ─ Fechar modal de import ─
    [elements.importClose, elements.importCancel].forEach(btn => {
        if (btn) btn.addEventListener('click', excel.closePreview);
    });

    // ─ Confirmar importação ─
    if (elements.importConfirm) {
        elements.importConfirm.addEventListener('click', excel.confirmImport);
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
