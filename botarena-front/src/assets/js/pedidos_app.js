document.addEventListener('DOMContentLoaded', () => {
    let ordersData = [];

    // DOM Elements
    const tbody = document.getElementById('orders-tbody');
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const totalCount = document.getElementById('orders-total-count');
    
    // Contadores
    const countNovo = document.getElementById('count-novo');
    const countPreparo = document.getElementById('count-preparo');
    const countEntrega = document.getElementById('count-entrega');
    const countEntregue = document.getElementById('count-entregue');
    
    // Print area
    const printArea = document.getElementById('print-area');

    async function loadOrders() {
        try {
            const res = await window.utils.apiFetch('/orders');
            ordersData = res;
            renderOrders();
        } catch (e) {
            console.error('Erro ao carregar pedidos:', e);
        }
    }

    function renderOrders() {
        // Filtragem
        const term = searchInput.value.toLowerCase();
        const status = statusFilter.value;

        const filtered = ordersData.filter(o => {
            const matchStatus = status === 'todos' || o.status === status;
            const matchTerm = 
                (o.numero_pedido && o.numero_pedido.toString().includes(term)) ||
                (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
                (o.customer_phone && o.customer_phone.includes(term));
            
            return matchStatus && matchTerm;
        });

        // Atualiza contadores globais (não afetados pelo filtro de busca)
        countNovo.textContent = ordersData.filter(o => o.status === 'novo').length;
        countPreparo.textContent = ordersData.filter(o => o.status === 'preparo').length;
        countEntrega.textContent = ordersData.filter(o => o.status === 'entrega').length;
        countEntregue.textContent = ordersData.filter(o => o.status === 'entregue').length;

        totalCount.textContent = `${filtered.length} pedido(s)`;

        // Renderiza Tabela
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">Nenhum pedido encontrado.</td></tr>`;
            return;
        }

        filtered.forEach(order => {
            const tr = document.createElement('tr');
            
            // Formatters
            const numPedido = order.numero_pedido ? `#${order.numero_pedido}` : `#${order.id.substring(0,4)}`;
            const totalFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total || 0);
            const taxaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.delivery_fee || 0);
            
            let badgeHtml = '';
            let iconBadge = '';
            if (order.status === 'novo') { badgeHtml = 'badge-novo'; iconBadge = '<i class="fa-solid fa-box"></i> Novo'; }
            if (order.status === 'preparo') { badgeHtml = 'badge-preparo'; iconBadge = '<i class="fa-solid fa-hat-chef"></i> Preparo'; }
            if (order.status === 'entrega') { badgeHtml = 'badge-entrega'; iconBadge = '<i class="fa-solid fa-motorcycle"></i> Entrega'; }
            if (order.status === 'entregue') { badgeHtml = 'badge-entregue'; iconBadge = '<i class="fa-regular fa-circle-check"></i> Entregue'; }

            tr.innerHTML = `
                <td>${numPedido}</td>
                <td>
                    <div class="client-info">
                        <span class="client-name">${order.customer_name || 'Cliente'}</span>
                        <span class="client-phone">${order.customer_phone || ''}</span>
                    </div>
                </td>
                <td>${order.neighborhood || 'N/A'}</td>
                <td>${order.payment_method || 'PIX'}</td>
                <td class="total-price" style="color: var(--text-muted); font-weight: 500;">${taxaFmt}</td>
                <td class="total-price">${totalFmt}</td>
                <td>
                    <span class="badge ${badgeHtml}">${iconBadge}</span>
                </td>
                <td>
                    <div class="actions" style="justify-content: flex-end;">
                        <select class="status-dropdown" data-id="${order.id}">
                            <option value="novo" ${order.status === 'novo' ? 'selected' : ''}>Novo</option>
                            <option value="preparo" ${order.status === 'preparo' ? 'selected' : ''}>Em preparo</option>
                            <option value="entrega" ${order.status === 'entrega' ? 'selected' : ''}>Saiu p/ entrega</option>
                            <option value="entregue" ${order.status === 'entregue' ? 'selected' : ''}>Entregue</option>
                        </select>
                        <button class="btn-action view-btn" data-id="${order.id}" title="Ver Detalhes">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <button class="btn-action dark print-btn" data-id="${order.id}" title="Imprimir Cupom">
                            <i class="fa-solid fa-print"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Attach events
        document.querySelectorAll('.status-dropdown').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const id = e.target.getAttribute('data-id');
                const newStatus = e.target.value;
                try {
                    await window.utils.apiFetch(`/orders/${id}/status`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: newStatus })
                    });
                    // O Socket.io vai avisar o frontend pra recarregar, mas otimista:
                    const o = ordersData.find(x => x.id === id);
                    if (o) o.status = newStatus;
                    renderOrders();
                } catch (err) {
                    alert('Erro ao atualizar status.');
                    loadOrders(); // reverte
                }
            });
        });

        document.querySelectorAll('.print-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                printOrder(id);
            });
        });
    }

    function printOrder(id) {
        const order = ordersData.find(o => o.id === id);
        if (!order) return;

        const date = new Date(order.created_at).toLocaleString('pt-BR');
        const numPedido = order.numero_pedido || order.id.substring(0,4);
        
        let itemsHtml = '';
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price);
                itemsHtml += `
                <div class="print-flex">
                    <span>${item.quantity}x ${item.product_name}</span>
                    <span>${price}</span>
                </div>
                ${item.notes ? `<div><small>Obs: ${item.notes}</small></div>` : ''}
                `;
            });
        }

        const totalFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total);

        printArea.innerHTML = `
            <div class="print-center print-bold" style="font-size: 16px; margin-bottom: 4px;">BOTARENA DELIVERY</div>
            <div class="print-center">--------------------------------</div>
            <div class="print-center print-bold" style="font-size: 14px; margin: 4px 0;">PEDIDO #${numPedido}</div>
            <div class="print-center">${date}</div>
            <div class="print-divider"></div>
            <div><span class="print-bold">Cliente:</span> ${order.customer_name}</div>
            <div><span class="print-bold">Tel:</span> ${order.customer_phone}</div>
            <div><span class="print-bold">End:</span> ${order.customer_address} - ${order.neighborhood}</div>
            <div class="print-divider"></div>
            <div class="print-bold" style="margin-bottom: 4px;">ITENS:</div>
            ${itemsHtml}
            <div class="print-divider"></div>
            <div class="print-flex print-bold" style="font-size: 14px;">
                <span>TOTAL:</span>
                <span>${totalFmt}</span>
            </div>
            <div><span class="print-bold">Pagamento:</span> ${order.payment_method}</div>
            <div class="print-divider"></div>
            <div class="print-center" style="margin-top: 10px;">
                *** CUPOM NAO FISCAL ***
            </div>
        `;
        
        printArea.style.display = 'block';
        window.print();
        printArea.style.display = 'none';
    }

    searchInput.addEventListener('input', renderOrders);
    statusFilter.addEventListener('change', renderOrders);

    // Socket.io for Realtime
    const token = localStorage.getItem('botarena_token');
    const socket = io({
        auth: { token }
    });

    socket.on('new_order', (order) => {
        // Toca um bipe simples
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...'); // Placeholder if we had an audio file
            // Let's just do a browser beep if supported or ignore
        } catch(e) {}
        
        loadOrders();
    });

    socket.on('order_status_updated', (data) => {
        const o = ordersData.find(x => x.id === data.id);
        if (o) {
            o.status = data.status;
            renderOrders();
        } else {
            loadOrders();
        }
    });

    // Init
    loadOrders();
});
