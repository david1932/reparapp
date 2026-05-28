/**
 * Repairs UI Module
 * Interfaz de gestión de reparaciones
 */

class RepairsUI {
    constructor() {
        this.reparaciones = [];
        this.clientes = [];
        this.searchQuery = '';
        this.filterEstado = '';
        this.filterClienteId = null;
        this.templates = null;
        this.usedParts = []; // Current repair parts
        this.repairPhotos = []; // Current repair photos (base64)
        this.partsSearchWidget = null;
        this.allProducts = []; // Cache for search
        this.stream = null; // Camera stream
        this.patternSequence = []; // Current pattern lock dot sequence
        this.patternLockInitialized = false;
        this.itemsPerPage = 20;
        this.displayedCount = 20;
    }

    /**
     * Inicializa el módulo
     */
    init() {
        // Botón nueva reparación
        document.getElementById('btn-add-reparacion')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Cerrar teclado si estuviera abierto
            if (document.activeElement && document.activeElement.tagName !== 'BODY') {
                document.activeElement.blur();
            }
            this.openModal();
        });

        // Búsqueda
        document.getElementById('search-reparaciones')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.displayedCount = this.itemsPerPage; // Reset pagination on search
            this.render();
        });

        // Filtro de estado
        document.getElementById('filter-estado')?.addEventListener('change', (e) => {
            this.filterEstado = e.target.value;
            this.displayedCount = this.itemsPerPage; // Reset pagination on filter
            this.render();
        });

        // Formulario (Submit)
        document.getElementById('form-reparacion')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveReparacion();
        });

        // Recalcular precio total al cambiar mano de obra
        document.getElementById('reparacion-precio')?.addEventListener('input', () => {
            this.recalculateTotalPrice();
        });

        // Cerrar modal
        document.querySelectorAll('[data-close-modal="modal-reparacion"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // View Mode Toggle
        document.querySelectorAll('#view-reparaciones .view-mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.classList.contains('mode-list') ? 'mode-list' :
                    btn.classList.contains('mode-small') ? 'mode-small' : 'mode-large';
                this.setViewMode(mode);
            });
        });

        // Restore saved view mode
        this.setViewMode(localStorage.getItem('repairs-view-mode') || 'mode-large');

        // Signature Pad initialization
        this.setupSignaturePad();

        // Pattern Lock initialization
        this.setupPatternLock();

        // RGPD Checkbox toggle — enable signature pad when accepted
        document.getElementById('rgpd-accept-checkbox')?.addEventListener('change', (e) => {
            const sigArea = document.getElementById('signature-canvas-area');
            if (sigArea) {
                if (e.target.checked) {
                    sigArea.style.opacity = '1';
                    sigArea.style.pointerEvents = 'auto';
                } else {
                    sigArea.style.opacity = '0.3';
                    sigArea.style.pointerEvents = 'none';
                }
            }
        });

        // Botón Firma Local
        document.getElementById('btn-local-signature')?.addEventListener('click', () => {
            this.startLocalSignature();
        });

        // Botón Limpiar Firma
        document.getElementById('btn-clear-signature')?.addEventListener('click', () => {
            this.clearSignature();
        });

        // Parts Search initialization
        this.initPartsSearch();
    }

    setViewMode(mode) {
        // Update grid class
        const grid = document.getElementById('reparaciones-grid');
        grid.classList.remove('mode-list', 'mode-small', 'mode-large');
        grid.classList.add(mode);

        // Update active button
        document.querySelectorAll('#view-reparaciones .view-mode-toggle button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains(mode)) {
                btn.classList.add('active');
            }
        });

        // Save preference
        localStorage.setItem('repairs-view-mode', mode);
    }




    /**
     * Renderiza la lista de reparaciones
     * @param {Object} params - Parámetros opcionales (ej: { clienteId: '...' })
     */
    async render(params = null) {
        try {
            // Manejar filtro por cliente
            if (params && params.clienteId) {
                this.filterClienteId = params.clienteId;
                // Mostrar indicador de filtro (opcional)
                const cliente = await db.getCliente(this.filterClienteId);
                if (cliente) {
                    app.showToast(i18n.t('rep_filtering_client', { name: cliente.nombre }), 'info');
                }
            } else if (params === null) {
                // Si params es explícitamente null (navegación menú), limpiar filtro
                this.filterClienteId = null;
            }

            // Obtener clientes para referencia
            this.clientes = await db.getAllClientes();

            // Obtener reparaciones
            this.reparaciones = await db.searchReparaciones(this.searchQuery, this.filterEstado || null);

            // Cargar plantillas WhatsApp (Safely)
            try {
                this.templates = {
                    pendiente: await db.getConfig('tpl_pendiente'),
                    presupuesto: await db.getConfig('tpl_presupuesto'),
                    reparado: await db.getConfig('tpl_reparado'),
                    entregado: await db.getConfig('tpl_entregado')
                };

                // AUTO-FIX: Corregir URLs locales hardcodeadas por error
                for (const key in this.templates) {
                    if (this.templates[key] && this.templates[key].includes('127.0.0.1')) {
                        console.log(`Fixing template ${key}: Removing localhost`);
                        // Reemplazar URL completa si es posible, o just el dominio
                        this.templates[key] = this.templates[key]
                            .replace(/http:\/\/127\.0\.0\.1:\d+\/tracking\.html\?id=/g, '{URL}')
                            .replace(/http:\/\/127\.0\.0\.1:\d+/g, '{URL}');

                        // Guardar corrección para el futuro
                        await db.saveConfig(`tpl_${key}`, this.templates[key]);
                    }
                }
            } catch (e) {
                console.warn('Could not load templates, using defaults', e);
                this.templates = {}; // Fallback to empty to trigger defaults in renderCard
            }

            // Get Tracking URL with robust fallback/fix
            let tUrl = await db.getConfig('tracking_url');

            // AUTO-FIX: Si no hay URL, es local, o de algún dominio antiguo, usar la nueva de Cloudflare Pages (reparapp-premium.pages.dev/tracking)
            if (!tUrl || tUrl.includes('127.0.0.1') || tUrl.includes('localhost') || tUrl.includes('reparapp-gestion') || tUrl.includes('david1932.github.io') || tUrl.includes('reparapp.pages.dev') || tUrl.includes('reparappremium.es')) {
                console.warn('Tracking URL antigua o local detectada:', tUrl);
                tUrl = 'https://reparapp-premium.pages.dev/tracking';
                await db.saveConfig('tracking_url', tUrl);
                console.log('Tracking URL corregida automáticamente a:', tUrl);
            }

            // AUTO-FIX: Si la URL no incluye /tracking.html ni /track.html y no es la URL estándar de reparapp.pages.dev/tracking, añadirlo
            if (tUrl && !tUrl.includes('tracking.html') && !tUrl.includes('track.html') && !tUrl.includes('tracking/') && !tUrl.includes('track/') && !tUrl.endsWith('/tracking')) {
                tUrl = tUrl.replace(/\/+$/, '') + '/tracking.html';
                await db.saveConfig('tracking_url', tUrl);
                console.log('Tracking URL corregida (faltaba /tracking.html):', tUrl);
            }

            this.trackingUrl = tUrl;

            // Filtrar por cliente si es necesario
            if (this.filterClienteId) {
                this.reparaciones = this.reparaciones.filter(r => r.cliente_id === this.filterClienteId);
            }

            // MIGRACIÓN DE ESTADOS ANTIGUOS (On-the-fly)
            let needsSave = false;
            for (let r of this.reparaciones) {
                const oldState = r.estado;
                // Mapping table
                if (oldState === 'pendiente') r.estado = 'recibido';
                else if (oldState === 'presupuesto') r.estado = 'diagnostico';
                else if (oldState === 'esperando_pieza' || oldState === 'reparando') r.estado = 'en_reparacion';
                else if (oldState === 'reparado' || oldState === 'completada') r.estado = 'listo';
                else if (oldState === 'en proceso') r.estado = 'en_proceso';
                else if (oldState === 'en reparacion') r.estado = 'en_reparacion';

                if (oldState !== r.estado) {
                    needsSave = true;
                    await db.saveReparacion(r);
                }
            }
            if (needsSave) {
                // Refresh if data migrated to ensure filters work
                this.reparaciones = await db.searchReparaciones(this.searchQuery, this.filterEstado || null);
                if (this.filterClienteId) {
                    this.reparaciones = this.reparaciones.filter(r => r.cliente_id === this.filterClienteId);
                }
            }

            // Ordenar por fecha de creación (más recientes primero)
            this.reparaciones.sort((a, b) => b.fecha_creacion - a.fecha_creacion);

            const grid = document.getElementById('reparaciones-grid');
            const empty = document.getElementById('empty-reparaciones');

            if (this.reparaciones.length === 0) {
                grid.innerHTML = '';
                empty.style.display = 'flex';
                return;
            }

            empty.style.display = 'none';

            // PAGINACIÓN: Cortar la lista según lo que queremos mostrar
            const toShow = this.reparaciones.slice(0, this.displayedCount);
            grid.innerHTML = toShow.map(rep => this.renderCard(rep)).join('');

            // Añadir botón "Cargar más" si hay más elementos
            if (this.reparaciones.length > this.displayedCount) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'btn-load-more';
                loadMoreBtn.style = 'grid-column: 1 / -1; margin-top: 20px; padding: 15px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--accent); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;';
                loadMoreBtn.textContent = i18n.t('rep_load_more', { count: this.reparaciones.length - this.displayedCount });
                loadMoreBtn.onclick = () => {
                    this.displayedCount += this.itemsPerPage;
                    this.render();
                };
                grid.appendChild(loadMoreBtn);
            }

            // Event listeners para acciones
            this.attachCardListeners();
        } catch (error) {
            console.error('Error rendering repairs:', error);
            if (error.message && error.message.includes('searchReparaciones')) {
                app.showToast(i18n.t('rep_error_search') + ': ' + error.message, 'error');
            } else if (error.message && error.message.includes('getAllClientes')) {
                app.showToast(i18n.t('rep_error_clients') + ': ' + error.message, 'error');
            } else {
                app.showToast(i18n.t('rep_error_general') + ': ' + (error.message || error), 'error');
            }
        }
    }

    /**
     * Obtiene el nombre del cliente por ID
     */
    getClienteName(clienteId) {
        const cliente = this.clientes.find(c => c.id === clienteId);
        return cliente ? cliente.nombre : i18n.t('cliente_desconocido');
    }

    /**
     * Obtiene el teléfono del cliente por ID
     */
    getClientePhone(clienteId) {
        const cliente = this.clientes.find(c => c.id === clienteId);
        return cliente ? cliente.telefono : null;
    }

    /**
     * Obtiene el badge de estado
     */
    getStatusBadge(estado) {
        const statusMap = {
            'recibido': { class: 'pending', text: i18n.t('status_received') },
            'diagnostico': { class: 'in-progress', text: i18n.t('status_diagnosing') },
            'en_proceso': { class: 'in-progress', text: i18n.t('status_in_progress') },
            'en_reparacion': { class: 'in-progress', text: i18n.t('status_repairing') },
            'listo': { class: 'completed', text: i18n.t('status_ready') },
            'entregado': { class: 'completed', text: i18n.t('status_delivered') },
            'garantia': { class: 'completed', text: i18n.t('status_warranty') },
            'cancelado': { class: 'cancelled', text: i18n.t('status_cancelled') },

            // Space-separated key versions just in case
            'en proceso': { class: 'in-progress', text: i18n.t('status_in_progress') },
            'en reparacion': { class: 'in-progress', text: i18n.t('status_repairing') },

            // Fallbacks for transition/legacy
            'pendiente': { class: 'pending', text: i18n.t('status_received') },
            'presupuesto': { class: 'in-progress', text: i18n.t('status_diagnosing') },
            'reparando': { class: 'in-progress', text: i18n.t('status_repairing') },
            'esperando_pieza': { class: 'in-progress', text: i18n.t('status_repairing') },
            'reparado': { class: 'completed', text: i18n.t('status_ready') },
            'completada': { class: 'completed', text: i18n.t('status_ready') }
        };
        const status = statusMap[estado] || statusMap.recibido;

        return `<span class="status-badge ${status.class}">${status.text}</span>`;
    }

    /**
     * Formatea precio
     */
    formatPrice(precio) {
        return app.formatPrice(precio);
    }

    /**
     * Formatea fecha
     */
    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString(i18n.currentLocale || 'es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    /**
     * Obtiene la etiqueta del tipo de dispositivo
     */
    getDispositivoLabel(dispositivo) {
        if (window.i18n) {
            const keys = {
                'movil': 'rep_type_mobile',
                'tablet': 'rep_type_tablet',
                'ordenador': 'rep_type_pc',
                'videoconsola': 'rep_type_console',
                'otro': 'rep_type_other'
            };
            if (keys[dispositivo]) return i18n.t(keys[dispositivo]);
        }

        const labels = {
            'movil': 'Móvil',
            'tablet': 'Tablet',
            'ordenador': 'Ordenador',
            'videoconsola': 'Videoconsola',
            'otro': 'Otro'
        };
        return labels[dispositivo] || dispositivo;
    }

    /**
     * Renderiza una tarjeta de reparación
     */
    renderCard(reparacion) {
        const cliente = this.clientes.find(c => String(c.id) === String(reparacion.cliente_id));
        const clienteName = cliente ? `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim() : i18n.t('cliente_desconocido');
        const clientePhone = cliente ? cliente.telefono || '' : '';
        const clienteDni = cliente ? cliente.dni || '' : '';

        let trackUrl = '';
        if (this.trackingUrl) {
            const separator = this.trackingUrl.includes('?') ? '&' : '?';
            trackUrl = `${this.trackingUrl}${separator}id=${reparacion.id}`;

            // UNIVERSAL TRACKING: Enviar credenciales (Base64) para que el hosting central funcione
            const sUrl = window.supabaseClient?.url;
            const sKey = window.supabaseClient?.anonKey;
            if (sUrl && sKey && sUrl !== '' && sKey !== '') {
                try {
                    // Usar encodeURIComponent para evitar que caracteres + y / rompan la URL
                    const uEncoded = encodeURIComponent(btoa(sUrl));
                    const kEncoded = encodeURIComponent(btoa(sKey));
                    trackUrl += `&u=${uEncoded}&k=${kEncoded}`;
                } catch (e) {
                    console.warn('Could not encode credentials for tracking URL');
                }
            }
        }

        let whatsappLink = '';

        if (clientePhone) {
            let message = '';
            const status = reparacion.estado;

            const price = this.formatPrice(reparacion.precio_final || reparacion.precio);
            const dispositivo = `${this.getDispositivoLabel(reparacion.dispositivo)} ${reparacion.marca || ''} ${reparacion.modelo || ''}`.trim();

            // Defaults (fallback)
            const defaults = {
                pendiente: i18n.t('tpl_default_pending'),
                presupuesto: i18n.t('tpl_default_budget'),
                reparado: i18n.t('tpl_default_ready'),
                entregado: i18n.t('tpl_default_delivered')
            };

            // Select template
            let template = '';
            if (['recibido', 'pendiente'].includes(status)) {
                template = this.templates?.pendiente || defaults.pendiente;
            } else if (['diagnostico', 'reparando', 'esperando_pieza'].includes(status)) {
                // Use "reparando" as general in-progress template if exists, or fallback to pending
                template = this.templates?.reparado || defaults.pendiente;
            } else if (['listo', 'reparado', 'entregado'].includes(status)) {
                template = this.templates?.reparado || defaults.reparado;
            } else {
                template = defaults.pendiente; // Fallback
            }

            // NEW: Prepare Advanced Variables
            const imei = reparacion.imei || i18n.t('label_not_available') || 'N/A';
            const repuestosNum = (reparacion.parts || []).map(p => p.name).join(', ') || i18n.t('label_none') || 'Ninguno';

            // Checklist Summary
            let checklistSummary = '';
            if (reparacion.checklist) {
                const checked = Object.entries(reparacion.checklist)
                    .filter(([_, val]) => val === true)
                    .map(([key, _]) => `✅ ${i18n.t('check_' + key) || key}`)
                    .join(', ');
                const failed = Object.entries(reparacion.checklist)
                    .filter(([_, val]) => val === false)
                    .map(([key, _]) => `❌ ${i18n.t('check_' + key) || key}`)
                    .join(', ');
                checklistSummary = [checked, failed].filter(s => s).join('\n');
            }

            // Replace variables
            message = template
                .replace(/{CLIENTE}/g, clienteName)
                .replace(/{DISPOSITIVO}/g, dispositivo)
                .replace(/{PRECIO}/g, price)
                .replace(/{TOTAL}/g, price)
                .replace(/{URL}/g, trackUrl)
                .replace(/{IMEI}/g, imei)
                .replace(/{SN}/g, imei)
                .replace(/{REPUESTOS}/g, repuestosNum)
                .replace(/{PIEZAS}/g, repuestosNum)
                .replace(/{CHECKLIST}/g, checklistSummary);

            // FINAL SAFETY CHECK: FORCE REPLACE LOCALHOST IF IT SLIPPED THROUGH
            if (message.includes('127.0.0.1') || message.includes('localhost')) {
                const currentTracking = this.trackingUrl || 'https://reparapp-premium.pages.dev/tracking';
                message = message
                    .replace(/http:\/\/127\.0\.0\.1:\d+\/(?:tracking|track)\.html\?id=/g, `${currentTracking}?id=`)
                    .replace(/http:\/\/127\.0\.0\.1:\d+/g, currentTracking);
            }

            const cleanPhone = clientePhone.replace(/\D/g, ''); // Remove non-digits
            // Basic check for Spain (34) if missing
            const finalPhone = cleanPhone.startsWith('34') || cleanPhone.length > 9 ? cleanPhone : `34${cleanPhone}`;

            whatsappLink = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
        }

        return `
            <div class="card repair-card-v2" data-id="${reparacion.id}">
                <!-- Visible client data -->
                <div class="card-visible-info" style="padding: 10px 12px 6px 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; cursor: pointer; user-select: none; width: 100%;">
                    <div style="flex: 1; min-width: 0; text-align: left;">
                        <h3 class="card-title" style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 700; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; text-align: left;">
                            ${this.escapeHtml(clienteName)}
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 2px; font-size: 0.9rem; color: var(--text-secondary); text-align: left;">
                            <div style="display: flex; align-items: center; gap: 4px; text-align: left;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px; color: var(--text-muted); flex-shrink: 0;">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                </svg>
                                <span style="text-align: left;">DNI: ${this.escapeHtml(clienteDni || 'N/A')}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px; text-align: left;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px; color: var(--text-muted); flex-shrink: 0;">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                                <span style="text-align: left;">Tel: ${this.escapeHtml(clientePhone || 'N/A')}</span>
                            </div>
                            <!-- Botón + Detalles para expandir info de reparación -->
                            <div style="margin-top: 4px;">
                                <span class="btn-toggle-details" style="cursor: pointer; font-size: 0.8rem; font-weight: 700; color: var(--electric-cyan); user-select: none; display: inline-flex; align-items: center; gap: 4px;">
                                    + Detalles
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; justify-content: flex-end;">
                        ${this.getStatusBadge(reparacion.estado)}
                    </div>
                </div>

                <!-- Collapsible details and options -->
                <div class="card-collapsible-info" style="display: none; border-top: 1px dashed var(--border-color); padding: 10px 12px; background: rgba(255,255,255,0.01); width: 100%;">
                    <div class="repair-details-container" style="padding: 0; margin-bottom: 0; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; text-align: left; width: 100%;">
                        
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px; width: 100%; text-align: left;">
                            <span>Fecha: ${this.formatDate(reparacion.fecha_creacion)}</span>
                            ${reparacion.assigned_to_name ? `<span>👤 ${this.escapeHtml(reparacion.assigned_to_name)}</span>` : ''}
                        </div>

                        ${reparacion.dispositivo ? `
                        <div class="card-info" style="margin-bottom: 2px; display: flex; align-items: center; gap: 6px; text-align: left; width: 100%;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; flex-shrink: 0;">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                <line x1="12" y1="18" x2="12.01" y2="18"></line>
                            </svg>
                            <span style="font-weight: 600; font-size: 0.8rem;">${this.getDispositivoLabel(reparacion.dispositivo)}${reparacion.marca ? ' - ' + this.escapeHtml(reparacion.marca) : ''}${reparacion.modelo ? ' ' + this.escapeHtml(reparacion.modelo) : ''}</span>
                        </div>
                        ` : ''}

                        ${reparacion.imei ? `
                        <div class="card-info" style="margin-bottom: 2px; font-size: 0.75rem; opacity: 0.8; display: flex; align-items: center; gap: 6px; text-align: left; width: 100%;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; flex-shrink: 0;">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                            <span>IMEI/SN: ${this.escapeHtml(reparacion.imei)}</span>
                        </div>
                        ` : ''}

                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.8rem; text-align: left; width: 100%;">
                            <strong>${i18n.t('label_problem') || 'Problema'}:</strong> ${this.escapeHtml(reparacion.problema || reparacion.descripcion)}
                        </p>
                        
                        ${reparacion.solucion ? `
                        <p style="color: var(--electric-cyan); margin: 0; font-size: 0.8rem; text-align: left; width: 100%;">
                            <strong>${i18n.t('label_solution') || 'Solución'}:</strong> ${this.escapeHtml(reparacion.solucion)}
                        </p>
                        ` : ''}

                        <div style="margin-top: 2px; text-align: left; width: 100%;">
                            ${reparacion.rgpd_accepted ? `
                            <div style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--electric-cyan); background: rgba(0, 255, 198, 0.08); padding: 2px 6px; border-radius: 4px;">
                                ✅ RGPD Firmado${reparacion.signature ? ' ✍️' : ''}
                            </div>
                            ` : `
                            <div style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--text-muted); background: rgba(255, 255, 255, 0.03); padding: 2px 6px; border-radius: 4px;">
                                ⚠️ Sin firma RGPD
                            </div>
                            `}
                        </div>
                    </div>
                </div>

                <!-- Action buttons and Price - ALWAYS visible at the bottom -->
                <div class="card-footer" style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: space-between; border-top: 1px solid var(--border-color); padding: 8px 12px; align-items: center; margin-top: auto; width: 100%;">
                    <div class="price" style="font-size: 1rem; font-weight: 800; margin: 0;">${this.formatPrice(reparacion.precio_final || reparacion.precio)}</div>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-icon btn-sm btn-copy-link" data-action="copy-link" data-id="${reparacion.id}" title="Copiar Enlace Seguimiento">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        </button>

                        <button class="btn btn-icon btn-sm btn-whatsapp-pro" data-action="whatsapp-pro" data-id="${reparacion.id}" title="Enviar WhatsApp (Pro)" style="color: #25D366;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; height:18px;">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-13.1 8.38 8.38 0 0 1 3.8.9L21 3z"></path>
                            </svg>
                        </button>

                        <button class="btn btn-icon btn-sm btn-print" data-action="print" data-id="${reparacion.id}" title="Imprimir Ticket">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                <rect x="6" y="14" width="12" height="8"></rect>
                            </svg>
                        </button>

                        <button class="btn btn-icon btn-sm btn-print-label" data-action="print-label" data-id="${reparacion.id}" title="Imprimir Etiqueta" style="color: var(--electric-cyan);">
                            <span class="material-icons" style="font-size: 16px;">label</span>
                        </button>

                        <button class="btn btn-icon btn-sm btn-convert" data-action="convert" data-id="${reparacion.id}" title="Convertir Documento" style="color: #FF9800;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                                <polyline points="17 1 21 5 17 9"></polyline>
                                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                                <polyline points="7 23 3 19 7 15"></polyline>
                                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                            </svg>
                        </button>

                        <button class="btn btn-icon btn-sm btn-edit" data-action="edit" data-id="${reparacion.id}" title="Editar">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>

                        <button class="btn btn-icon btn-sm btn-delete" data-action="delete" data-id="${reparacion.id}" title="Eliminar">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Edita una reparación
     */
    async editReparacion(id) {
        this.openModal(id);
    }

    /**
     * Copia el enlace de seguimiento
     * Primero sube la reparación a Supabase para garantizar que el enlace funcione
     */
    async copyTrackingLink(id) {
        const reparacion = this.reparaciones.find(r => r.id === id);
        if (!reparacion) return;

        // 1. Push repair to Supabase FIRST (like Android does)
        try {
            if (window.supabaseClient?.isConfigured) {
                window.app.showToast('☁️ Subiendo reparación a la nube...', 'info');

                let licenseKey = '';
                if (window.licenseManager && window.licenseManager.licenseData) {
                    licenseKey = window.licenseManager.licenseData.licenseKey || '';
                }
                if (licenseKey === 'DAVID-REPARAPP-OWNER-2026-TOKEN') {
                    licenseKey = 'DAVID-MASTER-PRO-2026';
                }

                let sucursalId = await db.getConfig('sucursal_id');
                if (!sucursalId || sucursalId === 'default') {
                    sucursalId = 'default';
                }

                // Push client first (foreign key dependency)
                const cliente = this.clientes.find(c => c.id === reparacion.cliente_id);
                if (cliente) {
                    const clientPayload = {
                        id: cliente.id,
                        nombre: (cliente.nombre || '') + (cliente.apellido ? ' ' + cliente.apellido : ''),
                        telefono: cliente.telefono || '',
                        email: cliente.email || '',
                        direccion: cliente.direccion || '',
                        notas: cliente.notas || '',
                        dni: cliente.dni || '',
                        sucursal_id: sucursalId,
                        licencia_key: licenseKey,
                        fecha_creacion: new Date(cliente.fecha_creacion || Date.now()).getTime(),
                        ultima_modificacion: Date.now()
                    };
                    await supabaseClient.upsertCliente(clientPayload);
                }

                // Push repair
                const repairPayload = {
                    id: reparacion.id,
                    cliente_id: reparacion.cliente_id,
                    problema: reparacion.problema || reparacion.descripcion || 'Sin descripción',
                    estado: localToCloudStatus(reparacion.estado || 'pendiente'),
                    precio: reparacion.precio || 0,
                    precio_final: reparacion.precio_final || null,
                    sucursal_id: sucursalId,
                    licencia_key: licenseKey,
                    fecha_creacion: new Date(reparacion.fecha_creacion || Date.now()).getTime(),
                    ultima_modificacion: Date.now()
                };
                if (reparacion.marca) repairPayload.marca = reparacion.marca;
                if (reparacion.modelo) repairPayload.modelo = reparacion.modelo;
                if (reparacion.imei) {
                    repairPayload.imei = reparacion.imei;
                    repairPayload.imei_serial = reparacion.imei;
                }
                if (reparacion.solucion) repairPayload.solucion = reparacion.solucion;
                if (reparacion.pin) repairPayload.contrasena = reparacion.pin;
                if (reparacion.contrasena) repairPayload.contrasena = reparacion.contrasena;
                if (reparacion.dispositivo) repairPayload.dispositivo = reparacion.dispositivo;
                if (reparacion.garantia_meses !== undefined) repairPayload.garantia_meses = reparacion.garantia_meses;
                if (reparacion.signature) {
                    repairPayload.signature = reparacion.signature;
                    if (['listo', 'entregado'].includes(reparacion.estado)) {
                        repairPayload.firma_recogida = reparacion.signature;
                    } else {
                        repairPayload.firma_entrada = reparacion.signature;
                    }
                }
                if (reparacion.checklist) repairPayload.checklist = reparacion.checklist;
                if (reparacion.parts) repairPayload.parts = reparacion.parts;

                // Signature & RGPD Data
                if (reparacion.signatureStrokes) repairPayload.signatureStrokes = reparacion.signatureStrokes;
                if (reparacion.rgpd_accepted) {
                    repairPayload.rgpd_accepted = reparacion.rgpd_accepted;
                    repairPayload.rgpd_accepted_date = reparacion.rgpd_accepted_date || reparacion.fecha_creacion;
                }

                await supabaseClient.upsertReparacion(repairPayload);
                console.log('✅ Reparación subida a la nube para tracking');
            }
        } catch (e) {
            console.error('Error pushing repair for tracking:', e);
            // Continue anyway — still copy the link
        }

        // 2. Build and copy the tracking link
        let trackUrl = this.trackingUrl || 'https://reparapp-premium.pages.dev/tracking';
        const separator = trackUrl.includes('?') ? '&' : '?';
        trackUrl += `${separator}id=${reparacion.id}`;

        // UNIVERSAL TRACKING: Enviar credenciales (Base64) para que el hosting funcione dinámicamente
        const sUrl = window.supabaseClient?.url;
        const sKey = window.supabaseClient?.anonKey;
        if (sUrl && sKey && sUrl !== '' && sKey !== '') {
            try {
                const uEncoded = encodeURIComponent(btoa(sUrl));
                const kEncoded = encodeURIComponent(btoa(sKey));
                trackUrl += `&u=${uEncoded}&k=${kEncoded}`;
            } catch (e) {
                console.warn('Could not encode credentials for tracking URL');
            }
        }

        try {
            await navigator.clipboard.writeText(trackUrl);
            if (window.supabaseClient?.isConfigured) {
                window.app.showToast('📋 Enlace copiado ✅ (Datos sincronizados)', 'success');
            } else {
                window.app.showToast('📋 Enlace copiado (⚠️ Conecta la nube para que funcione)', 'warning');
            }
        } catch (err) {
            console.error('Error al copiar:', err);
        }
    }

    /**
     * Adjunta listeners a las tarjetas
     */
    attachCardListeners() {
        // Cambiar estado
        document.querySelectorAll('[data-action="status"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await this.cycleStatus(id);
            });
        });

        // Copiar Enlace
        document.querySelectorAll('[data-action="copy-link"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyTrackingLink(btn.dataset.id);
            });
        });

        // WhatsApp Pro
        document.querySelectorAll('[data-action="whatsapp-pro"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sendWhatsAppPro(btn.dataset.id);
            });
        });

        // Editar
        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.openModal(id);
            });
        });

        // Imprimir Ticket
        document.querySelectorAll('[data-action="print"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                try {
                    const reparacion = await db.getReparacion(id);
                    if (reparacion) {
                        const cliente = await db.getCliente(reparacion.cliente_id);
                        if (window.printer) {
                            window.printer.printRepairTicket(reparacion, cliente);
                        } else {
                            app.showToast('Error: Módulo de impresión no cargado', 'error');
                        }
                    }
                } catch (error) {
                    console.error('Error printing ticket:', error);
                    app.showToast('Error crítico al imprimir: ' + error.message, 'error');
                }
            });
        });

        // Imprimir Etiqueta
        document.querySelectorAll('[data-action="print-label"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                try {
                    const reparacion = await db.getReparacion(id);
                    if (reparacion) {
                        const cliente = await db.getCliente(reparacion.cliente_id);
                        if (window.printer && window.printer.printLabel) {
                            window.printer.printLabel(reparacion, cliente);
                        } else {
                            app.showToast('Error: Módulo de etiquetas no cargado', 'error');
                        }
                    }
                } catch (error) {
                    console.error('Error printing label:', error);
                    app.showToast('Error al imprimir etiqueta: ' + error.message, 'error');
                }
            });
        });

        // Convertir Documento
        document.querySelectorAll('[data-action="convert"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.showConversionOptions(id);
            });
        });

        // Eliminar
        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                app.confirmDelete(
                    i18n.t('rep_delete_confirm'),
                    i18n.t('dlg_delete_warning'),
                    async () => {
                        await this.deleteReparacion(id);
                    }
                );
            });
        });

        // Click en "+ Detalles" para expandir/colapsar los detalles de la reparación
        document.querySelectorAll('.card[data-id]').forEach(card => {
            const toggleBtn = card.querySelector('.btn-toggle-details');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const collapsible = card.querySelector('.card-collapsible-info');
                    if (collapsible) {
                        const isHidden = collapsible.style.display === 'none';
                        collapsible.style.display = isHidden ? 'block' : 'none';
                        toggleBtn.textContent = isHidden ? '- Detalles' : '+ Detalles';
                    }
                });
            }
        });
    }

    /**
     * Cicla el estado de una reparación
     */
    async cycleStatus(id) {
        try {
            const reparacion = await db.getReparacion(id);
            if (!reparacion) return;

            // Updated status flow
            const estados = ['recibido', 'diagnostico', 'en_proceso', 'en_reparacion', 'listo', 'entregado', 'garantia', 'cancelado'];

            // Handle legacy statuses mapping
            if (reparacion.estado === 'pendiente') reparacion.estado = 'recibido';
            if (reparacion.estado === 'presupuesto') reparacion.estado = 'diagnostico';
            if (reparacion.estado === 'reparando') reparacion.estado = 'en_reparacion';
            if (reparacion.estado === 'esperando_pieza') reparacion.estado = 'en_reparacion';
            if (reparacion.estado === 'reparado') reparacion.estado = 'listo';
            if (reparacion.estado === 'en proceso') reparacion.estado = 'en_proceso';
            if (reparacion.estado === 'en reparacion') reparacion.estado = 'en_reparacion';

            let currentIndex = estados.indexOf(reparacion.estado);
            if (currentIndex === -1) currentIndex = 0; // Default to start if unknown

            const nextIndex = (currentIndex + 1) % estados.length;
            reparacion.estado = estados[nextIndex];

            // Auto-set modification date
            reparacion.ultima_modificacion = Date.now();

            await db.saveReparacion(reparacion);
            await this.render();

            app.showToast(`Estado: ${this.getStatusBadge(reparacion.estado).replace(/<[^>]*>/g, '')} `, 'info');
        } catch (error) {
            console.error('Error cycling status:', error);
            app.showToast('Error al cambiar estado', 'error');
        }
    }

    /**
     * Abre el modal de reparación
     */
    async openModal(id = null) {
        try {
            const modal = document.getElementById('modal-reparacion');
            const title = document.getElementById('modal-reparacion-title');
            const form = document.getElementById('form-reparacion');
            const selectCliente = document.getElementById('reparacion-cliente');
            const selectTecnico = document.getElementById('reparacion-tecnico');

            // Force Blur Logic
            if (document.activeElement && document.activeElement.tagName !== 'BODY') {
                document.activeElement.blur();
            }

            // Show modal immediately
            modal.classList.add('active');

            form.reset();
            document.getElementById('reparacion-id').value = '';

            // Show loading state in select
            selectCliente.innerHTML = `<option value="">${i18n.t('loading_clients')}</option>`;

            // Load Data Asynchronously
            try {
                const clientes = await db.getAllClientes();
                const users = await db.getAllUsers(); // Get technicians

                selectCliente.innerHTML = `<option value="">${i18n.t('rep_sel_client')}</option>` +
                    clientes.map(c => `<option value="${c.id}">${this.escapeHtml(c.nombre)} ${this.escapeHtml(c.apellido || '')}</option>`).join('');

                // Initialize SearchSelect
                if (typeof SearchSelect !== 'undefined') {
                    if (!this.clientSearchWidget) {
                        this.clientSearchWidget = new SearchSelect('reparacion-cliente');
                    } else {
                        this.clientSearchWidget.syncOptionsFromSelect();
                    }
                }

                // Populate Technicians
                if (selectTecnico) {
                    selectTecnico.innerHTML = `<option value="">${i18n.t('rep_tech_none')}</option>` +
                        users.map(u => `<option value="${u.id}">${this.escapeHtml(u.nombre)} (${u.role === 'admin' ? i18n.t('role_admin') : i18n.t('role_tech')})</option>`).join('');
                }

                if (id) {
                    // Modo edición
                    const reparacion = await db.getReparacion(id);
                    if (reparacion) {
                        document.getElementById('reparacion-id').value = reparacion.id;
                        document.getElementById('reparacion-cliente').value = reparacion.cliente_id;

                        if (this.clientSearchWidget) {
                            this.clientSearchWidget.setValue(reparacion.cliente_id);
                        }

                        document.getElementById('reparacion-dispositivo').value = reparacion.dispositivo || '';
                        document.getElementById('reparacion-marca').value = reparacion.marca || '';
                        document.getElementById('reparacion-modelo').value = reparacion.modelo || '';
                        document.getElementById('reparacion-imei').value = reparacion.imei || '';
                        document.getElementById('reparacion-problema').value = reparacion.problema || reparacion.descripcion || '';
                        document.getElementById('reparacion-solucion').value = reparacion.solucion || '';
                        document.getElementById('reparacion-estado').value = reparacion.estado;
                        document.getElementById('reparacion-precio').value = reparacion.precio || '';
                        document.getElementById('reparacion-precio-final').value = reparacion.precio_final || '';
                        document.getElementById('reparacion-fecha-entrega').value = reparacion.fecha_entrega ? new Date(reparacion.fecha_entrega).toISOString().split('T')[0] : '';
                        document.getElementById('reparacion-pin').value = reparacion.pin || '';
                        document.getElementById('reparacion-notas').value = reparacion.notas || '';
                        document.getElementById('reparacion-garantia-meses').value = reparacion.garantia_meses !== undefined ? reparacion.garantia_meses : 3;
                        if (selectTecnico) selectTecnico.value = reparacion.assigned_to_id || '';
                    }
                } else {
                    title.textContent = i18n.t('mod_repair_new');
                    document.getElementById('reparacion-garantia-meses').value = 3; // Default 3 months
                    if (this.clientSearchWidget) this.clientSearchWidget.reset();
                }

                // Load Checklist states
                const currentRep = id ? await db.getReparacion(id) : null;
                const checklist = currentRep?.checklist || {};
                const checklistContainer = document.getElementById('reparacion-checklist');
                if (checklistContainer) {
                    checklistContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => {
                        chk.checked = !!checklist[chk.value];
                    });
                }

                // Clear/Load Signature & Pattern
                this.clearSignature();
                this.clearPattern();
                if (currentRep?.signature) {
                    this.lastSignatureImageBase64 = currentRep.signature;
                    
                    // Si no hay trazos pero sí imagen, cargarla como imagen de fondo para redibujarla
                    const img = new Image();
                    img.onload = () => {
                        this.lastSignatureImage = img;
                        if (typeof this.redrawSignature === 'function') {
                            this.redrawSignature();
                        }
                    };
                    img.src = currentRep.signature;
                }

                // FORCE RESIZE NOW THAT MODAL IS VISIBLE
                setTimeout(() => {
                    if (typeof this.resizeSignatureCanvas === 'function') {
                        this.resizeSignatureCanvas();
                    }
                }, 300);

                if (currentRep?.signatureStrokes) {
                    this.allStrokes = currentRep.signatureStrokes;
                    // Trigger redraw after a short delay to ensure canvas is ready
                    setTimeout(() => {
                        const canvas = document.getElementById('signature-pad');
                        if (canvas && typeof this.redrawSignature === 'function') {
                            this.redrawSignature();
                        }
                    }, 150);
                }

                // Load Pattern Lock data
                if (currentRep?.patron_puntos && currentRep.patron_puntos.length > 0) {
                    this.patternSequence = [...currentRep.patron_puntos];
                    const patternToggle = document.getElementById('pattern-lock-toggle');
                    const patternContainer = document.getElementById('pattern-lock-container');
                    if (patternToggle) patternToggle.checked = true;
                    if (patternContainer) patternContainer.style.display = 'block';
                    setTimeout(() => {
                        if (typeof this.redrawPattern === 'function') {
                            this.redrawPattern();
                        }
                    }, 250);
                }

                // Load Used Parts
                this.usedParts = currentRep?.parts || [];
                await this.initPartsSearch();
                this.renderUsedParts();

                // Load Photos
                this.repairPhotos = currentRep?.photos || [];
                this.renderPhotos();

                // Attach Paste Listener
                this._pasteHandler = (e) => this.handlePaste(e);
                window.addEventListener('paste', this._pasteHandler);

                // Reset RGPD checkbox and signature section
                // Reset RGPD checkbox and signature area
                const rgpdCheckbox = document.getElementById('rgpd-accept-checkbox');
                const sigArea = document.getElementById('signature-canvas-area');
                if (rgpdCheckbox) {
                    // Force false first to be safe
                    rgpdCheckbox.checked = false;
                    if (sigArea) { sigArea.style.opacity = '0.3'; sigArea.style.pointerEvents = 'none'; }

                    // If editing and already accepted, set to true
                    if (id && currentRep && currentRep.rgpd_accepted) {
                        rgpdCheckbox.checked = true;
                        if (sigArea) { sigArea.style.opacity = '1'; sigArea.style.pointerEvents = 'auto'; }
                    }
                }
            } catch (dataError) {
                console.error('Error loading data for modal:', dataError);
                selectCliente.innerHTML = `<option value="">${i18n.t('err_loading_clients')}</option>`;
            }

        } catch (error) {
            console.error('Error opening repair modal:', error);
            document.getElementById('modal-reparacion').classList.remove('active');
            app.showInfoModal({
                type: 'error',
                title: i18n.t('app_error_title'),
                message: i18n.t('app_error_modal_repair') + error.message
            });
        }
    }

    /**
     * Cierra el modal de reparación
     */
    closeModal() {
        document.getElementById('modal-reparacion').classList.remove('active');

        // Remove Paste Listener
        if (this._pasteHandler) {
            window.removeEventListener('paste', this._pasteHandler);
            this._pasteHandler = null;
        }
    }

    /**
     * Guarda una reparación
     */
    async saveReparacion() {
        try {
            const id = document.getElementById('reparacion-id').value;
            // ...
            const precioFinalInput = document.getElementById('reparacion-precio-final');

            const checklist = {};
            document.querySelectorAll('#reparacion-checklist input[type="checkbox"]').forEach(chk => {
                checklist[chk.value] = chk.checked;
            });

            const reparacion = {
                cliente_id: document.getElementById('reparacion-cliente').value,
                dispositivo: document.getElementById('reparacion-dispositivo').value || null,
                marca: document.getElementById('reparacion-marca').value.trim() || null,
                modelo: document.getElementById('reparacion-modelo').value.trim() || null,
                imei: document.getElementById('reparacion-imei').value.trim() || null,
                problema: document.getElementById('reparacion-problema').value.trim(),
                descripcion: document.getElementById('reparacion-problema').value.trim(),
                solucion: document.getElementById('reparacion-solucion').value.trim() || null,
                estado: document.getElementById('reparacion-estado').value,
                precio: parseFloat(document.getElementById('reparacion-precio').value) || 0,
                precio_final: precioFinalInput ? (parseFloat(precioFinalInput.value) || null) : null,
                fecha_entrega: document.getElementById('reparacion-fecha-entrega').value ? new Date(document.getElementById('reparacion-fecha-entrega').value).getTime() : null,
                pin: document.getElementById('reparacion-pin').value.trim() || null,
                notas: document.getElementById('reparacion-notas').value.trim() || null,
                checklist: checklist,
                parts: this.usedParts, // Save parts list
                photos: this.repairPhotos, // Save photos
                signature: this.getSignatureData(), // Save DataURL for printing/preview
                signatureStrokes: this.allStrokes && this.allStrokes.length > 0 ? this.allStrokes : null, // Save raw strokes for redrawing
                patron_puntos: this.patternSequence && this.patternSequence.length >= 2 ? [...this.patternSequence] : null,
                patron_puntos_image: this.getPatternImage(),
                rgpd_accepted: document.getElementById('rgpd-accept-checkbox')?.checked || false,
                rgpd_accepted_date: document.getElementById('rgpd-accept-checkbox')?.checked ? new Date().toISOString() : null,
                assigned_to_id: document.getElementById('reparacion-tecnico')?.value || null,
                garantia_meses: parseInt(document.getElementById('reparacion-garantia-meses').value) || 0
            };

            // Detect status change to "Listo" or "Entregado" to deduct stock if not already done
            const oldRep = id ? await db.getReparacion(id) : null;
            const isClosing = (reparacion.estado === 'listo' || reparacion.estado === 'entregado') && (!oldRep || (oldRep.estado !== 'listo' && oldRep.estado !== 'entregado' && !oldRep.stock_deducted));

            // If already deducted, keep the flag
            if (oldRep && oldRep.stock_deducted) {
                reparacion.stock_deducted = true;
            }

            // Get Technician Name for cache
            if (reparacion.assigned_to_id) {
                const selectTecnico = document.getElementById('reparacion-tecnico');
                if (selectTecnico && selectTecnico.selectedIndex !== -1) {
                    const selectedOption = selectTecnico.options[selectTecnico.selectedIndex];
                    if (selectedOption) {
                        // Remove role info from name which is in parenthesis or brackets
                        reparacion.assigned_to_name = selectedOption.text.split('(')[0].split('[')[0].trim();
                    } else {
                        reparacion.assigned_to_name = null;
                    }
                } else {
                    reparacion.assigned_to_name = null;
                }
            } else {
                reparacion.assigned_to_name = null;
            }

            if (!reparacion.cliente_id) {
                app.showToast(i18n.t('toast_err_select_client'), 'error');
                return;
            }

            if (id) {
                reparacion.id = id;
            }

            const savedRep = await db.saveReparacion(reparacion);

            // Deduct stock if completing for the first time
            if (isClosing && reparacion.parts && reparacion.parts.length > 0 && !reparacion.stock_deducted) {
                await this.deductPartsStock(reparacion.parts, reparacion.id);
                reparacion.stock_deducted = true;
                // Update the document with the flag
                await db.saveReparacion(reparacion);
            }

            this.closeModal();
            await this.render();

            app.showToast(id ? i18n.t('toast_updated') : i18n.t('toast_saved'), 'success');
        } catch (error) {
            console.error('Error saving repair:', error);
            app.showToast(i18n.t('toast_err_save_repair', { error: error.message }), 'error');
        }
    }

    /**
     * Elimina una reparación
     */
    async deleteReparacion(id) {
        try {
            await db.deleteReparacion(id);
            await this.render();
            app.showToast(i18n.t('toast_deleted'), 'success');
        } catch (error) {
            console.error('Error deleting repair:', error);
            app.showToast(i18n.t('toast_err_delete_repair'), 'error');
        }
    }

    /**
     * Signature Pad Logic
     */
    setupSignaturePad() {
        const canvas = document.getElementById('signature-pad');
        if (!canvas) return;

        // --- PREVENT MULTIPLE INITIALIZATIONS ---
        if (this.signaturePadInitialized) {
            console.log('Signature Pad already initialized, skipping listeners.');
            this.clearSignature(); // Just clear for the new repair
            return;
        }

        const ctx = canvas.getContext('2d');
        this.sigCtx = ctx;
        this.sigCanvas = canvas;

        let isDrawing = false;
        this.allStrokes = [];
        this.lastSignatureImage = null; // Store for persistent Redraw
        let currentStroke = [];

        const applyStyles = () => {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000000';
        };

        const redrawAll = () => {
            // Use setTransform to ensure clean clear on any DPI
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            // 1. Draw Saved Image (Background)
            if (this.lastSignatureImage) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(this.lastSignatureImage, 0, 0, canvas.width, canvas.height);
                ctx.restore();
            }

            applyStyles();

            // 2. Draw Strokes
            const drawStroke = (stroke) => {
                if (stroke.length < 2) return;
                ctx.beginPath();
                ctx.moveTo(stroke[0].x, stroke[0].y);

                let i;
                for (i = 1; i < stroke.length - 2; i++) {
                    const xc = (stroke[i].x + stroke[i + 1].x) / 2;
                    const yc = (stroke[i].y + stroke[i + 1].y) / 2;
                    ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, xc, yc);
                }
                if (i < stroke.length - 1) {
                    ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, stroke[i + 1].x, stroke[i + 1].y);
                }
                ctx.stroke();
            };

            this.allStrokes.forEach(drawStroke);
            if (currentStroke && currentStroke.length > 0) drawStroke(currentStroke);
        };

        // Export redrawAll as a class method for external access (like openModal)
        this.redrawSignature = redrawAll;

        const resizeCanvas = () => {
            const ratio = window.devicePixelRatio || 1;
            const container = canvas.parentElement;
            if (!container) return;
            const width = container.clientWidth;
            const height = 150;

            if (width === 0) {
                console.warn('Canvas container width is 0, skipping resize.');
                return;
            }

            if (canvas.width !== width * ratio) {
                canvas.width = width * ratio;
                canvas.height = height * ratio;
                // Use setTransform instead of scale to avoid accumulation
                ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
                redrawAll();
            }
        };

        this.resizeSignatureCanvas = resizeCanvas;

        window.addEventListener('resize', resizeCanvas);
        setTimeout(resizeCanvas, 300); // 300ms to ensure modal animation finished

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const startDrawing = (e) => {
            isDrawing = true;
            const pos = getPos(e);
            currentStroke = [pos];
            redrawAll();
        };

        const draw = (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            currentStroke.push(pos);
            redrawAll();
        };

        const stopDrawing = () => {
            if (isDrawing && currentStroke.length > 1) {
                this.allStrokes.push([...currentStroke]);
            }
            isDrawing = false;
            currentStroke = [];
            redrawAll();
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDrawing);

        canvas.addEventListener('touchstart', (e) => {
            if (e.target === canvas) {
                e.preventDefault();
                startDrawing(e);
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (e.target === canvas) {
                e.preventDefault();
                draw(e);
            }
        }, { passive: false });

        canvas.addEventListener('touchend', stopDrawing);

        // Limpiar
        document.getElementById('btn-clear-signature')?.addEventListener('click', () => {
            this.clearSignature();
        });

        // Listen for signatures from local server (WiFi)
        if (window.api?.signature) {
            window.api.signature.onReceived((data) => {
                const currentId = document.getElementById('reparacion-id')?.value;
                if (data && data.id === currentId) {
                    this.handleSignatureResult(data);
                }
            });
        }

        this.signaturePadInitialized = true;
    }

    /**
     * Clear Signature
     */
    clearSignature() {
        this.allStrokes = [];
        this.lastSignatureImage = null; // Clear saved image
        this.lastSignatureImageBase64 = null; // Clear saved base64 image
        this.signatureChanged = true;

        if (this.redrawSignature) {
            this.redrawSignature();
        }

        const canvas = document.getElementById('signature-pad');
        if (canvas) {
            canvas.style.background = '#ffffff';
        }

        const rgpdCheck = document.getElementById('rgpd-accept-checkbox');
        if (rgpdCheck) {
            rgpdCheck.checked = false;
            const sigArea = document.getElementById('signature-canvas-area');
            if (sigArea) {
                sigArea.style.opacity = '0.3';
                sigArea.style.pointerEvents = 'none';
            }
        }
    }

    getSignatureData() {
        const canvas = document.getElementById('signature-pad');
        if (!canvas) return null;

        // Check if canvas is empty to avoid saving whitespace
        const ctx = canvas.getContext('2d');
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const isEmpty = !Array.from(pixels).some(channel => channel !== 0);

        if (isEmpty) {
            return this.lastSignatureImageBase64 || null;
        }

        return canvas.toDataURL();
    }

    async handleSignatureResult(data) {
        if (!data) return;

        const currentIdValue = document.getElementById('reparacion-id')?.value;
        if (data.id !== currentIdValue) {
            console.warn('ID mismatch in handleSignatureResult:', data.id, '!=', currentIdValue);
            return;
        }

        const qrContainer = document.getElementById('remote-signature-qr-container');
        if (qrContainer) qrContainer.style.display = 'none';

        if (data.signature) {
            const canvas = document.getElementById('signature-pad');
            if (canvas) {
                const img = new Image();
                img.onload = () => {
                    this.lastSignatureImage = img; // SAVE ATOMICALLY

                    // 1. Scale strokes BEFORE drawing (Native logic)
                    if (data.signatureStrokes && data.canvasWidth && data.canvasHeight) {
                        const logicalWidth = canvas.width / (window.devicePixelRatio || 1);
                        const logicalHeight = canvas.height / (window.devicePixelRatio || 1);
                        const scaleX = logicalWidth / data.canvasWidth;
                        const scaleY = logicalHeight / data.canvasHeight;
                        this.allStrokes = data.signatureStrokes.map(stroke =>
                            stroke.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }))
                        );
                    } else {
                        this.allStrokes = data.signatureStrokes || [];
                    }

                    // 2. Perform Atomic Redraw
                    if (typeof this.redrawSignature === 'function') {
                        this.redrawSignature();
                    }

                    this.signatureChanged = true;
                    canvas.style.background = '#ffffff';

                    // 3. Update UI
                    const rgpdCheck = document.getElementById('rgpd-accept-checkbox');
                    if (rgpdCheck) {
                        rgpdCheck.checked = true;
                        const sigArea = document.getElementById('signature-canvas-area');
                        if (sigArea) {
                            sigArea.style.opacity = '1';
                            sigArea.style.pointerEvents = 'auto';
                        }
                    }

                    if (typeof app !== 'undefined' && app.showToast) {
                        app.showToast(i18n.t('toast_sig_received'), 'success');
                    }
                };
                img.onerror = () => {
                    console.error('Signature image load error');
                };
                img.src = data.signature;
            }
        }

        // Handle pattern data from remote signing
        if (data.patron_puntos && data.patron_puntos.length >= 2) {
            this.patternSequence = [...data.patron_puntos];
            const patternToggle = document.getElementById('pattern-lock-toggle');
            const patternContainer = document.getElementById('pattern-lock-container');
            if (patternToggle) patternToggle.checked = true;
            if (patternContainer) patternContainer.style.display = 'block';
            setTimeout(() => {
                if (typeof this.redrawPattern === 'function') {
                    this.redrawPattern();
                }
            }, 200);
        }
    }

    async startLocalSignature() {
        const qrContainer = document.getElementById('remote-signature-qr-container');
        const qrContent = document.getElementById('remote-signature-qr');

        if (!window.api?.signature) {
            app.showToast(i18n.t('toast_sig_not_available'), 'error');
            return;
        }

        // 1. Get or Generate ID
        let id = document.getElementById('reparacion-id').value;
        if (!id) {
            id = window.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
            document.getElementById('reparacion-id').value = id;
        }

        // 2. Prepare UI
        qrContainer.style.display = 'block';
        qrContent.innerHTML = `<div style="padding: 20px;">${i18n.t('rep_starting_local_server')}</div>`;

        try {
            // 3. Start Local Server and Get IP
            const port = await window.api.signature.startServer();
            const ip = await window.api.signature.getLocalIp();

            const signUrl = `http://${ip}:${port}/remote_sign.html?id=${id}&local=true`;
            const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(signUrl)}`;

            qrContent.innerHTML = `
                <div style="margin-bottom: 10px; color: var(--status-success); font-size: 0.8rem; font-weight: bold;">📶 MODO OFFLINE (WiFi)</div>
                <img src="${qrImgUrl}" alt="QR Signature" style="display: block; width: 180px; height: 180px; margin: 0 auto;">
                <div style="font-size: 0.7rem; margin-top: 10px; opacity: 0.7;">IP: ${ip}:${port}</div>
            `;

            app.showToast(i18n.t('toast_sig_server_started'), 'info');

        } catch (e) {
            console.error('Local signature error:', e);
            qrContent.innerHTML = `<div style="color: var(--danger); padding: 10px;">${i18n.t('rep_local_server_error')}<br>${e.message}</div>`;
        }
    }

    stopRemoteSignaturePolling() {
        if (this.remoteSignInterval) {
            clearInterval(this.remoteSignInterval);
            this.remoteSignInterval = null;
        }
    }

    /**
     * Pattern Lock Logic - Visual dot pattern for device unlock
     */
    setupPatternLock() {
        const canvas = document.getElementById('pattern-lock-canvas');
        if (!canvas) return;

        if (this.patternLockInitialized) {
            return;
        }

        const ctx = canvas.getContext('2d');
        const padding = 40;
        const spacing = 80;
        const dotRadius = 14;
        const hitRadius = 32;

        // 3x3 grid dot positions
        const dots = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                dots.push({
                    x: padding + col * spacing,
                    y: padding + row * spacing,
                    index: row * 3 + col
                });
            }
        }

        let isDrawing = false;
        let currentPos = null;

        const redrawPattern = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw connecting lines between selected dots
            if (this.patternSequence.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
                ctx.shadowBlur = 8;

                const first = dots[this.patternSequence[0]];
                ctx.moveTo(first.x, first.y);
                for (let i = 1; i < this.patternSequence.length; i++) {
                    const dot = dots[this.patternSequence[i]];
                    ctx.lineTo(dot.x, dot.y);
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Draw dashed line to cursor while dragging
            if (isDrawing && currentPos && this.patternSequence.length > 0) {
                const last = dots[this.patternSequence[this.patternSequence.length - 1]];
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
                ctx.moveTo(last.x, last.y);
                ctx.lineTo(currentPos.x, currentPos.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw dots
            dots.forEach((dot) => {
                const isActive = this.patternSequence.includes(dot.index);
                const orderIdx = this.patternSequence.indexOf(dot.index);

                if (isActive) {
                    // Outer glow ring
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, dotRadius + 10, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
                    ctx.fill();

                    // Active circle with gradient
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
                    const grad = ctx.createRadialGradient(dot.x, dot.y, 2, dot.x, dot.y, dotRadius);
                    grad.addColorStop(0, 'rgba(200, 140, 255, 1)');
                    grad.addColorStop(1, 'rgba(168, 85, 247, 0.9)');
                    ctx.fillStyle = grad;
                    ctx.fill();

                    // Order number (white on purple)
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.font = 'bold 11px Outfit, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(orderIdx + 1), dot.x, dot.y);
                } else {
                    // Inactive outer ring
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Center dot
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(168, 85, 247, 0.45)';
                    ctx.fill();
                }
            });

            // Update status text
            const statusEl = document.getElementById('pattern-lock-status');
            if (statusEl) {
                if (this.patternSequence.length >= 2) {
                    statusEl.textContent = `✅ Patrón: ${this.patternSequence.length} puntos`;
                    statusEl.style.color = 'var(--electric-purple)';
                } else if (this.patternSequence.length === 1) {
                    statusEl.textContent = 'Conecta más puntos...';
                    statusEl.style.color = 'var(--text-secondary)';
                } else {
                    statusEl.textContent = 'Sin patrón';
                    statusEl.style.color = 'var(--text-tertiary)';
                }
            }
        };

        this.redrawPattern = redrawPattern;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        };

        const findDot = (pos) => {
            for (const dot of dots) {
                const dx = pos.x - dot.x;
                const dy = pos.y - dot.y;
                if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
                    return dot;
                }
            }
            return null;
        };

        const startPattern = (e) => {
            const pos = getPos(e);
            const dot = findDot(pos);
            if (dot) {
                this.patternSequence = [dot.index];
                isDrawing = true;
                currentPos = pos;
                redrawPattern();
            }
        };

        const movePattern = (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            currentPos = pos;
            const dot = findDot(pos);
            if (dot && !this.patternSequence.includes(dot.index)) {
                this.patternSequence.push(dot.index);
            }
            redrawPattern();
        };

        const stopPattern = () => {
            if (!isDrawing) return;
            isDrawing = false;
            currentPos = null;
            if (this.patternSequence.length < 2) {
                this.patternSequence = [];
            }
            redrawPattern();
        };

        // Mouse events
        canvas.addEventListener('mousedown', startPattern);
        canvas.addEventListener('mousemove', movePattern);
        window.addEventListener('mouseup', stopPattern);

        // Touch events
        canvas.addEventListener('touchstart', (e) => {
            if (e.target === canvas) { e.preventDefault(); startPattern(e); }
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            if (e.target === canvas) { e.preventDefault(); movePattern(e); }
        }, { passive: false });
        canvas.addEventListener('touchend', stopPattern);

        // Toggle visibility handler
        document.getElementById('pattern-lock-toggle')?.addEventListener('change', (e) => {
            const container = document.getElementById('pattern-lock-container');
            if (container) {
                if (e.target.checked) {
                    container.style.display = 'block';
                    setTimeout(() => redrawPattern(), 100);
                } else {
                    container.style.display = 'none';
                    this.patternSequence = [];
                    redrawPattern();
                }
            }
        });

        // Clear pattern button
        document.getElementById('btn-clear-pattern')?.addEventListener('click', () => {
            this.patternSequence = [];
            redrawPattern();
        });

        redrawPattern();
        this.patternLockInitialized = true;
    }

    /**
     * Clear Pattern Lock data and UI
     */
    clearPattern() {
        this.patternSequence = [];
        const toggle = document.getElementById('pattern-lock-toggle');
        const container = document.getElementById('pattern-lock-container');
        if (toggle) toggle.checked = false;
        if (container) container.style.display = 'none';
        if (typeof this.redrawPattern === 'function') {
            this.redrawPattern();
        }
    }

    /**
     * Get Pattern Lock canvas as DataURL image
     */
    getPatternImage() {
        if (!this.patternSequence || this.patternSequence.length < 2) return null;
        const canvas = document.getElementById('pattern-lock-canvas');
        if (!canvas) return null;
        return canvas.toDataURL('image/png');
    }

    /**
     * Parts Management Logic
     */
    async initPartsSearch() {
        const container = document.getElementById('repair-parts-search-container');
        if (!container) return;

        // Clear existing widget if any to avoid duplicates
        container.innerHTML = '';

        // Create hidden select for SearchSelect widget
        const select = document.createElement('select');
        select.id = 'repair-parts-select';
        select.style.display = 'none';
        container.appendChild(select);

        // Fetch products
        this.allProducts = await db.getAllProducts();
        const options = this.allProducts
            .filter(p => !p.oculto) // Filter out hidden products
            .map(p => ({
                value: p.id,
                text: `${p.nombre} (${p.marca || ''}) - ${app.formatPrice(p.precio_venta)} [Stock: ${p.stock || 0}]`
            }));

        this.partsSearchWidget = new SearchSelect('repair-parts-select', {
            placeholder: i18n.t('rep_parts_search_placeholder'),
            onSelect: (productId) => {
                if (productId) {
                    this.addPart(productId);
                    if (this.partsSearchWidget) this.partsSearchWidget.reset();
                }
            }
        });
        this.partsSearchWidget.setOptions(options);
    }

    addPart(productId) {
        const product = this.allProducts.find(p => p.id === productId);
        if (!product) return;

        // Check if already added
        const existing = this.usedParts.find(p => p.id === productId);
        if (existing) {
            existing.cantidad++;
        } else {
            this.usedParts.push({
                id: product.id,
                nombre: product.nombre,
                precio: product.precio_venta,
                cantidad: 1,
                sn: ''
            });
        }

        this.renderUsedParts();
    }

    removePart(index) {
        this.usedParts.splice(index, 1);
        this.renderUsedParts();
    }

    renderUsedParts() {
        const tbody = document.getElementById('repair-parts-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        let totalParts = 0;

        this.usedParts.forEach((part, index) => {
            totalParts += (part.precio * part.cantidad);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 8px;">${this.escapeHtml(part.nombre)}</td>
                <td style="padding: 8px;">
                    <input type="text" class="form-input" style="font-size: 0.75rem; padding: 4px; background: rgba(0,0,0,0.2);" 
                        value="${this.escapeHtml(part.sn || '')}" 
                        onchange="repUI.updatePartSN(${index}, this.value)" 
                        placeholder="${i18n.t('rep_parts_sn_placeholder')}">
                </td>
                <td style="text-align: center; padding: 8px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <button type="button" class="btn-qty" onclick="repUI.updatePartQty(${index}, -1)">-</button>
                        <span>${part.cantidad}</span>
                        <button type="button" class="btn-qty" onclick="repUI.updatePartQty(${index}, 1)">+</button>
                    </div>
                </td>
                <td style="text-align: right; padding: 8px;">${app.formatPrice(part.precio * part.cantidad)}</td>
                <td style="text-align: center; padding: 8px;">
                    <button type="button" class="btn-delete-item" onclick="repUI.removePart(${index})">×</button>
                </td>
`;
            tbody.appendChild(tr);
        });

        // Update total if price final input is available and we want to auto-suggest
        // For now, let's just make sure the user sees the parts cost.
        if (this.usedParts.length > 0) {
            const footerRow = document.createElement('tr');
            footerRow.innerHTML = `
                <td colspan="3" style="text-align: right; font-weight: bold; padding: 8px;">${i18n.t('rep_parts_total')}:</td>
                <td style="text-align: right; font-weight: bold; color: var(--warning); padding: 8px;">${app.formatPrice(totalParts)}</td>
                <td></td>
`;
            tbody.appendChild(footerRow);
        }

        // Recalculate total price (Mano de Obra + Repuestos)
        this.recalculateTotalPrice();
    }

    /**
     * Recalcula el Precio Total = Mano de Obra + Repuestos
     * Matches Android behavior: manoObra -> precio, precioTotal -> precio_final
     */
    recalculateTotalPrice() {
        const manoDeObra = parseFloat(document.getElementById('reparacion-precio')?.value) || 0;
        let totalParts = 0;
        if (this.usedParts && this.usedParts.length > 0) {
            this.usedParts.forEach(part => {
                totalParts += (part.precio * part.cantidad);
            });
        }
        const precioTotal = manoDeObra + totalParts;
        const precioFinalInput = document.getElementById('reparacion-precio-final');
        if (precioFinalInput) {
            precioFinalInput.value = precioTotal > 0 ? precioTotal.toFixed(2) : '';
        }
    }

    updatePartSN(index, value) {
        const part = this.usedParts[index];
        if (part) {
            part.sn = value;
            // No need to re-render everything to avoid losing focus if editing, 
            // usedParts is updated by reference.
        }
    }

    updatePartQty(index, delta) {
        const part = this.usedParts[index];
        if (part) {
            part.cantidad = Math.max(1, part.cantidad + delta);
            this.renderUsedParts();
        }
    }

    async deductPartsStock(parts, repairId) {
        for (const part of parts) {
            try {
                const product = await db.getProduct(part.id);
                if (product && product.type !== 'service') {
                    const newStock = (product.stock || 0) - part.cantidad;
                    await db.saveProduct({
                        ...product,
                        stock: newStock
                    });

                    // Register movement
                    await db.addCajaMovement({
                        tipo: 'OUT',
                        importe: 0,
                        concepto: i18n.t('rep_part_use_concept', { id: repairId.substring(0, 8), name: part.nombre, qty: part.cantidad }),
                        fecha: Date.now()
                    });
                }
            } catch (err) {
                console.error('Error deducting stock for part', part, err);
            }
        }
    }

    /* --- SECCIÓN DE FOTOS --- */
    async startCamera() {
        const video = document.getElementById('repair-video');
        const preview = document.getElementById('repair-camera-preview');
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            if (video) video.srcObject = this.stream;
            if (preview) preview.style.display = 'block';
        } catch (err) {
            console.error("Error accessing camera", err);
            app.showToast(i18n.t('rep_camera_error'), 'error');
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        const preview = document.getElementById('repair-camera-preview');
        if (preview) preview.style.display = 'none';
    }

    capturePhoto() {
        const video = document.getElementById('repair-video');
        const canvas = document.getElementById('repair-photo-canvas');
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');

        if (video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            this.repairPhotos.push(base64);
            this.renderPhotos();
            this.stopCamera();
        }
    }

    handlePhotoUpload(files) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.repairPhotos.push(e.target.result);
                this.renderPhotos();
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Maneja el pegado de imágenes desde el portapapeles (Puente WhatsApp)
     */
    handlePaste(event) {
        // Solo actuar si el modal está abierto y no estamos escribiendo en un textarea/input (opcional, pero útil)
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
            // Si el usuario está escribiendo una nota, quizás quiere pegar texto, no interceptamos
            // Pero si es una imagen, sí la queremos.
        }

        const items = (event.clipboardData || event.originalEvent?.clipboardData)?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                if (!blob) continue;

                const reader = new FileReader();
                reader.onload = (e) => {
                    this.repairPhotos.push(e.target.result);
                    this.renderPhotos();
                    app.showToast(i18n.t('rep_photo_pasted'), 'success');
                };
                reader.readAsDataURL(blob);
            }
        }
    }

    removePhoto(index) {
        this.repairPhotos.splice(index, 1);
        this.renderPhotos();
    }

    renderPhotos() {
        const gallery = document.getElementById('repair-photo-gallery');
        if (!gallery) return;

        gallery.innerHTML = this.repairPhotos.map((photo, index) => `
            <div style="position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: #000;">
                <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${photo}', '_blank')">
                <button type="button" onclick="repUI.removePhoto(${index})" 
                    style="position: absolute; top: 4px; right: 4px; background: rgba(255, 71, 87, 0.9); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 5;">&times;</button>
                <button type="button" onclick="repUI.openPhotoEditor(${index})" 
                    style="position: absolute; bottom: 4px; right: 4px; background: rgba(30, 144, 255, 0.9); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 5;" title="Editar">✏️</button>
            </div>
        `).join('');
    }

    openPhotoEditor(index) {
        const photo = this.repairPhotos[index];
        if (!photo) return;

        const modal = document.getElementById('modal-photo-editor');
        if (!modal) return;

        const canvas = document.getElementById('photo-editor-canvas');
        const ctx = canvas.getContext('2d');
        
        let isDrawing = false;
        let brushColor = '#ff4757'; 
        let brushSize = 5;
        let undoStack = [];
        
        const img = new Image();
        img.onload = () => {
            canvas.width = img.naturalWidth || 800;
            canvas.height = img.naturalHeight || 600;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            saveState();
        };
        img.src = photo;

        modal.classList.add('active');

        function saveState() {
            if (undoStack.length >= 20) {
                undoStack.shift();
            }
            undoStack.push(canvas.toDataURL());
        }

        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        };

        const startDrawing = (e) => {
            e.preventDefault();
            isDrawing = true;
            const pos = getMousePos(e);
            
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = brushColor;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = brushSize;
            ctx.stroke();
        };

        const draw = (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            const pos = getMousePos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = brushSize;
            ctx.stroke();
        };

        const stopDrawing = (e) => {
            if (isDrawing) {
                isDrawing = false;
                ctx.closePath();
                saveState();
            }
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);
        
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);

        const colorBtns = modal.querySelectorAll('.pe-color-btn');
        colorBtns.forEach(btn => {
            btn.style.border = btn.dataset.color === brushColor ? '2px solid white' : '2px solid transparent';
            
            btn.onclick = () => {
                colorBtns.forEach(b => b.style.border = '2px solid transparent');
                btn.style.border = '2px solid white';
                const selectedColor = btn.dataset.color;
                
                if (selectedColor === 'eraser') {
                    brushColor = '#ffffff'; // White for eraser tool
                } else {
                    brushColor = selectedColor;
                }
            };
        });

        const sizeInput = document.getElementById('pe-brush-size');
        const sizeVal = document.getElementById('pe-brush-size-val');
        sizeInput.value = brushSize;
        sizeVal.textContent = brushSize + 'px';
        sizeInput.oninput = (e) => {
            brushSize = parseInt(e.target.value);
            sizeVal.textContent = brushSize + 'px';
        };

        const undoBtn = document.getElementById('pe-btn-undo');
        undoBtn.onclick = () => {
            if (undoStack.length > 1) {
                undoStack.pop(); 
                const prevState = undoStack[undoStack.length - 1];
                const prevImg = new Image();
                prevImg.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(prevImg, 0, 0);
                };
                prevImg.src = prevState;
            } else if (undoStack.length === 1) {
                const prevImg = new Image();
                prevImg.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(prevImg, 0, 0);
                };
                prevImg.src = undoStack[0];
            }
        };

        const clearBtn = document.getElementById('pe-btn-clear');
        clearBtn.onclick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            saveState();
        };

        const saveBtn = document.getElementById('pe-btn-save');
        saveBtn.onclick = () => {
            const editedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            this.repairPhotos[index] = editedBase64;
            this.renderPhotos();
            
            cleanup();
            modal.classList.remove('active');
            app.showToast('Imagen editada correctamente', 'success');
        };

        const closeBtns = modal.querySelectorAll('[data-close-modal="modal-photo-editor"]');
        const closeHandler = () => {
            cleanup();
            modal.classList.remove('active');
        };
        closeBtns.forEach(btn => btn.onclick = closeHandler);

        function cleanup() {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseleave', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        }
    }


    async sendWhatsAppPro(id) {
        const rep = (await db.getReparacion(id)) || this.reparaciones.find(r => r.id === id);
        if (!rep) return;

        const cliente = this.clientes.find(c => c.id === rep.cliente_id) || await db.getCliente(rep.cliente_id);
        const name = cliente ? cliente.nombre : 'Cliente';
        const phone = cliente ? cliente.telefono : '';

        // Generate Vitaminized Text
        const dispositivo = `${this.getDispositivoLabel(rep.dispositivo)} ${rep.marca || ''} ${rep.modelo || ''}`.trim();
        const imei = rep.imei || 'N/A';

        // ANONYMOUS SMART LINK (Cloudflare Pages)
        let trackUrl = this.trackingUrl || 'https://reparapp-premium.pages.dev/tracking';
        const separator = trackUrl.includes('?') ? '&' : '?';
        trackUrl += `${separator}id=${rep.id}`;

        // UNIVERSAL TRACKING: Enviar credenciales (Base64) para que el hosting funcione dinámicamente
        const sUrl = window.supabaseClient?.url;
        const sKey = window.supabaseClient?.anonKey;
        if (sUrl && sKey && sUrl !== '' && sKey !== '') {
            try {
                const uEncoded = encodeURIComponent(btoa(sUrl));
                const kEncoded = encodeURIComponent(btoa(sKey));
                trackUrl += `&u=${uEncoded}&k=${kEncoded}`;
            } catch (e) {
                console.warn('Could not encode credentials for tracking URL');
            }
        }


        let template = (['listo', 'reparado', 'entregado'].includes(rep.estado)) ?
            "📱 *Consulta tu Reparación*\n\nHola {CLIENTE}, tu equipo ya está listo. Pincha aquí para ver los detalles:\n{URL}" :
            "📱 *Consulta tu Reparación*\n\nHola {CLIENTE}, hemos recibido tu equipo. Pincha aquí para ver el estado:\n{URL}";

        let checklistSummary = '';
        if (rep.checklist) {
            const checked = Object.entries(rep.checklist).filter(([_, v]) => v).map(([k]) => `✅ ${i18n.t('check_' + k) || k}`).join(', ');
            if (checked) checklistSummary = `\n\nChecklist:\n${checked}`;
        }

        let message = template
            .replace(/{CLIENTE}/g, name)
            .replace(/{URL}/g, trackUrl);

        // --- MEDIA SHARING (The "Pro" part) ---
        if (navigator.share && rep.photos && rep.photos.length > 0) {
            try {
                const files = [];
                for (let i = 0; i < Math.min(rep.photos.length, 3); i++) {
                    const res = await fetch(rep.photos[i]);
                    const blob = await res.blob();
                    files.push(new File([blob], `foto_${i + 1}.jpg`, { type: 'image/jpeg' }));
                }

                await navigator.share({
                    title: `Reparación: ${dispositivo}`,
                    text: message,
                    files: files
                });
                return;
            } catch (e) {
                console.warn("Navigator share failed, trying clipboard fallback", e);
            }
        }

        // Fallback: Copy to clipboard
        try {
            await navigator.clipboard.writeText(message);

            if (rep.photos && rep.photos.length > 0) {
                app.showToast(i18n.t('rep_wa_processing_photo'), 'info');
                try {
                    // Convert to PNG Blob (safest for ClipboardItem)
                    const pngBlob = await this.imgToPngBlob(rep.photos[0]);
                    const item = new ClipboardItem({ "image/png": pngBlob });
                    await navigator.clipboard.write([item]);
                    app.showToast(i18n.t('rep_wa_text_photo_copied'), 'success');
                } catch (clipErr) {
                    console.error("Image copy failed", clipErr);
                    app.showToast(i18n.t('rep_wa_text_copied'), 'info');
                }
            } else {
                app.showToast(i18n.t('rep_wa_msg_copied'), 'success');
            }
        } catch (err) {
            console.error("Clipboard failed", err);
        }

        if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            const finalPhone = cleanPhone.startsWith('34') || cleanPhone.length > 9 ? cleanPhone : `34${cleanPhone}`;
            const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;

            // --- ELECTRON DIRECT BRIDGE ---
            if (window.process && window.process.type === 'renderer') {
                try {
                    const { shell } = require('electron');
                    shell.openExternal(url);
                    return;
                } catch (e) {
                    console.error("Electron shell failed", e);
                }
            }
            window.open(url, '_blank');
        }
    }

    /**
     * Convierte cualquier imagen a PNG Blob para el portapapeles
     */
    async imgToPngBlob(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(resolve, 'image/png');
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    /**
     * Muestra la opciones para convertir documento (Orden de Trabajo, Presupuesto, Factura)
     */
    async showConversionOptions(id) {
        try {
            const rep = await db.getReparacion(id);
            if (!rep) {
                app.showToast('Reparación no encontrada', 'error');
                return;
            }
            const cliente = await db.getCliente(rep.cliente_id);

            // Crear y agregar el overlay del modal
            const overlay = document.createElement('div');
            overlay.id = 'conversion-overlay-modal';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center;
                z-index: 9999; backdrop-filter: blur(4px);
            `;

            overlay.innerHTML = `
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; width: 400px; padding: 25px; box-shadow: var(--shadow-lg); text-align: center;">
                    <h3 style="margin-top: 0; color: white; font-size: 1.2rem; margin-bottom: 10px;">Convertir Documento</h3>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 20px;">
                        Selecciona el formato al que deseas convertir la reparación de <strong>${this.escapeHtml(rep.dispositivo)}</strong>:
                    </p>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="btn-conv-ot" class="btn btn-primary" style="background: linear-gradient(135deg, #00ffc6, #00b386); color: black; font-weight: bold; justify-content: center;">
                            📄 Orden de Trabajo
                        </button>
                        
                        <button id="btn-conv-pres" class="btn btn-primary" style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; justify-content: center;">
                            💰 Presupuesto
                        </button>
                        
                        <button id="btn-conv-fact" class="btn btn-primary" style="background: linear-gradient(135deg, #FF9800, #F57C00); color: white; justify-content: center;">
                            🧾 Factura
                        </button>
                    </div>

                    <button id="btn-conv-cancel" class="btn btn-secondary" style="margin-top: 20px; width: 100%; justify-content: center;">
                        Cancelar
                    </button>
                </div>
            `;

            document.body.appendChild(overlay);

            // Listeners
            overlay.querySelector('#btn-conv-ot').addEventListener('click', () => {
                window.printer.printWorkOrderPDF(rep, cliente);
                overlay.remove();
            });

            overlay.querySelector('#btn-conv-pres').addEventListener('click', () => {
                window.printer.printBudgetPDF(rep, cliente);
                overlay.remove();
            });

            overlay.querySelector('#btn-conv-fact').addEventListener('click', async () => {
                try {
                    overlay.remove();
                    // Proceder a convertir en Factura
                    const nextNum = await db.generateNextInvoiceNumber();
                    const parts = rep.parts || [];
                    const precioPiezas = parts.reduce((acc, curr) => acc + (curr.cantidad * curr.precio), 0);
                    const total = rep.precio_final || rep.precio || 0;
                    const manoDeObra = Math.max(0, total - precioPiezas);

                    const lineas = [];
                    if (manoDeObra > 0 || parts.length === 0) {
                        lineas.push({
                            concepto: `Mano de obra - Reparación ${rep.dispositivo} ${rep.marca || ''} ${rep.modelo || ''}`,
                            cantidad: 1,
                            precio: manoDeObra
                        });
                    }
                    parts.forEach(p => {
                        lineas.push({
                            concepto: `${p.nombre} (Repuesto)`,
                            cantidad: p.cantidad,
                            precio: p.precio
                        });
                    });

                    const subtotal = total / 1.21;
                    const iva = total - subtotal;

                    const factura = {
                        cliente_id: rep.cliente_id,
                        numero: nextNum,
                        fecha: Date.now(),
                        lineas: lineas,
                        subtotal: subtotal,
                        iva: iva,
                        irpf: 0,
                        impuestos: 21,
                        retencion: 0,
                        tax_label: 'IVA',
                        ret_label: 'IRPF',
                        total: total,
                        notas: `Factura generada automáticamente de la reparación #${rep.id.substring(0, 8).toUpperCase()}`
                    };

                    await db.saveFactura(factura);
                    app.showToast(`Factura ${nextNum} creada con éxito`, 'success');

                    // Cambiar de vista a Facturas y volver a renderizar para mostrarla
                    const navInvoices = document.querySelector('[data-view="facturas"]');
                    if (navInvoices) {
                        navInvoices.click();
                    }
                    if (window.invoicesUI) {
                        await window.invoicesUI.render();
                    }
                } catch (factErr) {
                    console.error('Error al convertir a factura:', factErr);
                    app.showToast('Error al generar la factura: ' + factErr.message, 'error');
                }
            });

            overlay.querySelector('#btn-conv-cancel').addEventListener('click', () => {
                overlay.remove();
            });

            // Cerrar al pulsar fuera del modal
            overlay.addEventListener('click', (ev) => {
                if (ev.target === overlay) overlay.remove();
            });

        } catch (err) {
            console.error('Error opening conversion options:', err);
            app.showToast('Error al abrir convertidor', 'error');
        }
    }
}

// Instancia global
const repairsUI = new RepairsUI();
window.repairsUI = repairsUI;
window.repUI = repairsUI; // Alias fallback
