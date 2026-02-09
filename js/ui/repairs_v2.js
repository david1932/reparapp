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
            this.render();
        });

        // Filtro de estado
        document.getElementById('filter-estado')?.addEventListener('change', (e) => {
            this.filterEstado = e.target.value;
            this.render();
        });

        // Formulario
        document.getElementById('form-reparacion')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveReparacion();
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
                    app.showToast(`Filtrando reparaciones de: ${cliente.nombre}`, 'info');
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

            // AUTO-FIX: Si no hay URL o es local (127.0.0.1), forzar la de GitHub
            // Esto asegura que aunque el usuario no lo configure, funcione
            if (!tUrl || tUrl.includes('127.0.0.1') || tUrl.includes('localhost')) {
                console.warn('Tracking URL inválida detectada:', tUrl);
                tUrl = 'https://david1932.github.io/reparapp/tracking.html';
                await db.saveConfig('tracking_url', tUrl);
                console.log('Tracking URL corregida automáticamente a:', tUrl);
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
                else if (oldState === 'esperando_pieza') r.estado = 'reparando';
                else if (oldState === 'reparado') r.estado = 'listo';
                else if (oldState === 'entregado') r.estado = 'listo';
                else if (oldState === 'en_proceso') r.estado = 'diagnostico';
                else if (oldState === 'completada') r.estado = 'listo';

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
            grid.innerHTML = this.reparaciones.map(rep => this.renderCard(rep)).join('');

            // Event listeners para acciones
            this.attachCardListeners();
        } catch (error) {
            console.error('Error rendering repairs:', error);
            if (error.message && error.message.includes('searchReparaciones')) {
                app.showToast('Error al buscar reparaciones: ' + error.message, 'error');
            } else if (error.message && error.message.includes('getAllClientes')) {
                app.showToast('Error al cargar clientes: ' + error.message, 'error');
            } else {
                app.showToast('Error general al cargar reparaciones: ' + (error.message || error), 'error');
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
            'recibido': { class: 'pending', text: 'Recibido' },
            'diagnostico': { class: 'in-progress', text: 'En Diagnóstico' },
            'reparando': { class: 'in-progress', text: 'Reparando' },
            'listo': { class: 'completed', text: 'Listo' },
            'cancelado': { class: 'cancelled', text: 'Cancelado' },

            // Fallbacks for transition/legacy
            'pendiente': { class: 'pending', text: 'Recibido' },
            'presupuesto': { class: 'in-progress', text: 'En Diagnóstico' },
            'esperando_pieza': { class: 'in-progress', text: 'Reparando' },
            'reparado': { class: 'completed', text: 'Listo' },
            'entregado': { class: 'completed', text: 'Listo' }
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
                'movil': 'dev_movil',
                'tablet': 'dev_tablet',
                'ordenador': 'dev_ordenador',
                'videoconsola': 'dev_videoconsola',
                'otro': 'dev_otro'
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
        const clienteName = this.getClienteName(reparacion.cliente_id);
        const clientePhone = this.getClientePhone(reparacion.cliente_id);

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
                const currentTracking = this.trackingUrl || 'https://david1932.github.io/reparapp/tracking.html';
                message = message
                    .replace(/http:\/\/127\.0\.0\.1:\d+\/tracking\.html\?id=/g, `${currentTracking}?id=`)
                    .replace(/http:\/\/127\.0\.0\.1:\d+/g, currentTracking);
            }

            const cleanPhone = clientePhone.replace(/\D/g, ''); // Remove non-digits
            // Basic check for Spain (34) if missing
            const finalPhone = cleanPhone.startsWith('34') || cleanPhone.length > 9 ? cleanPhone : `34${cleanPhone}`;

            whatsappLink = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
        }

        return `
            <div class="card" data-id="${reparacion.id}">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${this.escapeHtml(clienteName)}</h3>
                        <p class="card-subtitle">${this.formatDate(reparacion.fecha_creacion)}</p>
                        ${reparacion.assigned_to_name ? `<div style="font-size: 0.75rem; color: var(--electric-purple); margin-top: 4px; display: flex; align-items: center; gap: 4px;"><span>👤</span> ${this.escapeHtml(reparacion.assigned_to_name)}</div>` : ''}
                    </div>
                    ${this.getStatusBadge(reparacion.estado)}
                </div>
                <div class="card-body">
                    ${reparacion.dispositivo ? `
                    <div class="card-info" style="margin-bottom: 4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                        </svg>
                        <span>${this.getDispositivoLabel(reparacion.dispositivo)}${reparacion.marca ? ' - ' + this.escapeHtml(reparacion.marca) : ''}${reparacion.modelo ? ' ' + this.escapeHtml(reparacion.modelo) : ''}</span>
                    </div>
                    ` : ''}
                    ${reparacion.imei ? `
                    <div class="card-info" style="margin-bottom: 8px; font-size: 0.8rem; opacity: 0.8;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                        <span>IMEI/SN: ${this.escapeHtml(reparacion.imei)}</span>
                    </div>
                    ` : ''}
                    <p style="color: var(--text-secondary); margin-bottom: var(--spacing-md);">
                        <strong>${i18n.t('label_problem')}:</strong> ${this.escapeHtml(reparacion.problema || reparacion.descripcion)}
                    </p>
                    ${reparacion.solucion ? `
                    <p style="color: var(--electric-cyan); margin-bottom: var(--spacing-md); font-size: 0.85rem;">
                        <strong>${i18n.t('label_solution')}:</strong> ${this.escapeHtml(reparacion.solucion)}
                    </p>
                    ` : ''}
                </div>
                <div class="card-footer" style="flex-wrap: wrap; gap: 8px; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 15px;">
                    <div class="price">${this.formatPrice(reparacion.precio_final || reparacion.precio)}</div>
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
     */
    async copyTrackingLink(id) {
        const reparacion = this.reparaciones.find(r => r.id === id);
        if (!reparacion) return;

        let trackUrl = 'https://david1932.github.io/reparapp/tracking.html';
        const sUrl = window.supabaseClient?.url;
        const sKey = window.supabaseClient?.anonKey;

        if (sUrl && sKey) {
            try {
                // ANONYMOUS URL-SAFE TOKEN: id|url|key
                const rawToken = btoa(`${reparacion.id}|${sUrl}|${sKey}`);
                const token = rawToken.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                trackUrl += `?t=${token}`;
            } catch (e) {
                console.error("Token generation failed", e);
                trackUrl += `?id=${reparacion.id}`;
            }
        } else {
            trackUrl += `?id=${reparacion.id}`;
        }


        try {
            await navigator.clipboard.writeText(trackUrl);
            window.app.showToast("¡Enlace de seguimiento copiado! ✨", "success");
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

        // Click en la tarjeta para editar (UX improvement)
        document.querySelectorAll('.card[data-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                // Si el click fue en un botón o dentro de un botón, ignorar
                if (e.target.closest('button')) return;

                const id = card.dataset.id;
                this.openModal(id);
            });
            // Añadir cursor pointer para indicar que es clickeable
            card.style.cursor = 'pointer';
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
            const estados = ['recibido', 'diagnostico', 'reparando', 'listo', 'cancelado'];

            // Handle legacy statuses mapping
            if (reparacion.estado === 'pendiente') reparacion.estado = 'recibido';
            if (reparacion.estado === 'presupuesto') reparacion.estado = 'diagnostico';
            if (reparacion.estado === 'esperando_pieza') reparacion.estado = 'reparando';
            if (reparacion.estado === 'reparado') reparacion.estado = 'listo';
            if (reparacion.estado === 'entregado') reparacion.estado = 'listo';

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
                        if (selectTecnico) selectTecnico.value = reparacion.assigned_to_id || '';
                    }
                } else {
                    title.textContent = i18n.t('mod_repair_new');
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

                // Clear/Load Signature
                this.clearSignature();
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

                // Load Used Parts
                this.usedParts = currentRep?.parts || [];
                this.renderUsedParts();

                // Load Photos
                this.repairPhotos = currentRep?.photos || [];
                this.renderPhotos();

                // Attach Paste Listener
                this._pasteHandler = (e) => this.handlePaste(e);
                window.addEventListener('paste', this._pasteHandler);
            } catch (dataError) {
                console.error('Error loading data for modal:', dataError);
                selectCliente.innerHTML = `< option value = "" > ${i18n.t('err_loading_clients')}</option > `;
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
                assigned_to_id: document.getElementById('reparacion-tecnico')?.value || null
            };

            // Detect status change to "Completada" to deduct stock if not already done
            const oldRep = id ? await db.getReparacion(id) : null;
            const isClosing = (reparacion.estado === 'completada' || reparacion.estado === 'entregado') && (!oldRep || (oldRep.estado !== 'completada' && oldRep.estado !== 'entregado'));

            // Get Technician Name for cache
            if (reparacion.assigned_to_id) {
                const selectTecnico = document.getElementById('reparacion-tecnico');
                if (selectTecnico && selectTecnico.selectedIndex !== -1) {
                    const selectedOption = selectTecnico.options[selectTecnico.selectedIndex];
                    if (selectedOption) {
                        // Remove role info from name which is in parenthesis
                        reparacion.assigned_to_name = selectedOption.text.split('(')[0].trim();
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
                app.showToast('Selecciona un cliente', 'error');
                return;
            }

            if (id) {
                reparacion.id = id;
            }

            const savedRep = await db.saveReparacion(reparacion);

            // Deduct stock if completing for the first time
            if (isClosing && reparacion.parts && reparacion.parts.length > 0) {
                await this.deductPartsStock(reparacion.parts, reparacion.id);
            }

            this.closeModal();
            await this.render();

            app.showToast(id ? i18n.t('toast_updated') : i18n.t('toast_saved'), 'success');
        } catch (error) {
            console.error('Error saving repair:', error);
            app.showToast('Error al guardar reparación: ' + error.message, 'error');
        }
    }

    /**
     * Elimina una reparación
     */
    async deleteReparacion(id) {
        try {
            await db.deleteReparacion(id);
            await this.render();
            app.showToast('Reparación eliminada', 'success');
        } catch (error) {
            console.error('Error deleting repair:', error);
            app.showToast('Error al eliminar reparación', 'error');
        }
    }

    /**
     * Signature Pad Logic
     */
    setupSignaturePad() {
        const canvas = document.getElementById('signature-pad');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        this.allStrokes = []; // Store strokes in class
        let currentStroke = [];

        const applyStyles = () => {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#000000';
        };

        const redrawAll = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            applyStyles();

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
            const width = container.clientWidth;
            const height = 150;

            if (canvas.width !== width * ratio) {
                canvas.width = width * ratio;
                canvas.height = height * ratio;
                ctx.scale(ratio, ratio);
                redrawAll();
            }
        };

        window.addEventListener('resize', resizeCanvas);
        setTimeout(resizeCanvas, 100);

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
            e.preventDefault();
            startDrawing(e);
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            draw(e);
        }, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        // Limpiar
        document.getElementById('btn-clear-signature')?.addEventListener('click', () => {
            this.clearSignature();
        });
    }

    clearSignature() {
        this.allStrokes = [];
        const canvas = document.getElementById('signature-pad');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.signatureChanged = false;
        }
    }

    getSignatureData() {
        const canvas = document.getElementById('signature-pad');
        if (!canvas) return null;

        // Check if canvas is empty to avoid saving whitespace
        const ctx = canvas.getContext('2d');
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const isEmpty = !Array.from(pixels).some(channel => channel !== 0);

        return isEmpty ? null : canvas.toDataURL();
    }

    /**
     * Parts Management Logic
     */
    async initPartsSearch() {
        const container = document.getElementById('repair-parts-search-container');
        if (!container) return;

        // Create hidden select for SearchSelect widget
        const select = document.createElement('select');
        select.id = 'repair-parts-select';
        select.style.display = 'none';
        container.appendChild(select);

        // Fetch products
        this.allProducts = await db.getAllProducts();
        const options = this.allProducts.map(p => ({
            value: p.id,
            text: `${p.nombre} (${p.marca || ''}) - ${app.formatPrice(p.precio_venta)} `
        }));

        this.partsSearchWidget = new SearchSelect('repair-parts-select', {
            onSelect: (productId) => {
                if (productId) {
                    this.addPart(productId);
                    this.partsSearchWidget.reset();
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
                cantidad: 1
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
    < td style = "padding: 8px;" > ${this.escapeHtml(part.nombre)}</td >
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
    < td colspan = "2" style = "text-align: right; font-weight: bold; padding: 8px;" > Total Repuestos:</td >
                <td style="text-align: right; font-weight: bold; color: var(--warning); padding: 8px;">${app.formatPrice(totalParts)}</td>
                <td></td>
`;
            tbody.appendChild(footerRow);
        }

        // Auto-update price field if it's empty or the user expects it
        const priceInput = document.getElementById('reparacion-precio');
        if (priceInput && (!priceInput.value || priceInput.value == "0")) {
            priceInput.value = totalParts;
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
                if (product && product.tipo !== 'servicio') {
                    const newStock = (product.stock || 0) - part.cantidad;
                    await db.saveProduct({
                        ...product,
                        stock: newStock
                    });

                    // Register movement
                    await db.addCajaMovement({
                        type: 'out',
                        amount: 0,
                        concept: `Repuesto usado en repair #${repairId.substring(0, 8)}: ${part.nombre} (x${part.cantidad})`,
                        date: db.getTimestamp()
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
            app.showToast('No se pudo acceder a la cámara', 'error');
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
                    app.showToast('¡Imagen pegada con éxito!', 'success');
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
            </div>
        `).join('');
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

        // ANONYMOUS SMART LINK (GitHub Stable)
        let trackUrl = 'https://david1932.github.io/reparapp/tracking.html';
        const sUrl = window.supabaseClient?.url;
        const sKey = window.supabaseClient?.anonKey;
        if (sUrl && sKey) {
            try {
                const rawToken = btoa(`${rep.id}|${sUrl}|${sKey}`);
                const token = rawToken.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                trackUrl += `?t=${token}`;
            } catch (e) {
                trackUrl += `?id=${rep.id}`;
            }
        } else {
            trackUrl += `?id=${rep.id}`;
        }


        let template = (['listo', 'reparado', 'entregado'].includes(rep.estado)) ?
            "📱 *Consulta tu Reparación*\n\nHola {CLIENTE}, tu dispositivo está listo. Pincha aquí para ver los detalles:\n{URL}" :
            "📱 *Consulta tu Reparación*\n\nHola {CLIENTE}, hemos recibido tu dispositivo. Pincha aquí para ver el estado:\n{URL}";

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
                app.showToast('Procesando foto para WhatsApp...', 'info');
                try {
                    // Convert to PNG Blob (safest for ClipboardItem)
                    const pngBlob = await this.imgToPngBlob(rep.photos[0]);
                    const item = new ClipboardItem({ "image/png": pngBlob });
                    await navigator.clipboard.write([item]);
                    app.showToast('¡Texto y FOTO (1) copiados! Pulsa Pegar (Ctrl+V) en WhatsApp.', 'success');
                } catch (clipErr) {
                    console.error("Image copy failed", clipErr);
                    app.showToast('Texto copiado. Adjunta la foto manualmente.', 'info');
                }
            } else {
                app.showToast('Mensaje copiado al portapapeles.', 'success');
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
}

// Instancia global
const repairsUI = new RepairsUI();
window.repairsUI = repairsUI;
window.repUI = repairsUI; // Alias fallback
