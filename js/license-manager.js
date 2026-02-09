/**
 * License Manager
 * Sistema de validación de licencias offline simple (Basado en Hash)
 */

class LicenseManager {
    constructor() {
        this.SECRET_SALT = "REPARAPP_PREMIUM_LICENSE_V1_KEY_GEN_SALT_992834";
        this.STORAGE_KEY = 'app_license_data';
        this.TRIAL_KEY = 'app_trial_info';
        this.TRIAL_DAYS = 7;

        this.isLicensed = false;
        this.isInTrial = false;
        this.trialRemainingDays = 0;
        this.licenseData = null;
        this.fingerprint = null;
    }

    async init() {
        try {
            // 1. Generar/Obtener Huella del Dispositivo (Fingerprint)
            this.fingerprint = await this.getDeviceFingerprint();

            // 2. Cargar licencia guardada localmente
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                // Validar clave + huella
                const isValid = await this.validateKey(data.companyName, data.licenseKey);

                if (isValid) {
                    // VERIFICAR EXPIRACIÓN (1 AÑO)
                    const now = Date.now();
                    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
                    const expirationDate = data.activationDate + ONE_YEAR_MS;

                    if (now < expirationDate) {
                        this.isLicensed = true;
                        this.licenseData = data;
                        console.log('✅ Licencia Verificada:', data.companyName);
                        return;
                    } else {
                        console.warn('❌ Licencia EXPIRADA');
                        // No borramos los datos por si quiere renovar, pero quitamos el flag de activo
                        this.isLicensed = false;
                    }
                } else {
                    console.warn('Licencia inválida o de otro dispositivo');
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            }

            // 3. Si no hay licencia, verificar Trial
            await this.checkTrial();

        } catch (e) {
            console.error('License init error:', e);
        }
    }

    /**
     * Gestiona el periodo de prueba de 7 días
     */
    async checkTrial() {
        let trialInfo = localStorage.getItem(this.TRIAL_KEY);
        const now = Date.now();

        if (!trialInfo) {
            // Primer inicio: Registrar fecha
            trialInfo = {
                startDate: now,
                firstFingerprint: this.fingerprint
            };
            localStorage.setItem(this.TRIAL_KEY, JSON.stringify(trialInfo));
        } else {
            trialInfo = JSON.parse(trialInfo);
        }

        const elapsedMs = now - trialInfo.startDate;
        const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

        this.trialRemainingDays = Math.max(0, this.TRIAL_DAYS - elapsedDays);
        this.isInTrial = this.trialRemainingDays > 0;

        if (this.isInTrial) {
            console.log(`⏳ Modo Prueba: Quedan ${this.trialRemainingDays} días.`);
        } else {
            console.warn('❌ Periodo de prueba agotado.');
        }
    }

    /**
     * Genera una huella simple (Basada en CPU y Pantalla)
     * En un entorno real esto sería más complejo, pero sirve para evitar copias directas
     */
    async getDeviceFingerprint() {
        const platform = navigator.platform || 'unknown';
        const logicalProcessors = navigator.hardwareConcurrency || 1;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;

        const raw = `${platform}-${logicalProcessors}-${screenWidth}x${screenHeight}`;

        // Hash SHA-256
        const msgBuffer = new TextEncoder().encode(raw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).slice(0, 8).join('');
    }

    /**
     * Valida si un par Nombre/Clave es correcto
     */
    async validateKey(companyName, key) {
        if (!companyName || !key) return false;

        const expectedKey = await this.generateKeyForName(companyName);

        // Normalización
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
    async generateKeyForName(name, customFingerprint = null) {
        // La clave ahora incluye la Huella del Dispositivo para evitar copias
        const targetFingerprint = customFingerprint || this.fingerprint;
        const text = name.trim().toUpperCase() + targetFingerprint + this.SECRET_SALT;
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
    async _adminGenerate(name, customFingerprint) {
        if (!customFingerprint) {
            console.error("Custom Fingerprint required for Admin generation");
            return "ERROR: FINGERPRINT REQUIRED";
        }
        console.log(`Generating key for "${name}" with CID "${customFingerprint}"...`);
        const key = await this.generateKeyForName(name, customFingerprint);
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
