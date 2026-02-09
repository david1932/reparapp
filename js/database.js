/**
 * Database Module - IndexedDB para almacenamiento local
 * Gestión de clientes y reparaciones offline
 */

const DB_NAME = 'GestionAppDB';
const DB_VERSION = 9;

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
                this.ensureDefaultClient(); // Create default client if missing
                resolve(this.db);
            };

            request.onblocked = () => {
                console.warn('Database open BLOCKED. Please close other tabs/windows.');
                reject(new Error('Database blocked: Close other app instances and reload.'));
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

                // Crear store de productos (INVENTARIO)
                if (!db.objectStoreNames.contains('products')) {
                    const productsStore = db.createObjectStore('products', { keyPath: 'id' });
                    productsStore.createIndex('name', 'name', { unique: false });
                    productsStore.createIndex('sku', 'sku', { unique: false });
                    productsStore.createIndex('category', 'category', { unique: false });
                    productsStore.createIndex('stock', 'stock', { unique: false });
                    productsStore.createIndex('ultima_modificacion', 'ultima_modificacion', { unique: false });
                }

                // Crear store de usuarios (Gestion de Personal)
                if (!db.objectStoreNames.contains('users')) {
                    const usersStore = db.createObjectStore('users', { keyPath: 'id' });
                    usersStore.createIndex('role', 'role', { unique: false });
                    usersStore.createIndex('pin', 'pin', { unique: true });
                }

                // Crear store de configuración
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('gastos')) {
                    const gastosStore = db.createObjectStore('gastos', { keyPath: 'id', autoIncrement: true });
                    gastosStore.createIndex('fecha', 'fecha', { unique: false });
                    gastosStore.createIndex('trimestre', 'trimestre', { unique: false });
                }
                if (!db.objectStoreNames.contains('ingresos_extra')) {
                    const ingresosStore = db.createObjectStore('ingresos_extra', { keyPath: 'id', autoIncrement: true });
                    ingresosStore.createIndex('fecha', 'fecha', { unique: false });
                    ingresosStore.createIndex('trimestre', 'trimestre', { unique: false });
                }

                // Crear store para handles (File System Access API)
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles', { keyPath: 'id' });
                }

                // Crear store de CITAS (NEW)
                if (!db.objectStoreNames.contains('citas')) {
                    const citasStore = db.createObjectStore('citas', { keyPath: 'id' });
                    citasStore.createIndex('fecha', 'fecha', { unique: false }); // TIMESTAMP
                    citasStore.createIndex('cliente_id', 'cliente_id', { unique: false });
                    citasStore.createIndex('ultima_modificacion', 'ultima_modificacion', { unique: false });
                }

                // Crear store de CAJA / TPV (NEW)
                if (!db.objectStoreNames.contains('caja')) {
                    const cajaStore = db.createObjectStore('caja', { keyPath: 'id' });
                    cajaStore.createIndex('fecha', 'fecha', { unique: false });
                    cajaStore.createIndex('tipo', 'tipo', { unique: false }); // IN, OUT, OPEN, CLOSE
                    cajaStore.createIndex('ultima_modificacion', 'ultima_modificacion', { unique: false });
                }

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
     * File System Handles Support
     */
    async saveDirectoryHandle(handle) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['handles'], 'readwrite');
            const store = transaction.objectStore('handles');
            // Serializamos lo que podamos, pero el handle en sí es el objeto clave
            const request = store.put({ id: 'backup_dir', handle: handle });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getDirectoryHandle() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['handles'], 'readonly');
            const store = transaction.objectStore('handles');
            const request = store.get('backup_dir');
            request.onsuccess = () => resolve(request.result ? request.result.handle : null);
            request.onerror = () => reject(request.error);
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

            request.onsuccess = () => {
                // Filter out soft-deleted records
                const active = request.result.filter(r => !r.deleted);
                resolve(active);
            };
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
        // Primero eliminar reparaciones asociadas (Soft Delete también)
        const reparaciones = await this.getReparacionesByCliente(id);
        for (const rep of reparaciones) {
            await this.deleteReparacion(rep.id);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clientes'], 'readwrite');
            const store = transaction.objectStore('clientes');

            // Soft Delete: Get, Modify, Put
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record) {
                    record.deleted = 1;
                    record.ultima_modificacion = this.getTimestamp();

                    const putReq = store.put(record);
                    putReq.onsuccess = () => {
                        if (typeof fileSync !== 'undefined') fileSync.syncTable('clientes');
                        resolve(true);
                    };
                    putReq.onerror = () => reject(putReq.error);
                } else {
                    resolve(true); // Already gone
                }
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    /**
     * Busca clientes por nombre o teléfono
     */
    async searchClientes(query) {
        const clientes = await this.getAllClientes();
        const lowerQuery = query.toLowerCase();

        // Filter: Strict startsWith for text, includes for phone
        const results = clientes.filter(cliente => {
            const nameMatch = cliente.nombre && cliente.nombre.toLowerCase().startsWith(lowerQuery);
            const emailMatch = cliente.email && cliente.email.toLowerCase().startsWith(lowerQuery);
            const phoneMatch = cliente.telefono && cliente.telefono.includes(query); // Phone usually needs includes

            return nameMatch || emailMatch || phoneMatch;
        });

        // Sort: Alphabetical (since all match startsWith essentially)
        return results.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    async ensureDefaultClient() {
        try {
            const defaultId = 'CLIENTE_GENERAL';
            const exists = await this.getCliente(defaultId);
            if (!exists) {
                console.log('Creating default Walk-in Client...');
                await this.saveCliente({
                    id: defaultId,
                    nombre: 'Cliente',
                    apellido: 'General',
                    telefono: '000000000',
                    email: '',
                    dni: '00000000T',
                    direccion: 'Venta en Mostrador',
                    notas: 'Cliente por defecto para ventas rápidas',
                    fecha_creacion: this.getTimestamp(),
                    ultima_modificacion: this.getTimestamp()
                });
            }
        } catch (e) {
            console.error('Error ensuring default client:', e);
        }
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

            request.onsuccess = () => {
                const active = request.result.filter(r => !r.deleted);
                resolve(active);
            };
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
     * Crea o actualiza una reparación
     */
    async saveReparacion(reparacion) {
        const now = this.getTimestamp();

        if (!reparacion.id) {
            reparacion.id = this.generateUUID();
            reparacion.fecha_creacion = now;
            reparacion.estado = 'pendiente'; // Default
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
     * Obtiene reparaciones de un cliente
     */
    async getReparacionesByCliente(clienteId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reparaciones'], 'readonly');
            const store = transaction.objectStore('reparaciones');
            const index = store.index('cliente_id');
            const request = index.getAll(clienteId);

            request.onsuccess = () => {
                const active = request.result.filter(r => !r.deleted);
                resolve(active);
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

            // Soft Delete
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record) {
                    record.deleted = 1;
                    record.ultima_modificacion = this.getTimestamp();
                    const putReq = store.put(record);
                    putReq.onsuccess = () => {
                        if (typeof fileSync !== 'undefined') fileSync.syncTable('reparaciones');
                        resolve(true);
                    };
                    putReq.onerror = () => reject(putReq.error);
                } else {
                    resolve(true);
                }
            };
            getReq.onerror = () => reject(getReq.error);
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

            // To filter by client name, we need to fetch clients first
            const clients = await this.getAllClientes();
            const clientMap = new Map(clients.map(c => [c.id, c.nombre.toLowerCase()]));

            // Strict StartsWith Filter
            reparaciones = reparaciones.filter(r => {
                const descMatch = r.descripcion.toLowerCase().startsWith(lowerQuery);
                const brandMatch = r.marca && r.marca.toLowerCase().startsWith(lowerQuery);
                const modelMatch = r.modelo && r.modelo.toLowerCase().startsWith(lowerQuery);
                const imeiMatch = r.imei && r.imei.toLowerCase().startsWith(lowerQuery);

                // Check Client Name
                const clientName = clientMap.get(r.cliente_id);
                const clientMatch = clientName && clientName.startsWith(lowerQuery);

                return descMatch || brandMatch || modelMatch || imeiMatch || clientMatch;
            });

            // Sort by date (default) since filtering is strict
        }

        return reparaciones;
    }

    // ==================== CITAS ====================

    /**
     * Obtiene todas las citas
     */
    async getAllCitas() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['citas'], 'readonly');
            const store = transaction.objectStore('citas');
            const request = store.getAll();

            request.onsuccess = () => {
                const active = request.result.filter(r => !r.deleted);
                resolve(active);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Guarda una cita
     */
    async saveCita(cita) {
        const now = this.getTimestamp();

        if (!cita.id) {
            cita.id = this.generateUUID();
            cita.fecha_creacion = now;
        }

        // Asignar user_id si hay sesión activa
        if (!cita.user_id && typeof supabaseClient !== 'undefined') {
            try {
                const user = await supabaseClient.getUser();
                if (user) cita.user_id = user.id;
            } catch (e) {
                console.warn('Could not set user_id', e);
            }
        }

        cita.ultima_modificacion = now;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['citas'], 'readwrite');
            const store = transaction.objectStore('citas');
            const request = store.put(cita);

            request.onsuccess = () => {
                if (typeof fileSync !== 'undefined') fileSync.syncTable('citas');
                resolve(cita);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Elimina una cita
     */
    async deleteCita(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['citas'], 'readwrite');
            const store = transaction.objectStore('citas');

            // Soft Delete
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record) {
                    record.deleted = 1;
                    record.ultima_modificacion = this.getTimestamp();
                    const putReq = store.put(record);
                    putReq.onsuccess = () => {
                        if (typeof fileSync !== 'undefined') fileSync.syncTable('citas');
                        resolve(true);
                    };
                    putReq.onerror = () => reject(putReq.error);
                } else {
                    resolve(true); // Already gone
                }
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    /**
     * Obtiene citas en un rango de fechas
     */
    async getCitasByDateRange(start, end) {
        const all = await this.getAllCitas();
        return all.filter(c => {
            const date = new Date(c.fecha).getTime();
            return date >= start && date <= end;
        });
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
     * Obtiene TODA la configuración para backup
     */
    async getAllConfig() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.getAll();

            request.onsuccess = () => {
                // Convertir array de objetos {key, value} a objeto simple {key: value}
                const configMap = {};
                request.result.forEach(item => {
                    if (item.key && item.value) configMap[item.key] = item.value;
                });
                resolve(configMap);
            };
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
        // We need ALL records (including deleted) to push changes
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clientes'], 'readonly');
            const store = transaction.objectStore('clientes');
            const request = store.getAll();

            request.onsuccess = () => {
                // Filter by modification time ONLY
                const modified = request.result.filter(c => c.ultima_modificacion > timestamp);
                resolve(modified);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene reparaciones modificadas después de un timestamp
     */
    /**
     * Obtiene reparaciones modificadas después de un timestamp
     */
    async getReparacionesModifiedAfter(timestamp) {
        // We need ALL records (including deleted) to push changes
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reparaciones'], 'readonly');
            const store = transaction.objectStore('reparaciones');
            const request = store.getAll();

            request.onsuccess = () => {
                const modified = request.result.filter(r => r.ultima_modificacion > timestamp);
                resolve(modified);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene facturas modificadas después de un timestamp
     */
    async getFacturasModifiedAfter(timestamp) {
        // We need ALL records (including deleted) to push changes
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['facturas'], 'readonly');
            const store = transaction.objectStore('facturas');
            const request = store.getAll();

            request.onsuccess = () => {
                const modified = request.result.filter(f => f.ultima_modificacion > timestamp);
                resolve(modified);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Importa datos del servidor (para sincronización)
     */
    async importFromServer(clientes, reparaciones, facturas = []) {
        const importBatch = async (items, storeName) => {
            if (!items || items.length === 0) return;

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            // Get all existing items in this store to compare timestamps in memory
            const existingItems = await new Promise(r => {
                const req = store.getAll();
                req.onsuccess = () => r(req.result);
                req.onerror = () => r([]);
            });

            const localMap = new Map(existingItems.map(i => [i.id, i]));

            for (const item of items) {
                const local = localMap.get(item.id);
                if (!local || item.ultima_modificacion > local.ultima_modificacion) {
                    store.put(item);
                }
            }

            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        };

        await importBatch(clientes, 'clientes');
        await importBatch(reparaciones, 'reparaciones');
        await importBatch(facturas, 'facturas');
    }

    // ==================== ESTADÍSTICAS ====================

    /**
     * Obtiene estadísticas generales
     */
    async getStats() {
        const clientes = await this.getAllClientes();
        const reparaciones = await this.getAllReparaciones();
        const facturas = await this.getAllFacturas();

        return {
            totalClientes: clientes.length,
            totalReparaciones: reparaciones.length,
            totalFacturas: facturas.length,
            recibido: reparaciones.filter(r => r.estado === 'recibido').length,
            diagnostico: reparaciones.filter(r => r.estado === 'diagnostico').length,
            reparando: reparaciones.filter(r => r.estado === 'reparando').length,
            completadas: reparaciones.filter(r => r.estado === 'listo').length,
            canceladas: reparaciones.filter(r => r.estado === 'cancelado').length
        };
    }

    // ==================== FACTURAS ====================

    /**
     * Obtiene todas las facturas
     */
    /**
     * Obtiene todas las facturas
     */
    async getAllFacturas() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['facturas'], 'readonly');
            const store = transaction.objectStore('facturas');
            const request = store.getAll();

            request.onsuccess = () => {
                const active = request.result.filter(r => !r.deleted);
                resolve(active);
            };
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
            factura.fecha = now;
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

            // Soft Delete
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record) {
                    record.deleted = 1;
                    record.ultima_modificacion = this.getTimestamp();
                    const putReq = store.put(record);
                    putReq.onsuccess = () => {
                        if (typeof fileSync !== 'undefined') fileSync.syncTable('facturas');
                        resolve(true);
                    };
                    putReq.onerror = () => reject(putReq.error);
                } else {
                    resolve(true);
                }
            };
            getReq.onerror = () => reject(getReq.error);
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
        const products = await this.getAllProducts(); // Include inventory

        return {
            version: DB_VERSION,
            timestamp: Date.now(),
            data: {
                clientes,
                reparaciones,
                facturas,
                products
            }
        };
    }

    /**
     * Exporta datos en formato UNIVERSAL (Compatible con Android ReparApp)
     * Maps internal fields back to Legacy CamelCase + Structure
     */
    async exportUniversalData() {
        const clientes = await this.getAllClientes();
        const reparaciones = await this.getAllReparaciones();
        const facturas = await this.getAllFacturas();

        // 1. Map Clientes
        const clientesLegacy = clientes.map(c => ({
            id: isNaN(Number(c.id)) ? c.id : Number(c.id), // Try sending Int if possible
            nombre: c.nombre || '',
            apellido: c.apellido || '',
            telefono: c.telefono || '',
            email: c.email || '',
            dni: c.dni || '',
            direccion: c.direccion || '',
            fechaRegistro: c.fecha_creacion || Date.now(),
            // Legacy apps might ignore extra fields, which is fine
        }));

        // 2. Map Reparaciones
        const reparacionesLegacy = reparaciones.map(r => {
            let estadoLegacy = 'PENDIENTE';
            if (['listo', 'completada'].includes(r.estado)) estadoLegacy = 'LISTO';
            else if (['diagnostico', 'reparando', 'en_proceso'].includes(r.estado)) estadoLegacy = 'EN PROCESO';
            else if (r.estado === 'cancelado') estadoLegacy = 'CANCELADO';

            return {
                id: isNaN(Number(r.id)) ? r.id : Number(r.id),
                clienteId: isNaN(Number(r.cliente_id)) ? r.cliente_id : Number(r.cliente_id),
                tipoDispositivo: (r.dispositivo || 'OTROS').toUpperCase(),
                marca: r.marca || '',
                modelo: r.modelo || '',
                descripcionProblema: r.problema || r.descripcion || '',
                descripcionSolucion: r.solucion || '',
                codigoPin: r.pin || '',
                costoEstimado: Number(r.precio || 0),
                costoFinal: Number(r.precio || 0),
                estado: estadoLegacy,
                fechaAdmision: r.fecha_creacion || Date.now(),
                fechaEntrega: r.fecha_creacion || Date.now(), // Fallback
                notas: r.notas || ''
            };
        });

        // 3. Map Facturas
        const facturasLegacy = facturas.map(f => {
            // Convert Lines back to itemsJson String
            const items = (f.lineas || []).map(l => ({
                description: l.concepto,
                quantity: Number(l.cantidad || 1),
                unitPrice: Number(l.precio || 0)
            }));

            return {
                id: isNaN(Number(f.id)) ? f.id : Number(f.id),
                clienteId: isNaN(Number(f.cliente_id)) ? f.cliente_id : Number(f.cliente_id),
                numero: f.numero || '',
                fecha: f.fecha || Date.now(),
                total: Number(f.total || 0),
                notes: f.notas || '',
                itemsJson: JSON.stringify(items), // CRITICAL for Android compatibility
                filePath: f.archivo_url || ''
            };
        });

        return {
            version: 2, // Legacy Version
            timestamp: Date.now(),
            data: {
                clientes: clientesLegacy,
                reparaciones: reparacionesLegacy,
                facturas: facturasLegacy
            }
        };
    }

    /**
     * Importa datos y sobrescribe/actualiza la base de datos
     * @param {Object} backupData - Datos del backup JSON
     */
    /**
     * Importa datos y sobrescribe/actualiza la base de datos
     * @param {Object} backupData - Datos del backup JSON
     */
    async importData(backupData, onProgress) {
        if (!backupData || !backupData.data) {
            throw new Error('Formato de copia de seguridad inválido');
        }

        const data = backupData.data;
        let clientes = [];
        let reparaciones = [];
        let facturas = [];
        let productos = [];

        // 1. Detect Structure Version
        // Robust check: Version 3 OR presence of V3 specific keys
        const isV3 = (backupData.version && backupData.version >= 3) ||
            (data.reparaciones_huerfanas !== undefined) ||
            (data.facturas_huerfanas !== undefined) ||
            (data.inventario !== undefined) ||
            (Array.isArray(data.clientes) && data.clientes.length > 0 && (data.clientes[0].reparaciones || data.clientes[0].facturas));

        if (isV3) {
            // HIERARCHICAL STRUCTURE (v3+)

            // Flatten Clients
            if (Array.isArray(data.clientes)) {
                data.clientes.forEach(c => {
                    // Support legacy _id
                    if (!c.id && c._id) c.id = c._id;

                    // Extract nested arrays
                    if (c.reparaciones && Array.isArray(c.reparaciones)) {
                        c.reparaciones.forEach(r => {
                            // Support legacy _id in repair
                            if (!r.id && r._id) r.id = r._id;
                            // FORCE LINK: Ensure repair belongs to this client
                            if (c.id) r.cliente_id = String(c.id);
                            reparaciones.push(r);
                        });
                    }
                    if (c.facturas && Array.isArray(c.facturas)) {
                        c.facturas.forEach(f => {
                            // Support legacy _id in invoice
                            if (!f.id && f._id) f.id = f._id;
                            // FORCE LINK: Ensure invoice belongs to this client
                            if (c.id) f.cliente_id = String(c.id);
                            facturas.push(f);
                        });
                    }

                    // Clean client object (remove large arrays before save)
                    const clientClean = { ...c };
                    delete clientClean.reparaciones;
                    delete clientClean.facturas;
                    clientes.push(clientClean);
                });
            }

            // Add orphans if present
            if (data.reparaciones_huerfanas && Array.isArray(data.reparaciones_huerfanas)) {
                reparaciones = reparaciones.concat(data.reparaciones_huerfanas);
            }
            if (data.facturas_huerfanas && Array.isArray(data.facturas_huerfanas)) {
                facturas = facturas.concat(data.facturas_huerfanas);
            }

            // Add inventory
            if (data.inventario && Array.isArray(data.inventario)) {
                productos = data.inventario;
            }

        } else {
            // FLAT STRUCTURE (v1/v2)
            clientes = Array.isArray(data.clientes) ? data.clientes : [];
            reparaciones = Array.isArray(data.reparaciones) ? data.reparaciones : [];
            facturas = Array.isArray(data.facturas) ? data.facturas : [];
            productos = Array.isArray(data.products) || Array.isArray(data.inventario) ? (data.products || data.inventario) : [];
        }

        let errors = 0;

        // --- Helper de Mapeo (Legacy Android -> Web) ---
        // --- Helper de Mapeo (Legacy Android -> Web) ---
        const normalizeCliente = (c) => {
            if (c.fechaRegistro) c.fecha_creacion = c.fechaRegistro;

            // Support legacy _id
            if (!c.id && c._id) c.id = c._id;

            // CRITICAL FIX: Do NOT regenerate ID if it exists. 
            // Only generate if absolutely missing.
            if (!c.id) {
                console.warn('Cliente sin ID encontrado, generando uno nuevo:', c.nombre);
                c.id = this.generateUUID();
            }

            // Force String ID
            c.id = String(c.id);
            return c;
        };

        const normalizeReparacion = (r) => {
            // Support legacy _id
            if (!r.id && r._id) r.id = r._id;

            if (r.clienteId) r.cliente_id = r.clienteId;
            if (r.id) r.id = String(r.id);
            if (r.cliente_id) r.cliente_id = String(r.cliente_id);
            if (r.tipoDispositivo) r.dispositivo = r.tipoDispositivo.toLowerCase();
            if (r.fechaAdmision) r.fecha_creacion = r.fechaAdmision;
            if (r.descripcionProblema) r.problema = r.descripcionProblema;
            if (r.descripcionProblema && !r.descripcion) r.descripcion = r.descripcionProblema;
            if (r.descripcionSolucion) r.solucion = r.descripcionSolucion;
            if (r.codigoPin) r.pin = r.codigoPin;
            if (r.costoFinal) r.precio = r.costoFinal;

            if (r.estado) {
                const s = r.estado.toUpperCase();
                if (s === 'LISTO' || s === 'ENTREGADO' || s === 'TERMINADO' || s === 'COMPLETADA') r.estado = 'completada';
                else if (s === 'EN PROCESO' || s === 'REPARANDO' || s === 'EN_PROCESO') r.estado = 'en_proceso';
                else r.estado = 'pendiente';
            }
            return r;
        };

        const normalizeFactura = (f) => {
            if (f.clienteId) f.cliente_id = f.clienteId;
            if (f.id) f.id = String(f.id);
            if (f.cliente_id) f.cliente_id = String(f.cliente_id);

            if (f.itemsJson && typeof f.itemsJson === 'string') {
                try {
                    const safeJson = f.itemsJson.replace(/\n/g, "\\n").replace(/\r/g, "").replace(/\t/g, "\\t");
                    const rawItems = JSON.parse(safeJson);
                    f.lineas = rawItems.map(i => ({
                        concepto: i.description || i.concepto || 'Item',
                        cantidad: i.quantity || i.cantidad || 1,
                        precio: i.unitPrice || i.precio || 0
                    }));
                } catch (e) {
                    f.lineas = [];
                }
            } else if (f.items && Array.isArray(f.items)) {
                f.lineas = f.items.map(i => ({
                    concepto: i.description || i.concepto || 'Item',
                    cantidad: i.cantidad || i.quantity || 1,
                    precio: i.precio || i.unitPrice || 0
                }));
            }
            // Ensure totals
            if (f.total && (!f.subtotal || !f.iva)) {
                const taxRate = window.app_tax_rate || 21;
                f.subtotal = f.total / (1 + taxRate / 100);
                f.iva = f.total - f.subtotal;
            }
            // Notes mapping
            if (f.notes) f.notas = f.notes;

            return f;
        };

        // --- IMPORTACIÓN CON PROGRESO ---
        const totalSteps = clientes.length + reparaciones.length + facturas.length + productos.length;
        let currentStep = 0;

        const report = () => {
            if (onProgress && totalSteps > 0) {
                const pct = Math.min(100, Math.round((currentStep / totalSteps) * 100));
                onProgress(pct, `Restaurando datos (${currentStep}/${totalSteps})...`);
            }
        };

        // Importar clientes
        for (const c of clientes) {
            try {
                await this.saveCliente(normalizeCliente(c));
            } catch (e) { errors++; console.error("Error import client:", c, e); }
            currentStep++;
            if (currentStep % 10 === 0) report();
        }

        // Importar Reparaciones
        for (const r of reparaciones) {
            try {
                await this.saveReparacion(normalizeReparacion(r));
            } catch (e) { errors++; console.error("Error import repair:", r, e); }
            currentStep++;
            if (currentStep % 10 === 0) report();
        }

        // Importar Facturas
        for (const f of facturas) {
            try {
                await this.saveFactura(normalizeFactura(f));
            } catch (e) { errors++; console.error("Error import invoice:", f, e); }
            currentStep++;
            if (currentStep % 10 === 0) report();
        }

        // Importar Inventario
        for (const p of productos) {
            try {
                const prod = { ...p };
                if (!prod.id) prod.id = this.generateUUID();
                await this.saveProduct(prod);
            } catch (e) { errors++; console.error("Error import product:", p, e); }
            currentStep++;
            if (currentStep % 10 === 0) report();
        }

        // Restore Config
        if (backupData.config) {
            for (const [key, value] of Object.entries(backupData.config)) {
                await this.saveConfig(key, value);
            }
        }

        return {
            totalClientes: clientes.length,
            totalReparaciones: reparaciones.length,
            totalFacturas: facturas.length,
            totalProductos: productos.length,
            errors
        };
    }

    /**
     * Elimina TODOS los datos de negocio (Clientes, Reparaciones, Facturas)
     * Mantiene la configuración (Logo, PIN, Datos Empresa)
     */
    async wipeDatabase() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            // Stores to clear
            const allPossibleStores = ['clientes', 'reparaciones', 'facturas', 'products'];
            const storesToClear = allPossibleStores.filter(name => this.db.objectStoreNames.contains(name));

            if (storesToClear.length === 0) {
                resolve();
                return;
            }

            const transaction = this.db.transaction(storesToClear, 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                console.error('Error wiping database:', event.target.error);
                reject(event.target.error);
            };

            storesToClear.forEach(storeName => {
                transaction.objectStore(storeName).clear();
            });
        });
    }

    /**
     * Elimina TODOS los datos de negocio (Clientes, Reparaciones, Facturas)
     * Realiza un SOFT DELETE masivo para que se propague a la nube
     */
    // ==================== PRODUCTOS (INVENTARIO) ====================

    /**
     * Obtiene todos los productos (excluyendo eliminados)
     */
    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result || [];
                // Filtrar soft-deleted
                const active = results.filter(p => !p.deleted);
                resolve(active);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Guarda o actualiza un producto
     */
    async saveProduct(product) {
        if (!product.id) {
            product.id = this.generateUUID();
        }
        product.ultima_modificacion = this.getTimestamp();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');
            const request = store.put(product);

            request.onsuccess = () => resolve(product);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Elimina un producto (Soft Delete)
     */
    async deleteProduct(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const product = getRequest.result;
                if (product) {
                    product.deleted = true;
                    product.ultima_modificacion = this.getTimestamp();
                    const updateRequest = store.put(product);
                    updateRequest.onsuccess = () => resolve(true);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve(false);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // ==================== USUARIOS (GESTIÓN DE PERSONAL) ====================

    /**
     * Obtiene todos los usuarios
     */
    async getAllUsers() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Guarda o actualiza un usuario
     */
    async saveUser(user) {
        if (!user.id) {
            user.id = this.generateUUID();
            user.fecha_creacion = this.getTimestamp();
        }
        user.ultima_modificacion = this.getTimestamp();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(user);

            request.onsuccess = () => resolve(user);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Elimina un usuario
     */
    async deleteUser(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Verifica un PIN y devuelve el usuario si coincide
     * Si no hay usuarios en la base de datos, permite acceso con 1234 (Rescue Mode)
     */
    async verifyPin(pin) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');

            // 1. Intentar buscar por PIN directamente
            const index = store.index('pin');
            const request = index.get(pin);

            request.onsuccess = () => {
                const user = request.result;
                if (user) {
                    resolve(user);
                } else {
                    // 2. Si falló y el PIN es 1234, verificamos si existe ALGÚN admin
                    if (pin === '1234') {
                        const allReq = store.getAll();
                        allReq.onsuccess = () => {
                            const users = allReq.result;
                            const hasAdmin = users.some(u => u.role === 'admin');

                            if (!hasAdmin) {
                                // NO hay admins: Crear Admin de Rescate
                                const defaultUser = {
                                    id: this.generateUUID(),
                                    nombre: 'Jefe (Rescate)',
                                    role: 'admin',
                                    pin: '1234',
                                    fecha_creacion: this.getTimestamp(),
                                    ultima_modificacion: this.getTimestamp()
                                };
                                store.put(defaultUser);
                                resolve(defaultUser);
                            } else {
                                // Ya existe un admin y el PIN 1234 no es correcto
                                resolve(null);
                            }
                        };
                        allReq.onerror = () => reject(allReq.error);
                    } else {
                        resolve(null);
                    }
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== CONFIGURACIÓN ====================

    /**
     * Obtiene una configuración por clave
     */
    async getConfig(key) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Guarda una configuración
     */
    async saveConfig(key, value) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readwrite');
            const store = transaction.objectStore('config');
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Elimina TODOS los datos de negocio (Clientes, Reparaciones, Facturas, Productos)
     * Realiza un SOFT DELETE masivo para que se propague a la nube
     */
    async clearAllData() {
        // 1. Clientes
        const clientes = await this.getAllClientes(); // Esto trae los activos
        // Necesitamos borrarlos uno a uno para activar el soft-delete logic
        for (const c of clientes) {
            await this.deleteCliente(c.id);
        }

        // 2. Reparaciones
        const reparaciones = await this.getAllReparaciones();
        for (const r of reparaciones) {
            await this.deleteReparacion(r.id);
        }

        // 3. Facturas
        const facturas = await this.getAllFacturas();
        for (const f of facturas) {
            await this.deleteFactura(f.id);
        }

        return true;
    }

    /**
     * Genera el siguiente número de factura (Formato FAC-0000000)
     */
    async generateNextInvoiceNumber() {
        const facturas = await this.getAllFacturas();
        let maxNum = 0;

        facturas.forEach(f => {
            if (f.numero && f.numero.startsWith('FAC-')) {
                const parts = f.numero.split('-');
                const lastPart = parts[parts.length - 1];
                const num = parseInt(lastPart, 10);

                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });

        const nextNum = maxNum + 1;
        // The user requested format FAC-0000010 (7 digits)
        return `FAC-${nextNum.toString().padStart(7, '0')}`;
    }

    // ==================== USUARIOS (Staff) ====================

    /**
     * Obtiene todos los usuarios
     */
    async getAllUsers() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== PRODUCTOS (INVENTARIO) ====================

    /**
     * Obtiene todos los productos
     */
    async getAllProducts() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');
            const request = store.getAll();

            request.onsuccess = () => {
                const active = request.result.filter(p => !p.deleted);
                resolve(active);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene un producto por ID
     */
    async getProduct(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== CAJA (TPV) ====================

    /**
     * Registra un movimiento de caja
     */
    async addCajaMovement(movement) {
        if (!this.db) await this.init();

        if (!movement.id) movement.id = this.generateUUID();
        if (!movement.fecha) movement.fecha = Date.now();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['caja'], 'readwrite');
            const store = transaction.objectStore('caja');
            const request = store.put(movement);

            request.onsuccess = () => resolve(movement);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene movimientos de caja
     */
    async getCajaMovements() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['caja'], 'readonly');
            const store = transaction.objectStore('caja');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== HELPERS GENÉRICOS ====================

    async addToStore(storeName, item) {
        if (!this.db) await this.init();
        // Ensure ID
        if (!item.id) item.id = Date.now();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(item);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFromStore(storeName) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFromStore(storeName, id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // --- GESTOR (HACIENDA) CRUD ---
    async addGasto(gasto) { return this.addToStore('gastos', gasto); }
    async getAllGastos() { return this.getAllFromStore('gastos'); }
    async deleteGasto(id) { return this.deleteFromStore('gastos', id); }

    async addIngresoExtra(ingreso) { return this.addToStore('ingresos_extra', ingreso); }
    async getAllIngresosExtra() { return this.getAllFromStore('ingresos_extra'); }
    async deleteIngresoExtra(id) { return this.deleteFromStore('ingresos_extra', id); }

    async getGastosByQuarter(year, quarter) {
        const all = await this.getAllGastos();
        return all.filter(g => g.anio === year && g.trimestre === quarter);
    }

    /**
     * Guarda un usuario (Admin/Empleado)
     */
    async saveUser(user) {
        if (!this.db) await this.init();

        // Validación básica
        if (!user.pin || !user.nombre) throw new Error("Datos incompletos");

        if (!user.id) {
            user.id = this.generateUUID();
            user.fecha_creacion = Date.now();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(user);

            request.onsuccess = () => resolve(user);
            request.onerror = () => {
                // Probablemente error de constraint (PIN duplicado)
                reject(request.error);
            };
        });
    }

    /**
     * Elimina un usuario por ID
     */
    async deleteUser(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Instancia global
const db = new Database();
