const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const os = require('os');
const { app } = require('electron');

class LicenseHandler {
    constructor() {
        this.encryptionKey = crypto.scryptSync('REPARAPP_ENC_KEY', 'salt', 32);
        this.licenseFile = null;
        this.hardwareId = null;
        this.cachedLicense = null;
    }

    async init() {
        this.licenseFile = path.join(app.getPath('userData'), 'license.lic');
        this.hardwareId = this.getHardwareId();
    }

    getHardwareId() {
        if (this.hardwareId) return this.hardwareId;

        try {
            // Windows specific: Get Disk Serial + CPU ID (Increased timeout to 10s)
            const diskSerial = execSync('wmic diskdrive get serialnumber', { timeout: 10000 }).toString().replace(/\s+/g, '').replace('SerialNumber', '');
            const cpuId = execSync('wmic cpu get processorid', { timeout: 10000 }).toString().replace(/\s+/g, '').replace('ProcessorId', '');

            const rawId = `${os.hostname()}-${cpuId}-${diskSerial}`;
            return crypto.createHash('sha256').update(rawId).digest('hex').substring(0, 16).toUpperCase();
        } catch (e) {
            console.error('HWID Error:', e);
            // Fallback: uses machine-id logic
            try {
                const fallbackId = crypto.createHash('sha256').update(os.hostname() + os.platform() + os.arch() + os.cpus().length).digest('hex').substring(0, 16).toUpperCase();
                console.log('Using Fallback HWID:', fallbackId);
                return fallbackId;
            } catch (fallbackError) {
                console.error('Fallback HWID Error:', fallbackError);
                return 'UNKNOWN-HWID';
            }
        }
    }

    encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    decrypt(text) {
        try {
            const textParts = text.split(':');
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (e) {
            return null;
        }
    }

    // Unified Activation Logic (Matches Android)
    // In a real scenario, this would simple make a fetch() call to Supabase RPC
    // Unified Activation Logic (Matches Android)
    async activate(name, key) {
        try {
            const cleanKey = String(key || '').trim().toUpperCase();
            console.log('LicenseHandler: Activation attempt for:', name, 'Key:', cleanKey);

            // --- MASTER KEY CHECK (Owner Offline Bypass) ---
            const masterHash = 'b77cf4c8100c7f3d46aa9317f729104bd962b8d019d366fa2d3667b4e9a4ae97';
            const inputHash = crypto.createHash('sha256').update(cleanKey).digest('hex');

            console.log('LicenseHandler: Master Key Debug -> InputHash:', inputHash);

            if (inputHash === masterHash) {
                console.log('LicenseHandler: MASTER KEY MATCHED! Generating offline license...');
                const ownerLicense = {
                    companyName: name || 'PROPIETARIO',
                    licenseKey: cleanKey,
                    activationDate: Date.now(),
                    expirationDate: Date.now() + (100 * 365 * 24 * 60 * 60 * 1000), // 100 years
                    hwid: 'MASTER-BYPASS',
                    isOwner: true
                };
                fs.writeFileSync(this.licenseFile, this.encrypt(JSON.stringify(ownerLicense)));
                this.cachedLicense = ownerLicense;
                return { success: true, message: 'Licencia Maestra Vitalicia Activada (Propietario)' };
            }

            console.log('LicenseHandler: No Master Key match. Proceeding to Online validation...');

            // --- REGULAR ACTIVATION ---
            const SUPABASE_URL = process.env.SUPABASE_URL || "https://yihgvgsajrncsamkwjlq.supabase.co";
            const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA";

            const body = JSON.stringify({
                p_key: cleanKey,
                p_hwid: this.getHardwareId()
            });

            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/activate_license`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                },
                body: body
            });

            const data = await response.json();
            console.log('LicenseHandler: Server Response ->', JSON.stringify(data));

            if (!response.ok) {
                return { success: false, error: data.message || 'Error en el servidor' };
            }

            if (data.success) {
                console.log('LicenseHandler: Online Activation SUCCESS');
                const licenseData = {
                    companyName: name,
                    licenseKey: cleanKey,
                    activationDate: Date.now(),
                    expirationDate: new Date(data.expiration_date).getTime(),
                    hwid: this.getHardwareId()
                };

                try {
                    fs.writeFileSync(this.licenseFile, this.encrypt(JSON.stringify(licenseData)));
                    this.cachedLicense = licenseData;
                    return { success: true, message: data.message };
                } catch (err) {
                    console.error('LicenseHandler: Write error:', err);
                    return { success: false, error: 'Error al guardar la licencia: ' + err.message };
                }
            } else {
                console.warn('LicenseHandler: Online Activation DENIED:', data.message);
                return { success: false, error: data.message || 'Licencia rechazada' };
            }
        } catch (e) {
            console.error('LicenseHandler: Activation Exception:', e);
            return { success: false, error: 'Error de activación: ' + e.message };
        }
    }

    getLicense() {
        try {
            if (!this.cachedLicense) {
                if (!fs.existsSync(this.licenseFile)) return { valid: false, error: 'No Found' };

                const encrypted = fs.readFileSync(this.licenseFile, 'utf8');
                const decrypted = this.decrypt(encrypted);
                if (!decrypted) return { valid: false, error: 'Corrupted' };

                this.cachedLicense = JSON.parse(decrypted);
            }

            // Check HWID binding (Skip for Master License)
            if (this.cachedLicense.hwid !== 'MASTER-BYPASS' && this.cachedLicense.hwid !== this.getHardwareId()) {
                console.warn('License HWID Mismatch:', this.cachedLicense.hwid, 'vs', this.getHardwareId());
                return { valid: false, error: 'HWID Mismatch' };
            }

            // Check expiration
            if (this.cachedLicense.expirationDate && this.cachedLicense.expirationDate < Date.now()) {
                this.cachedLicense = null;
                return { valid: false, error: 'License Expired' };
            }

            return { valid: true, license: this.cachedLicense };
        } catch (e) {
            return { valid: false, error: e.message };
        }
    }

    deactivate() {
        if (fs.existsSync(this.licenseFile)) {
            fs.unlinkSync(this.licenseFile);
        }
        this.cachedLicense = null;
        return { success: true };
    }

    /**
     * Periodic server revalidation (mirrors Android LicenseWorker)
     * Calls validate_license RPC to ensure license hasn't been revoked.
     */
    async revalidateOnline() {
        if (!this.cachedLicense || !this.cachedLicense.licenseKey) {
            return; // No license to validate
        }

        try {
            const SUPABASE_URL = process.env.SUPABASE_URL || "https://yihgvgsajrncsamkwjlq.supabase.co";
            const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA";

            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_license`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                },
                body: JSON.stringify({
                    p_key: this.cachedLicense.licenseKey,
                    p_hwid: this.getHardwareId()
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // License still valid — update expiration if server provides it
                if (data.expiration_date) {
                    this.cachedLicense.expirationDate = new Date(data.expiration_date).getTime();
                    fs.writeFileSync(this.licenseFile, this.encrypt(JSON.stringify(this.cachedLicense)));
                }
                console.log('License revalidation: OK');
            } else if (response.ok && !data.success) {
                // Server explicitly rejected — revoke locally
                console.warn('License REVOKED by server:', data.message);
                this.deactivate();
            }
            // Network errors: don't revoke (same as Android LicenseWorker)
        } catch (e) {
            console.warn('License revalidation network error (keeping local):', e.message);
        }
    }
}

module.exports = new LicenseHandler();