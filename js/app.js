/**
 * Main Application Module
 * Punto de entrada y coordinación general
 */

class App {
    constructor() {
        this.deleteCallback = null;
    }

    /**
     * Inicializa la aplicación
     */
    async init() {
        // --- ELECTRON BRIDGE FIX ---
        if (window.process && window.process.type === 'renderer') {
            try {
                const { shell } = require('electron');
                const originalOpen = window.open;
                window.open = function (url, target, features) {
                    if (url && (url.includes('whatsapp.com') || url.includes('wa.me'))) {
                        shell.openExternal(url);
                        return null;
                    }
                    return originalOpen(url, target, features);
                };
            } catch (e) { console.error('Electron bridge failed', e); }
        }

        // Inicializar i18n
        if (window.i18n) i18n.init();

        try {
            // Asegurar configuración de Supabase
            supabaseClient.loadConfiguration();

            // Inicializar base de datos
            await db.init();

            // Cargar Moneda Global y Tasa de Impuestos
            window.app_currency = await db.getConfig('app_currency') || 'EUR';
            window.app_tax_rate = parseFloat(await db.getConfig('tax_iva')) || 21;
            window.app_tax_label = await db.getConfig('intl_tax_label') || 'IVA';

            // Aplicar Tema (Oscuro/Claro)
            await this.applyTheme();

            // VERIFICACIÓN DE LICENCIA
            if (window.licenseManager) {
                await licenseManager.init();
                this.setupLicenseHandlers();

                if (!licenseManager.isLicensed) {
                    if (licenseManager.isInTrial) {
                        this.showToast(`MODO PRUEBA: Tienes ${licenseManager.trialRemainingDays} días para activar ReparApp.`, 'info');
                    } else {
                        // Trial agotado y sin licencia -> BLOQUEAR
                        const overlay = document.getElementById('license-overlay');
                        if (overlay) overlay.style.display = 'flex';
                    }
                }
            }

            // Inicializar sincronización local
            if (typeof fileSync !== 'undefined') {
                await fileSync.init();

                // Verificar si necesitamos reconectar (carpeta configurada pero sin permisos)
                if (fileSync.needsReconnect) {
                    this.showReconnectBanner();
                }
            }

            // Verificar si IndexedDB está vacía y hay backup disponible
            await this.checkAndRestoreFromBackup();

            // Inicializar sync manager
            await syncManager.init();

            // Inicializar navegación
            await navigation.init();

            // Inicializar UIs con manejo de errores individual
            try { await authUI.init(); } catch (e) { console.error('Error init authUI', e); }
            try { clientsUI.init(); } catch (e) { console.error('Error init clientsUI', e); }
            try { repairsUI.init(); } catch (e) { console.error('Error init repairsUI', e); }
            try { invoicesUI.init(); } catch (e) { console.error('Error init invoicesUI', e); }
            try { inventoryUI.init(); } catch (e) { console.error('Error init inventoryUI', e); }
            try { settingsUI.init(); } catch (e) { console.error('Error init settingsUI', e); }
            try { if (window.managerUI) window.managerUI.init(); } catch (e) { console.error('Error init managerUI', e); }
            try { if (window.appointmentsUI) window.appointmentsUI.init(); } catch (e) { console.error('Error init appointmentsUI', e); }
            try { if (window.posUI) { await window.posUI.init(); await window.posUI.loadData(); } } catch (e) { console.error('Error init posUI', e); }

            // Renderizar dashboard inicial
            await this.renderDashboard();

            // VERIFICAR SETUP WIZARD (Si es usuario rescate)
            this.checkSetupWizard();

            // Actualizar estado de sync
            syncManager.updateLastSyncDisplay();

            this.showToast('Aplicación lista', 'success');

        } catch (error) {
            console.error('Error initializing app:', error);
            this.showToast('Error al iniciar la aplicación: ' + error.message, 'error');
        } finally {
            // Always initialize listeners so the app is not dead
            try {
                this.progress = new ProgressUI();
                this.initGlobalListeners();
            } catch (e) {
                console.error('Error processing global listeners:', e);
            }
        }
    }

    /**
     * Aplica el tema guardado (Oscuro o Claro)
     */
    async applyTheme() {
        try {
            const theme = await db.getConfig('app_theme') || 'dark';
            if (theme === 'light') {
                document.documentElement.classList.add('light-theme');
            } else {
                document.documentElement.classList.remove('light-theme');
            }
            this.updateThemeUI(theme);
        } catch (e) {
            console.error('Error applying theme:', e);
        }
    }

    /**
     * Cambia el tema de la aplicación
     */
    async setTheme(theme) {
        if (theme === 'light') {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }

        await db.saveConfig('app_theme', theme);
        this.updateThemeUI(theme);

        // Actualizar meta theme-color para navegadores móviles
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'light' ? '#f0f2f5' : '#000000');
        }

        this.showToast(theme === 'light' ? 'Modo claro activado' : 'Modo oscuro activado', 'info');
    }

    /**
     * Actualiza la interfaz de selección de tema
     */
    updateThemeUI(theme) {
        const btnDark = document.getElementById('btn-theme-dark');
        const btnLight = document.getElementById('btn-theme-light');
        if (btnDark && btnLight) {
            btnDark.classList.toggle('active', theme === 'dark');
            btnLight.classList.toggle('active', theme === 'light');
        }
    }

    /**
     * Verifica si IndexedDB está vacía y hay datos de backup disponibles
     * Si es así, intenta restaurar automáticamente
     */
    async checkAndRestoreFromBackup() {
        if (typeof fileSync === 'undefined') return;

        try {
            // Verificar si hay datos en IndexedDB
            const stats = await db.getStats();
            const hasData = stats.totalClientes > 0 || stats.totalReparaciones > 0;

            if (hasData) {
                return;
            }

            // Si no tiene permisos, no podemos hacer nada automáticamente
            if (fileSync.needsReconnect) {
                return;
            }

            // Verificar si hay backup disponible
            if (!fileSync.isLinked) {
                return;
            }

            // Intentar cargar desde archivos
            const result = await fileSync.loadFromFiles();

            if (result.success && result.imported) {
                const total = result.imported.clientes + result.imported.reparaciones + result.imported.facturas;
                if (total > 0) {
                    this.showToast(`✅ Datos restaurados: ${result.imported.clientes} clientes, ${result.imported.reparaciones} reparaciones, ${result.imported.facturas} facturas`, 'success');
                }
            }
        } catch (error) {
            console.error('Error en checkAndRestoreFromBackup:', error);
        }
    }

    /**
     * Muestra un banner para reconectar la carpeta local
     */
    showReconnectBanner() {
        // Crear banner si no existe
        let banner = document.getElementById('reconnect-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'reconnect-banner';
            banner.className = 'reconnect-banner';
            banner.innerHTML = `
                <div class="reconnect-content">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>La carpeta local necesita permisos. Haz clic para reconectar y recuperar tus datos.</span>
                    <button id="btn-reconnect-folder" class="btn-reconnect">Reconectar</button>
                    <button id="btn-dismiss-banner" class="btn-dismiss">×</button>
                </div>
            `;
            document.body.insertBefore(banner, document.body.firstChild);

            // Event listeners
            document.getElementById('btn-reconnect-folder').addEventListener('click', () => this.handleReconnect());
            document.getElementById('btn-dismiss-banner').addEventListener('click', () => banner.remove());
        }
    }

    /**
     * Configura los eventos de la pantalla de activación
     */
    setupLicenseHandlers() {
        const overlay = document.getElementById('license-overlay');
        const btn = document.getElementById('btn-activate');
        const inputName = document.getElementById('lic-name');
        const inputKey = document.getElementById('lic-key');
        const errorMsg = document.getElementById('lic-error');
        const fingerprintEl = document.getElementById('lic-fingerprint');
        const subtitleEl = overlay?.querySelector('[data-i18n="lic_subtitle"]');

        if (fingerprintEl && window.licenseManager) {
            fingerprintEl.textContent = licenseManager.fingerprint || 'GENERANDO...';

            // Si la licencia existe pero no es válida, es que ha expirado
            const stored = localStorage.getItem('app_license_data');
            if (stored && !licenseManager.isLicensed && subtitleEl) {
                subtitleEl.textContent = "TU LICENCIA ANUAL HA EXPIRADO. POR FAVOR, RENUÉVALA.";
                subtitleEl.style.color = "#f87171";
                subtitleEl.style.fontWeight = "bold";
            }
        }

        if (!btn) return; // Si no existe el overlay

        btn.addEventListener('click', async () => {
            const name = inputName.value;
            const key = inputKey.value;

            btn.textContent = i18n.t('wiz_verifying');
            btn.disabled = true;

            // Pequeño delay para UX (que parezca que procesa)
            await new Promise(r => setTimeout(r, 800));

            if (await licenseManager.activate(name, key)) {
                overlay.style.display = 'none';
                this.showInfoModal({
                    type: 'success',
                    title: i18n.t('app_activation_success_title'),
                    message: i18n.t('app_activation_success_msg').replace('{name}', name)
                });
            } else {
                errorMsg.style.display = 'block';
                inputKey.style.borderColor = '#ef4444';
                inputKey.classList.add('shake'); // Asumiendo que existe o no pasa nada
                btn.textContent = i18n.t('wiz_retry');
                btn.disabled = false;
            }
        });
    }

    /**
     * Maneja la reconexión de la carpeta local
     */
    async handleReconnect() {
        if (typeof fileSync === 'undefined') return;

        try {
            // Solicitar permisos
            const granted = await fileSync.requestPermissionWithUI();

            if (granted) {
                // Ocultar banner
                document.getElementById('reconnect-banner')?.remove();

                // Intentar restaurar datos
                await this.checkAndRestoreFromBackup();

                // Refrescar vista
                await this.renderDashboard();
                navigation.refreshView(navigation.getCurrentView());

                this.showToast(i18n.t('app_reconnect_folder_success'), 'success');
            } else {
                this.showToast(i18n.t('app_reconnect_folder_error'), 'error');
            }
        } catch (error) {
            console.error('Error en handleReconnect:', error);
            this.showToast(i18n.t('toast_error') + ': ' + error.message, 'error');
        }
    }

    /**
     * Inicializa listeners globales
     */
    initGlobalListeners() {
        // Logout button (Global)
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                if (window.authUI) {
                    window.authUI.handleLogout();
                } else if (typeof authUI !== 'undefined') {
                    authUI.handleLogout();
                } else {
                    this.showConfirm(
                        i18n.t('app_logout_confirm_title'),
                        i18n.t('app_logout_confirm_msg'),
                        () => location.reload()
                    );
                }
            });
        }
        // Guardar configuración Supabase
        document.getElementById('btn-save-config')?.addEventListener('click', async () => {
            const url = document.getElementById('supabase-url').value.trim();
            const key = document.getElementById('supabase-key').value.trim();

            if (!url || !key) {
                this.showToast('Introduce URL y Key', 'error');
                return;
            }

            const result = await syncManager.configureAndTest(url, key);
            if (result.success) {
                this.showToast('Conexión exitosa', 'success');
                document.getElementById('modal-config').classList.remove('active');
            } else {
                this.showToast('Error de conexión: ' + result.error, 'error');
            }
        });

        // Botón de sincronización (Desktop)
        document.getElementById('btn-sync')?.addEventListener('click', async () => {
            if (!syncManager.isAvailable()) {
                this.showConfigModal();
                return;
            }

            // AUTO-REPAIR: Asegurar integridad antes de sincronizar
            await this.repairDatabaseTimestamps();

            const result = await syncManager.sync();
            this.showToast(result.message, result.success ? 'success' : 'error');

            console.log('Sync Result Full:', JSON.stringify(result, null, 2));

            if (result.success) {
                try {
                    // Always try to show info modal
                    const stats = result.stats || {};
                    const dl = stats.downloaded || { clientes: 0, reparaciones: 0, facturas: 0 };
                    const ul = stats.uploaded || { clientes: 0, reparaciones: 0, facturas: 0, errors: 0, skipped: 0 };
                    const errors = ul.errors || 0;

                    const hasErrors = errors > 0 || (ul.skipped || 0) > 0;

                    this.showInfoModal({
                        type: hasErrors ? 'warning' : 'success',
                        title: 'Sincronización Completada',
                        stats: {
                            '↓ Clientes descargados': dl.clientes || 0,
                            '↓ Reparaciones descargadas': dl.reparaciones || 0,
                            '↓ Facturas descargadas': dl.facturas || 0,
                            '↑ Clientes subidos': ul.clientes || 0,
                            '↑ Reparaciones subidas': ul.reparaciones || 0,
                            '↑ Facturas subidas': ul.facturas || 0,
                            ...(errors > 0 ? { '⚠️ Errores': errors } : {}),
                            ...((ul.skipped || 0) > 0 ? { '⚠️ Omitidos': ul.skipped } : {})
                        }
                    });
                } catch (e) {
                    console.error("Error showing sync modal:", e);
                    alert("Sync completed but error showing details: " + e.message);
                }
            }

            // Refrescar vista actual
            navigation.refreshView(navigation.getCurrentView());
        });

        // Botón de sincronización (Mobile)
        document.getElementById('btn-sync-mobile')?.addEventListener('click', async () => {
            if (!syncManager.isAvailable()) {
                this.showConfigModal();
                return;
            }
            const btn = document.getElementById('btn-sync-mobile');
            btn.classList.add('syncing'); // Add rotation class if exists

            const result = await syncManager.sync();
            this.showToast(result.message, result.success ? 'success' : 'error');

            btn.classList.remove('syncing');

            // Mostrar modal informativo con estadísticas
            if (result.success) {
                const stats = result.stats || {
                    downloaded: { clientes: 0, reparaciones: 0, facturas: 0 },
                    uploaded: { clientes: 0, reparaciones: 0, facturas: 0, errors: 0, skipped: 0 }
                };

                const dl = stats.downloaded;
                const ul = stats.uploaded;
                const errors = ul.errors || 0;

                const hasErrors = errors > 0 || ul.skipped > 0;
                this.showInfoModal({
                    type: hasErrors ? 'warning' : 'success',
                    title: 'Sincronización Completada',
                    stats: {
                        '↓ Clientes descargados': dl.clientes || 0,
                        '↓ Reparaciones descargadas': dl.reparaciones || 0,
                        '↓ Facturas descargadas': dl.facturas || 0,
                        '↑ Clientes subidos': ul.clientes || 0,
                        '↑ Reparaciones subidas': ul.reparaciones || 0,
                        '↑ Facturas subidas': ul.facturas || 0,
                        ...(errors > 0 ? { '⚠️ Errores': errors } : {}),
                        ...(ul.skipped > 0 ? { '⚠️ Omitidos': ul.skipped } : {})
                    }
                });
            }

            // Refrescar vista actual
            navigation.refreshView(navigation.getCurrentView());
        });

        // Modal de confirmación de eliminación
        const btnConfirm = document.getElementById('btn-confirm-delete');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', async () => {
                if (this.deleteCallback) {
                    try {
                        await this.deleteCallback();
                    } catch (e) {
                        console.error('Error executing delete callback:', e);
                        this.showToast('Error al eliminar', 'error');
                    } finally {
                        this.deleteCallback = null;
                        this.closeConfirmModal();
                    }
                } else {
                    this.closeConfirmModal();
                }
            });
        }

        // Cerrar modales al hacer clic fuera
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });

        // Cerrar modales con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });

        // Cerrar modal confirm
        document.querySelectorAll('[data-close-modal="modal-confirm"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeConfirmModal());
        });

        // Dashboard View Mode Toggle
        document.querySelectorAll('#view-dashboard .view-mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.classList.contains('mode-list') ? 'mode-list' :
                    btn.classList.contains('mode-small') ? 'mode-small' : 'mode-large';
                this.setDashboardViewMode(mode);
            });
        });

        // Restore saved dashboard view mode
        this.setDashboardViewMode(localStorage.getItem('dashboard-view-mode') || 'mode-large');
    }

    /**
     * REPARACIÓN DE EMERGENCIA
     * Recorre todos los datos y les asigna timestamp si no tienen,
     * y marca ultima_modificacion = ahora para forzar subida.
     */


    setDashboardViewMode(mode) {
        // Update grid class
        const grid = document.getElementById('dashboard-repairs');
        if (!grid) return;

        grid.classList.remove('mode-list', 'mode-small', 'mode-large');
        grid.classList.add(mode);

        // Update active button
        document.querySelectorAll('#view-dashboard .view-mode-toggle button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains(mode)) {
                btn.classList.add('active');
            }
        });

        // Save preference
        localStorage.setItem('dashboard-view-mode', mode);
    }

    /**
     * Renderiza el dashboard
     */
    async renderDashboard() {
        try {
            const stats = await db.getStats();

            // Actualizar estadísticas
            document.getElementById('stat-clientes').textContent = stats.totalClientes;
            document.getElementById('stat-reparaciones').textContent = stats.totalReparaciones;
            document.getElementById('stat-completadas').textContent = stats.completadas;

            // Cargar reparaciones recientes
            const reparaciones = await db.getAllReparaciones();
            const clientes = await db.getAllClientes();

            // Ordenar por fecha y tomar las 6 más recientes
            const recent = reparaciones
                .sort((a, b) => b.fecha_creacion - a.fecha_creacion)
                .slice(0, 6);

            const grid = document.getElementById('dashboard-repairs');

            if (recent.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                        </svg>
                        <h3>Sin reparaciones</h3>
                        <p>Las reparaciones recientes aparecerán aquí</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = recent.map(rep => {
                const cliente = clientes.find(c => c.id === rep.cliente_id);
                const clienteName = cliente ? cliente.nombre : 'Cliente desconocido';
                const statusClass = {
                    'recibido': 'pending',
                    'diagnostico': 'in-progress',
                    'reparando': 'in-progress',
                    'listo': 'completed',
                    'cancelado': 'cancelled',
                    'pendiente': 'pending', // Fallback
                    'completada': 'completed' // Fallback
                }[rep.estado] || 'pending';

                const statusText = {
                    'recibido': 'Recibido',
                    'diagnostico': 'En Diagnóstico',
                    'reparando': 'Reparando',
                    'listo': 'Listo',
                    'cancelado': 'Cancelado',
                    'pendiente': 'Recibido',
                    'completada': 'Listo'
                }[rep.estado] || 'Recibido';

                return `
                    <div class="card">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">${this.escapeHtml(clienteName)}</h3>
                                <p class="card-subtitle">${new Date(rep.fecha_creacion).toLocaleDateString('es-ES')}</p>
                            </div>
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        <div class="card-body">
                            <p style="color: var(--text-secondary);">${this.escapeHtml(rep.descripcion)}</p>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error rendering dashboard:', error);
        }
    }

    /**
     * Muestra un toast de notificación
     */
    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto-remove después de 3 segundos
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Formatea un precio según la moneda y el idioma actual
     */
    formatPrice(precio) {
        const currency = window.app_currency || 'EUR';
        try {
            return new Intl.NumberFormat(i18n.currentLocale || 'es-ES', {
                style: 'currency',
                currency: currency
            }).format(precio || 0);
        } catch (e) {
            // Fallback para códigos no válidos o errores
            return `${parseFloat(precio || 0).toFixed(2)} ${currency}`;
        }
    }

    /**
     * Muestra diálogo de confirmación genérico
     */
    showConfirm(title, message, onConfirm, onCancel = null) {
        const modal = document.getElementById('modal-confirm');
        if (!modal) {
            console.error('Modal confirm not found');
            return;
        }

        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;

        // Usar btn-confirm-ok para confirmar (coincide con el HTML)
        const btnConfirm = document.getElementById('btn-confirm-ok') || document.getElementById('btn-confirm-delete');
        if (!btnConfirm) {
            console.error('Confirm button not found');
            return;
        }

        // Limpiar listeners antiguos clonando el botón
        const newBtnConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);

        newBtnConfirm.addEventListener('click', async () => {
            try {
                if (onConfirm) await onConfirm();
            } catch (error) {
                console.error('Error in confirm action:', error);
            } finally {
                this.closeConfirmModal();
                window.focus(); // Recuperar foco global
            }
        });

        // Usar btn-confirm-cancel (coincide con el HTML)
        const btnCancel = document.getElementById('btn-confirm-cancel') || modal.querySelector('[data-close-modal="modal-confirm"]');
        if (btnCancel) {
            const newBtnCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

            newBtnCancel.addEventListener('click', () => {
                if (onCancel) onCancel();
                this.closeConfirmModal();
                window.focus();
            });
        }

        modal.classList.add('active');
    }

    /**
     * Muestra alerta personalizada
     */
    showAlert(title, message) {
        this.showConfirm(title, message, null);
        const btnCancel = document.querySelector('[data-close-modal="modal-confirm"]');
        if (btnCancel) btnCancel.style.display = 'none';

        // El botón de "Eliminar" (que será "Aceptar") debe cerrar normal
        const btnConfirm = document.getElementById('btn-confirm-delete');
        btnConfirm.textContent = 'Aceptar';
        btnConfirm.className = 'btn btn-primary';
    }

    /**
     * Muestra diálogo de confirmación para eliminar (retrocompatibilidad)
     */
    confirmDelete(title, message, callback) {
        this.showConfirm(title, message, callback);
        const btnConfirm = document.getElementById('btn-confirm-delete');
        btnConfirm.textContent = 'Eliminar';
        btnConfirm.className = 'btn btn-danger';
        const btnCancel = document.querySelector('[data-close-modal="modal-confirm"]');
        if (btnCancel) btnCancel.style.display = 'inline-flex';
    }

    /**
     * Muestra modal informativo visual mejorado
     * @param {Object} options - Opciones del modal
     * @param {string} options.type - 'success', 'error', 'warning', 'info'
     * @param {string} options.title - Título del modal
     * @param {string|string[]} options.message - Mensaje o array de mensajes para lista
     * @param {Object} options.stats - Objeto con estadísticas {label: value}
     */
    showInfoModal({ type = 'info', title = 'Información', message = '', stats = null }) {
        const modal = document.getElementById('modal-info');
        if (!modal) {
            // Fallback a alert si no existe el modal
            const text = Array.isArray(message) ? message.join('\n') : message;
            alert(title + '\n\n' + text);
            return;
        }

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const colors = {
            success: { bg: 'linear-gradient(135deg, #10b981, #22c55e)', glow: 'rgba(16, 185, 129, 0.3)' },
            error: { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', glow: 'rgba(239, 68, 68, 0.3)' },
            warning: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', glow: 'rgba(245, 158, 11, 0.3)' },
            info: { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', glow: 'rgba(59, 130, 246, 0.3)' }
        };

        const iconEl = document.getElementById('info-modal-icon');
        const titleEl = document.getElementById('info-modal-title');
        const contentEl = document.getElementById('info-modal-content');
        const btnOk = document.getElementById('info-modal-ok');

        // Configurar icono
        iconEl.textContent = icons[type] || icons.info;
        iconEl.style.background = colors[type]?.bg || colors.info.bg;
        iconEl.style.boxShadow = `0 8px 32px ${colors[type]?.glow || colors.info.glow}`;

        // Configurar título
        titleEl.textContent = title;

        // Configurar contenido
        let contentHTML = '';

        if (stats) {
            // Formato de estadísticas con iconos
            contentHTML = '<div class="info-stats-grid">';
            for (const [label, value] of Object.entries(stats)) {
                const icon = label.toLowerCase().includes('cliente') ? '👤' :
                    label.toLowerCase().includes('reparac') ? '🔧' :
                        label.toLowerCase().includes('factura') ? '📄' :
                            label.toLowerCase().includes('error') ? '⚠️' :
                                label.toLowerCase().includes('ok') ? '✅' : '📊';
                contentHTML += `
                    <div class="info-stat-item">
                        <span class="info-stat-icon">${icon}</span>
                        <span class="info-stat-label">${label}</span>
                        <span class="info-stat-value">${value}</span>
                    </div>`;
            }
            contentHTML += '</div>';
        } else if (Array.isArray(message)) {
            // Lista de items
            contentHTML = '<ul class="info-list">';
            message.forEach(item => {
                const isHeader = item.startsWith('↓') || item.startsWith('↑') || item.endsWith(':');
                if (isHeader) {
                    contentHTML += `<li class="info-list-header">${item}</li>`;
                } else {
                    contentHTML += `<li>${item}</li>`;
                }
            });
            contentHTML += '</ul>';
        } else {
            // Texto simple con soporte de saltos de línea
            contentHTML = `<p class="info-message">${message.replace(/\n/g, '<br>')}</p>`;
        }

        contentEl.innerHTML = contentHTML;

        // Configurar botón
        btnOk.style.background = colors[type]?.bg || colors.info.bg;
        btnOk.onclick = () => this.closeInfoModal();

        // Mostrar modal con animación
        modal.classList.add('active');

        // Animar icono
        iconEl.classList.remove('bounce');
        void iconEl.offsetWidth; // Trigger reflow
        iconEl.classList.add('bounce');
    }

    closeInfoModal() {
        const modal = document.getElementById('modal-info');
        if (modal) modal.classList.remove('active');
    }

    /**
     * Cierra el modal de confirmación
     */
    closeConfirmModal() {
        const modal = document.getElementById('modal-confirm');
        if (modal) modal.classList.remove('active');
    }

    /**
     * Muestra un prompt moderno con modal visual
     * @param {Object} options - Opciones del prompt
     * @param {string} options.title - Título del prompt
     * @param {string} options.message - Mensaje descriptivo
     * @param {string} options.placeholder - Placeholder del input
     * @param {string} options.defaultValue - Valor por defecto
     * @param {string} options.inputType - Tipo de input (text, password, number)
     * @param {string} options.icon - Emoji de icono
     * @returns {Promise<string|null>} - Valor ingresado o null si canceló
     */
    showPrompt({ title = 'Introduce un valor', message = '', placeholder = '', defaultValue = '', inputType = 'text', icon = '✏️' } = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('modal-prompt');
            if (!modal) {
                // Fallback a prompt nativo
                const result = prompt(message || title, defaultValue);
                resolve(result);
                return;
            }

            const iconEl = document.getElementById('prompt-icon');
            const titleEl = document.getElementById('prompt-title');
            const messageEl = document.getElementById('prompt-message');
            const inputEl = document.getElementById('prompt-input');
            const btnOk = document.getElementById('btn-prompt-ok');
            const btnCancel = document.getElementById('btn-prompt-cancel');

            // Configurar contenido
            iconEl.textContent = icon;
            titleEl.textContent = title;
            messageEl.textContent = message;
            messageEl.style.display = message ? 'block' : 'none';
            inputEl.type = inputType;
            inputEl.placeholder = placeholder;
            inputEl.value = defaultValue;

            // Limpiar listeners anteriores clonando los botones
            const newBtnOk = btnOk.cloneNode(true);
            btnOk.parentNode.replaceChild(newBtnOk, btnOk);
            const newBtnCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

            // Handler para confirmar
            const handleConfirm = () => {
                const value = document.getElementById('prompt-input').value;
                modal.classList.remove('active');
                resolve(value);
            };

            // Handler para cancelar
            const handleCancel = () => {
                modal.classList.remove('active');
                resolve(null);
            };

            newBtnOk.addEventListener('click', handleConfirm);
            newBtnCancel.addEventListener('click', handleCancel);

            // También permitir Enter para confirmar
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            // Mostrar modal y enfocar input
            modal.classList.add('active');
            setTimeout(() => inputEl.focus(), 100);
        });
    }

    /**
     * Muestra modal de configuración de Supabase
     */
    async showConfigModal() {
        const url = await this.showPrompt({
            title: 'Configurar Supabase',
            message: 'Introduce la URL de tu proyecto Supabase',
            placeholder: 'https://xxxxx.supabase.co',
            icon: '🔐'
        });
        if (!url) return;

        const key = await this.showPrompt({
            title: 'API Key',
            message: 'Introduce la API Key anónima (anon key)',
            placeholder: 'eyJhbGciOiJIUzI1NiIs...',
            icon: '🔑',
            inputType: 'password'
        });
        if (!key) return;

        supabaseClient.configure(url.trim(), key.trim());
        this.showToast('Supabase configurado. Prueba a sincronizar.', 'success');
    }

    /**
     * Escapa HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    /**
     * REPARACIÓN DE EMERGENCIA (Fase 2 - Integridad Completa)
     * 1. Asigna timestamps recientes.
     * 2. Detecta IDs inválidos (no UUID) y los migra a UUID.
     * 3. Actualiza las claves foráneas (cliente_id) para no romper relaciones.
     */
    async repairDatabaseTimestamps() {
        const now = Date.now();

        // Mapa para rastrear cambios de ID: id_viejo -> id_nuevo
        const idMap = {};
        const isUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        if (!db.db) await db.init();
        const tx = db.db.transaction(['clientes', 'reparaciones', 'facturas'], 'readwrite');

        // --- 1. MIGRAR CLIENTES ---
        const clientStore = tx.objectStore('clientes');
        const clients = await new Promise(r => { const req = clientStore.getAll(); req.onsuccess = () => r(req.result); });

        let fixedClients = 0;
        for (const c of clients) {
            // Verificar si el ID es válido
            if (!c.id || !isUUID(c.id)) {
                const oldId = c.id;
                const newId = db.generateUUID();

                // Guardar mapeo para actualizar referencias
                idMap[oldId] = newId;

                // Crear copia con nuevo ID
                c.id = newId;
                c.ultima_modificacion = now;

                // Reemplazar: Borrar viejo, poner nuevo
                if (oldId) clientStore.delete(oldId);
                clientStore.put(c);
                fixedClients++;
            } else if (!c.ultima_modificacion) {
                // Solo actualizar si falta fecha
                c.ultima_modificacion = now;
                clientStore.put(c);
            }
        }

        // --- 2. MIGRAR REPARACIONES ---
        const repStore = tx.objectStore('reparaciones');
        const repairs = await new Promise(r => { const req = repStore.getAll(); req.onsuccess = () => r(req.result); });

        let fixedRepairs = 0;
        for (const r of repairs) {
            let changed = false;

            // Arreglar FK: Si el cliente cambió de ID, actualizar referencia
            if (r.cliente_id && idMap[r.cliente_id]) {
                r.cliente_id = idMap[r.cliente_id];
                changed = true;
            }

            // Arreglar ID propio
            if (!r.id || !isUUID(r.id)) {
                const oldId = r.id;
                const newId = db.generateUUID();

                r.id = newId;
                r.ultima_modificacion = now;

                if (oldId) repStore.delete(oldId);
                repStore.put(r);
                fixedRepairs++;
                continue; // Ya guardado
            }

            // Solo guardar si hubo cambios (FK actualizada)
            if (changed) {
                r.ultima_modificacion = now;
                repStore.put(r);
            }
        }

        // --- 3. MIGRAR FACTURAS ---
        const facStore = tx.objectStore('facturas');
        const facturas = await new Promise(r => { const req = facStore.getAll(); req.onsuccess = () => r(req.result); });

        let fixedInvoices = 0;
        for (const f of facturas) {
            let changed = false;

            // Arreglar FK
            if (f.cliente_id && idMap[f.cliente_id]) {
                f.cliente_id = idMap[f.cliente_id];
                changed = true;
            }

            // Arreglar ID propio
            if (!f.id || !isUUID(f.id)) {
                const oldId = f.id;
                const newId = db.generateUUID();

                f.id = newId;
                f.ultima_modificacion = now;

                if (oldId) facStore.delete(oldId);
                facStore.put(f);
                fixedInvoices++;
                continue;
            }

            if (changed) {
                f.ultima_modificacion = now;
                facStore.put(f);
            }
        }

        await new Promise((resolve) => {
            tx.oncomplete = () => {
                resolve();
            };
            tx.onerror = (e) => {
                console.error('Error crítico en reparación DB:', e);
                resolve(); // Resolver para no bloquear la UI aunque falle
            };
        });
    }

    /**
     * Verifica si el usuario actual es el de rescate y muestra el asistente
     */
    async checkSetupWizard() {
        const session = localStorage.getItem('employee_session');
        if (session) {
            try {
                const user = JSON.parse(session);
                // Si el nombre es el de rescate y no hay otros administradores reales
                if (user.nombre === 'Jefe (Rescate)' && user.pin === '1234') {
                    if (window.setupWizard) {
                        setTimeout(() => setupWizard.show(), 1000); // Dar tiempo a que cargue todo
                    }
                }
            } catch (e) {
                console.error('Error checking wizard session', e);
            }
        }
    }
}

// Dashboard UI helper
const dashboardUI = {
    render: async () => {
        await app.renderDashboard();
    }
};

// Instancia global
const app = new App();

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    app.init();

    // NUCLEAR FIX: Move modals to body to prevent nesting issues
    const modals = ['modal-reparacion', 'modal-factura', 'modal-cliente', 'modal-confirm', 'modal-producto', 'modal-cita', 'modal-ingreso', 'modal-gasto'];
    modals.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            document.body.appendChild(el);
        }
    });

    // Expose references for inline HTML handlers (Critical for Mobile)
    window.app = app;
    // window.repairsUI, window.invoicesUI etc are already set by their respective files.
    // Redundant assignments removed to avoid ReferenceErrors if variables are not in scope.
    window.syncManager = syncManager;
    window.dashboardUI = dashboardUI;

    // Add global touchstart listeners for robustness
    const btnRep = document.getElementById('btn-add-reparacion');
    if (btnRep) {
        btnRep.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Stop ghost clicks
            if (window.repairsUI) window.repairsUI.openModal();
        }, { passive: false });
    }

    const btnInv = document.getElementById('btn-add-factura');
    if (btnInv) {
        btnInv.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.invoicesUI) window.invoicesUI.openModal();
        }, { passive: false });
    }

    const btnSync = document.getElementById('btn-sync-mobile');
    if (btnSync) {
        btnSync.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.syncManager) {
                window.syncManager.sync();
            }
        }, { passive: false });

        // Also add click just in case
        btnSync.addEventListener('click', (e) => {
            if (window.syncManager) window.syncManager.sync();
        });
    }

    const btnProd = document.getElementById('btn-add-product');
    if (btnProd) {
        btnProd.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.inventoryUI) window.inventoryUI.openModal();
        }, { passive: false });
    }

});

