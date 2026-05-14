// ==========================================
// 🍽️ CARDÁPIO APP — CRUD LOCAL + API READY
// ==========================================

// Estado em memória
let items = [];
let categories = [];
let editingId = null;
let editingCategoryId = null;

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
    
    select.innerHTML = '<option value="">Sem categoria</option>';
    allCatNames.forEach(function(name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    
    if (currentVal && allCatNames.includes(currentVal)) {
        select.value = currentVal;
    }
}

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
    renderItems();
});

// ── MODAL ITEM ──
function openModal(item) {
    item = item || null;
    editingId = item ? item.id : null;
    modalTitle.textContent = item ? 'Editar item' : 'Novo item';
    
    updateCategorySelect();

    document.getElementById('item-name').value        = item && item.name      ? item.name      : '';
    document.getElementById('item-category').value    = item && item.category  ? item.category  : '';
    document.getElementById('item-price').value       = item && item.price     ? item.price     : '';
    document.getElementById('item-desc').value        = item && item.desc      ? item.desc      : '';
    document.getElementById('item-available').checked = item ? item.available : true;
    document.getElementById('item-edit-id').value     = item && item.id        ? item.id        : '';

    modalOverlay.classList.add('active');
    document.getElementById('item-name').focus();
}

function closeModal() {
    modalOverlay.classList.remove('active');
    editingId = null;
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

// ── RENDER (agrupado por categoria) ──
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
        var cat = (item.category && item.category.trim()) ? item.category.trim() : 'Sem categoria';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
    });

    // Renderiza cada grupo
    Object.keys(groups).forEach(function(catName) {
        var catItems = groups[catName];
        var groupEl  = document.createElement('div');
        
        // Verifica o status da categoria no array global categories
        var catObj = categories.find(function(c) { return c.name === catName; });
        var isCatAvailable = catObj && catObj.available !== undefined ? catObj.available : true;
        
        groupEl.className = 'category-group' + (isCatAvailable ? '' : ' category-group--disabled');

        // Cabeçalho do grupo
        var header = document.createElement('div');
        header.className = 'category-group__header';
        
        // Switch de Categoria
        var toggleHTML = 
            '<label class="switch switch--small" title="Ativar/Desativar Categoria">' +
                '<input type="checkbox" class="category-toggle" data-cat="' + catName + '" ' + (isCatAvailable ? 'checked' : '') + '>' +
                '<span class="slider"></span>' +
            '</label>';

        header.innerHTML =
            '<span class="category-group__title">' + catName + '</span>' +
            '<div class="category-group__header-actions" style="display: flex; align-items: center; gap: 1rem;">' +
                '<span class="category-group__count">' + catItems.length + ' item(ns)</span>' +
                toggleHTML +
            '</div>';
        
        groupEl.appendChild(header);

        // Lista de itens do grupo em formato de tabela
        var tableWrapper = document.createElement('div');
        tableWrapper.className = 'category-group__table-wrapper';
        
        var tableHTML = '<table class="category-table">' +
            '<thead>' +
                '<tr>' +
                    '<th style="width:25%;">Nome</th>' +
                    '<th style="width:35%;">Descrição</th>' +
                    '<th style="width:15%;">Preço</th>' +
                    '<th style="width:10%;">Disponível</th>' +
                    '<th style="width:15%; text-align:right;">Ações</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>';

        catItems.forEach(function(item) {
            var priceFormatted = item.price ? 'R$ ' + item.price : '—';
            var badgeClass = item.available ? 'item-card__badge--on' : 'item-card__badge--off';
            var badgeText = item.available ? 'Sim' : 'Não';
            
            tableHTML += '<tr class="item-row" data-id="' + item.id + '">' +
                '<td><span class="item-name">' + item.name + '</span></td>' +
                '<td><span class="item-desc">' + (item.desc || '') + '</span></td>' +
                '<td><span class="item-price">' + priceFormatted + '</span></td>' +
                '<td><button class="item-card__badge ' + badgeClass + '" data-action="toggle-item" data-id="' + item.id + '" style="border:none; cursor:pointer; font-family:inherit;" title="Clique para alterar">' + badgeText + '</button></td>' +
                '<td style="text-align:right;">' +
                    '<div class="item-card__actions" style="justify-content: flex-end;">' +
                        '<button class="icon-btn" title="Editar" data-action="edit" data-id="' + item.id + '">' +
                            '<i class="fa-solid fa-pen"></i>' +
                        '</button>' +
                        '<button class="icon-btn icon-btn--danger" title="Excluir" data-action="delete" data-id="' + item.id + '">' +
                            '<i class="fa-solid fa-trash"></i>' +
                        '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        });

        tableHTML += '</tbody></table>';
        tableWrapper.innerHTML = tableHTML;
        
        groupEl.appendChild(tableWrapper);
        itemListEl.appendChild(groupEl);
    });
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
    var category  = document.getElementById('item-category').value.trim();
    var price     = document.getElementById('item-price').value.trim();
    var desc      = document.getElementById('item-desc').value.trim();
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

    // 1. Fecha o modal imediatamente
    modalOverlay.classList.remove('active');
    editingId = null;

    // 2. Atualiza o estado
    var editId = document.getElementById('item-edit-id').value;
    if (editId) {
        var idx = items.findIndex(function(i) { return i.id === editId; });
        if (idx !== -1) {
            items[idx] = Object.assign({}, items[idx], { name: name, category: category, price: price, desc: desc, available: available });
        }
        showToast('Item atualizado!');
    } else {
        var newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString();
        items.push({ id: newId, name: name, category: category, price: price, desc: desc, available: available, createdAt: new Date().toISOString() });
        showToast('Item adicionado!');
    }

    // 3. Re-renderiza e sincroniza
    renderItems();
    syncToBackend();
});

// ── SYNC AO BACKEND (api/menu-items) ──
async function syncToBackend() {
    if (!window.BASE_URL) return;
    try {
        await fetch(window.BASE_URL + '/api/menu-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
        });
    } catch (e) {
        // Backend pode não ter esta rota ainda — falha silenciosa
    }
}

// ── CARREGA DO BACKEND ──
async function loadFromBackend() {
    if (!window.BASE_URL) { renderItems(); return; }
    try {
        var res = await fetch(window.BASE_URL + '/api/menu-items');
        if (res.ok) {
            var data = await res.json();
            items = Array.isArray(data.items) ? data.items : [];
        }
    } catch (e) {
        items = [];
    }
    renderItems();
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', function() {
    loadFromBackend();
});
