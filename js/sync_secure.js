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
            return { success: false, message: 'Sincronización en progreso' };
        }

        if (!this.isAvailable()) {
            return { success: false, message: 'Supabase no configurado' };
        }

        this.isSyncing = true;
        this.updateSyncUI(true);

        try {

            // Paso 1: Descargar cambios del servidor
            const pullStats = await this.pullFromServer();

            // Paso 2: Subir cambios locales
            const pushStats = await this.pushToServer();

            // Paso 3: Actualizar timestamp SOLO si no hubo errores graves
            // Si hubo errores, mantenemos el timestamp antiguo para reintentar la próxima vez
            if (pushStats.errors === 0) {
                this.lastSyncTimestamp = Date.now();
                await db.setConfig('last_sync', this.lastSyncTimestamp);
            } else {
                console.warn('Sync completed with errors. Timestamp NOT updated to ensure retry.');
            }

            this.isSyncing = false;
            this.updateSyncUI(false);
            this.updateLastSyncDisplay();

            return {
                success: true,
                message: 'Sincronización completada',
                stats: {
                    downloaded: pullStats,
                    uploaded: pushStats
                }
            };

        } catch (error) {
            console.error('Sync error:', error);
            this.isSyncing = false;
            this.updateSyncUI(false);
            return { success: false, message: `Error al sincronizar: ${error.message || error}` };
        }
    }

    /**
     * Descarga cambios del servidor
     */
    async pullFromServer() {

        // Obtener datos modificados después de la última sincronización
        const [serverClientes, serverReparaciones, serverFacturas] = await Promise.all([
            supabaseClient.getClientesModifiedAfter(this.lastSyncTimestamp),
            supabaseClient.getReparacionesModifiedAfter(this.lastSyncTimestamp),
            supabaseClient.getFacturasModifiedAfter(this.lastSyncTimestamp)
        ]);


        // Importar con resolución de conflictos
        await db.importFromServer(serverClientes, serverReparaciones, serverFacturas);

        return {
            clientes: serverClientes.length,
            reparaciones: serverReparaciones.length,
            facturas: serverFacturas.length
        };
    }

    /**
     * Sube cambios locales al servidor
     */
    /**
     * Sube cambios locales al servidor
     */
    async pushToServer() {

        // Obtener usuario actual para asegurar propiedad
        const user = await supabaseClient.getUser();
        const userId = user ? user.id : null;

        if (!userId) {
            return { clientes: 0, reparaciones: 0, facturas: 0, errors: 0, skipped: 0 };
        }

        // Obtener datos modificados localmente (incluye eliminados soft-delete)
        const [localClientes, localReparaciones, localFacturas] = await Promise.all([
            db.getClientesModifiedAfter(this.lastSyncTimestamp),
            db.getReparacionesModifiedAfter(this.lastSyncTimestamp),
            db.getFacturasModifiedAfter(this.lastSyncTimestamp)
        ]);


        const stats = { clientes: 0, reparaciones: 0, facturas: 0, errors: 0, lastError: null, skipped: 0 };

        // Helper to capture error
        const captureError = (error) => {
            console.error(error);
            stats.errors++;
            if (!stats.lastError) stats.lastError = error.message || error.toString();
        };

        // Helper to validate UUID
        const isValidUUID = (id) => {
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return regex.test(id);
        };

        // Subir clientes
        const clientTasks = localClientes.map(async (cliente) => {
            try {
                if (!isValidUUID(cliente.id)) {
                    console.warn(`Skipping invalid client ID: ${cliente.id}`);
                    stats.skipped++;
                    return;
                }

                if (cliente.deleted) {
                    await supabaseClient.deleteCliente(cliente.id);
                } else {
                    const payload = { ...cliente };
                    delete payload.user_id;
                    if (payload.apellido) {
                        if (!payload.nombre.includes(payload.apellido)) {
                            payload.nombre = `${payload.nombre} ${payload.apellido}`.trim();
                        }
                        delete payload.apellido;
                    }
                    if (payload.dni) {
                        if (!payload.nombre.includes(payload.dni)) {
                            payload.nombre = `${payload.nombre} (DNI:${payload.dni})`;
                        }
                        delete payload.dni;
                    }
                    let addressParts = [];
                    if (payload.direccion) addressParts.push(payload.direccion);
                    if (payload.cp) addressParts.push(`CP:${payload.cp}`);
                    if (payload.poblacion) addressParts.push(payload.poblacion);
                    if (payload.provincia) addressParts.push(payload.provincia);
                    if (addressParts.length > 0) payload.direccion = addressParts.join(', ');
                    delete payload.cp;
                    delete payload.poblacion;
                    delete payload.provincia;
                    delete payload.fechaRegistro;

                    await supabaseClient.upsertCliente(payload);
                }
                stats.clientes++;
            } catch (error) {
                captureError(error);
            }
        });
        await Promise.all(clientTasks);

        // Subir reparaciones
        const repairTasks = localReparaciones.map(async (reparacion) => {
            try {
                if (!isValidUUID(reparacion.id) || (reparacion.cliente_id && !isValidUUID(reparacion.cliente_id))) {
                    stats.skipped++;
                    return;
                }

                if (reparacion.deleted) {
                    await supabaseClient.deleteReparacion(reparacion.id);
                } else {
                    const cleanPayload = {
                        id: reparacion.id,
                        cliente_id: reparacion.cliente_id || reparacion.clientId,
                        descripcion: reparacion.descripcion || reparacion.problema || 'Sin descripción',
                        estado: reparacion.estado || 'pendiente',
                        precio: reparacion.precio || reparacion.coste || 0,
                        precio_final: reparacion.precio_final || null,
                        fecha_creacion: reparacion.fecha_creacion || reparacion.fechaCreacion || Date.now(),
                        ultima_modificacion: reparacion.ultima_modificacion || Date.now()
                    };
                    if (reparacion.marca) cleanPayload.marca = reparacion.marca;
                    if (reparacion.modelo) cleanPayload.modelo = reparacion.modelo;
                    if (reparacion.imei) cleanPayload.imei = reparacion.imei;
                    if (reparacion.observaciones) cleanPayload.observaciones = reparacion.observaciones;
                    if (reparacion.solucion) cleanPayload.solucion = reparacion.solucion;
                    if (reparacion.fecha_estimada) cleanPayload.fecha_estimada = reparacion.fecha_estimada;
                    if (reparacion.checklist) cleanPayload.checklist = reparacion.checklist;
                    if (reparacion.parts) cleanPayload.parts = reparacion.parts;
                    // LITE SYNC: Exclude heavy media to save Supabase storage (Free Tier)
                    // if (reparacion.photos) cleanPayload.photos = reparacion.photos;
                    // if (reparacion.signature) cleanPayload.signature = reparacion.signature;

                    await supabaseClient.upsertReparacion(cleanPayload);
                }
                stats.reparaciones++;
            } catch (error) {
                captureError(error);
            }
        });
        await Promise.all(repairTasks);

        // Subir facturas
        const invoiceTasks = localFacturas.map(async (factura) => {
            try {
                if (!isValidUUID(factura.id) || (factura.cliente_id && !isValidUUID(factura.cliente_id))) {
                    stats.skipped++;
                    return;
                }

                if (factura.deleted) {
                    await supabaseClient.deleteFactura(factura.id);
                } else {
                    const payload = { ...factura };
                    delete payload.user_id;

                    // Usar POST con Prefer resolution=merge-duplicates para upsert
                    await supabaseClient.request('facturas', {
                        method: 'POST',
                        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
                        body: JSON.stringify(payload)
                    });
                }
                stats.facturas++;
            } catch (error) {
                captureError(error);
            }
        });
        await Promise.all(invoiceTasks);

        return stats;
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

// Instancia global explícita
window.syncManager = new SyncManager();
