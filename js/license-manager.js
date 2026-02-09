/**
 * License Manager
 * Sistema de validación de licencias offline simple (Basado en Hash)
 */

class LicenseManager {
    constructor() {
        // SALT Secreta: DEBES CAMBIAR ESTO ANTES DE VENDER SI QUIERES SEGURIDAD
        this.SECRET_SALT = "REPARAPP_PREMIUM_LICENSE_V1_KEY_GEN_SALT_992834";
        this.STORAGE_KEY = 'app_license_data';
        this.isLicensed = true; // CAMBIADO: Liberado para desarrollo (Volver a false en producción)
        this.licenseData = null;
    }

    async init() {
        try {
            // Cargar licencia guardada localmente
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                // Verificar si es válida (por si copiaron el localStorage de otro PC con otro nombre, 
                // aunque en localstorage es editable, esto evita corrupción accidental)
                const isValid = await this.validateKey(data.companyName, data.licenseKey);
                if (isValid) {
                    this.isLicensed = true;
                    this.licenseData = data;
                    console.log('License Verified:', data.companyName);
                } else {
                    console.warn('Stored license invalid');
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('License init error:', e);
        }
    }

    /**
     * Valida si un par Nombre/Clave es correcto
     */
    async validateKey(companyName, key) {
        if (!companyName || !key) return false;

        const expectedKey = await this.generateKeyForName(companyName);

        // Normalización para comparación (quitar espacios, mayúsculas)
        const cleanInput = key.trim().toUpperCase();
        const cleanExpected = expectedKey.trim().toUpperCase();

        return cleanInput === cleanExpected;
    }

    /**
     * Activa la aplicación
     */
    async activate(companyName, key) {
        if (await this.validateKey(companyName, key)) {
            const data = {
                companyName,
                licenseKey: key,
                activationDate: Date.now()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            this.isLicensed = true;
            this.licenseData = data;

            // También guardar nombre de empresa en DB Config para que se vea en facturas
            if (window.db) {
                await db.setConfig('company_name', companyName);
            }

            return true;
        }
        return false;
    }

    /**
     * Genera la clave esperada para un nombre (Lógica CORE)
     * Usa SHA-256 del nombre + salt
     */
    async generateKeyForName(name) {
        const text = name.trim().toUpperCase() + this.SECRET_SALT;
        const msgBuffer = new TextEncoder().encode(text);

        // Hash SHA-256
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));

        // Convertir a Hex
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

        // Tomar primeros 16 chars y formatear XXXX-XXXX-XXXX-XXXX
        const rawKey = hashHex.substring(0, 16);
        const formatted = rawKey.match(/.{1,4}/g).join('-');

        return formatted;
    }

    /**
     * Debug/Admin: Generar clave (Solo para uso del vendedor)
     */
    async _adminGenerate(name) {
        console.log(`Generating key for "${name}"...`);
        const key = await this.generateKeyForName(name);
        console.log(`KEY: ${key}`);
        return key;
    }

    deactivate() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.isLicensed = false;
        this.licenseData = null;
        location.reload(); // Forzar bloqueo
    }
}

// Global Instance
window.licenseManager = new LicenseManager();
