/**
 * POS UI Module
 * Punto de Venta / Caja
 */

class POSUI {
    constructor() {
        this.cart = [];
        this.products = [];
        this.categories = new Set();
        this.searchQuery = '';
        this.categoryFilter = '';
        this.currentCategory = null; // New state for folder navigation
        this.isShiftOpen = false;
    }

    async init() {
        // Event Listeners

        // Search
        document.getElementById('pos-search')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderProducts();
        });

        // Category Filter
        document.getElementById('pos-category-filter')?.addEventListener('change', (e) => {
            this.categoryFilter = e.target.value;
            this.renderProducts();
        });

        // Clear Cart
        document.getElementById('btn-pos-clear')?.addEventListener('click', () => {
            if (confirm(i18n.t('pos_clear_cart_confirm') || '¿Vaciar carrito?')) { // Fallback i18n
                this.clearCart();
            }
        });

        // Pay Button
        document.getElementById('btn-pos-pay')?.addEventListener('click', () => {
            if (this.cart.length === 0) return;
            this.openPayModal();
        });

        // Modal Close
        document.querySelectorAll('[data-close-modal="modal-pos-pay"]').forEach(btn => {
            btn.addEventListener('click', () => document.getElementById('modal-pos-pay').classList.remove('active'));
        });

        // Payment Method Toggle
        const payMethods = document.querySelectorAll('.segmented-option');
        payMethods.forEach(btn => {
            btn.addEventListener('click', () => {
                payMethods.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updatePayUI(btn.dataset.method);
            });
        });

        // Cash Input Change -> Calc Change
        document.getElementById('pos-pay-amount')?.addEventListener('input', () => this.calcChange());

        // Confirm Payment
        document.getElementById('btn-pos-confirm')?.addEventListener('click', () => this.finalizeSale());

        // Back Button
        document.getElementById('btn-pos-back')?.addEventListener('click', () => {
            this.currentCategory = null;
            this.renderProducts();
        });
    }

    async loadData() {
        console.log('POSUI: Loading data...');
        try {
            this.products = await db.getAllProducts();
            console.log('POSUI: Products loaded:', this.products);

            if (!this.products || !Array.isArray(this.products)) {
                console.error('POSUI: Invalid products data', this.products);
                this.products = [];
            }

            // Extract Categories
            this.categories.clear();
            this.products.forEach(p => {
                if (p.category) this.categories.add(p.category);
            });

            this.renderFilters();
            this.renderProducts();

            // Populate Client Select in Modal (Optional)
            const clients = await db.getAllClientes();
            const clientSelect = document.getElementById('pos-client-select');
            if (clientSelect) {
                const defaultId = 'CLIENTE_GENERAL';
                clientSelect.innerHTML = clients.map(c =>
                    `<option value="${c.id}" ${c.id === defaultId ? 'selected' : ''}>${c.nombre} ${c.apellido || ''}</option>`
                ).join('');

                // If 'CLIENTE_GENERAL' is not in the list (e.g. not synced yet), add it manually or fallback
                if (!clientSelect.value) {
                    clientSelect.insertAdjacentHTML('afterbegin', `<option value="${defaultId}" selected>Cliente General</option>`);
                }
            }

        } catch (e) {
            console.error("Error loading POS data", e);
            app.showToast(i18n.t('toast_error_loading'), 'error');
        }
    }

    renderFilters() {
        const select = document.getElementById('pos-category-filter');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="">Todas</option>';
        this.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        select.value = currentVal;
    }

    renderProducts() {
        const grid = document.getElementById('pos-products-grid');
        if (!grid) return;

        grid.innerHTML = '';

        // 1. Handling Search (Flat List) - Bypasses folders
        if (this.searchQuery) {
            this.renderFlatList(grid);
            this.updateHeader('Caja (Búsqueda)', true);
            return;
        }

        // 2. Handling Category View (Inside a folder)
        if (this.currentCategory) {
            const filtered = this.products.filter(p => p.category === this.currentCategory);
            this.renderProductGrid(filtered, grid);
            this.updateHeader(`Caja > ${this.currentCategory}`, true);
        } else {
            // ROOT LEVEL: Show Categories (Folders) + Uncategorized Items
            this.renderRootLevel(grid);
            this.updateHeader('Caja / TPV', false);
        }
    }

    renderRootLevel(grid) {
        // Calculate Categories from current products list
        const categories = {};
        const uncategorized = [];

        this.products.forEach(p => {
            if (p.category && p.category.trim() !== '') {
                if (!categories[p.category]) categories[p.category] = 0;
                categories[p.category]++;
            } else {
                uncategorized.push(p);
            }
        });

        let html = '';

        // Render Category Folders
        Object.keys(categories).sort().forEach(cat => {
            html += this.renderFolderCard(cat, categories[cat]);
        });

        // Render Uncategorized Products
        if (uncategorized.length > 0) {
            uncategorized.forEach(p => {
                html += this.renderProductCardHTML(p);
            });
        }

        grid.innerHTML = html || '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">No hay productos en el inventario</div>';
        this.attachFolderListeners();
    }

    renderProductGrid(filtered, grid) {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        grid.innerHTML = filtered.map(p => this.renderProductCardHTML(p)).join('');
    }

    renderFlatList(grid) {
        const filtered = this.products.filter(p => {
            const searchStr = `${p.name} ${p.sku || ''} ${p.category || ''}`.toLowerCase();
            return searchStr.includes(this.searchQuery);
        });

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">No se encontraron productos</div>';
            return;
        }

        grid.innerHTML = filtered.map(p => this.renderProductCardHTML(p)).join('');
    }

    renderProductCardHTML(p) {
        const stock = parseInt(p.stock) || 0;
        const price = parseFloat(p.price) || 0;
        const isOOS = p.type !== 'service' && stock <= 0;
        const isLow = p.type !== 'service' && stock < 3;

        return `
            <div class="pos-product-card ${isOOS ? 'oos' : ''}" 
                 onclick="window.posUI.addToCartById('${p.id}')"
                 style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px; cursor: pointer; transition: transform 0.1s; opacity: ${isOOS ? 0.6 : 1}; display: flex; flex-direction: column; justify-content: space-between; height: 120px;">
                <div style="font-weight: 600; font-size: 0.95rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.name}</div>
                <div>
                     <div style="font-size: 0.8rem; color: ${isOOS ? 'var(--danger)' : (isLow ? 'var(--status-pending)' : 'var(--text-secondary)')}; margin-bottom: 5px;">
                        ${p.type === 'service' ? 'SERVICIO' : (isOOS ? 'AGOTADO' : `Stock: ${stock}`)}
                    </div>
                    <div style="font-weight: bold; color: var(--electric-cyan); font-size: 1.1rem;">${app.formatPrice(price)}</div>
                </div>
            </div>
        `;
    }

    renderFolderCard(category, count) {
        let icon = this.getCategoryIcon(category);
        return `
            <div class="inventory-folder-card pos-folder-card" data-category="${category}" 
                 style="height: 120px; padding: 15px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                <div class="folder-icon" style="font-size: 2rem; margin-bottom: 5px;">${icon}</div>
                <div class="folder-name" style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); text-align: center;">${category}</div>
                <div class="folder-count" style="font-size: 0.75rem; color: var(--text-secondary);">${count} items</div>
            </div>
        `;
    }

    getCategoryIcon(category) {
        const cat = category.toLowerCase();
        if (cat.includes('pantalla') || cat.includes('lcd') || cat.includes('display') || cat.includes('screen')) return '📱';
        if (cat.includes('bater') || cat.includes('batt') || cat.includes('carga')) return '🔋';
        if (cat.includes('cristal') || cat.includes('tapa') || cat.includes('traser')) return '🔙';
        if (cat.includes('flex') || cat.includes('cable') || cat.includes('conector')) return '🔌';
        if (cat.includes('funda') || cat.includes('carcasa') || cat.includes('case')) return '🛡️';
        if (cat.includes('protector') || cat.includes('templado')) return '💎';
        if (cat.includes('audio') || cat.includes('altavoz') || cat.includes('auricular')) return '🔊';
        if (cat.includes('placa') || cat.includes('chip') || cat.includes('microsoldadura')) return '🔬';
        if (cat.includes('camara') || cat.includes('lens')) return '📷';
        if (cat.includes('otros') || cat.includes('misc')) return '📦';
        return '📁';
    }

    attachFolderListeners() {
        document.querySelectorAll('.pos-folder-card').forEach(folder => {
            folder.onclick = () => {
                this.currentCategory = folder.dataset.category;
                this.renderProducts();
            };
        });
    }

    updateHeader(title, showBack) {
        const titleEl = document.getElementById('pos-header-title');
        const backBtn = document.getElementById('btn-pos-back');
        if (titleEl) titleEl.textContent = title;
        if (backBtn) backBtn.style.display = showBack ? 'flex' : 'none';
    }

    // Helper for onclick in string template
    async addToCartById(id) {
        const product = this.products.find(p => p.id === id);
        if (product) this.addToCart(product);
    }

    addToCart(product) {
        const existing = this.cart.find(item => item.product.id === product.id);
        const stock = parseInt(product.stock) || 0;

        // Check Stock
        const currentQtyInCart = existing ? existing.qty : 0;
        if (product.type !== 'service' && currentQtyInCart + 1 > stock) {
            app.showToast(i18n.t('pos_error_stock') || 'No hay suficiente stock', 'warning');
            return;
        }

        if (existing) {
            existing.qty++;
        } else {
            this.cart.push({
                product: product,
                qty: 1,
                price: parseFloat(product.price) || 0 // Snapshot price
            });
        }
        this.renderCart();
        // Play sound effect?
    }

    removeFromCart(productId) {
        const idx = this.cart.findIndex(item => item.product.id === productId);
        if (idx !== -1) {
            this.cart.splice(idx, 1);
            this.renderCart();
        }
    }

    updateQty(productId, change) {
        const item = this.cart.find(item => item.product.id === productId);
        if (!item) return;

        const newQty = item.qty + change;
        const stock = parseInt(item.product.stock) || 0;

        if (newQty <= 0) {
            this.removeFromCart(productId);
            return;
        }

        if (item.product.type !== 'service' && newQty > stock) {
            app.showToast(i18n.t('pos_error_stock') || 'No hay suficiente stock', 'warning');
            return;
        }

        item.qty = newQty;
        this.renderCart();
    }

    clearCart() {
        this.cart = [];
        this.renderCart();
    }

    renderCart() {
        const container = document.getElementById('pos-cart-items');
        const countBadge = document.getElementById('pos-cart-count'); // Optional badge

        if (!container) return;

        container.innerHTML = '';

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div id="pos-empty-cart" style="text-align: center; color: var(--text-muted); padding-top: 50px;">
                    <p>Rejilla vacía</p>
                </div>`;
            this.updateTotals();
            return;
        }

        this.cart.forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = `
                display: flex; justify-content: space-between; align-items: center; 
                background: var(--bg-card); padding: 10px; margin-bottom: 8px; border-radius: 8px;
            `;

            div.innerHTML = `
                <div style="flex: 1; min-width: 0; padding-right: 10px;">
                    <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.product.name}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${app.formatPrice(item.price)} x ${item.qty}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="btn-qty-minus" style="width: 25px; height: 25px; border-radius: 50%; border: 1px solid var(--border-color); background: none; color: var(--text-primary); cursor: pointer;">-</button>
                    <span style="font-weight: bold; width: 20px; text-align: center;">${item.qty}</span>
                    <button class="btn-qty-plus" style="width: 25px; height: 25px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--electric-cyan); color: #000; cursor: pointer;">+</button>
                    <div style="font-weight: bold; min-width: 60px; text-align: right;">${app.formatPrice(item.price * item.qty)}</div>
                </div>
            `;

            div.querySelector('.btn-qty-minus').onclick = () => this.updateQty(item.product.id, -1);
            div.querySelector('.btn-qty-plus').onclick = () => this.updateQty(item.product.id, 1);

            container.appendChild(div);
        });

        this.updateTotals();
    }

    updateTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

        // For simplicity in POS: Prices are final (Tax Included)
        // We backtrack calculations for display
        const taxRate = window.app_tax_rate || 21;
        const base = subtotal / (1 + taxRate / 100);
        const tax = subtotal - base;

        document.getElementById('pos-total-subtotal').textContent = app.formatPrice(base);
        document.getElementById('pos-total-tax').textContent = app.formatPrice(tax);
        document.getElementById('pos-total-total').textContent = app.formatPrice(subtotal);

        this.currentTotal = subtotal; // Store for checkout
    }

    openPayModal() {
        const modal = document.getElementById('modal-pos-pay');
        modal.classList.add('active');

        // Reset View
        document.getElementById('pos-cash-container').style.display = 'block';
        document.getElementById('pos-success-container').style.display = 'none';
        document.getElementById('pos-pay-actions').style.display = 'flex';

        document.getElementById('pos-pay-total').textContent = app.formatPrice(this.currentTotal);

        // Reset state
        this.updatePayUI('cash');
        document.querySelectorAll('.segmented-option').forEach(b => b.classList.remove('active'));
        document.getElementById('btn-pay-cash').classList.add('active');

        // Pre-fill with Total (formatted)
        const totalStr = this.currentTotal.toFixed(2).replace('.', ',');
        const input = document.getElementById('pos-pay-amount');
        input.value = totalStr;
        input.disabled = false; // Ensure enabled

        this.calcChange();

        // Focus without aggressively selecting all instantly to avoid mobile issues
        setTimeout(() => {
            input.focus();
            // Optional: select on click only?
            // input.select(); 
        }, 100);
    }

    updatePayUI(method) {
        this.paymentMethod = method;
        const cashContainer = document.getElementById('pos-cash-container');

        if (method === 'cash') {
            cashContainer.style.display = 'block';
        } else {
            cashContainer.style.display = 'none';
        }
    }

    calcChange() {
        let val = document.getElementById('pos-pay-amount').value || '0';
        val = val.replace(',', '.'); // Allow comma
        const paid = parseFloat(val) || 0;
        const change = paid - this.currentTotal;

        const changeEl = document.getElementById('pos-pay-change');
        if (change < 0) {
            changeEl.textContent = app.formatPrice(0);
            changeEl.style.color = 'var(--text-secondary)';
        } else {
            changeEl.textContent = app.formatPrice(change);
            changeEl.style.color = 'var(--status-completed)';
        }
    }

    async finalizeSale() {
        let val = document.getElementById('pos-pay-amount').value || '0';
        val = val.replace(',', '.');
        const paidAmount = parseFloat(val) || 0;

        if (this.paymentMethod === 'cash' && paidAmount < this.currentTotal) {
            app.showToast(i18n.t('pos_error_payment_amount') || 'Importe insuficiente', 'error');
            return;
        }

        const clientId = document.getElementById('pos-client-select').value || null;



        try {
            const nextNum = await db.generateNextInvoiceNumber();

            const factura = {
                numero: nextNum,
                fecha: Date.now(),
                cliente_id: clientId,
                subtotal: this.currentTotal / (1 + (window.app_tax_rate || 21) / 100),
                iva: this.currentTotal - (this.currentTotal / (1 + (window.app_tax_rate || 21) / 100)),
                irpf: 0,
                total: this.currentTotal,
                impuestos: window.app_tax_rate || 21,
                tax_label: window.app_tax_label || 'IVA',
                estado: 'pagada',
                notas: `Venta TPV - ${this.paymentMethod.toUpperCase()}`,
                lineas: this.cart.map(item => ({
                    concepto: item.product.name,
                    cantidad: item.qty,
                    precio: item.price
                })),
                fecha_creacion: Date.now(),
                fecha_modificacion: Date.now()
            };

            const savedInvoice = await db.saveFactura(factura);
            const invoiceId = savedInvoice.id;

            // Update Stock
            for (const item of this.cart) {
                const product = await db.getProduct(item.product.id);
                if (product && product.type !== 'service') {
                    product.stock = (parseInt(product.stock) || 0) - item.qty;
                    await db.saveProduct(product);
                }
            }

            // Register Cash
            if (this.paymentMethod === 'cash') {
                await db.addCajaMovement({
                    tipo: 'IN',
                    importe: this.currentTotal,
                    concepto: `Venta Ticket ${nextNum}`,
                    fecha: Date.now()
                });
            }

            this.lastInvoiceId = invoiceId; // Save for printing
            this.lastClientId = clientId;

            this.showSuccess();
            this.clearCart();
            this.loadData();

        } catch (err) {
            console.error('POS Error', err);
            app.showToast('Error: ' + err.message, 'error');
        }
    }

    showSuccess() {
        document.getElementById('pos-cash-container').style.display = 'none';
        document.getElementById('pos-pay-actions').style.display = 'none';
        document.getElementById('pos-success-container').style.display = 'block';

        // Setup Buttons
        document.getElementById('btn-pos-print-last').onclick = () => this.printLastTicket();
        document.getElementById('btn-pos-new-sale').onclick = () => {
            document.getElementById('modal-pos-pay').classList.remove('active');
        };
    }

    async printLastTicket() {
        if (!this.lastInvoiceId) {
            console.error('POSUI: No last invoice ID to print');
            app.showToast('No hay venta reciente para imprimir', 'warning');
            return;
        }
        try {
            console.log('POSUI: Printing Invoice ID:', this.lastInvoiceId);
            const savedFactura = await db.getFactura(this.lastInvoiceId);

            if (!savedFactura) {
                throw new Error('Factura no encontrada en DB');
            }

            const client = this.lastClientId ? await db.getCliente(this.lastClientId) : { nombre: 'Cliente General' };
            console.log('POSUI: Factura loaded', savedFactura);

            if (window.printer) {
                console.log('POSUI: Call printer.printInvoiceTicket');
                window.printer.printInvoiceTicket(savedFactura, client);
            } else {
                console.error('POSUI: window.printer is undefined');
                app.showToast('Error: Servicio de impresión no disponible', 'error');
            }
        } catch (e) {
            console.error('POSUI: Print Error', e);
            app.showToast('Error al imprimir: ' + e.message, 'error');
        }
    }
}

// Global hook
window.posUI = new POSUI();
