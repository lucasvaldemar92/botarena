// ==========================================
// 👤 USERS APP — Gestão de Acesso
// ==========================================
// Handles all CRUD operations for the users-management.html fragment.
// Communicates with /api/users (admin-only routes).
// Relies on apiFetch() defined in the parent fragment.

(function UsersApp() {
    'use strict';

    // ── STATE ────────────────────────────────────────
    let _users     = [];
    let _editingId = null;

    // ── PROFILE DESCRIPTIONS ─────────────────────────
    const PROFILE_HINTS = {
        basico:  { icon: 'fa-user',  text: 'Acesso operacional básico: configurações, clientes, cardápio, pedidos e taxas de entrega.' },
        premium: { icon: 'fa-star',  text: 'Acesso ampliado: todos os módulos básicos + módulos premium (em breve).' },
        admin:   { icon: 'fa-crown', text: 'Acesso total: inclui gestão de usuários, configurações críticas e todas as funcionalidades.' }
    };

    // ── DOM REFS ─────────────────────────────────────
    const D = {
        tableWrapper:  () => document.getElementById('users-table-wrapper'),
        statTotal:     () => document.getElementById('stat-total'),
        statAdmin:     () => document.getElementById('stat-admin'),
        statPremium:   () => document.getElementById('stat-premium'),
        statBasico:    () => document.getElementById('stat-basico'),
        modal:         () => document.getElementById('modal-user'),
        modalTitleTxt: () => document.getElementById('modal-title-text'),
        inputName:     () => document.getElementById('input-name'),
        inputEmail:    () => document.getElementById('input-email'),
        inputPassword: () => document.getElementById('input-password'),
        inputRole:     () => document.getElementById('input-role'),
        profileHint:   () => document.getElementById('profile-hint'),
        pwdHint:       () => document.getElementById('password-hint'),
        pwdRequiredLbl:() => document.getElementById('password-required-label'),
        btnSave:       () => document.getElementById('btn-modal-save'),
        toastContainer:() => document.getElementById('toast-container'),
        btnRefresh:    () => document.getElementById('btn-refresh-users'),
        btnNewUser:    () => document.getElementById('btn-new-user'),
    };

    // ── TOAST ─────────────────────────────────────────
    function showToast(message, type = 'success') {
        const container = D.toastContainer();
        if (!container) return;

        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        const el   = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
        container.appendChild(el);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => el.classList.add('visible'));
        });

        // Animate out after 3.5s
        setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 400);
        }, 3500);
    }

    // ── STATS ─────────────────────────────────────────
    function updateStats(users) {
        const total   = users.length;
        const admin   = users.filter(u => u.role === 'admin').length;
        const premium = users.filter(u => u.role === 'premium').length;
        const basico  = users.filter(u => u.role === 'basico').length;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('stat-total',   total);
        set('stat-admin',   admin);
        set('stat-premium', premium);
        set('stat-basico',  basico);
    }

    // ── AVATAR INITIALS ───────────────────────────────
    function getInitials(name) {
        const parts = (name || '?').trim().split(' ');
        return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
    }

    // ── ROLE BADGE ────────────────────────────────────
    function roleBadge(role) {
        const map = {
            admin:   ['badge-role--admin',   'fa-crown', 'Admin'],
            premium: ['badge-role--premium', 'fa-star',  'Premium'],
            basico:  ['badge-role--basico',  'fa-user',  'Básico']
        };
        const [cls, icon, label] = map[role] || ['badge-role--basico', 'fa-user', role];
        return `<span class="badge-role ${cls}"><i class="fa-solid ${icon}"></i>${label}</span>`;
    }

    // ── STATUS BADGE ──────────────────────────────────
    function statusBadge(isActive) {
        return isActive
            ? `<span class="badge-status badge-status--active">Ativo</span>`
            : `<span class="badge-status badge-status--inactive">Inativo</span>`;
    }

    // ── RENDER TABLE ──────────────────────────────────
    function renderTable(users) {
        const wrapper = D.tableWrapper();
        if (!wrapper) return;

        if (!users || users.length === 0) {
            wrapper.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-users-slash"></i>
                    <p>Nenhum usuário cadastrado ainda.<br>Clique em <strong>Novo Usuário</strong> para começar.</p>
                </div>`;
            return;
        }

        const rows = users.map(u => `
            <tr data-id="${u.id}">
                <td>
                    <div class="user-cell">
                        <div class="avatar" style="background: ${avatarGradient(u.name)}">${getInitials(u.name)}</div>
                        <div class="user-cell__info">
                            <span>${escHtml(u.name)}</span>
                            <small>${escHtml(u.email)}</small>
                        </div>
                    </div>
                </td>
                <td>${roleBadge(u.role)}</td>
                <td>${statusBadge(u.is_active)}</td>
                <td style="color:var(--text-muted);font-size:0.82rem">
                    ${u.last_login_at ? fmtDate(u.last_login_at) : '—'}
                </td>
                <td>
                    <div class="actions-cell">
                        <button class="btn btn--ghost btn--sm" data-action="edit" data-id="${u.id}" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn--ghost btn--sm" data-action="toggle" data-id="${u.id}"
                            title="${u.is_active ? 'Desativar' : 'Ativar'}" style="color:${u.is_active ? '#f59e0b' : '#10b981'}">
                            <i class="fa-solid ${u.is_active ? 'fa-ban' : 'fa-circle-check'}"></i>
                        </button>
                        <button class="btn btn--danger btn--sm" data-action="delete" data-id="${u.id}" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        wrapper.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Usuário</th>
                        <th>Perfil</th>
                        <th>Status</th>
                        <th>Último Acesso</th>
                        <th style="text-align:right">Ações</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    // ── HELPERS ───────────────────────────────────────
    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function fmtDate(dt) {
        return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }

    function avatarGradient(name) {
        const colors = [
            'linear-gradient(135deg,#667eea,#764ba2)',
            'linear-gradient(135deg,#f093fb,#f5576c)',
            'linear-gradient(135deg,#4facfe,#00f2fe)',
            'linear-gradient(135deg,#43e97b,#38f9d7)',
            'linear-gradient(135deg,#fa709a,#fee140)',
            'linear-gradient(135deg,#a18cd1,#fbc2eb)',
            'linear-gradient(135deg,#fccb90,#d57eeb)',
        ];
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) hash += (name || '').charCodeAt(i);
        return colors[hash % colors.length];
    }

    // ── LOAD USERS ────────────────────────────────────
    async function loadUsers() {
        const wrapper = D.tableWrapper();
        if (wrapper) wrapper.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

        try {
            _users = await apiFetch('/users');
            updateStats(_users);
            renderTable(_users);
        } catch (err) {
            const msg = err.status === 403
                ? 'Acesso negado. Apenas administradores podem ver usuários.'
                : `Erro ao carregar usuários: ${err.message}`;
            if (wrapper) {
                wrapper.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i><p>${msg}</p></div>`;
            }
            showToast(msg, 'error');
        }
    }

    // ── MODAL ─────────────────────────────────────────
    function openModal(user = null) {
        _editingId = user ? user.id : null;

        const titleEl = D.modalTitleTxt();
        if (titleEl) titleEl.textContent = user ? 'Editar Usuário' : 'Novo Usuário';

        const nameEl  = D.inputName();
        const emailEl = D.inputEmail();
        const passEl  = D.inputPassword();
        const roleEl  = D.inputRole();
        const pwdHint = D.pwdHint();
        const pwdLbl  = D.pwdRequiredLbl();

        if (user) {
            if (nameEl)  nameEl.value  = user.name  || '';
            if (emailEl) emailEl.value = user.email || '';
            if (roleEl)  roleEl.value  = user.role  || 'basico';
            if (passEl)  passEl.value  = '';
            if (pwdHint) pwdHint.textContent = 'Deixe em branco para não alterar a senha.';
            if (pwdLbl)  pwdLbl.textContent  = '(opcional)';
        } else {
            if (nameEl)  nameEl.value  = '';
            if (emailEl) emailEl.value = '';
            if (passEl)  passEl.value  = '';
            if (roleEl)  roleEl.value  = '';
            if (pwdHint) pwdHint.textContent = '';
            if (pwdLbl)  pwdLbl.textContent  = '(obrigatória)';
        }

        updateProfileHint(user?.role || '');
        D.modal()?.classList.add('open');
        setTimeout(() => D.inputName()?.focus(), 100);
    }

    function closeModal() {
        D.modal()?.classList.remove('open');
        _editingId = null;
    }

    // ── PROFILE HINT ─────────────────────────────────
    function updateProfileHint(role) {
        const hintEl = D.profileHint();
        if (!hintEl) return;

        const info = PROFILE_HINTS[role];
        if (!info) {
            hintEl.style.display = 'none';
            return;
        }

        hintEl.className = `profile-hint profile-hint--${role}`;
        hintEl.innerHTML = `<i class="fa-solid ${info.icon}"></i><span>${info.text}</span>`;
        hintEl.style.display = 'flex';
    }

    // ── SAVE USER ─────────────────────────────────────
    async function saveUser() {
        const name     = D.inputName()?.value.trim();
        const email    = D.inputEmail()?.value.trim();
        const password = D.inputPassword()?.value;
        const role     = D.inputRole()?.value;
        const btnSave  = D.btnSave();

        if (!name || !email || !role) {
            showToast('Preencha todos os campos obrigatórios.', 'error');
            return;
        }
        if (!_editingId && !password) {
            showToast('A senha é obrigatória para novos usuários.', 'error');
            return;
        }

        const originalHtml = btnSave?.innerHTML;
        if (btnSave) { btnSave.innerHTML = '<div class="spinner"></div> Salvando...'; btnSave.disabled = true; }

        try {
            if (_editingId) {
                // Update existing
                const body = { name, role };
                if (password) body.password = password;
                await apiFetch(`/users/${_editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(body)
                });
                showToast('Usuário atualizado com sucesso!');
            } else {
                // Create new
                await apiFetch('/users', {
                    method: 'POST',
                    body: JSON.stringify({ name, email, password, role })
                });
                showToast('Usuário criado com sucesso!');
            }
            closeModal();
            await loadUsers();
        } catch (err) {
            const msg = err.status === 409 ? 'E-mail já cadastrado para outro usuário.' : `Erro: ${err.message}`;
            showToast(msg, 'error');
        } finally {
            if (btnSave) { btnSave.innerHTML = originalHtml; btnSave.disabled = false; }
        }
    }

    // ── TOGGLE ACTIVE ────────────────────────────────
    async function toggleUser(id) {
        try {
            await apiFetch(`/users/${id}/toggle`, { method: 'PATCH', body: '{}' });
            await loadUsers();
            showToast('Status do usuário atualizado.');
        } catch (err) {
            showToast(`Erro: ${err.message}`, 'error');
        }
    }

    // ── DELETE USER ───────────────────────────────────
    async function deleteUser(id) {
        const user = _users.find(u => u.id === id);
        const name = user?.name || `usuário #${id}`;
        if (!confirm(`Tem certeza que deseja excluir ${name}? Esta ação não pode ser desfeita.`)) return;

        try {
            await apiFetch(`/users/${id}`, { method: 'DELETE' });
            showToast(`Usuário ${name} excluído.`);
            await loadUsers();
        } catch (err) {
            showToast(`Erro ao excluir: ${err.message}`, 'error');
        }
    }

    // ── BIND EVENTS ───────────────────────────────────
    function bindEvents() {
        // New user button
        document.getElementById('btn-new-user')?.addEventListener('click', () => openModal());

        // Refresh button
        document.getElementById('btn-refresh-users')?.addEventListener('click', loadUsers);

        // Modal close buttons
        document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
        document.getElementById('btn-modal-cancel')?.addEventListener('click', closeModal);

        // Close on backdrop click
        document.getElementById('modal-user')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-user')) closeModal();
        });

        // Save button
        document.getElementById('btn-modal-save')?.addEventListener('click', saveUser);

        // Profile select → update hint
        document.getElementById('input-role')?.addEventListener('change', (e) => {
            updateProfileHint(e.target.value);
        });

        // Table action delegation (edit / toggle / delete)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const id     = parseInt(btn.dataset.id);

            if (action === 'edit') {
                const user = _users.find(u => u.id === id);
                if (user) openModal(user);
            }
            if (action === 'toggle') toggleUser(id);
            if (action === 'delete') deleteUser(id);
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // ── INIT ──────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        bindEvents();
        loadUsers();
    });

})();
