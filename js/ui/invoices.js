/**
 * Invoices UI Module
 * Interfaz de gestión de facturas
 */

class InvoicesUI {
    constructor() {
        this.facturas = [];
        this.clientes = [];
        this.searchQuery = '';
        this.lineas = [];
    }

    /**
     * Inicializa el módulo
     */
    init() {
        // Botón nueva factura
        document.getElementById('btn-add-factura')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Cerrar teclado si estuviera abierto
            if (document.activeElement) document.activeElement.blur();
            this.openModal();
        });

        // Búsqueda
        document.getElementById('search-facturas')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.render();
        });

        // Formulario
        document.getElementById('form-factura')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveFactura();
        });

        // Cerrar modal
        document.querySelectorAll('[data-close-modal="modal-factura"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // Selección de cliente - auto-rellenar datos
        document.getElementById('factura-cliente')?.addEventListener('change', (e) => {
            this.onClienteChange(e.target.value);
        });

        // Añadir línea
        document.getElementById('btn-add-linea')?.addEventListener('click', () => {
            this.addLinea();
        });

        // Botón editar fecha (abrir calendario)
        document.getElementById('btn-edit-fecha')?.addEventListener('click', () => {
            document.getElementById('factura-fecha')?.showPicker();
        });

        // View Mode Toggle
        document.querySelectorAll('#view-facturas .view-mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.classList.contains('mode-list') ? 'mode-list' :
                    btn.classList.contains('mode-small') ? 'mode-small' : 'mode-large';
                this.setViewMode(mode);
            });
        });

        // Restore saved view mode
        this.setViewMode(localStorage.getItem('invoices-view-mode') || 'mode-large');
    }

    setViewMode(mode) {
        // Update grid class
        const grid = document.getElementById('facturas-grid');
        grid.classList.remove('mode-list', 'mode-small', 'mode-large');
        grid.classList.add(mode);

        // Update active button
        document.querySelectorAll('#view-facturas .view-mode-toggle button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains(mode)) {
                btn.classList.add('active');
            }
        });

        // Save preference
        localStorage.setItem('invoices-view-mode', mode);
    }

    /**
     * Cuando cambia el cliente seleccionado
     */
    async onClienteChange(clienteId) {
        const infoDiv = document.getElementById('factura-cliente-info');

        if (!clienteId) {
            infoDiv.style.display = 'none';
            return;
        }

        const cliente = await db.getCliente(clienteId);
        if (cliente) {
            document.getElementById('factura-info-nombre').textContent = cliente.nombre || '-';
            document.getElementById('factura-info-dni').textContent = cliente.dni || '-';
            document.getElementById('factura-info-telefono').textContent = cliente.telefono || '-';
            document.getElementById('factura-info-email').textContent = cliente.email || '-';
            document.getElementById('factura-info-direccion').textContent = cliente.direccion || '-';
            infoDiv.style.display = 'block';
        }
    }

    /**
     * Añade una línea de factura
     */
    addLinea(concepto = '', cantidad = 1, precio = 0) {
        const container = document.getElementById('factura-lineas');
        const index = container.children.length;

        const lineaHtml = `
            <div class="factura-linea" data-index="${index}" style="display: grid; grid-template-columns: 2fr 80px 100px 100px 40px; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); align-items: center;">
                <input type="text" class="form-input linea-concepto" placeholder="Producto" value="${this.escapeHtml(concepto)}">
                <input type="number" class="form-input linea-cantidad" placeholder="Und" value="${cantidad}" min="1">
                <input type="number" class="form-input linea-precio" placeholder="Precio" value="${precio}" step="0.01" min="0">
                <span class="linea-total" style="text-align: right; font-weight: 600; color: var(--electric-cyan);">${this.formatPrice(cantidad * precio)}</span>
                <button type="button" class="btn btn-icon btn-remove-linea" style="padding: 4px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', lineaHtml);

        // Añadir listeners
        const linea = container.lastElementChild;
        linea.querySelector('.linea-cantidad').addEventListener('input', () => this.updateTotales());
        linea.querySelector('.linea-precio').addEventListener('input', () => this.updateTotales());
        linea.querySelector('.btn-remove-linea').addEventListener('click', () => {
            linea.remove();
            this.updateTotales();
        });

        this.updateTotales();
    }

    /**
     * Actualiza los totales de la factura
     */
    updateTotales() {
        const lineas = document.querySelectorAll('.factura-linea');
        let subtotal = 0;

        lineas.forEach(linea => {
            const cantidad = parseFloat(linea.querySelector('.linea-cantidad').value) || 0;
            const precio = parseFloat(linea.querySelector('.linea-precio').value) || 0;
            const total = cantidad * precio;

            linea.querySelector('.linea-total').textContent = this.formatPrice(total);
            subtotal += total;
        });

        const iva = subtotal * 0.21;
        const total = subtotal + iva;

        document.getElementById('factura-subtotal').textContent = this.formatPrice(subtotal);
        document.getElementById('factura-iva').textContent = this.formatPrice(iva);
        document.getElementById('factura-total').textContent = this.formatPrice(total);
    }

    /**
     * Genera número de factura
     */
    async generateNumeroFactura() {
        const facturas = await db.getAllFacturas();
        const year = new Date().getFullYear();
        const count = facturas.filter(f => f.numero && f.numero.includes(year.toString())).length + 1;
        return `FAC-${year}-${count.toString().padStart(3, '0')}`;
    }

    /**
     * Renderiza la lista de facturas
     */
    async render() {
        try {
            this.clientes = await db.getAllClientes();
            this.facturas = await db.getAllFacturas();

            // Filtrar por búsqueda
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                this.facturas = this.facturas.filter(f =>
                    f.numero?.toLowerCase().includes(query) ||
                    this.getClienteName(f.cliente_id).toLowerCase().includes(query)
                );
            }

            // Ordenar por fecha (más recientes primero)
            this.facturas.sort((a, b) => b.fecha_creacion - a.fecha_creacion);

            const grid = document.getElementById('facturas-grid');
            const empty = document.getElementById('empty-facturas');

            if (this.facturas.length === 0) {
                grid.innerHTML = '';
                empty.style.display = 'flex';
                return;
            }

            empty.style.display = 'none';
            grid.innerHTML = this.facturas.map(factura => this.renderCard(factura)).join('');

            this.attachCardListeners();
        } catch (error) {
            console.error('Error rendering invoices:', error);
            app.showToast('Error al cargar facturas', 'error');
        }
    }

    /**
     * Obtiene el nombre del cliente por ID
     */
    getClienteName(clienteId) {
        const cliente = this.clientes.find(c => c.id === clienteId);
        return cliente ? cliente.nombre : 'Cliente desconocido';
    }

    /**
     * Formatea precio
     */
    formatPrice(precio) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(precio || 0);
    }

    /**
     * Formatea fecha
     */
    formatDate(timestamp) {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    /**
     * Renderiza una tarjeta de factura
     */
    renderCard(factura) {
        const clienteName = this.getClienteName(factura.cliente_id);

        return `
            <div class="card" data-id="${factura.id}">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${this.escapeHtml(factura.numero || 'Sin número')}</h3>
                        <p class="card-subtitle">${this.formatDate(factura.fecha)}</p>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-info">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                        </svg>
                        <span>${this.escapeHtml(clienteName)}</span>
                    </div>
                    <div class="price" style="margin-top: var(--spacing-md);">${this.formatPrice(factura.total)}</div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-secondary btn-pdf" data-action="pdf" data-id="${factura.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="12" y1="18" x2="12" y2="12"></line>
                            <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                        PDF
                    </button>
                    <button class="btn btn-secondary btn-edit" data-action="edit" data-id="${factura.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Editar
                    </button>
                    <button class="btn btn-icon btn-delete" data-action="delete" data-id="${factura.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Adjunta listeners a las tarjetas
     */
    attachCardListeners() {
        // Editar
        document.querySelectorAll('#facturas-grid .btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.openModal(id);
            });
        });

        // Eliminar
        document.querySelectorAll('#facturas-grid .btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                app.confirmDelete(
                    '¿Eliminar factura?',
                    'Esta acción no se puede deshacer.',
                    async () => {
                        await this.deleteFactura(id);
                    }
                );
            });
        });

        // Generar PDF
        document.querySelectorAll('#facturas-grid .btn-pdf').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Evitar abrir modal
                const id = btn.dataset.id;
                await this.generatePDF(id);
            });
        });

        // Click en la tarjeta para editar (UX improvement)
        document.querySelectorAll('.card[data-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                // Si el click fue en un botón o dentro de un botón, ignorar
                if (e.target.closest('button')) return;

                const id = card.dataset.id;
                this.openModal(id);
            });
            // Añadir cursor pointer
            card.style.cursor = 'pointer';
        });
    }

    /**
     * Genera un PDF de la factura (vía impresión)
     * Si la factura tiene un PDF guardado (importado de Android), lo abre directamente
     */
    async generatePDF(id) {
        const factura = await db.getFactura(id);
        if (!factura) return;

        // Si tiene PDF guardado (importado de Android), abrirlo directamente
        if (factura.pdf_data) {
            try {
                // Crear blob y abrir en nueva ventana
                const byteString = atob(factura.pdf_data.split(',')[1]);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                return;
            } catch (e) {
                console.error('Error abriendo PDF guardado:', e);
                // Si falla, continuar con generación normal
            }
        }

        const cliente = await db.getCliente(factura.cliente_id);
        const clienteNombre = cliente ? cliente.nombre : 'Cliente desconocido';
        const clienteDni = cliente ? cliente.dni || '' : '';
        const clienteDireccion = cliente ? cliente.direccion || '' : '';
        const clienteEmail = cliente ? cliente.email || '' : '';
        const clienteTelefono = cliente ? cliente.telefono || '' : '';

        // Cargar Datos de Empresa y Logo
        // Cargar Datos de Empresa y Logo
        const companyName = (await db.getConfig('company_name')) || 'Mi Empresa de Reparaciones';
        const companyDni = (await db.getConfig('company_dni')) || '';
        const companyAddress = (await db.getConfig('company_address')) || 'Calle Principal, 123, Madrid';
        const companyPhone = (await db.getConfig('company_phone')) || '91 123 45 67';
        const companyEmail = (await db.getConfig('company_email')) || 'contacto@ejemplo.com';
        const logo = await db.getConfig('app_logo');

        // Crear ventana de impresión
        const printWindow = window.open('', '_blank');

        let lineasHtml = '';
        factura.lineas.forEach(l => {
            lineasHtml += `
                <tr>
                    <td>${this.escapeHtml(l.concepto)}</td>
                    <td class="text-center">${l.cantidad}</td>
                    <td class="text-right">${this.formatPrice(l.precio)}</td>
                    <td class="text-right">${this.formatPrice(l.cantidad * l.precio)}</td>
                </tr>
            `;
        });

        const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Factura ${factura.numero}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
                    
                    /* Header Container: Logo | Title | Meta */
                    .header-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #ccc; padding-bottom: 20px; }
                    
                    .header-logo { flex: 0 0 200px; }
                    .header-logo img { max-width: 180px; max-height: 100px; display: block; }
                    
                    .header-title { flex: 1; text-align: center; }
                    .header-title h1 { margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
                    
                    .header-meta { flex: 0 0 250px; text-align: right; background: #f0f0f0; padding: 10px; border-radius: 4px; border: 1px solid #ddd; }
                    .header-meta p { margin: 4px 0; font-size: 14px; font-weight: bold; }

                    /* Info Columns: Emisor | Cliente */
                    .info-container { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 40px; }
                    .info-col { flex: 1; }
                    .info-col h3 { margin: 0 0 10px 0; font-size: 16px; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #555; }
                    .info-col .name { font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #000; }
                    .info-col p { margin: 3px 0; font-size: 14px; }
                    .info-label { font-weight: bold; width: 80px; display: inline-block; color: #555; }

                    /* Table */
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
                    th { background-color: #e0e0e0; color: #333; font-weight: bold; padding: 10px; text-align: left; border-top: 2px solid #333; border-bottom: 2px solid #333; }
                    td { padding: 10px; border-bottom: 1px solid #eee; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    
                    /* Utility */
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    
                    /* Totals */
                    .totals-container { display: flex; justify-content: flex-end; }
                    .totals-box { width: 300px; }
                    .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
                    .total-row.final { font-weight: bold; font-size: 20px; border-top: 2px solid #000; margin-top: 10px; padding-top: 10px; }

                    /* Footer */
                    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }

                    @media print {
                        @page { margin: 0; }
                        body { margin: 1cm; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="header-logo">
                        ${logo ? `<img src="${logo}" alt="Logo">` : '<div style="font-size: 24px; font-weight: bold; color: #ddd;">LOGO</div>'}
                    </div>
                    <div class="header-title">
                        <h1>FACTURA</h1>
                    </div>
                    <div class="header-meta">
                        <p>Nº Factura: ${factura.numero || '-'}</p>
                        <p>Fecha: ${this.formatDate(factura.fecha)}</p>
                    </div>
                </div>

                <div class="info-container">
                    <div class="info-col">
                        <h3>Emisor:</h3>
                        <div class="name">${this.escapeHtml(companyName)}</div>
                        <p>${this.escapeHtml(companyAddress)}</p>
                        ${companyDni ? `<p>NIF/CIF: ${this.escapeHtml(companyDni)}</p>` : ''}
                        <p>Tel: ${this.escapeHtml(companyPhone)}</p>
                        <p>Email: ${this.escapeHtml(companyEmail)}</p>
                    </div>
                    <div class="info-col">
                        <h3>Cliente:</h3>
                        <div class="name">Nombre: <span style="font-weight: normal">${this.escapeHtml(clienteNombre)}</span></div>
                        ${clienteDni ? `<p><span class="info-label">DNI/NIF:</span> ${this.escapeHtml(clienteDni)}</p>` : ''}
                        ${clienteDireccion ? `<p><span class="info-label">Dirección:</span> ${this.escapeHtml(clienteDireccion)}</p>` : ''}
                        ${clienteTelefono ? `<p><span class="info-label">Teléfono:</span> ${this.escapeHtml(clienteTelefono)}</p>` : ''}
                        ${clienteEmail ? `<p><span class="info-label">Email:</span> ${this.escapeHtml(clienteEmail)}</p>` : ''}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-center" width="60">Und</th>
                            <th class="text-right" width="100">Precio</th>
                            <th class="text-right" width="100">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineasHtml}
                    </tbody>
                </table>

                <div class="totals-container">
                    <div class="totals-box">
                        <div class="total-row">
                            <span>Base Imponible:</span>
                            <span>${this.formatPrice(factura.subtotal)}</span>
                        </div>
                        <div class="total-row">
                            <span>IVA (21%):</span>
                            <span>${this.formatPrice(factura.iva)}</span>
                        </div>
                        <div class="total-row final">
                            <span>TOTAL A PAGAR:</span>
                            <span>${this.formatPrice(factura.total)}</span>
                        </div>
                    </div>
                </div>

                ${factura.notas ? `
                <div style="margin-top: 30px; font-style: italic; color: #666; font-size: 13px;">
                    <strong>Notas:</strong> ${this.escapeHtml(factura.notas)}
                </div>
                ` : ''}
                
                <div class="footer">
                    <p>Gracias por su confianza</p>
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    }

    /**
     * Abre el modal de factura
     */
    async openModal(id = null) {
        try {
            const modal = document.getElementById('modal-factura');
            const title = document.getElementById('modal-factura-title');
            const form = document.getElementById('form-factura');
            const selectCliente = document.getElementById('factura-cliente');
            const lineasContainer = document.getElementById('factura-lineas');

            // 1. Show modal immediately (with slight delay)
            setTimeout(() => {
                modal.classList.add('active');
            }, 100);

            // 2. Blur any active input
            if (document.activeElement) document.activeElement.blur();

            form.reset();
            document.getElementById('factura-id').value = '';
            document.getElementById('factura-cliente-info').style.display = 'none';
            lineasContainer.innerHTML = '';

            // Show loading state
            selectCliente.innerHTML = '<option value="">Cargando clientes...</option>';

            // Fecha actual por defecto
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('factura-fecha');
            dateInput.value = today;
            dateInput.removeAttribute('readonly');
            dateInput.removeAttribute('disabled');

            // 3. Load Data Asynchronously
            try {
                // Cargar clientes
                const clientes = await db.getAllClientes();
                selectCliente.innerHTML = '<option value="">Seleccionar cliente...</option>' +
                    clientes.map(c => `<option value="${c.id}">${this.escapeHtml(c.nombre)}</option>`).join('');

                if (id) {
                    // Modo edición
                    title.textContent = 'Editar Factura';
                    const factura = await db.getFactura(id);
                    if (factura) {
                        document.getElementById('factura-id').value = factura.id;
                        document.getElementById('factura-cliente').value = factura.cliente_id;
                        document.getElementById('factura-numero').value = factura.numero || '';
                        document.getElementById('factura-fecha').value = factura.fecha ? new Date(factura.fecha).toISOString().split('T')[0] : today;
                        document.getElementById('factura-notas').value = factura.notas || '';

                        // Cargar datos del cliente
                        this.onClienteChange(factura.cliente_id);

                        // Cargar líneas
                        if (factura.lineas && factura.lineas.length > 0) {
                            factura.lineas.forEach(l => {
                                this.addLinea(l.concepto, l.cantidad, l.precio);
                            });
                        }
                    }
                } else {
                    title.textContent = 'Nueva Factura';
                    // Generar número de factura
                    try {
                        const nextNum = await this.generateNumeroFactura();
                        document.getElementById('factura-numero').value = nextNum;
                    } catch (numErr) {
                        console.error('Error generating invoice number:', numErr);
                    }
                    // Añadir una línea vacía
                    this.addLinea();
                }

                this.updateTotales();
            } catch (dataError) {
                console.error('Error loading data for invoice modal:', dataError);
                selectCliente.innerHTML = '<option value="">Error cargando datos</option>';
                app.showToast('Error cargando datos: ' + dataError.message, 'error');
            }

        } catch (error) {
            console.error('Error opening invoice modal:', error);
            // Critical error, ensure modal is closed
            document.getElementById('modal-factura').classList.remove('active');
            alert('Error crítico al abrir modal: ' + error.message);
        }
    }

    /**
     * Cierra el modal
     */
    closeModal() {
        document.getElementById('modal-factura').classList.remove('active');
    }

    /**
     * Guarda una factura
     */
    async saveFactura() {
        try {
            const id = document.getElementById('factura-id').value;

            // Recoger líneas
            const lineasElements = document.querySelectorAll('.factura-linea');
            const lineas = [];
            let subtotal = 0;

            lineasElements.forEach(linea => {
                const concepto = linea.querySelector('.linea-concepto').value.trim();
                const cantidad = parseFloat(linea.querySelector('.linea-cantidad').value) || 0;
                const precio = parseFloat(linea.querySelector('.linea-precio').value) || 0;

                if (concepto) {
                    lineas.push({ concepto, cantidad, precio });
                    subtotal += cantidad * precio;
                }
            });

            const iva = subtotal * 0.21;
            const total = subtotal + iva;

            const factura = {
                cliente_id: document.getElementById('factura-cliente').value,
                numero: document.getElementById('factura-numero').value.trim(),
                fecha: new Date(document.getElementById('factura-fecha').value).getTime(),
                lineas: lineas,
                subtotal: subtotal,
                iva: iva,
                total: total,
                notas: document.getElementById('factura-notas').value.trim() || null
            };

            if (!factura.cliente_id) {
                app.showToast('Selecciona un cliente', 'error');
                return;
            }

            if (lineas.length === 0) {
                app.showToast('Añade al menos un concepto', 'error');
                return;
            }

            if (id) {
                factura.id = id;
            }

            // Comprobar si el número ya existe (y no es la misma factura)
            const existingFacturas = await db.getAllFacturas();
            const duplicate = existingFacturas.find(f => f.numero === factura.numero && f.id !== (id || ''));
            if (duplicate) {
                app.showToast(`El número de factura ${factura.numero} ya existe`, 'error');
                return;
            }

            await db.saveFactura(factura);
            this.closeModal();
            await this.render();

            app.showToast(id ? 'Factura actualizada' : 'Factura creada', 'success');
        } catch (error) {
            console.error('Error saving invoice:', error);
            app.showToast('Error al guardar factura', 'error');
        }
    }

    /**
     * Elimina una factura
     */
    async deleteFactura(id) {
        try {
            await db.deleteFactura(id);
            await this.render();
            app.showToast('Factura eliminada', 'success');
        } catch (error) {
            console.error('Error deleting invoice:', error);
            app.showToast('Error al eliminar factura', 'error');
        }
    }

    /**
     * Escapa HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Instancia global
const invoicesUI = new InvoicesUI();
