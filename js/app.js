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
        console.log('Initializing GestionApp...');

        try {
            // Asegurar configuración de Supabase
            supabaseClient.loadConfiguration();

            // Inicializar base de datos
            await db.init();
            console.log('Database ready');

            // Inicializar sincronización local
            if (typeof fileSync !== 'undefined') {
                await fileSync.init();

                // Verificar si necesitamos reconectar (carpeta configurada pero sin permisos)
                if (fileSync.needsReconnect) {
                    console.log('Carpeta local configurada pero sin permisos');
                    this.showReconnectBanner();
                }
            }

            // Verificar si IndexedDB está vacía y hay backup disponible
            await this.checkAndRestoreFromBackup();

            // Inicializar sync manager
            await syncManager.init();
            console.log('Sync manager ready');

            // Inicializar navegación
            navigation.init();

            // Inicializar UIs con manejo de errores individual
            try { await authUI.init(); } catch (e) { console.error('Error init authUI', e); }
            try { clientsUI.init(); } catch (e) { console.error('Error init clientsUI', e); }
            try { repairsUI.init(); } catch (e) { console.error('Error init repairsUI', e); }
            try { invoicesUI.init(); } catch (e) { console.error('Error init invoicesUI', e); }
            try { settingsUI.init(); } catch (e) { console.error('Error init settingsUI', e); }

            // Event listeners globales
            this.initGlobalListeners();

            // Renderizar dashboard inicial
            await this.renderDashboard();

            // Actualizar estado de sync
            syncManager.updateLastSyncDisplay();

            console.log('GestionApp initialized successfully');
            this.showToast('Aplicación lista', 'success');

        } catch (error) {
            console.error('Error initializing app:', error);
            this.showToast('Error al iniciar la aplicación', 'error');
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
                console.log('IndexedDB tiene datos, no es necesario restaurar');
                return;
            }

            // Si no tiene permisos, no podemos hacer nada automáticamente
            if (fileSync.needsReconnect) {
                console.log('IndexedDB vacía y carpeta necesita reconexión manual');
                return;
            }

            // Verificar si hay backup disponible
            if (!fileSync.isLinked) {
                console.log('No hay carpeta vinculada para restaurar');
                return;
            }

            // Intentar cargar desde archivos
            console.log('IndexedDB vacía, intentando restaurar desde carpeta local...');
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

                this.showToast('✅ Carpeta reconectada correctamente', 'success');
            } else {
                this.showToast('No se pudo obtener permiso para la carpeta', 'error');
            }
        } catch (error) {
            console.error('Error en handleReconnect:', error);
            this.showToast('Error al reconectar: ' + error.message, 'error');
        }
    }

    /**
     * Inicializa listeners globales
     */
    initGlobalListeners() {
        // Botón de sincronización (Desktop)
        document.getElementById('btn-sync')?.addEventListener('click', async () => {
            if (!syncManager.isAvailable()) {
                this.showConfigModal();
                return;
            }
            const result = await syncManager.sync();
            this.showToast(result.message, result.success ? 'success' : 'error');

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

            // Refrescar vista actual
            navigation.refreshView(navigation.getCurrentView());
        });

        // Modal de confirmación de eliminación
        document.getElementById('btn-confirm-delete')?.addEventListener('click', async () => {
            if (this.deleteCallback) {
                await this.deleteCallback();
                this.deleteCallback = null;
            }
            this.closeConfirmModal();
        });

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
                    'pendiente': 'pending',
                    'en_proceso': 'in-progress',
                    'completada': 'completed'
                }[rep.estado] || 'pending';
                const statusText = {
                    'pendiente': 'Pendiente',
                    'en_proceso': 'En Proceso',
                    'completada': 'Completada'
                }[rep.estado] || 'Pendiente';

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
        const container = document.getElementById('toast-container');
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
     * Muestra diálogo de confirmación para eliminar
     */
    confirmDelete(title, message, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        this.deleteCallback = callback;
        document.getElementById('modal-confirm').classList.add('active');
    }

    /**
     * Cierra el modal de confirmación
     */
    closeConfirmModal() {
        document.getElementById('modal-confirm').classList.remove('active');
        this.deleteCallback = null;
    }

    /**
     * Muestra modal de configuración de Supabase
     */
    showConfigModal() {
        const url = prompt('Introduce la URL de Supabase:\n(ej: https://xxxxx.supabase.co)');
        if (!url) return;

        const key = prompt('Introduce la API Key anónima:');
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

    // Expose references for inline HTML handlers (Critical for Mobile)
    window.app = app;
    window.repairsUI = repairsUI;
    window.invoicesUI = invoicesUI;
    window.clientsUI = clientsUI;
    window.syncManager = syncManager;
    window.dashboardUI = dashboardUI;

    console.log('Mobile handlers initialized: UIs exposed to window');
});
