/**
 * Sync Module - Sincronización bidireccional
 * Windows ↔ Cloud ↔ Android
 */

class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.lastSyncTimestamp = 0;
    }

    /**
     * Inicializa el gestor de sincronización
     */
    async init() {
        // Cargar último timestamp de sincronización
        this.lastSyncTimestamp = await db.getConfig('last_sync') || 0;

        // Cargar configuración de Supabase si existe
        supabaseClient.loadConfiguration();
    }

    /**
     * Verifica si la sincronización está disponible
     */
    isAvailable() {
        return supabaseClient.checkConfiguration();
    }

    /**
     * Ejecuta sincronización completa bidireccional
     */
    async sync() {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return { success: false, message: 'Sincronización en progreso' };
        }

        if (!this.isAvailable()) {
            return { success: false, message: 'Supabase no configurado' };
        }

        this.isSyncing = true;
        this.updateSyncUI(true);

        try {
            console.log('Starting sync...');

            // Paso 1: Descargar cambios del servidor
            await this.pullFromServer();

            // Paso 2: Subir cambios locales
            await this.pushToServer();

            // Paso 3: Actualizar timestamp
            this.lastSyncTimestamp = Date.now();
            await db.setConfig('last_sync', this.lastSyncTimestamp);

            this.isSyncing = false;
            this.updateSyncUI(false);
            this.updateLastSyncDisplay();

            console.log('Sync completed successfully');
            return { success: true, message: 'Sincronización completada' };

        } catch (error) {
            console.error('Sync error:', error);
            this.isSyncing = false;
            this.updateSyncUI(false);
            return { success: false, message: error.message };
        }
    }

    /**
     * Descarga cambios del servidor
     */
    async pullFromServer() {
        console.log('Pulling from server...');

        // Obtener datos modificados después de la última sincronización
        const [serverClientes, serverReparaciones, serverFacturas] = await Promise.all([
            supabaseClient.getClientesModifiedAfter(this.lastSyncTimestamp),
            supabaseClient.getReparacionesModifiedAfter(this.lastSyncTimestamp),
            supabaseClient.getFacturasModifiedAfter(this.lastSyncTimestamp)
        ]);

        console.log(`Received ${serverClientes.length} clients, ${serverReparaciones.length} repairs, ${serverFacturas.length} invoices`);

        // Importar con resolución de conflictos
        await db.importFromServer(serverClientes, serverReparaciones, serverFacturas);
    }

    /**
     * Sube cambios locales al servidor
     */
    /**
     * Sube cambios locales al servidor
     */
    async pushToServer() {
        console.log('Pushing to server...');

        // Obtener usuario actual para asegurar propiedad
        const user = await supabaseClient.getUser();
        const userId = user ? user.id : null;

        if (!userId) {
            console.log('No user logged in, skipping push');
            return;
        }

        // Obtener datos modificados localmente (incluye eliminados soft-delete)
        const [localClientes, localReparaciones, localFacturas] = await Promise.all([
            db.getClientesModifiedAfter(this.lastSyncTimestamp),
            db.getReparacionesModifiedAfter(this.lastSyncTimestamp),
            db.getFacturasModifiedAfter(this.lastSyncTimestamp)
        ]);

        console.log(`Pushing ${localClientes.length} clients, ${localReparaciones.length} repairs, ${localFacturas.length} invoices`);

        // Subir clientes
        for (const cliente of localClientes) {
            try {
                if (cliente.deleted) {
                    // Hard Delete on Server
                    await supabaseClient.deleteCliente(cliente.id);
                } else {
                    // Upsert (Create/Update)
                    // if (!cliente.user_id) cliente.user_id = userId; // REMOVED
                    const serverCliente = await supabaseClient.getCliente(cliente.id);

                    if (!serverCliente) {
                        await supabaseClient.createCliente(cliente);
                    } else if (cliente.ultima_modificacion > serverCliente.ultima_modificacion) {
                        await supabaseClient.updateCliente(cliente.id, cliente);
                    }
                }
            } catch (error) {
                console.error(`Error syncing cliente ${cliente.id}:`, error);
            }
        }

        // Subir reparaciones
        for (const reparacion of localReparaciones) {
            try {
                if (reparacion.deleted) {
                    await supabaseClient.deleteReparacion(reparacion.id);
                } else {
                    // if (!reparacion.user_id) reparacion.user_id = userId; // REMOVED
                    const serverReparacion = await supabaseClient.getReparacion(reparacion.id);

                    if (!serverReparacion) {
                        await supabaseClient.createReparacion(reparacion);
                    } else if (reparacion.ultima_modificacion > serverReparacion.ultima_modificacion) {
                        await supabaseClient.updateReparacion(reparacion.id, reparacion);
                    }
                }
            } catch (error) {
                console.error(`Error syncing reparacion ${reparacion.id}:`, error);
            }
        }

        // Subir facturas
        for (const factura of localFacturas) {
            try {
                if (factura.deleted) {
                    await supabaseClient.deleteFactura(factura.id);
                } else {
                    // if (!factura.user_id) factura.user_id = userId; // REMOVED: Schema mismtach (column missing)
                    const serverFactura = await supabaseClient.getFactura(factura.id);

                    if (!serverFactura) {
                        await supabaseClient.createFactura(factura);
                    } else if (factura.ultima_modificacion > serverFactura.ultima_modificacion) {
                        await supabaseClient.updateFactura(factura.id, factura);
                    }
                }
            } catch (error) {
                console.error(`Error syncing factura ${factura.id}:`, error);
            }
        }
    }

    /**
     * Actualiza la UI del botón de sync
     */
    updateSyncUI(syncing) {
        // Desktop Button
        const btnSync = document.getElementById('btn-sync');
        if (btnSync) {
            if (syncing) {
                btnSync.classList.add('syncing');
                btnSync.querySelector('span').textContent = 'Sincronizando...';
            } else {
                btnSync.classList.remove('syncing');
                btnSync.querySelector('span').textContent = 'Sincronizar';
            }
        }

        // Mobile Button
        const btnSyncMobile = document.getElementById('btn-sync-mobile');
        if (btnSyncMobile) {
            if (syncing) {
                btnSyncMobile.classList.add('syncing');
                // Optional: Show toast if starting
                if (window.app && window.app.showToast) window.app.showToast('Sincronizando...', 'info');
            } else {
                btnSyncMobile.classList.remove('syncing');
            }
        }
    }

    /**
     * Actualiza el display de última sincronización
     */
    updateLastSyncDisplay() {
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) {
            if (this.lastSyncTimestamp > 0) {
                const date = new Date(this.lastSyncTimestamp);
                syncStatus.textContent = `Última: ${date.toLocaleTimeString()}`;
            } else {
                syncStatus.textContent = 'Sin sincronizar';
            }
        }
    }

    /**
     * Configura Supabase y prueba la conexión
     */
    async configureAndTest(url, anonKey) {
        supabaseClient.configure(url, anonKey);
        const result = await supabaseClient.testConnection();

        if (result.success) {
            // Guardar configuración
            localStorage.setItem('supabase_url', url);
            localStorage.setItem('supabase_key', anonKey);
        }

        return result;
    }
}

// Instancia global
const syncManager = new SyncManager();
