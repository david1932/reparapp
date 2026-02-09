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
            // AUTO-REPAIR: Corregir formatos de fecha antes de sincronizar
            await this.repairLocalData();

            // CLEANUP: Borrar datos antiguos de la nube (Política 10 días)
            await this.cleanupOldData();

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
                    // CONSTRUIR PAYLOAD LIMPIO (Solo campos que existen en Supabase)
                    const payload = {
                        id: cliente.id,
                        nombre: cliente.nombre,
                        telefono: cliente.telefono || '',
                        email: cliente.email || '',
                        direccion: cliente.direccion || '',
                        notas: cliente.notas || '',
                        // REVERT: Database expects BIGINT (numbers), not ISO Strings
                        fecha_creacion: new Date(cliente.fecha_creacion).getTime(),
                        ultima_modificacion: Date.now()
                    };

                    // Merge Apellido into Nombre if exists locally
                    if (cliente.apellido && !payload.nombre.includes(cliente.apellido)) {
                        payload.nombre = `${payload.nombre} ${cliente.apellido}`.trim();
                    }

                    // Merge DNI into Nombre if exists locally
                    if (cliente.dni && !payload.nombre.includes(cliente.dni)) {
                        payload.nombre = `${payload.nombre} (DNI:${cliente.dni})`;
                    }

                    // Merge CP/City into Address
                    let extraAddress = [];
                    if (cliente.cp) extraAddress.push(`CP:${cliente.cp}`);
                    if (cliente.poblacion) extraAddress.push(cliente.poblacion);
                    if (cliente.provincia) extraAddress.push(cliente.provincia);

                    if (extraAddress.length > 0) {
                        const extraStr = extraAddress.join(', ');
                        if (!payload.direccion.includes(extraStr)) {
                            payload.direccion = payload.direccion ? `${payload.direccion}, ${extraStr}` : extraStr;
                        }
                    }

                    await supabaseClient.upsertCliente(payload);
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
                        fecha_creacion: new Date(reparacion.fecha_creacion || reparacion.fechaCreacion || Date.now()).getTime(),
                        ultima_modificacion: Date.now()
                    };
                    if (reparacion.marca) cleanPayload.marca = reparacion.marca;
                    if (reparacion.modelo) cleanPayload.modelo = reparacion.modelo;
                    if (reparacion.imei) cleanPayload.imei = reparacion.imei;
                    // if (reparacion.observaciones) cleanPayload.observaciones = reparacion.observaciones; // Column does not exist
                    if (reparacion.solucion) cleanPayload.solucion = reparacion.solucion;

                    if (reparacion.fecha_estimada) {
                        // Ensure proper date format for timestamptz column
                        try {
                            const d = new Date(reparacion.fecha_estimada);
                            if (!isNaN(d.getTime())) cleanPayload.fecha_estimada = d.toISOString();
                        } catch (e) { }
                    }

                    if (reparacion.checklist) cleanPayload.checklist = reparacion.checklist;
                    if (reparacion.parts) cleanPayload.parts = reparacion.parts;

                    // LITE SYNC: Sincronizar fotos para que el cliente las vea en la web
                    if (reparacion.photos && reparacion.photos.length > 0) {
                        // Limitamos a las primeras 3 fotos para ahorrar espacio si hay muchas
                        cleanPayload.photos = reparacion.photos.slice(0, 3);
                    }

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

    /**
     * REPARACIÓN DE DATOS (Data Doctor Integrado)
     * Corrige formatos de fecha (String -> Number) antes de subir
     */
    async repairLocalData() {
        console.log('👨‍⚕️ Ejecutando Doctor de Datos previo al sync...');
        try {
            const reparaciones = await db.getAllReparaciones();
            let fixedCount = 0;

            for (const r of reparaciones) {
                let modified = false;

                // Corregir fecha_creacion
                if (typeof r.fecha_creacion === 'string') {
                    r.fecha_creacion = new Date(r.fecha_creacion).getTime();
                    modified = true;
                }

                // Corregir ultima_modificacion
                if (typeof r.ultima_modificacion === 'string') {
                    r.ultima_modificacion = new Date(r.ultima_modificacion).getTime();
                    modified = true;
                }

                if (modified) {
                    // Actualizar timestamp para forzar subida
                    r.ultima_modificacion = Date.now();
                    await db.saveReparacion(r);
                    fixedCount++;
                }
            }
            if (fixedCount > 0) {
                console.log(`✅ Doctor: ${fixedCount} reparaciones corregidas.`);
                // Show a small toast if repairs were made
                if (window.app && window.app.showToast) {
                    window.app.showToast(`Datos corregidos: ${fixedCount}`, 'info');
                }
            }
        } catch (e) {
            console.error('Error en Data Doctor:', e);
        }
    }

    /**
     * CLEANUP: Política de retención (10 días)
     * Elimina de la nube las reparaciones entregadas hace más de 10 días
     * para ahorrar espacio y privacidad. Mantiene copia local.
     */
    async cleanupOldData() {
        console.log('🧹 Ejecutando limpieza de nube (Retention Policy)...');
        try {
            const reparaciones = await db.getAllReparaciones();
            const RETENTION_DAYS = 10;
            const cutoffDate = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);

            let deletedCount = 0;

            // Agrupar IDs para borrar
            const idsToDelete = [];

            for (const r of reparaciones) {
                // Criterio: Entregada Y (Fecha Entrega o Creación > 10 días)
                // Priorizamos fecha_creacion porque ultima_modificacion cambia al sincronizar
                const dateVal = r.fecha_creacion || r.ultima_modificacion;
                if (r.estado === 'entregada' && dateVal < cutoffDate) {
                    idsToDelete.push(r.id);
                }
            }

            if (idsToDelete.length > 0) {
                console.log(`🧹 Encontradas ${idsToDelete.length} reparaciones caducadas para borrar de la nube.`);

                // Borrar en lotes (batch) si es posible, o uno a uno
                // Supabase permite IN filter para deletes massivos: DELETE FROM reparaciones WHERE id IN (...)
                // Haremos uno a uno por seguridad de la librería actual o pequeño batch

                // Borrar en paralelo para mayor velocidad
                const deletePromises = idsToDelete.map(async (id) => {
                    try {
                        await supabaseClient.deleteReparacion(id);
                        return true;
                    } catch (e) {
                        console.warn(`Error borrando reparación caducada ${id}:`, e);
                        return false;
                    }
                });

                const results = await Promise.all(deletePromises);
                deletedCount = results.filter(r => r).length;
            }

            if (deletedCount > 0) {
                console.log(`✅ Limpieza: ${deletedCount} reparaciones eliminadas de la nube.`);
            }
        } catch (e) {
            console.error('Error en Cloud Cleanup:', e);
        }
    }

    /**
     * TEST: Verificar Política de Retención
     */
    async testRetentionPolicy() {
        if (!confirm('Se va a crear una reparación de prueba con fecha antigua (20 días) y se intentará borrar automáticamente. ¿Continuar?')) return;

        try {
            const clients = await db.getAllClientes();
            if (!clients || clients.length === 0) {
                alert('Ve a Ajustes > Sincronización: Crea un cliente primero.');
                return;
            }
            // 0. Ensure Client Exists in Cloud (Fix 409 Error)
            const client = clients[0];
            const clientPayload = {
                id: client.id,
                nombre: (client.nombre || '') + (client.apellido ? ' ' + client.apellido : ''),
                telefono: client.telefono || '',
                email: client.email || '',
                direccion: client.direccion || '',
                notas: client.notas || '',
                fecha_creacion: typeof client.fecha_creacion === 'string' ? new Date(client.fecha_creacion).getTime() : (client.fecha_creacion || Date.now()),
                ultima_modificacion: Date.now()
            };
            await supabaseClient.upsertCliente(clientPayload);

            // 1. Mock Repair with VALID UUID (Supabase requires UUID)
            const oldId = crypto.randomUUID();
            const daysAgo = 20;
            const pastDate = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);

            const oldRepair = {
                id: oldId,
                cliente_id: client.id,
                descripcion: 'Test Retention Policy',
                estado: 'entregada',
                fecha_creacion: pastDate,
                ultima_modificacion: pastDate,
                precio: 0, precio_final: 0
            };

            await db.saveReparacion(oldRepair);

            // Forzar fechas antiguas después del save (por si db.save las sobreescribe)
            const forceOld = await db.getReparacion(oldId);
            forceOld.fecha_creacion = pastDate;
            forceOld.ultima_modificacion = pastDate;
            await db.saveReparacion(forceOld);

            // 2. Upload to Cloud
            const repairPayload = { ...forceOld };
            delete repairPayload.precio; delete repairPayload.precio_final;
            await supabaseClient.upsertReparacion(repairPayload);

            // 3. Run Cleanup
            alert(`✅ Prueba subida.\nID: ${oldId}\n\nEjecutando limpieza...`);
            await this.cleanupOldData();

            // 4. Verify
            const check = await supabaseClient.getReparacion(oldId);
            await db.deleteReparacion(oldId); // Cleanup local

            if (!check) {
                alert('🎉 ¡ÉXITO! La reparación se borró de la nube.\n\nLa política de 10 días funciona correctamente.');
            } else {
                alert('❌ FALLO: Sigue en la nube.\n\nRevisa si la sección de Ajustes > Sincronización tiene errores.');
            }

        } catch (e) {
            alert('Error: ' + (e.message || JSON.stringify(e)));
            console.error(e);
        }
    }
}

// Instancia global explícita
window.syncManager = new SyncManager();
