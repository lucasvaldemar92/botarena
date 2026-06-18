// ==========================================
// 📊 REPORTS APP LOGIC
// ==========================================

let revenueChartInstance = null;
let statusChartInstance = null;

// UI Elements
const els = {
    loader: document.getElementById('loader-view'),
    content: document.getElementById('content-view'),
    btnCharts: document.getElementById('btn-view-charts'),
    btnData: document.getElementById('btn-view-data'),
    viewCharts: document.getElementById('viewport-charts'),
    viewData: document.getElementById('viewport-data'),
    
    // Summaries
    valRevenue: document.getElementById('val-revenue'),
    valOrders: document.getElementById('val-orders'),
    valTicket: document.getElementById('val-ticket'),
    valCompleted: document.getElementById('val-completed'),
    
    // Table
    tableBody: document.getElementById('orders-table-body'),
    productsTableBody: document.getElementById('products-table-body'),
    
    // Canvases
    ctxRevenue: document.getElementById('revenueChart'),
    ctxStatus: document.getElementById('statusChart')
};

// Utils: Format Currency
function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// Format Date
function formatDate(isoString) {
    if (!isoString) return '---';
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Toggle Views
function setupToggles() {
    els.btnCharts.addEventListener('click', () => {
        els.btnCharts.classList.add('active');
        els.btnData.classList.remove('active');
        els.viewCharts.classList.add('active');
        els.viewData.classList.remove('active');
    });

    els.btnData.addEventListener('click', () => {
        els.btnData.classList.add('active');
        els.btnCharts.classList.remove('active');
        els.viewData.classList.add('active');
        els.viewCharts.classList.remove('active');
    });
}

// Process Data and Render UI
function processAndRender(orders) {
    // 1. Calculate Summary Metrics
    let totalRevenue = 0;
    let completedCount = 0;
    const statusCounts = {
        'novo': 0,
        'preparo': 0,
        'entrega': 0,
        'entregue': 0
    };

    // Prepare data for line chart (Last 7 days)
    const today = new Date();
    today.setHours(0,0,0,0);
    const last7DaysMap = {};
    for(let i=6; i>=0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        // label format: DD/MM
        const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}`;
        last7DaysMap[label] = 0; // initialize
    }

    const productsMap = {};

    orders.forEach(order => {
        const val = parseFloat(order.total_amount) || parseFloat(order.total) || 0;
        const stat = (order.status || 'novo').toLowerCase();
        
        // Sum total revenue regardless of status (or we could limit to 'entregue', but let's do all for general analytics)
        totalRevenue += val;
        
        if (stat === 'entregue') completedCount++;
        
        if (statusCounts[stat] !== undefined) {
            statusCounts[stat]++;
        } else {
            statusCounts[stat] = 1;
        }

        // Daily Revenue Calculation
        if (order.created_at) {
            const orderDate = new Date(order.created_at);
            const label = `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth()+1).padStart(2, '0')}`;
            if (last7DaysMap[label] !== undefined) {
                last7DaysMap[label] += val;
            }
        }

        // Aggregate Products
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const pName = item.product_name || 'Desconhecido';
                const pQtd = parseInt(item.quantity) || 1;
                const pPrice = parseFloat(item.price) || 0;
                const pTotal = pQtd * pPrice;

                if (!productsMap[pName]) {
                    productsMap[pName] = { quantity: 0, total: 0 };
                }
                productsMap[pName].quantity += pQtd;
                productsMap[pName].total += pTotal;
            });
        }
    });

    const totalOrders = orders.length;
    const ticketMedio = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    // Update Summary DOM
    els.valRevenue.textContent = formatCurrency(totalRevenue);
    els.valOrders.textContent = totalOrders;
    els.valTicket.textContent = formatCurrency(ticketMedio);
    els.valCompleted.textContent = completedCount;

    // 2. Render Table
    // Sort descending by date (assuming id correlates or parsing created_at)
    const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    els.tableBody.innerHTML = sortedOrders.map(o => {
        let statusBadge = '';
        const s = (o.status || 'novo').toLowerCase();
        if (s === 'novo') statusBadge = `<span style="background: var(--status-novo-bg); color: var(--status-novo-text); padding: 0.25rem 0.5rem; border-radius: var(--radius-md); font-weight: 600; font-size: 0.8rem;">Novo</span>`;
        else if (s === 'preparo') statusBadge = `<span style="background: var(--status-preparo-bg); color: var(--status-preparo-text); padding: 0.25rem 0.5rem; border-radius: var(--radius-md); font-weight: 600; font-size: 0.8rem;">Preparo</span>`;
        else if (s === 'entrega') statusBadge = `<span style="background: var(--status-entrega-bg); color: var(--status-entrega-text); padding: 0.25rem 0.5rem; border-radius: var(--radius-md); font-weight: 600; font-size: 0.8rem;">Entrega</span>`;
        else if (s === 'entregue') statusBadge = `<span style="background: var(--status-entregue-bg); color: var(--status-entregue-text); padding: 0.25rem 0.5rem; border-radius: var(--radius-md); font-weight: 600; font-size: 0.8rem;">Entregue</span>`;
        else statusBadge = `<span>${s}</span>`;

        return `
            <tr>
                <td style="font-weight: 600; color: var(--primary);">#${o.id}</td>
                <td>${o.customer_name || o.client_name || o.customer_phone || o.client_phone || 'Desconhecido'}</td>
                <td>${statusBadge}</td>
                <td style="font-weight: 600; color: var(--accent);">${formatCurrency(parseFloat(o.total_amount) || parseFloat(o.total) || 0)}</td>
                <td>${formatDate(o.created_at)}</td>
            </tr>
        `;
    }).join('');

    // Render Products Table
    const sortedProducts = Object.keys(productsMap)
        .map(name => ({ name, ...productsMap[name] }))
        .sort((a, b) => b.quantity - a.quantity);

    if (els.productsTableBody) {
        if (sortedProducts.length === 0) {
            els.productsTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Nenhum produto registrado</td></tr>`;
        } else {
            els.productsTableBody.innerHTML = sortedProducts.map(p => `
                <tr>
                    <td style="font-weight: 500; color: var(--text-main);">${p.name}</td>
                    <td style="text-align: right; color: var(--text-muted);">${p.quantity}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--accent);">${formatCurrency(p.total)}</td>
                </tr>
            `).join('');
        }
    }

    // 3. Render Charts
    renderCharts(last7DaysMap, statusCounts);

    // Swap views
    els.loader.style.display = 'none';
    els.content.style.display = 'flex';
}

function renderCharts(last7DaysMap, statusCounts) {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Chart 1: Revenue Line Chart
    if (revenueChartInstance) revenueChartInstance.destroy();
    
    const revenueLabels = Object.keys(last7DaysMap);
    const revenueData = Object.values(last7DaysMap);

    // Create gradient
    const ctxR = els.ctxRevenue.getContext('2d');
    const gradient = ctxR.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    revenueChartInstance = new Chart(els.ctxRevenue, {
        type: 'line',
        data: {
            labels: revenueLabels,
            datasets: [{
                label: 'Faturamento Diário',
                data: revenueData,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#0f172a',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return ' ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                    ticks: {
                        callback: function(value) { return 'R$ ' + value; }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // Chart 2: Status Doughnut
    if (statusChartInstance) statusChartInstance.destroy();
    
    statusChartInstance = new Chart(els.ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Novo', 'Em Preparo', 'Em Entrega', 'Entregue'],
            datasets: [{
                data: [
                    statusCounts['novo'] || 0,
                    statusCounts['preparo'] || 0,
                    statusCounts['entrega'] || 0,
                    statusCounts['entregue'] || 0
                ],
                backgroundColor: [
                    '#3b82f6', // blue
                    '#d97706', // orange/amber
                    '#9333ea', // purple
                    '#10b981'  // green
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 15, font: { size: 11 } }
                }
            }
        }
    });
}

// Initial Fetch
async function loadData() {
    try {
        const orders = await window.utils.apiFetch('/orders');
        processAndRender(orders);
    } catch (err) {
        console.error('❌ Erro ao carregar dados dos relatórios:', err);
        els.loader.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #ef4444;"></i>
            <p style="color: #ef4444;">Erro ao carregar dados. Tente novamente.</p>
        `;
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    setupToggles();
    loadData();
});
