/**
 * FileSyncService
 * Gestiona la sincronización de datos con una carpeta local del PC
 * utilizando la File System Access API.
 */
class FileSyncService {
    constructor() {
        this.dirHandle = null;
        this.isLinked = false;
        this.folderName = '';
    }

    /**
     * Inicializa el servicio cargando el handle guardado
     */
    async init() {
        try {
            // El handle se guarda en IndexedDB ya que localStorage no soporta objetos complejos
            // Pero por simplicidad inicial, intentaremos recuperarlo de una tabla de config
            if (typeof db === 'undefined') return;

            const handle = await db.getConfig('local_folder_handle');
            if (handle) {
                this.dirHandle = handle;
                this.folderName = handle.name;
                // Verificar si tenemos permiso (el navegador lo quita al recargar)
                this.isLinked = await this.verifyPermission(handle);
            }
        } catch (error) {
            console.error('Error initializing FileSyncService:', error);
        }
    }

    /**
     * Pide al usuario que elija una carpeta
     */
    async linkFolder() {
        try {
            if (!window.showDirectoryPicker) {
                throw new Error('Tu navegador no soporta el acceso a carpetas locales. Usa Chrome o Edge.');
            }

            const handle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });

            this.dirHandle = handle;
            this.folderName = handle.name;
            this.isLinked = true;

            // Guardar handle en la DB
            await db.setConfig('local_folder_handle', handle);

            // Sincronizar inmediatamente
            await this.syncAll();

            return { success: true, folderName: this.folderName };
        } catch (error) {
            console.error('Error linking folder:', error);
            if (error.name === 'AbortError') return { success: false, aborted: true };
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica si tenemos permisos de escritura
     */
    async verifyPermission(handle, withPrompt = false) {
        const options = { mode: 'readwrite' };
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if (withPrompt && (await handle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    /**
     * Escribe un archivo JSON en la carpeta vinculada
     */
    async writeFile(fileName, data) {
        if (!this.dirHandle || !this.isLinked) return;

        try {
            // Verificar permisos antes de escribir
            if (!await this.verifyPermission(this.dirHandle)) {
                this.isLinked = false;
                return;
            }

            const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
        } catch (error) {
            console.error(`Error writing file ${fileName}:`, error);
        }
    }

    /**
     * Sincroniza todas las tablas
     */
    async syncAll() {
        if (!this.dirHandle || !this.isLinked) return;

        try {
            const clientes = await db.getAllClientes();
            const reparaciones = await db.getAllReparaciones();
            const facturas = await db.getAllFacturas();

            // Crear subcarpeta 'data' si es posible, o guardar en raíz
            // Por simplicidad en raíz con prefijo:
            await this.writeFile('clientes.json', clientes);
            await this.writeFile('reparaciones.json', reparaciones);
            await this.writeFile('facturas.json', facturas);

            // También guardar config básica
            const config = {
                company_name: await db.getConfig('company_name'),
                company_dni: await db.getConfig('company_dni'),
                last_sync: new Date().toISOString()
            };
            await this.writeFile('config.json', config);

        } catch (error) {
            console.error('Error in syncAll:', error);
        }
    }

    /**
     * Sincroniza una tabla específica (llamado por hooks de DB)
     */
    async syncTable(tableName) {
        if (!this.dirHandle || !this.isLinked) return;

        let data;
        switch (tableName) {
            case 'clientes':
                data = await db.getAllClientes();
                await this.writeFile('clientes.json', data);
                break;
            case 'reparaciones':
                data = await db.getAllReparaciones();
                await this.writeFile('reparaciones.json', data);
                break;
            case 'facturas':
                data = await db.getAllFacturas();
                await this.writeFile('facturas.json', data);
                break;
        }
    }

    /**
     * Lee un archivo JSON de la carpeta vinculada
     * @param {string} fileName - Nombre del archivo a leer
     * @returns {Array|Object|null} - Datos parseados o null si no existe
     */
    async readFile(fileName) {
        if (!this.dirHandle || !this.isLinked) return null;

        try {
            const fileHandle = await this.dirHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const content = await file.text();
            return JSON.parse(content);
        } catch (error) {
            if (error.name === 'NotFoundError') {
                return null;
            }
            console.error(`Error leyendo ${fileName}:`, error);
            return null;
        }
    }

    /**
     * Carga todos los datos desde los archivos JSON de la carpeta vinculada
     * Se usa para recuperar datos cuando IndexedDB está vacía
     * @returns {Object} - Resultado de la operación con contadores
     */
    async loadFromFiles() {
        if (!this.dirHandle || !this.isLinked) {
            return { success: false, reason: 'no_folder' };
        }

        try {
            let imported = { clientes: 0, reparaciones: 0, facturas: 0 };

            // Cargar clientes
            const clientes = await this.readFile('clientes.json');
            if (clientes && Array.isArray(clientes)) {
                for (const c of clientes) {
                    // Usar put directo para no disparar sync de vuelta
                    await new Promise((resolve, reject) => {
                        const tx = db.db.transaction(['clientes'], 'readwrite');
                        const store = tx.objectStore('clientes');
                        const req = store.put(c);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                    });
                    imported.clientes++;
                }
            }

            // Cargar reparaciones
            const reparaciones = await this.readFile('reparaciones.json');
            if (reparaciones && Array.isArray(reparaciones)) {
                for (const r of reparaciones) {
                    await new Promise((resolve, reject) => {
                        const tx = db.db.transaction(['reparaciones'], 'readwrite');
                        const store = tx.objectStore('reparaciones');
                        const req = store.put(r);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                    });
                    imported.reparaciones++;
                }
            }

            // Cargar facturas
            const facturas = await this.readFile('facturas.json');
            if (facturas && Array.isArray(facturas)) {
                for (const f of facturas) {
                    await new Promise((resolve, reject) => {
                        const tx = db.db.transaction(['facturas'], 'readwrite');
                        const store = tx.objectStore('facturas');
                        const req = store.put(f);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                    });
                    imported.facturas++;
                }
            }

            return { success: true, imported };

        } catch (error) {
            console.error('Error cargando desde archivos:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Solicita permisos de acceso a la carpeta con feedback al usuario
     * @returns {boolean} - true si se obtuvo permiso
     */
    async requestPermissionWithUI() {
        if (!this.dirHandle) return false;

        try {
            const hasPermission = await this.verifyPermission(this.dirHandle, true);
            if (hasPermission) {
                this.isLinked = true;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error solicitando permisos:', error);
            return false;
        }
    }

    /**
     * Verifica si hay datos en los archivos JSON de respaldo
     * @returns {boolean}
     */
    async hasBackupData() {
        if (!this.dirHandle) return false;

        try {
            // Verificar permisos primero (sin solicitar)
            if (!await this.verifyPermission(this.dirHandle, false)) {
                return false;
            }

            // Verificar si existe al menos el archivo de clientes
            const clientes = await this.readFile('clientes.json');
            return clientes && Array.isArray(clientes) && clientes.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Indica si hay una carpeta configurada pero sin permisos
     * (requiere que el usuario reconecte)
     */
    get needsReconnect() {
        return this.dirHandle !== null && !this.isLinked;
    }
}

// Instancia global
const fileSync = new FileSyncService();
