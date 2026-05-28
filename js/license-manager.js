class LicenseManager {
    constructor() {
        this.licenseData = null;
        this.isValid = false;
        this.hwid = null;
        this.checkInterval = null;
        this._initialized = false;
    }

    // Compatibility getters for app.js
    get isLicensed() { return this.isValid; }
    get fingerprint() { return this.hwid; }
    get isInTrial() { return false; } // No trial system in Electron build
    get trialRemainingDays() { return 0; }

    async init() {
        // Prevent double initialization
        if (this._initialized) {
            console.log('LicenseManager: Already initialized, skipping.');
            return;
        }
        this._initialized = true;

        try {
            console.log('LicenseManager: Initializing...');

            // Get Hardware ID for display
            if (window.api && window.api.license) {
                this.hwid = await window.api.license.getHwid();
                console.log('LicenseManager: HWID received:', this.hwid);

                const hwidDisplay = document.getElementById('lic-fingerprint');
                if (hwidDisplay) {
                    hwidDisplay.innerText = this.hwid || 'Desconocido';
                    // Remove "GENERANDO..." style if present
                    hwidDisplay.style.color = '#22d3ee';
                }
            } else {
                console.error('LicenseManager: API not available');
                const hwidDisplay = document.getElementById('lic-fingerprint');
                if (hwidDisplay) {
                    hwidDisplay.innerText = 'API ERROR - RESTART APP';
                    hwidDisplay.style.color = 'red';
                }
            }

            // Check License
            await this.checkLicense();

            // Set up interval (every hour)
            this.checkInterval = setInterval(() => this.checkLicense(), 3600000);

            // Bind UI events if on activation screen
            this.bindEvents();

        } catch (error) {
            console.error('License Init Error:', error);
        }
    }

    async checkLicense() {
        if (!window.api || !window.api.license) {
            console.warn('LicenseManager: No API available, skipping license check');
            this.isValid = true; // Don't lock if API isn't available
            return;
        }

        try {
            console.log('LicenseManager: Executing main-process license check...');
            const result = await window.api.license.check();
            console.log('LicenseManager: Check result ->', JSON.stringify(result));

            // Logic: Master License BYPASSES ALL security checks (VM etc)
            const isMaster = result.valid && (result.license.isOwner || result.license.hwid === 'MASTER-BYPASS');

            if (isMaster) {
                console.log('%c LicenseManager: MASTER LICENSE ACTIVE (OWNER BYPASS) ', 'background: #0ea5e9; color: #fff');
                this.isValid = true;
                this.licenseData = result.license;
                this.unlockApp();
                return;
            }

            // --- SECURITY LOCKOUT (VM DETECTION) ---
            // Only apply if NOT Master License
            if (window.securityManager && window.securityManager.isVM) {
                console.error('LicenseManager: Security Lockdown - Environment Not Trusted (VM Detected)');
                const errorMsg = document.getElementById('lic-error');
                if (errorMsg) {
                    errorMsg.innerText = 'ERROR DE SEGURIDAD: Entorno no confiable detectado. Por favor, ejecute la aplicación en hardware real.';
                    errorMsg.style.display = 'block';
                }
                this.isValid = false;
                this.lockApp();
                return;
            }

            // --- REGULAR LICENSE VALIDATION ---
            if (result.valid) {
                this.isValid = true;
                this.licenseData = result.license;
                this.unlockApp();
            } else {
                this.isValid = false;
                this.licenseData = null;
                console.warn('LicenseManager: Validation Failed ->', result.error);

                // Show specific error in UI if it's a mismatch
                const errorMsg = document.getElementById('lic-error');
                if (errorMsg) {
                    if (result.error === 'HWID Mismatch') {
                        errorMsg.innerText = '❌ Esta licencia está vinculada a otro equipo.';
                        errorMsg.style.display = 'block';
                    } else if (result.error === 'License Expired') {
                        errorMsg.innerText = '⚠️ La licencia ha caducado.';
                        errorMsg.style.display = 'block';
                    }
                }

                this.lockApp();
            }
        } catch (e) {
            console.error('LicenseManager: Exception during check:', e);
            // Don't lock on error — might be a temp IPC issue
            this.isValid = true;
        }
    }

    async activate(name, key) {
        if (!window.api) return { success: false, error: 'API no disponible' };

        try {
            const result = await window.api.license.activate(name, key);
            if (result.success) {
                await this.checkLicense();
                return { success: true };
            } else {
                return { success: false, error: result.error || 'Error desconocido' };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    bindEvents() {
        const btnActivate = document.getElementById('btn-activate');

        if (btnActivate) {
            // Remove old listeners to avoid duplicates
            const newBtn = btnActivate.cloneNode(true);
            btnActivate.parentNode.replaceChild(newBtn, btnActivate);

            newBtn.addEventListener('click', async () => {
                const nameInput = document.getElementById('lic-name');
                const keyInput = document.getElementById('lic-key');
                const errorMsg = document.getElementById('lic-error');

                if (!nameInput || !keyInput) return;

                const name = nameInput.value.trim();
                const key = keyInput.value.trim();

                if (!name || !key) {
                    if (errorMsg) {
                        errorMsg.innerText = 'Por favor, rellena todos los campos.';
                        errorMsg.style.display = 'block';
                    }
                    return;
                }

                // Show loading state
                newBtn.disabled = true;
                newBtn.innerText = 'Verificando...';

                const result = await this.activate(name, key);

                if (result.success) {
                    if (errorMsg) errorMsg.style.display = 'none';
                    alert('¡Licencia activada correctamente!');
                    // Reload to apply changes
                    window.location.reload();
                } else {
                    newBtn.disabled = false;
                    newBtn.innerText = 'ACTIVAR AHORA';
                    if (errorMsg) {
                        errorMsg.innerText = result.error || 'Clave incorrecta.';
                        errorMsg.style.display = 'block';
                    }
                }
            });
        }
    }

    lockApp() {
        // Show activation modal
        const lockScreen = document.getElementById('license-overlay');
        if (lockScreen) {
            lockScreen.style.display = 'flex';
        }

        // Hide main app content interaction
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.filter = 'blur(5px)';
            appContainer.style.pointerEvents = 'none';
        }
    }

    unlockApp() {
        const lockScreen = document.getElementById('license-overlay');
        if (lockScreen) {
            lockScreen.style.display = 'none';
        }

        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.filter = 'none';
            appContainer.style.pointerEvents = 'all';
        }
    }
}

// Singleton
window.licenseManager = new LicenseManager();

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.licenseManager.init();
});