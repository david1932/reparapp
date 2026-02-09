/**
 * Inventory UI Module
 * Gestión de inventario y stock
 */

class InventoryUI {
    constructor() {
        this.products = [];
        this.searchQuery = '';
        this.html5QrcodeScanner = null;
        this.isScanning = false;
    }

    /**
     * Inicializa el módulo
     */
    init() {
        // Botón nuevo producto
        document.getElementById('btn-add-product')?.addEventListener('click', () => {
            this.openModal();
        });

        // Botón Escanear SKU
        document.getElementById('btn-scan-sku')?.addEventListener('click', () => {
            this.handleScan();
        });

        // Búsqueda
        document.getElementById('search-inventory')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.render();
        });

        // Formulario
        document.getElementById('form-producto')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Cerrar modal
        document.querySelectorAll('[data-close-modal="modal-producto"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        document.querySelectorAll('[data-close-modal="modal-scanner"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeScanner());
        });

        // View Mode Toggle
        document.querySelectorAll('#view-inventory .view-mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.classList.contains('mode-list') ? 'mode-list' :
                    btn.classList.contains('mode-small') ? 'mode-small' : 'mode-large';
                this.setViewMode(mode);
            });
        });

        // Restore saved view mode
        this.setViewMode(localStorage.getItem('inventory-view-mode') || 'mode-large');
    }

    setViewMode(mode) {
        // Update grid class
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;

        // Ensure we keep base classes
        if (!grid.classList.contains('cards-grid')) grid.classList.add('cards-grid');
        if (!grid.classList.contains('inventory-grid')) grid.classList.add('inventory-grid');

        grid.classList.remove('mode-list', 'mode-small', 'mode-large');
        grid.classList.add(mode);

        // Update active button
        document.querySelectorAll('#view-inventory .view-mode-toggle button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains(mode)) {
                btn.classList.add('active');
            }
        });

        // Save preference
        localStorage.setItem('inventory-view-mode', mode);
    }

    /**
     * Renderiza la lista de productos o categorías
     */
    async render() {
        try {
            this.products = await db.getAllProducts();
            const allProducts = this.products;
            const grid = document.getElementById('inventory-grid');
            const empty = document.getElementById('empty-inventory');

            // Clean up previous logic
            grid.innerHTML = '';

            // 1. Handling Search (Flat List)
            if (this.searchQuery) {
                this.renderFlatList(allProducts, grid, empty);
                this.updateHeader('Inventario (Búsqueda)');
                return;
            }

            // 2. Handling Category View
            if (this.currentCategory) {
                // Show items in specific category
                const filtered = allProducts.filter(p => p.category === this.currentCategory);
                this.renderProductGrid(filtered, grid, empty); // Use helper
                this.updateHeader(`Inventario > ${this.currentCategory}`, true); // Show back button
            } else {
                // ROOT LEVEL: Show Categories (Folders) + Uncategorized Items
                this.renderRootLevel(allProducts, grid, empty);
                this.updateHeader('Inventario', false);
            }

        } catch (error) {
            console.error('Error rendering inventory:', error);
            app.showToast(i18n.t('toast_error_loading'), 'error');
        }
    }

    renderFlatList(allProducts, grid, empty) {
        const filtered = allProducts.filter(p => {
            const searchStr = `${p.name} ${p.sku || ''} ${p.category || ''}`.toLowerCase();
            return searchStr.includes(this.searchQuery);
        });

        filtered.sort((a, b) => a.name.localeCompare(b.name));

        if (filtered.length === 0) {
            empty.style.display = 'flex';
            return;
        }
        empty.style.display = 'none';
        grid.innerHTML = filtered.map(p => this.renderCard(p)).join('');
        this.attachCardListeners();
    }

    renderRootLevel(products) {
        const grid = document.getElementById('inventory-grid');
        const empty = document.getElementById('empty-inventory');
        grid.innerHTML = ''; // Restore this!

        // Ensure base classes are present without wiping mode classes
        grid.classList.add('cards-grid', 'inventory-grid');

        // Apply saved mode if not already present
        const savedMode = localStorage.getItem('inventory-view-mode') || 'mode-large';
        if (!grid.classList.contains('mode-list') &&
            !grid.classList.contains('mode-small') &&
            !grid.classList.contains('mode-large')) {
            grid.classList.add(savedMode);
        }

        // Calculate Categories
        const categories = {};
        const uncategorized = [];
        let lowStockCount = 0;

        products.forEach(p => {
            if (p.stock < 3 && p.type !== 'service') lowStockCount++; // Low stock threshold < 3

            if (p.category && p.category.trim() !== '') {
                if (!categories[p.category]) categories[p.category] = 0;
                categories[p.category]++;
            } else {
                uncategorized.push(p);
            }
        });

        let html = '';

        // 1. Render "Low Stock" Folder (if any)
        if (lowStockCount > 0) {
            html += this.renderFolderCard('⚠️ Stock Bajo', lowStockCount, 'low-stock');
        }

        // 2. Render Category Folders
        Object.keys(categories).sort().forEach(cat => {
            html += this.renderFolderCard(cat, categories[cat]);
        });

        // 3. Render Uncategorized Products (Root level items)
        if (uncategorized.length > 0) {
            uncategorized.forEach(p => {
                html += this.renderCard(p);
            });
        }

        if (html === '') {
            empty.style.display = 'flex';
        } else {
            empty.style.display = 'none';
            grid.innerHTML = html;
        }

        this.attachFolderListeners();
        this.attachCardListeners();
    }

    renderProductGrid(products, grid, empty) {
        products.sort((a, b) => a.name.localeCompare(b.name));

        if (products.length === 0) {
            empty.style.display = 'flex'; // Should not happen usually if folder exists
            return;
        }
        empty.style.display = 'none';
        grid.innerHTML = products.map(p => this.renderCard(p)).join('');
        this.attachCardListeners();
    }

    renderFolderCard(category, count, specialType = null) {
        let icon = this.getCategoryIcon(category);
        let customClass = '';
        // Note: Styles for specific/dynamic backgrounds (like low-stock) 
        // should ideally be classes too, but inline is okay for dynamic colors if strictly necessary.
        // However, we can use a class 'card-low-stock' 

        let extraStyle = '';
        if (specialType === 'low-stock') {
            icon = '⚠️';
            customClass = 'stock-low-card'; // We will define this in CSS
            // Fallback/Override inline just in case specific colors are needed
            extraStyle = 'background: rgba(255, 59, 48, 0.1); border: 1px solid var(--status-pending);';
        }

        return `
            <div class="inventory-folder-card ${customClass}" data-category="${specialType || category}" style="${extraStyle}">
                <div class="folder-icon">${icon}</div>
                <div class="folder-name" ${specialType === 'low-stock' ? 'style="color: var(--status-pending);"' : ''}>${category}</div>
                <div class="folder-count">${count} items</div>
                
                <!-- Hover Effect Overlay -->
                <div class="folder-overlay" style="position: absolute; top:0; left:0; right:0; bottom:0; background: linear-gradient(45deg, rgba(var(--electric-blue-rgb), 0.1), transparent); opacity: 0; transition: opacity 0.2s;"></div>
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
        if (cat.includes('micro') || cat.includes('micrófono')) return '🎙️';
        if (cat.includes('camara') || cat.includes('cámara') || cat.includes('lente')) return '📷';
        if (cat.includes('placa') || cat.includes('base') || cat.includes('chip') || cat.includes('ic') || cat.includes('component')) return '💾';
        if (cat.includes('herramienta') || cat.includes('tool')) return '🛠️';
        if (cat.includes('servicio') || cat.includes('mano') || cat.includes('labor')) return '👨‍🔧';
        if (cat.includes('accesorio')) return '🎧';
        if (cat.includes('otro') || cat.includes('vario') || cat.includes('misc')) return '📦';
        return '📁'; // Default
    }

    attachFolderListeners() {
        document.querySelectorAll('.inventory-folder-card').forEach(card => {
            card.onclick = () => {
                const category = card.dataset.category;
                const grid = document.getElementById('inventory-grid');
                const empty = document.getElementById('empty-inventory');

                if (category === 'low-stock') {
                    // Filter low stock products
                    const lowStockProducts = this.products.filter(p => p.stock < 3 && p.type !== 'service');
                    this.currentCategory = '⚠️ Stock Bajo'; // Display name
                    this.renderProductGrid(lowStockProducts, grid, empty);
                    this.updateHeader(`Inventario > ${this.currentCategory}`, true);
                } else if (category === 'uncategorized') {
                    this.currentCategory = 'Sin Categoría';
                    const filtered = this.products.filter(p => !p.category || p.category.trim() === '');
                    this.renderProductGrid(filtered, grid, empty);
                    this.updateHeader(`Inventario > ${this.currentCategory}`, true);
                }
                else {
                    this.currentCategory = category;
                    const filtered = this.products.filter(p => p.category === category);
                    this.renderProductGrid(filtered, grid, empty);
                    this.updateHeader(`Inventario > ${this.currentCategory}`, true);
                }
            };
        });
    }

    updateHeader(titleText, showBack = false) {
        // We need to inject or update a title/breadcrumb element.
        // Assuming there isn't one easily accessible, verify index.html structure.
        // For now, let's use the Search placeholder or inject a breadcrumb below header.
        // Or update the "Inventario" header if accessible via ID?
        // Checking view_file 937: <h1 class="page-title" data-i18n="stk_title">Inventario</h1>
        // ID not present. We can target .page-title inside #view-inventory.

        const header = document.querySelector('#view-inventory .page-title');
        if (header) {
            if (showBack) {
                header.innerHTML = `
                    <button id="btn-inventory-back" class="btn-icon" style="margin-right: 10px; display: inline-flex;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                    </button>
                    ${titleText}
                 `;
                document.getElementById('btn-inventory-back').onclick = () => {
                    this.currentCategory = null;
                    this.render();
                };
            } else {
                header.textContent = titleText; // 'Inventario'
            }
        }
    }

    /**
     * Formatea un precio
     */
    formatPrice(precio) {
        return app.formatPrice(precio);
    }

    renderCard(product) {
        // Determinar estado de stock
        const stock = parseInt(product.stock) || 0;
        const minStock = parseInt(product.minStock) || 2;
        let stockClass = 'stock-ok';
        let stockLabel = i18n.t('stk_status_ok');

        if (product.type === 'service') {
            stockLabel = 'SERVICIO';
            stockClass = 'stock-ok'; // Use green or specific color
        } else if (stock <= 0) {
            stockClass = 'stock-out';
            stockLabel = i18n.t('stk_status_out');
        } else if (stock <= minStock) {
            stockClass = 'stock-low';
            stockLabel = i18n.t('stk_status_low') + ` (${stock})`;
        } else {
            stockLabel = i18n.t('stk_status_ok') + ` (${stock})`;
        }
        const stockColor = stock <= 0 ? 'var(--status-rejected)' : (stock <= minStock ? 'var(--status-pending)' : 'var(--status-completed)');

        return `
            <div class="card product-card" data-id="${product.id}">
                <div class="card-header">
                    <div class="product-info">
                        <h3 class="card-title">${product.name}</h3>
                        <p class="card-subtitle">${product.category || 'General'} ${product.sku ? `• SKU: ${product.sku}` : ''}</p>
                    </div>
                    <div class="stock-badge" style="color: ${stockColor}; font-weight: bold; font-size: 0.8rem;">
                        ${stock} un.
                    </div>
                </div>
                <div class="card-body">
                    <div class="price-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="price-label" style="color: var(--text-secondary); font-size: 0.9rem;">${i18n.t('stk_label_price')}:</span>
                        <span class="price-value" style="font-weight: bold; font-size: 1.1rem;">${this.formatPrice(product.price)}</span>
                    </div>
                    <div class="cost-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                         <span class="cost-label" style="color: var(--text-secondary);">${i18n.t('stk_label_cost')}:</span>
                         <span class="cost-value">${product.cost ? this.formatPrice(product.cost) : '-'}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn-icon btn-edit-product" data-id="${product.id}" title="${i18n.t('btn_edit')}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon btn-delete-product" data-id="${product.id}" title="${i18n.t('btn_delete')}" style="color: var(--status-rejected);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }

    attachCardListeners() {
        // Editar
        document.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const product = this.products.find(p => p.id === id);
                if (product) this.openModal(product);
            });
        });

        // Eliminar
        document.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteProduct(btn.dataset.id);
            });
        });
    }

    openModal(product = null) {
        const modal = document.getElementById('modal-producto');
        const form = document.getElementById('form-producto');
        const title = document.getElementById('modal-producto-title');

        if (product) {
            title.textContent = i18n.t('stk_edit_title');
            document.getElementById('producto-id').value = product.id;
            document.getElementById('producto-tipo').value = product.type || 'product';
            document.getElementById('producto-nombre').value = product.name;
            document.getElementById('producto-sku').value = product.sku || '';
            document.getElementById('producto-categoria').value = product.category || '';
            document.getElementById('producto-coste').value = product.cost || '';
            document.getElementById('producto-precio').value = product.price || '';
            document.getElementById('producto-stock').value = product.stock || 0;
            document.getElementById('producto-stock-min').value = product.minStock || 2;
        } else {
            title.textContent = i18n.t('mod_product_new');
            form.reset();
            document.getElementById('producto-id').value = '';
            document.getElementById('producto-tipo').value = 'product'; // Default
            document.getElementById('producto-stock').value = '0';
            document.getElementById('producto-stock-min').value = '2';
        }

        this.toggleStockFields();
        modal.classList.add('active');
    }

    toggleStockFields() {
        const type = document.getElementById('producto-tipo').value;
        const stockRow = document.getElementById('producto-stock').closest('.modal-body').lastElementChild.previousElementSibling;
        // We need a better way to target the stock row.
        // Let's assume the stock inputs are in the last grid container before footer?
        // Actually, let's use IDs to be safe in the replacement.
        const stockInput = document.getElementById('producto-stock');
        if (stockInput) {
            const container = stockInput.closest('.form-group').parentElement; // The grid div
            if (type === 'service') {
                container.style.display = 'none';
            } else {
                container.style.display = 'grid';
            }
        }
    }

    closeModal() {
        document.getElementById('modal-producto').classList.remove('active');
    }

    async saveProduct() {
        const id = document.getElementById('producto-id').value;
        const name = document.getElementById('producto-nombre').value;
        const type = document.getElementById('producto-tipo').value;

        if (!name) return;

        const product = {
            id: id || undefined,
            name: name,
            type: type,
            sku: document.getElementById('producto-sku').value,
            category: document.getElementById('producto-categoria').value,
            cost: parseFloat(document.getElementById('producto-coste').value) || 0,
            price: parseFloat(document.getElementById('producto-precio').value) || 0,
            stock: type === 'service' ? 9999 : (parseInt(document.getElementById('producto-stock').value) || 0),
            minStock: parseInt(document.getElementById('producto-stock-min').value) || 2
        };

        try {
            await db.saveProduct(product);
            app.showToast(i18n.t('toast_saved'), 'success');
            this.closeModal();
            this.render();
        } catch (error) {
            console.error('Error saving product:', error);
            app.showToast(i18n.t('toast_error'), 'error');
        }
    }

    async deleteProduct(id) {
        app.confirmDelete(
            i18n.t('stk_delete_confirm'),
            i18n.t('dlg_delete_warning'),
            async () => {
                try {
                    await db.deleteProduct(id);
                    app.showToast(i18n.t('toast_deleted'), 'success');
                    this.render();
                } catch (error) {
                    console.error('Error deleting product:', error);
                    app.showToast(i18n.t('toast_error'), 'error');
                }
            }
        );
    }

    /* Scanner Methods */
    async handleScan() {
        const modal = document.getElementById('modal-scanner');
        modal.classList.add('active');

        if (!this.html5QrcodeScanner) {
            this.html5QrcodeScanner = new Html5Qrcode("reader");
        }

        try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length) {
                const cameraId = cameras[0].id;
                await this.html5QrcodeScanner.start(
                    cameraId,
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    (decodedText, decodedResult) => this.onScanSuccess(decodedText, decodedResult),
                    (errorMessage) => {
                        // ignore validation errors
                    }
                );
                this.isScanning = true;
            } else {
                app.showInfoModal({
                    type: 'warning',
                    title: i18n.t('dlg_warning_title'),
                    message: i18n.t('ocr_camera_not_found')
                });
                this.closeScanner();
            }
        } catch (err) {
            console.error('Error starting scanner', err);
            app.showInfoModal({
                type: 'error',
                title: i18n.t('ocr_camera_error_title'),
                message: i18n.t('ocr_camera_start_error') + err
            });
            this.closeScanner();
        }
    }

    onScanSuccess(decodedText, decodedResult) {
        if (!this.isScanning) return;


        // Play beep
        // const audio = new Audio('assets/beep.mp3'); audio.play().catch(e=>{}); 

        // Stop scanning
        this.closeScanner();

        // Fill Input
        const skuInput = document.getElementById('producto-sku');
        if (skuInput) {
            skuInput.value = decodedText;
            app.showToast(`Código escaneado: ${decodedText}`, 'success');
        }
    }

    async closeScanner() {
        const modal = document.getElementById('modal-scanner');
        modal.classList.remove('active');

        if (this.html5QrcodeScanner && this.isScanning) {
            try {
                await this.html5QrcodeScanner.stop();
                this.isScanning = false;
            } catch (ignore) {
                console.warn('Error stopping scanner', ignore);
                this.isScanning = false; // Force reset
            }
        }
    }
}

// Instancia global
window.inventoryUI = new InventoryUI();
