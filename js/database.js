/**
 * Database Module - IndexedDB para almacenamiento local
 * Gestión de clientes y reparaciones offline
 */

const DB_NAME = 'GestionAppDB';
const DB_VERSION = 2;

class Database {
    constructor() {
        this.db = null;
        this.isReady = false;
    }

    /**
     * Inicializa la base de datos IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Error opening database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('Database initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Crear store de clientes
                if (!db.objectStoreNames.contains('clientes')) {
                    const clientesStore = db.createObjectStore('clientes', { keyPath: 'id' });
                    clientesStore.createIndex('nombre', 'nombre', { unique: false });
                    clientesStore.createIndex('telefono', 'telefono', { unique: false });
                    clientesStore.createIndex('ultima_modificacion', 'ultima_modificacion', { unique: false });
                }

                // Crear store de reparaciones
                if (!db.objectStoreNames.contains('reparaciones')) {
                    const reparacionesStore = db.createObjectStore('reparaciones', { keyPath: 'id' });
                    reparacionesStore.createIndex('cliente_id', 'cliente_id', { unique: false });
                    reparacionesStore.createIndex('estado', 'estado', { unique: false });
                    reparacionesStore.createIndex('ultima_modificacion', 'ultima_modificacion', { unique: false });
                }

                // Crear store de facturas
                if (!db.objectStoreNames.contains('facturas')) {
                    const facturasStore = db.createObjectStore('facturas', { keyPath: 'id' });
                    facturasStore.createIndex('cliente_id', 'cliente_id', { unique: false });
                    facturasStore.createIndex('numero', 'numero', { unique: false });
                    facturasStore.createIndex('fecha', 'fecha', { unique: false });
                    facturasStore.createIndex('ultima_modificacion', 'ultima_modificacion', { unique: false });
                }

                // Crear store de configuración (para sync timestamps)
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'key' });
                }

                console.log('Database schema created');
            };
        });
    }

    /**
     * Genera un UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Obtiene el timestamp actual en milisegundos
     */
    getTimestamp() {
        return Date.now();
    }

    // ==================== CLIENTES ====================

    /**
     * Obtiene todos los clientes
     */
    async getAllClientes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clientes'], 'readonly');
            const store = transaction.objectStore('clientes');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene un cliente por ID
     */
    async getCliente(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clientes'], 'readonly');
            const store = transaction.objectStore('clientes');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Crea o actualiza un cliente
     */
    async saveCliente(cliente) {
        const now = this.getTimestamp();

        if (!cliente.id) {
            // Nuevo cliente
            cliente.id = this.generateUUID();
            cliente.fecha_creacion = now;
        }

        // Asignar user_id si hay sesión activa
        if (!cliente.user_id && typeof supabaseClient !== 'undefined') {
            try {
                const user = await supabaseClient.getUser();
                if (user) cliente.user_id = user.id;
            } catch (e) {
                console.warn('Could not set user_id', e);
            }
        }

        cliente.ultima_modificacion = now;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clientes'], 'readwrite');
            const store = transaction.objectStore('clientes');
            const request = store.put(cliente);

            request.onsuccess = () => {
                if (typeof fileSync !== 'undefined') fileSync.syncTable('clientes');
                resolve(cliente);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Elimina un cliente
     */
    async deleteCliente(id) {
        // Primero eliminar reparaciones asociadas
        const reparaciones = await this.getReparacionesByCliente(id);
        for (const rep of reparaciones) {
            await this.deleteReparacion(rep.id);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clientes'], 'readwrite');
            const store = transaction.objectStore('clientes');
            const request = store.delete(id);

            request.onsuccess = () => {
                if (typeof fileSync !== 'undefined') fileSync.syncTable('clientes');
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Busca clientes por nombre o teléfono
     */
    async searchClientes(query) {
        const clientes = await this.getAllClientes();
        const lowerQuery = query.toLowerCase();

        return clientes.filter(cliente =>
            cliente.nombre.toLowerCase().includes(lowerQuery) ||
            cliente.telefono.includes(query)
        );
    }

    // ==================== REPARACIONES ====================

    /**
     * Obtiene todas las reparaciones
     */
    async getAllReparaciones() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reparaciones'], 'readonly');
            const store = transaction.objectStore('reparaciones');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene una reparación por ID
     */
    async getReparacion(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reparaciones'], 'readonly');
            const store = transaction.objectStore('reparaciones');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene reparaciones por cliente
     */
    async getReparacionesByCliente(clienteId) {
        const reparaciones = await this.getAllReparaciones();
        return reparaciones.filter(r => r.cliente_id === clienteId);
    }

    /**
     * Obtiene reparaciones por estado
     */
    async getReparacionesByEstado(estado) {
        const reparaciones = await this.getAllReparaciones();
        return reparaciones.filter(r => r.estado === estado);
    }

    /**
     * Crea o actualiza una reparación
     */
    async saveReparacion(reparacion) {
        const now = this.getTimestamp();

        if (!reparacion.id) {
            // Nueva reparación
            reparacion.id = this.generateUUID();
            reparacion.fecha_creacion = now;
        }

        // Asignar user_id si hay sesión activa
        if (!reparacion.user_id && typeof supabaseClient !== 'undefined') {
            try {
                const user = await supabaseClient.getUser();
                if (user) reparacion.user_id = user.id;
            } catch (e) {
                console.warn('Could not set user_id', e);
            }
        }

        reparacion.ultima_modificacion = now;
        reparacion.precio = parseFloat(reparacion.precio) || 0;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reparaciones'], 'readwrite');
            const store = transaction.objectStore('reparaciones');
            const request = store.put(reparacion);

            request.onsuccess = () => {
                if (typeof fileSync !== 'undefined') fileSync.syncTable('reparaciones');
                resolve(reparacion);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Elimina una reparación
     */
    async deleteReparacion(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reparaciones'], 'readwrite');
            const store = transaction.objectStore('reparaciones');
            const request = store.delete(id);

            request.onsuccess = () => {
                if (typeof fileSync !== 'undefined') fileSync.syncTable('reparaciones');
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Busca reparaciones
     */
    async searchReparaciones(query, estado = null) {
        let reparaciones = await this.getAllReparaciones();

        if (estado) {
            reparaciones = reparaciones.filter(r => r.estado === estado);
        }

        if (query) {
            const lowerQuery = query.toLowerCase();
            reparaciones = reparaciones.filter(r =>
                r.descripcion.toLowerCase().includes(lowerQuery)
            );
        }

        return reparaciones;
    }

    // ==================== CONFIG / SYNC ====================

    /**
     * Obtiene un valor de configuración
     */
    async getConfig(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Guarda un valor de configuración
     */
    async setConfig(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readwrite');
            const store = transaction.objectStore('config');
            const request = store.put({ key, value });

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene clientes modificados después de un timestamp
     */
    async getClientesModifiedAfter(timestamp) {
        const clientes = await this.getAllClientes();
        return clientes.filter(c => c.ultima_modificacion > timestamp);
    }

    /**
     * Obtiene reparaciones modificadas después de un timestamp
     */
    async getReparacionesModifiedAfter(timestamp) {
        const reparaciones = await this.getAllReparaciones();
        return reparaciones.filter(r => r.ultima_modificacion > timestamp);
    }

    /**
     * Obtiene facturas modificadas después de un timestamp
     */
    async getFacturasModifiedAfter(timestamp) {
        const facturas = await this.getAllFacturas();
        return facturas.filter(f => f.ultima_modificacion > timestamp);
    }

    /**
     * Importa datos del servidor (para sincronización)
     */
    async importFromServer(clientes, reparaciones, facturas = []) {
        // Importar clientes
        for (const cliente of clientes) {
            const local = await this.getCliente(cliente.id);
            if (!local || cliente.ultima_modificacion > local.ultima_modificacion) {
                await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['clientes'], 'readwrite');
                    const store = transaction.objectStore('clientes');
                    const request = store.put(cliente);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        }

        // Importar reparaciones
        for (const reparacion of reparaciones) {
            const local = await this.getReparacion(reparacion.id);
            if (!local || reparacion.ultima_modificacion > local.ultima_modificacion) {
                await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['reparaciones'], 'readwrite');
                    const store = transaction.objectStore('reparaciones');
                    const request = store.put(reparacion);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        }

        // Importar facturas
        for (const factura of facturas) {
            const local = await this.getFactura(factura.id);
            if (!local || factura.ultima_modificacion > local.ultima_modificacion) {
                await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['facturas'], 'readwrite');
                    const store = transaction.objectStore('facturas');
                    const request = store.put(factura);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        }
    }

    // ==================== ESTADÍSTICAS ====================

    /**
     * Obtiene estadísticas generales
     */
    async getStats() {
        const clientes = await this.getAllClientes();
        const reparaciones = await this.getAllReparaciones();

        return {
            totalClientes: clientes.length,
            totalReparaciones: reparaciones.length,
            pendientes: reparaciones.filter(r => r.estado === 'pendiente').length,
            enProceso: reparaciones.filter(r => r.estado === 'en_proceso').length,
            completadas: reparaciones.filter(r => r.estado === 'completada').length
        };
    }

    // ==================== FACTURAS ====================

    /**
     * Obtiene todas las facturas
     */
    async getAllFacturas() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['facturas'], 'readonly');
            const store = transaction.objectStore('facturas');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene una factura por ID
     */
    async getFactura(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['facturas'], 'readonly');
            const store = transaction.objectStore('facturas');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Crea o actualiza una factura
     */
    async saveFactura(factura) {
        const now = this.getTimestamp();

        if (!factura.id) {
            factura.id = this.generateUUID();
            factura.fecha_creacion = now;
        }

        // Asignar user_id si hay sesión activa
        if (!factura.user_id && typeof supabaseClient !== 'undefined') {
            try {
                const user = await supabaseClient.getUser();
                if (user) factura.user_id = user.id;
            } catch (e) {
                console.warn('Could not set user_id', e);
            }
        }

        factura.ultima_modificacion = now;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['facturas'], 'readwrite');
            const store = transaction.objectStore('facturas');
            const request = store.put(factura);

            request.onsuccess = () => {
                if (typeof fileSync !== 'undefined') fileSync.syncTable('facturas');
                resolve(factura);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Elimina una factura
     */
    async deleteFactura(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['facturas'], 'readwrite');
            const store = transaction.objectStore('facturas');
            const request = store.delete(id);

            request.onsuccess = () => {
                if (typeof fileSync !== 'undefined') fileSync.syncTable('facturas');
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== BACKUP / EXPORT ====================

    /**
     * Exporta todos los datos de la base de datos
     */
    async exportData() {
        const clientes = await this.getAllClientes();
        const reparaciones = await this.getAllReparaciones();
        const facturas = await this.getAllFacturas();

        return {
            version: DB_VERSION,
            timestamp: Date.now(),
            data: {
                clientes,
                reparaciones,
                facturas
            }
        };
    }

    /**
     * Importa datos y sobrescribe/actualiza la base de datos
     * @param {Object} backupData - Datos del backup JSON
     */
    async importData(backupData) {
        if (!backupData || !backupData.data) {
            throw new Error('Formato de backup inválido');
        }

        const { clientes, reparaciones, facturas } = backupData.data;

        // Importar clientes
        if (clientes && Array.isArray(clientes)) {
            for (const c of clientes) {
                await this.saveCliente(c);
            }
        }

        // Importar reparaciones
        if (reparaciones && Array.isArray(reparaciones)) {
            for (const r of reparaciones) {
                await this.saveReparacion(r);
            }
        }

        // Importar facturas
        if (facturas && Array.isArray(facturas)) {
            for (const f of facturas) {
                await this.saveFactura(f);
            }
        }

        return true;
    }

    /**
     * Elimina TODOS los datos de negocio (Clientes, Reparaciones, Facturas)
     * Mantiene la configuración (Logo, PIN, Datos Empresa)
     */
    async clearAllData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clientes', 'reparaciones', 'facturas'], 'readwrite');

            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => resolve();

            transaction.objectStore('clientes').clear();
            transaction.objectStore('reparaciones').clear();
            transaction.objectStore('facturas').clear();
        });
    }
}

// Instancia global
const db = new Database();
