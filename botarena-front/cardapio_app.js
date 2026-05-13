// ==========================================
// 🍽️ CARDÁPIO APP — CRUD LOCAL + API READY
// ==========================================

// Estado em memória
let items = [];
let editingId = null;

// ── DOM ──
const emptyState  = document.getElementById('empty-state');
const itemListEl  = document.getElementById('item-list');
const itemCount   = document.getElementById('item-count');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle  = document.getElementById('modal-title');
const modalSave   = document.getElementById('modal-save');
const modalCancel = document.getElementById('modal-cancel');
const modalClose  = document.getElementById('modal-close');
const toast       = document.getElementById('toast');
const toastMsg    = document.getElementById('toast-msg');
const toastIcon   = toast.querySelector('i');

// ── TOAST ──
let toastTimer;
function showToast(msg, type = 'success') {
    toastMsg.textContent = msg;
    toast.className = `toast toast--${type} show`;
    toastIcon.className = type === 'success'
        ? 'fa-solid fa-circle-check'
        : 'fa-solid fa-trash-can';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ── MODAL ──
function openModal(item = null) {
    editingId = item ? item.id : null;
    modalTitle.textContent = item ? 'Editar item' : 'Novo item';

    document.getElementById('item-name').value      = item?.name      || '';
    document.getElementById('item-category').value  = item?.category  || '';
    document.getElementById('item-price').value     = item?.price     || '';
    document.getElementById('item-desc').value      = item?.desc      || '';
    document.getElementById('item-available').checked = item ? item.available : true;
    document.getElementById('item-edit-id').value   = item?.id        || '';

    modalOverlay.classList.add('active');
    document.getElementById('item-name').focus();
}

function closeModal() {
    modalOverlay.classList.remove('active');
    editingId = null;
}

document.getElementById('btn-novo-item').onclick = () => openModal();
modalClose.onclick  = closeModal;
modalCancel.onclick = closeModal;
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// ── FORMAT PRICE ──
const priceInput = document.getElementById('item-price');
priceInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (!v) { e.target.value = ''; return; }
    v = (parseInt(v) / 100).toFixed(2);
    e.target.value = v.replace('.', ',');
});

// ── RENDER ──
function renderItems() {
    const count = items.length;
    itemCount.textContent = `${count} ${count === 1 ? 'item cadastrado' : 'itens cadastrado(s)'}`;

    if (count === 0) {
        emptyState.style.display = 'flex';
        itemListEl.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    itemListEl.style.display = 'flex';
    itemListEl.innerHTML = '';

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.dataset.id = item.id;

        const priceFormatted = item.price
            ? `R$ ${item.price}`
            : '—';

        div.innerHTML = `
            <div class="item-card__info">
                <div class="item-card__category">${item.category || 'Sem categoria'}</div>
                <div class="item-card__name">${item.name}</div>
                ${item.desc ? `<div class="item-card__desc">${item.desc}</div>` : ''}
            </div>
            <div class="item-card__right">
                <span class="item-card__price">${priceFormatted}</span>
                <span class="item-card__badge ${item.available ? 'item-card__badge--on' : 'item-card__badge--off'}">
                    ${item.available ? 'Disponível' : 'Indisponível'}
                </span>
                <div class="item-card__actions">
                    <button class="icon-btn" title="Editar" data-action="edit" data-id="${item.id}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="icon-btn icon-btn--danger" title="Excluir" data-action="delete" data-id="${item.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        itemListEl.appendChild(div);
    });
}

// ── DELEGATED EVENTS NA LISTA ──
itemListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id     = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'edit') {
        const item = items.find(i => i.id === id);
        if (item) openModal(item);
    }

    if (action === 'delete') {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        items = items.filter(i => i.id !== id);
        renderItems();
        showToast('Item excluído.', 'delete');
        syncToBackend();
    }
});

// ── SALVAR ──
modalSave.addEventListener('click', () => {
    const name      = document.getElementById('item-name').value.trim();
    const category  = document.getElementById('item-category').value.trim();
    const price     = document.getElementById('item-price').value.trim();
    const desc      = document.getElementById('item-desc').value.trim();
    const available = document.getElementById('item-available').checked;

    if (!name) {
        document.getElementById('item-name').focus();
        document.getElementById('item-name').style.borderColor = '#ef4444';
        setTimeout(() => document.getElementById('item-name').style.borderColor = '', 1500);
        return;
    }

    if (editingId) {
        const idx = items.findIndex(i => i.id === editingId);
        if (idx !== -1) items[idx] = { ...items[idx], name, category, price, desc, available };
        showToast('Item atualizado!');
    } else {
        items.push({
            id: crypto.randomUUID(),
            name, category, price, desc, available,
            createdAt: new Date().toISOString()
        });
        showToast('Item adicionado!');
    }

    closeModal();
    renderItems();
    syncToBackend();
});

// ── SYNC AO BACKEND (api/menu-items) ──
async function syncToBackend() {
    if (!window.BASE_URL) return;
    try {
        await fetch(`${window.BASE_URL}/api/menu-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
    } catch (e) {
        // Backend pode não ter esta rota ainda — falha silenciosa
    }
}

// ── CARREGA DO BACKEND ──
async function loadFromBackend() {
    if (!window.BASE_URL) { renderItems(); return; }
    try {
        const res = await fetch(`${window.BASE_URL}/api/menu-items`);
        if (res.ok) {
            const data = await res.json();
            items = Array.isArray(data.items) ? data.items : [];
        }
    } catch (e) {
        items = [];
    }
    renderItems();
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    loadFromBackend();
});
