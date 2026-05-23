// ==========================================
// 🍽️ CARDÁPIO APP — CRUD LOCAL + API READY
// ==========================================

// Estado em memória
let items = [];
let categories = [];
let editingId = null;
let editingCategoryId = null;
let currentTabCategory = null;

// ── DOM ──
const emptyState   = document.getElementById('empty-state');
const itemListEl   = document.getElementById('item-list');
const itemCount    = document.getElementById('item-count');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle   = document.getElementById('modal-title');
const modalSave    = document.getElementById('modal-save');
const modalCancel  = document.getElementById('modal-cancel');
const modalClose   = document.getElementById('modal-close');

// Modal Categoria
const modalCatOverlay = document.getElementById('modal-category-overlay');
const modalCatTitle   = document.getElementById('modal-category-title');
const modalCatSave    = document.getElementById('modal-category-save');
const modalCatCancel  = document.getElementById('modal-category-cancel');
const modalCatClose   = document.getElementById('modal-category-close');

const toast        = document.getElementById('toast');
const toastMsg     = document.getElementById('toast-msg');
const toastIcon    = toast.querySelector('i');

// ── TOAST ──
let toastTimer;
function showToast(msg, type = 'success') {
    toastMsg.textContent = msg;
    toast.className = 'toast toast--' + type + ' show';
    toastIcon.className = type === 'success'
        ? 'fa-solid fa-circle-check'
        : 'fa-solid fa-trash-can';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3200);
}

// ── ATUALIZAR SELECT DE CATEGORIAS ──
function updateCategorySelect() {
    var select = document.getElementById('item-category');
    var currentVal = select.value;
    
    // Coleta categorias explicitas + categorias ad-hoc já nos itens
    var allCatNames = categories.map(function(c) { return c.name; });
    items.forEach(function(i) {
        if (i.category && !allCatNames.includes(i.category)) {
            allCatNames.push(i.category);
        }
    });
    
    select.innerHTML = '';
    
    if (allCatNames.length === 0) {
        select.innerHTML = '<option value="">Sem categoria</option>';
    }

    allCatNames.forEach(function(name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    
    var separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    select.appendChild(separator);
    
    var newCatOpt = document.createElement('option');
    newCatOpt.value = '__NEW_CATEGORY__';
    newCatOpt.textContent = '+ Nova categoria';
    newCatOpt.style.fontWeight = 'bold';
    select.appendChild(newCatOpt);
    
    if (currentVal && allCatNames.includes(currentVal)) {
        select.value = currentVal;
    }
}

document.getElementById('item-category').addEventListener('change', function(e) {
    if (e.target.value === '__NEW_CATEGORY__') {
        e.target.value = ''; // Reseta para caso o usuário cancele
        openCategoryModal();
    }
});

// ── MODAL CATEGORIA ──
function openCategoryModal(cat) {
    cat = cat || null;
    editingCategoryId = cat ? cat.id : null;
    modalCatTitle.textContent = cat ? 'Editar Categoria' : 'Nova Categoria';

    document.getElementById('category-name').value = cat ? cat.name : '';
    document.getElementById('category-edit-id').value = cat ? cat.id : '';

    modalCatOverlay.classList.add('active');
    document.getElementById('category-name').focus();
}

function closeCategoryModal() {
    modalCatOverlay.classList.remove('active');
    editingCategoryId = null;
}

document.getElementById('btn-nova-categoria').onclick = function() { openCategoryModal(); };
modalCatClose.onclick = closeCategoryModal;
modalCatCancel.onclick = closeCategoryModal;
modalCatOverlay.addEventListener('click', function(e) {
    if (e.target === modalCatOverlay) closeCategoryModal();
});

modalCatSave.addEventListener('click', function() {
    var name = document.getElementById('category-name').value.trim();

    if (!name) {
        var nameInput = document.getElementById('category-name');
        nameInput.focus();
        nameInput.style.borderColor = '#ef4444';
        nameInput.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.15)';
        setTimeout(function() {
            nameInput.style.borderColor = '';
            nameInput.style.boxShadow   = '';
        }, 1600);
        return;
    }

    modalCatOverlay.classList.remove('active');
    
    if (editingCategoryId) {
        var idx = categories.findIndex(function(c) { return c.id === editingCategoryId; });
        if (idx !== -1) {
            var oldName = categories[idx].name;
            categories[idx].name = name;
            // Atualiza o nome da categoria nos itens se ela for editada
            items.forEach(function(i) {
                if (i.category === oldName) i.category = name;
            });
        }
        showToast('Categoria atualizada!');
    } else {
        var newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString();
        categories.push({ id: newId, name: name });
        showToast('Categoria adicionada!');
    }

    editingCategoryId = null;
    updateCategorySelect();
    
    // Auto-seleciona a categoria que acabou de ser criada (se o modal de item estiver aberto)
    if (modalOverlay.classList.contains('active')) {
        document.getElementById('item-category').value = name;
    }
    
    renderItems();
});

// ── MODAL ITEM ──
function openModal(item) {
    item = item || null;
    editingId = item ? item.id : null;
    modalTitle.textContent = item ? 'Editar item' : 'Novo item';
    
    updateCategorySelect();

    document.getElementById('item-name').value        = item && item.name      ? item.name      : '';
    document.getElementById('item-codigo-pdv').value  = item && item.codigo_pdv? item.codigo_pdv: '';
    document.getElementById('item-category').value    = item && item.category  ? item.category  : '';
    document.getElementById('item-price').value       = item && item.price     ? item.price     : '';
    
    var descText = '';
    var adIds = [];
    if (item && item.desc) {
        var parts = item.desc.split(' ||| ');
        descText = parts[0] || '';
        if (parts[1]) {
            try {
                var meta = JSON.parse(parts[1]);
                if (meta.adicionalIds) adIds = meta.adicionalIds;
            } catch (e) {
                console.warn('Falha ao processar metadados de adicionais:', e);
            }
        }
    }
    document.getElementById('item-desc').value        = descText;
    document.getElementById('item-available').checked = item ? item.available : true;
    document.getElementById('item-edit-id').value     = item && item.id        ? item.id        : '';

    if (window.cardapioAdicionaisManager) {
        window.cardapioAdicionaisManager.setSelected(adIds);
    }

    modalOverlay.classList.add('active');
    document.getElementById('item-name').focus();
}

function closeModal() {
    modalOverlay.classList.remove('active');
    editingId = null;
    if (window.cardapioAdicionaisManager) {
        window.cardapioAdicionaisManager.clear();
    }
}

document.getElementById('btn-novo-item').onclick = function() { openModal(); };
modalClose.onclick  = closeModal;
modalCancel.onclick = closeModal;
modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) closeModal();
});

// ── FORMAT PRICE ──
var priceInput = document.getElementById('item-price');
priceInput.addEventListener('input', function(e) {
    var v = e.target.value.replace(/\D/g, '');
    if (!v) { e.target.value = ''; return; }
    v = (parseInt(v) / 100).toFixed(2);
    e.target.value = v.replace('.', ',');
});

// ── RENDER (agrupado por categoria com ABAS) ──
function renderItems() {
    var count = items.length;
    itemCount.textContent = count + ' ' + (count === 1 ? 'item cadastrado' : 'itens cadastrado(s)');

    if (count === 0) {
        emptyState.style.display = 'flex';
        itemListEl.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    itemListEl.style.display = 'flex';
    itemListEl.innerHTML = '';

    // Agrupa por categoria
    var groups = {};
    items.forEach(function(item) {
        var cat = (item.category && item.category.trim()) ? item.category.trim() : 'Geral';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
    });

    var groupNames = Object.keys(groups);
    if (!currentTabCategory || !groups[currentTabCategory]) {
        currentTabCategory = groupNames[0];
    }

    // Criar container de tabs e panes
    var tabsNav = document.createElement('nav');
    tabsNav.className = 'cd-subtabs';
    
    var panesContainer = document.createElement('div');
    panesContainer.className = 'cd-panes-container';

    groupNames.forEach(function(catName) {
        var catItems = groups[catName];
        var catObj = categories.find(function(c) { return c.name === catName; });
        var isCatAvailable = catObj && catObj.available !== undefined ? catObj.available : true;
        
        var isActive = (catName === currentTabCategory);

        // 1. Criar a Aba (Tab)
        var tabBtn = document.createElement('button');
        tabBtn.className = 'cd-subtab' + (isActive ? ' active' : '');
        if (!isCatAvailable) tabBtn.style.opacity = '0.6';
        
        // Switch de Categoria (dentro da aba, ao lado do nome)
        var toggleHTML = 
            '<label class="switch switch--small" title="Ativar/Desativar Categoria" style="margin-left: 0.5rem;" onclick="event.stopPropagation()">' +
                '<input type="checkbox" class="category-toggle" data-cat="' + catName + '" ' + (isCatAvailable ? 'checked' : '') + '>' +
                '<span class="slider"></span>' +
            '</label>';

        tabBtn.innerHTML = catName + 
                           '<span style="background: #e2e8f0; color: var(--text-muted); padding: 0.1rem 0.5rem; border-radius: 100px; font-size: 0.75rem; margin-left: 0.5rem;">' + catItems.length + '</span>' + 
                           toggleHTML;
        
        tabBtn.addEventListener('click', function(e) {
            if (e.target.closest('.switch')) return;
            currentTabCategory = catName;
            renderItems();
        });
        
        tabsNav.appendChild(tabBtn);

        // 2. Criar o Painel (Pane) da Categoria
        var paneEl = document.createElement('div');
        paneEl.className = 'cd-pane' + (isActive ? ' active' : '');
        
        var tableWrapperOuter = document.createElement('div');
        tableWrapperOuter.className = 'category-group__table-wrapper';
        
        var tableWrapperInner = document.createElement('div');
        tableWrapperInner.className = 'table-responsive-wrapper';
        
        var tableHTML = '<table class="category-table">' +
            '<thead>' +
                '<tr>' +
                    '<th style="width:10%;">Cód. PDV</th>' +
                    '<th style="width:20%;">Nome</th>' +
                    '<th style="width:30%;">Descrição</th>' +
                    '<th style="width:15%;">Preço</th>' +
                    '<th style="width:10%;">Disponível</th>' +
                    '<th style="width:15%; text-align:right;">Ações</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>';

        catItems.forEach(function(item, index) {
            var totalPreco = parseFloat(item.price) || 0;
            var descParts = (item.desc || '').split(' ||| ');
            var displayDesc = descParts[0] || '';
            
            if (descParts[1] && window.cardapioAdicionaisManager && typeof window.cardapioAdicionaisManager.getAvailableAdicionais === 'function') {
                try {
                    var meta = JSON.parse(descParts[1]);
                    if (meta.adicionalIds && meta.adicionalIds.length > 0) {
                        var available = window.cardapioAdicionaisManager.getAvailableAdicionais();
                        var vinculados = available.filter(function(ad) {
                            return meta.adicionalIds.includes(ad.id) || meta.adicionalIds.includes(String(ad.id));
                        });
                        var somaAdicionais = vinculados.reduce(function(sum, ad) {
                            return sum + (parseFloat(ad.preco) || 0);
                        }, 0);
                        totalPreco += somaAdicionais;
                    }
                } catch (e) {
                    console.warn('Falha ao calcular soma de adicionais no cardápio:', e);
                }
            }
            
            var priceFormatted = totalPreco ? 'R$ ' + totalPreco.toFixed(2) : (item.price ? 'R$ ' + parseFloat(item.price).toFixed(2) : '—');
            var badgeClass = item.available ? 'item-card__badge--on' : 'item-card__badge--off';
            var badgeText = item.available ? 'Sim' : 'Não';
            
            var rowClass = 'item-row';
            
            tableHTML += '<tr class="' + rowClass + '" data-id="' + item.id + '">' +
                '<td><span class="item-codigo-pdv" style="font-weight: 600; color: var(--color-primary);">' + (item.codigo_pdv || '—') + '</span></td>' +
                '<td><span class="item-name">' + item.name + '</span></td>' +
                '<td><span class="item-desc">' + displayDesc + '</span></td>' +
                '<td><span class="item-price">' + priceFormatted + '</span></td>' +
                '<td><button class="item-card__badge ' + badgeClass + '" data-action="toggle-item" data-id="' + item.id + '" style="border:none; cursor:pointer; font-family:inherit;" title="Clique para alterar">' + badgeText + '</button></td>' +
                '<td style="text-align:right;">' +
                    '<div class="item-card__actions" style="justify-content: flex-end;">' +
                        '<button class="icon-btn" title="Editar" data-action="edit" data-id="' + item.id + '">' +
                            '<i class="fa-solid fa-pen-to-square"></i>' +
                        '</button>' +
                        '<button class="icon-btn icon-btn--danger" title="Excluir" data-action="delete" data-id="' + item.id + '">' +
                            '<i class="fa-solid fa-trash"></i>' +
                        '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        });

        tableHTML += '</tbody></table>';
        tableWrapperInner.innerHTML = tableHTML;
        tableWrapperOuter.appendChild(tableWrapperInner);
        
        paneEl.appendChild(tableWrapperOuter);
        panesContainer.appendChild(paneEl);
    });

    itemListEl.appendChild(tabsNav);
    itemListEl.appendChild(panesContainer);
}

// ── DELEGATED EVENTS NA LISTA ──
itemListEl.addEventListener('change', function(e) {
    if (e.target.classList.contains('category-toggle')) {
        var catName = e.target.dataset.cat;
        var isAvailable = e.target.checked;
        
        // Procura categoria ou cria se não existir
        var catObj = categories.find(function(c) { return c.name === catName; });
        if (catObj) {
            catObj.available = isAvailable;
        } else {
            var newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString();
            categories.push({ id: newId, name: catName, available: isAvailable });
        }
        
        renderItems();
        showToast('Status da categoria atualizado!');
        syncToBackend();
    }
});

itemListEl.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;

    var action = btn.dataset.action;
    var id     = btn.dataset.id;
    var item   = items.find(function(i) { return i.id === id; });

    if (!item) return;

    if (action === 'toggle-item') {
        item.available = !item.available;
        renderItems();
        showToast('Status do item atualizado!');
        syncToBackend();
    } else if (action === 'edit') {
        if (item) openModal(item);
    } else if (action === 'delete') {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        items = items.filter(function(i) { return i.id !== id; });
        renderItems();
        showToast('Item excluído.', 'delete');
        syncToBackend();
    }
});

// ── SALVAR ──
modalSave.addEventListener('click', function() {
    var name      = document.getElementById('item-name').value.trim();
    var codigo_pdv= document.getElementById('item-codigo-pdv').value.trim();
    var category  = document.getElementById('item-category').value.trim();
    var price     = document.getElementById('item-price').value.trim();
    var descText  = document.getElementById('item-desc').value.trim();
    var available = document.getElementById('item-available').checked;

    // Validação: nome obrigatório
    if (!name) {
        var nameInput = document.getElementById('item-name');
        nameInput.focus();
        nameInput.style.borderColor = '#ef4444';
        nameInput.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.15)';
        setTimeout(function() {
            nameInput.style.borderColor = '';
            nameInput.style.boxShadow   = '';
        }, 1600);
        return;
    }

    // Obter adicionais selecionados
    var adIds = [];
    if (window.cardapioAdicionaisManager) {
        adIds = window.cardapioAdicionaisManager.getSelectedIds();
    }
    var desc = descText ? descText + ' ||| ' + JSON.stringify({ adicionalIds: adIds }) : ' ||| ' + JSON.stringify({ adicionalIds: adIds });

    // 1. Fecha o modal imediatamente
    modalOverlay.classList.remove('active');
    editingId = null;

    // 2. Atualiza o estado
    var editId = document.getElementById('item-edit-id').value;
    if (editId) {
        var idx = items.findIndex(function(i) { return i.id === editId; });
        if (idx !== -1) {
            items[idx] = Object.assign({}, items[idx], { name: name, codigo_pdv: codigo_pdv, category: category, price: price, desc: desc, available: available });
        }
        showToast('Item atualizado!');
    } else {
        var newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString();
        items.push({ id: newId, name: name, codigo_pdv: codigo_pdv, category: category, price: price, desc: desc, available: available, createdAt: new Date().toISOString() });
        showToast('Item adicionado!');
    }

    // 3. Re-renderiza e sincroniza
    renderItems();
    syncToBackend();
});

// ── PERSISTÊNCIA LOCAL (localStorage) ──
var STORAGE_KEY = 'botarena_cardapio_items';
var STORAGE_KEY_CATS = 'botarena_cardapio_categories';

function syncToBackend() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        localStorage.setItem(STORAGE_KEY_CATS, JSON.stringify(categories));
    } catch (e) {
        console.warn('Erro ao salvar cardápio no localStorage:', e);
    }
}

// ── CARREGA DO STORAGE LOCAL ──
async function loadFromBackend() {
    try {
        var savedItems = localStorage.getItem(STORAGE_KEY);
        var savedCats  = localStorage.getItem(STORAGE_KEY_CATS);
        items      = savedItems ? JSON.parse(savedItems) : [];
        categories = savedCats  ? JSON.parse(savedCats)  : [];
    } catch (e) {
        items = [];
        categories = [];
    }
    renderItems();
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', function() {
    loadFromBackend();
});

// ── IMPORTAÇÃO DE EXCEL ──
document.getElementById('btn-download-template').addEventListener('click', function() {
    var ws_data = [
        ["Nome do Item", "Código PDV", "Categoria", "Preço", "Descrição"],
        ["Ex: Pizza Margherita", "1001", "Pizzas", "45.00", "Molho de tomate, muçarela e manjericão"]
    ];
    var ws = XLSX.utils.aoa_to_sheet(ws_data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo_Cardapio");
    XLSX.writeFile(wb, "Modelo_Importacao_Cardapio.xlsx");
});

document.getElementById('btn-import-excel').addEventListener('click', function() {
    document.getElementById('excel-upload').click();
});

document.getElementById('excel-upload').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        
        var firstSheetName = workbook.SheetNames[0];
        var worksheet = workbook.Sheets[firstSheetName];
        
        // Converte a planilha para JSON (array de objetos)
        var json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Remove cabeçalho
        if (json.length > 0) json.shift();
        
        var count = 0;
        json.forEach(function(row) {
            // Mapeando: Nome do Item | Código PDV | Categoria | Preço | Descrição
            if (row[0] && String(row[0]).trim() !== '') {
                var name = String(row[0]).trim();
                var pdv = row[1] ? String(row[1]).trim() : '';
                var category = row[2] ? String(row[2]).trim() : '';
                var priceStr = row[3] ? String(row[3]).trim() : '';
                var desc = row[4] ? String(row[4]).trim() : '';
                
                var priceMatches = priceStr.match(/\d+([.,]\d+)?/);
                var price = priceMatches ? parseFloat(priceMatches[0].replace(',', '.')) : 0;
                
                var newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString() + Math.random();
                
                items.push({
                    id: newId,
                    name: name,
                    codigo_pdv: pdv,
                    category: category,
                    price: price.toFixed(2),
                    desc: desc,
                    available: true,
                    createdAt: new Date().toISOString()
                });
                count++;
            }
        });
        
        document.getElementById('excel-upload').value = ''; // reseta
        
        if (count > 0) {
            syncToBackend();
            renderItems();
            showToast(count + ' item(ns) importado(s) com sucesso!');
        } else {
            showToast('Nenhum item encontrado no Excel.');
        }
    };
    reader.readAsArrayBuffer(file);
});

// Camada de Gerenciamento de Vínculos de Adicionais (Autocomplete e Lookup Síncrono)
(() => {
    const localState = {
        availableAdicionais: [], // Carregado via GET /api/catalog/adicionais
        selectedAdicionaisForCurrentProduct: new Set()
    };

    const searchInput = document.getElementById('product-adicional-search');
    const resultsBox = document.getElementById('autocomplete-results-box');
    const tagsContainer = document.getElementById('product-selected-adicionais-tags');

    // 1. Mecanismo de Busca Visual e Lookup por Código do PDV
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (!query) {
                resultsBox.style.display = 'none';
                return;
            }

            // Filtra buscando por Nome OU correspondência exata do Código do PDV
            const matches = localState.availableAdicionais.filter(ad => 
                ad.nome.toLowerCase().includes(query) || 
                (ad.cod_pdv && ad.cod_pdv.toString() === query)
            );

            if (matches.length > 0) {
                resultsBox.innerHTML = matches.map(ad => `
                    <div class="autocomplete-item" data-id="${ad.id}" data-nome="${ad.nome}" data-cod="${ad.cod_pdv || ''}">
                        <strong>${ad.nome}</strong> <span style="color:#718096; font-size:12px;">(PDV: ${ad.cod_pdv || '-'})</span>
                    </div>
                `).join('');
                resultsBox.style.display = 'block';
            } else {
                resultsBox.innerHTML = `<div class="autocomplete-no-results">Nenhum adicional encontrado.</div>`;
                resultsBox.style.display = 'block';
            }
        });
        
        // Fechar autocomplete ao clicar fora
        document.addEventListener('click', (e) => {
            if (resultsBox && !searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
                resultsBox.style.display = 'none';
            }
        });
    }

    // 2. Delegação de Eventos para Seleção no Dropdown do Autocomplete
    if (resultsBox) {
        resultsBox.addEventListener('click', (e) => {
            const item = e.target.closest('.autocomplete-item');
            if (!item) return;

            addAdicionalTag({
                id: item.dataset.id,
                nome: item.dataset.nome,
                cod_pdv: item.dataset.cod
            });

            resultsBox.style.display = 'none';
            searchInput.value = '';
        });
    }

    // Vincular adicionais clicando no botão "Vincular"
    const btnVincular = document.getElementById('btn-add-adicional-to-item');
    if (btnVincular && searchInput) {
        btnVincular.addEventListener('click', () => {
            const query = searchInput.value.trim().toLowerCase();
            if (!query) return;
            
            const found = localState.availableAdicionais.find(ad => 
                ad.nome.toLowerCase() === query || 
                (ad.cod_pdv && ad.cod_pdv.toString() === query)
            );
            
            if (found) {
                addAdicionalTag({
                    id: found.id,
                    nome: found.nome,
                    cod_pdv: found.cod_pdv
                });
                resultsBox.style.display = 'none';
                searchInput.value = '';
            } else {
                const partial = localState.availableAdicionais.find(ad => 
                    ad.nome.toLowerCase().includes(query) || 
                    (ad.cod_pdv && ad.cod_pdv.toString().includes(query))
                );
                if (partial) {
                    addAdicionalTag({
                        id: partial.id,
                        nome: partial.nome,
                        cod_pdv: partial.cod_pdv
                    });
                    resultsBox.style.display = 'none';
                    searchInput.value = '';
                } else {
                    alert('Nenhum adicional correspondente encontrado.');
                }
            }
        });
    }

    // 3. Renderizador Síncrono de Tags Visuais (UX Automática)
    function addAdicionalTag(adicional) {
        // Converter ID para string para consistência no Set
        const idStr = String(adicional.id);
        if (localState.selectedAdicionaisForCurrentProduct.has(idStr)) return;

        localState.selectedAdicionaisForCurrentProduct.add(idStr);

        const span = document.createElement('span');
        span.className = 'badge-adicional-tag';
        span.dataset.id = idStr;
        span.style = "background: #EDF2F7; color: #2D3748; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; margin: 4px;";
        span.innerHTML = `
            ${adicional.nome} <span style="font-size: 11px; color: #718096;">(Cód: ${adicional.cod_pdv || '-'})</span>
            <i class="fa-solid fa-xmark remove-tag-btn" style="cursor:pointer; color:#E53E3E;"></i>
        `;

        tagsContainer.appendChild(span);
    }

    // 4. Delegação para Remoção de Vínculo na Tag (Botão X)
    if (tagsContainer) {
        tagsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-tag-btn')) {
                const tag = e.target.closest('.badge-adicional-tag');
                localState.selectedAdicionaisForCurrentProduct.delete(String(tag.dataset.id));
                tag.remove();
            }
        });
    }

    // Carregar adicionais do banco
    async function loadAvailableAdicionais() {
        try {
            if (window.utils && window.utils.apiFetch) {
                const data = await window.utils.apiFetch('/catalog/adicionais');
                localState.availableAdicionais = data || [];
            }
        } catch (e) {
            console.error('Erro ao carregar adicionais no autocomplete:', e);
        }
    }

    // Expor globalmente para a página
    window.cardapioAdicionaisManager = {
        setSelected: (adicionalIds) => {
            localState.selectedAdicionaisForCurrentProduct.clear();
            if (tagsContainer) tagsContainer.innerHTML = '';
            
            if (adicionalIds && adicionalIds.length > 0) {
                adicionalIds.forEach(id => {
                    const ad = localState.availableAdicionais.find(x => x.id == id);
                    if (ad) {
                        addAdicionalTag(ad);
                    } else {
                        // Fallback temporário
                        addAdicionalTag({ id: id, nome: `Adicional #${id}`, cod_pdv: '' });
                    }
                });
            }
        },
        getSelectedIds: () => {
            return Array.from(localState.selectedAdicionaisForCurrentProduct).map(id => parseInt(id) || id);
        },
        clear: () => {
            localState.selectedAdicionaisForCurrentProduct.clear();
            if (tagsContainer) tagsContainer.innerHTML = '';
        },
        reload: loadAvailableAdicionais,
        getAvailableAdicionais: () => localState.availableAdicionais
    };

    // Inicializa carregamento
    loadAvailableAdicionais();
})();

