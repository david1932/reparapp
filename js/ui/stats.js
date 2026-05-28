class StatsUI {
    constructor() {
        this.charts = {};
        this.followupCandidates = [];
        this.lowStockProducts = [];
    }

    async init() {
        console.log('📊 StatsUI Initializing...');
        await this.updateDashboard();

        // Listen for sync/data changes to refresh
        window.addEventListener('data-changed', () => this.updateDashboard());
        window.addEventListener('sync-complete', () => this.updateDashboard());
    }

    async updateDashboard() {
        try {
            const reparaciones = await db.getAllReparaciones();
            const facturas = await db.getAllFacturas ? await db.getAllFacturas() : [];
            const extraIncome = await db.getAllIngresosExtra ? await db.getAllIngresosExtra() : [];
            const products = await db.getAllProducts ? await db.getAllProducts() : [];

            this.renderStatusChart(reparaciones);
            this.renderRevenueChart(facturas, extraIncome);
            this.checkFollowups(reparaciones);
            this.checkLowStock(products);
        } catch (e) {
            console.error('Error updating stats:', e);
        }
    }

    renderStatusChart(reparaciones) {
        const ctx = document.getElementById('chart-status');
        if (!ctx) return;

        const stats = {
            recibido: 0,
            diagnostico: 0,
            en_proceso: 0,
            en_reparacion: 0,
            listo: 0,
            entregado: 0,
            garantia: 0,
            cancelado: 0
        };

        reparaciones.forEach(r => {
            let s = r.estado || 'recibido';
            // map spaces/legacy to underscored keys if they slipped through
            if (s === 'en proceso') s = 'en_proceso';
            if (s === 'en reparacion' || s === 'reparando' || s === 'esperando_pieza') s = 'en_reparacion';
            if (s === 'reparado') s = 'listo';
            if (stats[s] !== undefined) stats[s]++;
        });

        const data = {
            labels: Object.keys(stats).map(k => i18n.t('st_' + k) || k),
            datasets: [{
                data: Object.values(stats),
                backgroundColor: [
                    '#5765f2', // Blue
                    '#ff9f43', // Orange
                    '#3498db', // Light Blue
                    '#a29bfe', // Purple
                    '#00ffc6', // Cyan/Green
                    '#2ecc71', // Green
                    '#f1c40f', // Yellow
                    '#ff4757'  // Red
                ],
                borderWidth: 0
            }]
        };

        if (this.charts.status) {
            this.charts.status.data = data;
            this.charts.status.update();
        } else {
            this.charts.status = new Chart(ctx, {
                type: 'doughnut',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#a0a0a0', usePointStyle: true } }
                    },
                    cutout: '70%'
                }
            });
        }
    }

    renderRevenueChart(facturas, extraIncome = []) {
        const ctx = document.getElementById('chart-revenue');
        if (!ctx) return;

        // Last 6 months
        const labels = [];
        const values = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(d.toLocaleString('default', { month: 'short' }));

            const monthFacturas = facturas.filter(f => {
                const fDate = new Date(f.fecha);
                return fDate.getMonth() === d.getMonth() && fDate.getFullYear() === d.getFullYear() && !f.excluded_from_accounting;
            }).reduce((sum, f) => sum + (f.total || 0), 0);

            const monthExtra = extraIncome.filter(i => {
                const iDate = new Date(i.fecha);
                return iDate.getMonth() === d.getMonth() && iDate.getFullYear() === d.getFullYear();
            }).reduce((sum, i) => sum + (i.total || 0), 0);

            values.push(monthFacturas + monthExtra);
        }

        const data = {
            labels,
            datasets: [{
                label: i18n.t('dash_chart_revenue'),
                data: values,
                borderColor: '#00ffc6',
                backgroundColor: 'rgba(0, 255, 198, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#00ffc6'
            }]
        };

        if (this.charts.revenue) {
            this.charts.revenue.data = data;
            this.charts.revenue.update();
        } else {
            this.charts.revenue = new Chart(ctx, {
                type: 'line',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#808080' } },
                        x: { grid: { display: false }, ticks: { color: '#808080' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    async checkFollowups(reparaciones) {
        const banner = document.getElementById('followup-banner');
        if (!banner) return;

        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        this.followupCandidates = reparaciones.filter(r => {
            const isDelivered = r.estado === 'entregado' || r.estado === 'entregada';
            const deliveredDate = r.ultima_modificacion || r.fecha_creacion;
            const diff = now - deliveredDate;

            // Candidate if delivered > 7 days ago AND not already followed up (we'd need a flag, but for now we filter)
            return isDelivered && diff > SEVEN_DAYS && diff < (SEVEN_DAYS * 4); // Within a month
        });

        if (this.followupCandidates.length > 0) {
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    async checkLowStock(products) {
        const banner = document.getElementById('stock-alert-banner');
        if (!banner) return;

        this.lowStockProducts = products.filter(p => {
            if (p.type === 'service') return false;
            const stock = parseInt(p.stock) || 0;
            const min = parseInt(p.stock_min) || 3; // Default 3 if not set
            return stock <= min;
        });

        if (this.lowStockProducts.length > 0) {
            banner.style.display = 'flex';
            const msg = document.getElementById('stock-alert-msg');
            if (msg) msg.textContent = `Atención: Hay ${this.lowStockProducts.length} productos bajo mínimos.`;
        } else {
            banner.style.display = 'none';
        }
    }

    async showFollowupList() {
        if (this.followupCandidates.length === 0) return;

        const count = this.followupCandidates.length;

        let html = `
            <div style="max-height: 400px; overflow-y: auto; padding: 10px;">
                <p style="margin-bottom: 20px; color: var(--text-secondary);">Equipos entregados hace más de 7 días. Pulsa el icono para enviar un mensaje de cortesía.</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <th style="padding: 10px;">Cliente</th>
                            <th style="padding: 10px;">Equipo</th>
                            <th style="padding: 10px; text-align: center;">WhatsApp</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const rep of this.followupCandidates) {
            const cliente = await db.getCliente(rep.cliente_id);
            const nombreCli = cliente ? `${cliente.nombre} ${cliente.apellido || ''}` : 'Cliente desconocido';
            const telefono = cliente ? cliente.telefono : '';

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px;">${nombreCli}</td>
                    <td style="padding: 10px;">${rep.marca} ${rep.modelo}</td>
                    <td style="padding: 10px; text-align: center;">
                        <button class="btn btn-sm btn-success" style="background: #25D366; border: none;"
                            onclick="window.statsUI.sendFollowupMessage('${telefono}', '${nombreCli}', '${rep.marca} ${rep.modelo}')">
                            <svg style="width: 14px; height: 14px; fill: white;" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.588-5.946 0-6.556 5.332-11.891 11.891-11.891 3.181 0 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.481 8.403 0 6.556-5.332 11.891-11.891 11.891-2.011 0-3.978-.511-5.719-1.48L0 .057zM12.043 2.1c-5.421 0-9.834 4.413-9.834 9.834 0 2.126.671 4.104 1.815 5.733l-1.099 4.01 4.137-1.085c1.558.915 3.321 1.398 5.122 1.398h.001c5.42 0 9.833-4.413 9.833-9.834 0-2.627-1.022-5.101-2.876-6.958L12.043 2.1zm5.385 13.43c-.295-.148-1.743-.86-2.012-.958-.268-.098-.463-.148-.658.148-.195.298-.755.958-.927 1.15-.172.193-.344.218-.639.071-.295-.148-1.243-.458-2.37-1.465-.873-.78-1.464-1.745-1.635-2.041-.172-.297-.018-.458.13-.605.132-.132.296-.345.443-.518.148-.172.197-.297.296-.495.097-.198.05-.37-.024-.518-.076-.148-.658-1.587-.901-2.174-.237-.573-.478-.495-.66-.505l-.56-.01c-.195 0-.512.073-.78.37-.268.297-1.025 1.013-1.025 2.47s1.06 2.87 1.208 3.07c.148.196 2.083 3.179 5.045 4.462.705.305 1.255.487 1.683.623.708.226 1.353.194 1.861.118.571-.085 1.743-.712 1.99-1.402.246-.688.246-1.278.172-1.402-.074-.124-.268-.193-.564-.343l.001.001z"/></svg>
                        </button>
                    </td>
                </tr>
            `;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        if (window.utilsUI && window.utilsUI.showModal) {
            window.utilsUI.showModal('Seguimiento de Calidad', html);
        } else {
            // Fallback to a simple container if utilsUI is not ready
            const modal = document.createElement('div');
            modal.style = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background: var(--glass-bg); backdrop-filter: blur(10px); padding:25px; border-radius:15px; border:1px solid rgba(255,255,255,0.1); z-index:10000; box-shadow:0 10px 40px rgba(0,0,0,0.5); width: 500px; max-width: 90vw;";
            modal.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="margin:0;">Seguimiento de Calidad</h3>
                    <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">&times;</button>
                </div>
                ${html}
            `;
            document.body.appendChild(modal);
        }
    }

    sendFollowupMessage(telefono, cliente, dispositivo) {
        if (!telefono) {
            app.showToast('Error: El cliente no tiene teléfono.', 'error');
            return;
        }

        const template = i18n.t('tpl_default_delivered') || "Hola {CLIENTE}, hace 7 días reparamos tu {DISPOSITIVO}. ¿Todo va bien? ¡Gracias!";
        const message = template
            .replace(/{CLIENTE}/g, cliente)
            .replace(/{DISPOSITIVO}/g, dispositivo);

        const cleanPhone = telefono.replace(/\s+/g, '').replace(/[^\d+]/g, '');
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
        app.showToast('Abriendo WhatsApp...', 'success');
    }
}

// Inyectar en el sistema
window.statsUI = new StatsUI();
