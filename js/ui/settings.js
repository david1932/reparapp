/**
 * Settings UI Module
 * Gestión de ajustes, logo y copias de seguridad
 */

class SettingsUI {
    constructor() {
        this.pin = null;
    }

    /**
     * Guarda datos de empresa y configuración fiscal
     */
    async saveCompanyData() {
        const companyName = document.getElementById('company-name').value;
        const companyDni = document.getElementById('company-dni').value;
        const companyAddress = document.getElementById('company-address').value;
        const companyPhone = document.getElementById('company-phone').value;
        const companyEmail = document.getElementById('company-email').value;
        const trackingUrl = document.getElementById('company-tracking-url').value;

        // Tax values
        const taxIva = document.getElementById('company-tax-iva').value;
        const taxIrpf = document.getElementById('company-tax-irpf').value;

        // Accounting Mode & International config
        const accountingMode = document.getElementById('company-accounting-mode').value;
        const intlTaxLabel = document.getElementById('intl-tax-label').value;
        const intlTaxRates = document.getElementById('intl-tax-rates').value;
        const intlRetLabel = document.getElementById('intl-ret-label').value;
        const intlRetRates = document.getElementById('intl-ret-rates').value;

        try {
            await db.saveConfig('company_name', companyName);
            await db.saveConfig('company_dni', companyDni);
            await db.saveConfig('company_address', companyAddress);
            await db.saveConfig('company_phone', companyPhone);

            await db.saveConfig('company_email', companyEmail);
            await db.saveConfig('tracking_url', trackingUrl);

            // Save Tax Config
            const taxEntity = document.getElementById('company-tax-entity').value;
            await db.saveConfig('tax_iva', taxIva);
            await db.saveConfig('tax_irpf', taxIrpf);
            await db.saveConfig('tax_entity', taxEntity);

            // Save Accounting Mode & Intl
            await db.saveConfig('accounting_mode', accountingMode);
            await db.saveConfig('intl_tax_label', intlTaxLabel);
            await db.saveConfig('intl_tax_rates', intlTaxRates);
            await db.saveConfig('intl_ret_label', intlRetLabel);
            await db.saveConfig('intl_ret_rates', intlRetRates);

            // Save Currency
            const currency = document.getElementById('company-currency').value;
            await db.saveConfig('app_currency', currency);
            window.app_currency = currency;

            app.showToast(i18n.t('toast_saved'), 'success');

            // Refresh UIs that use currency
            if (window.managerUI) window.managerUI.renderDashboard();
            if (window.repairsUI) window.repairsUI.render();
            if (window.invoicesUI) window.invoicesUI.render();
            if (window.inventoryUI) window.inventoryUI.render();
            app.renderDashboard(); // Main dashboard
        } catch (e) {
            console.error(e);
            app.showToast(i18n.t('toast_error'), 'error');
        }
    }

    /**
     * Ajusta los valores por defecto según la entidad
     */
    handleEntityChange(type) {
        const elIrpf = document.getElementById('company-tax-irpf');
        const elLabel = document.getElementById('label-tax-irpf');

        if (type === 'sociedad') {
            if (elLabel) elLabel.textContent = i18n.t('set_tax_irpf_label_sociedad');
            if (elIrpf && elIrpf.value == '0') elIrpf.value = '25'; // Default IS
        } else {
            if (elLabel) elLabel.textContent = i18n.t('set_tax_irpf_label_autonomo');
            if (elIrpf && elIrpf.value == '25') elIrpf.value = '0'; // Reset if it was IS default (usually 0 for retention on invoices, calculation is internal)
        }
    }

    /**
     * Maneja el cambio de modo de contabilidad
     */
    handleAccountingModeChange(mode) {
        // Update hidden input
        const input = document.getElementById('company-accounting-mode');
        if (input) input.value = mode;

        // Update active class on buttons
        document.getElementById('btn-mode-spain')?.classList.toggle('active', mode === 'spain');
        document.getElementById('btn-mode-intl')?.classList.toggle('active', mode === 'international');

        // Toggle configurations
        const spainConfig = document.getElementById('spain-tax-config');
        const intlConfig = document.getElementById('intl-tax-config');

        if (spainConfig) spainConfig.style.display = mode === 'spain' ? 'block' : 'none';
        if (intlConfig) intlConfig.style.display = mode === 'international' ? 'block' : 'none';
    }

    /**
     * Inicializa el módulo
     */
    async init() {
        // Cargar configuración inicial
        await this.loadSettings();
        await this.loadTemplates(); // Cargar plantillas

        // Inicializar selector de idioma
        const langSelector = document.getElementById('app-language-selector');
        if (langSelector && window.i18n) {
            langSelector.value = i18n.currentLocale;
            langSelector.addEventListener('change', (e) => i18n.setLocale(e.target.value));
        }

        // Listeners Logo
        document.getElementById('logo-input')?.addEventListener('change', (e) => this.handleLogoUpload(e));
        document.getElementById('btn-delete-logo')?.addEventListener('click', () => this.deleteLogo());

        // Listeners Backup
        document.getElementById('btn-export-backup')?.addEventListener('click', () => this.handleExportBackup());
        document.getElementById('btn-export-advanced')?.addEventListener('click', () => this.handleExportAdvanced());
        document.getElementById('backup-input-json')?.addEventListener('change', (e) => this.handleImportBackup(e, 'json'));
        document.getElementById('backup-input-zip')?.addEventListener('change', (e) => this.handleImportBackup(e, 'zip'));
        document.getElementById('btn-deduplicate')?.addEventListener('click', () => this.handleDeduplication());
        const btnAutoBackup = document.getElementById('btn-setup-autobackup');
        if (btnAutoBackup) {
            btnAutoBackup.addEventListener('click', () => {
                this.handleSetupAutoBackup();
            });
        } else {
            console.error('CRITICAL: Auto-backup button NOT found in DOM.');
        }

        // Listeners Seguridad
        document.getElementById('btn-save-pin')?.addEventListener('click', () => this.savePin());
        // btn-clear-data tiene onclick inline para mayor seguridad/simpleza



        // Listener Logout Global (Sidebar) - MOVED TO APP.JS

        // Check local sync status AND auto-backup status
        this.updateLocalSyncStatus();
        this.updateAutoBackupStatus();

        // Attempt Auto-Backup on startup (if configured)
        setTimeout(() => this.performAutoBackup(true), 5000); // Wait 5s to not block init

        // Listeners Datos Empresa (evitar recarga formulario)
        document.getElementById('form-company-data')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCompanyData();
        });

        // Listeners Supabase Cloud (YA NO NECESARIOS, usan onclick global manualSupabaseSave)
        // Se mantienen comentados por si acaso
        // document.getElementById('btn-save-supabase')?.addEventListener('click', () => this.saveSupabaseConfig());

        // Listeners Plantillas WhatsApp
        document.getElementById('form-templates')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTemplates();
        });
        document.getElementById('btn-reset-templates')?.addEventListener('click', () => this.handleResetTemplates());

        // Listeners Staff Management
        // Listeners Staff Management (Via Inline HTML onclick for reliability)
        // document.getElementById('btn-add-staff')?.addEventListener('click', () => this.handleAddStaff());

        // Listener Bloqueo App
        document.getElementById('check-app-lock')?.addEventListener('change', (e) => this.toggleAppLock(e.target.checked));

        // Lock Screen Input (Enter key)
        document.getElementById('lock-pin')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.unlockApp();
        });

        // Cargar lista de personal
        await this.renderStaffList();

        // Verificar bloqueo al inicio
        this.checkLock();

        // Listener Diagnóstico (Emergency)
        document.getElementById('btn-diagnose-data')?.addEventListener('click', () => this.handleDiagnoseData());

        // Listeners Import/Export
        document.getElementById('btn-export-backup')?.addEventListener('click', () => this.handleExportBackup());
        document.getElementById('btn-export-universal')?.addEventListener('click', () => this.handleExportUniversal());

        document.getElementById('backup-input-json')?.addEventListener('change', (e) => this.handleImportBackup(e));
    }

    /**
     * Cambia entre pestañas de ajustes
     * @param {string} tabId ID del contenedor de la pestaña
     */
    switchTab(tabId) {
        // 1. Quitar 'active' de todos los botones y contenidos
        document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.settings-tab-content').forEach(content => content.classList.remove('active'));

        // 2. Activar el botón clickado (usando el atributo data-tab)
        const activeBtn = document.querySelector(`.settings-tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // 3. Mostrar el contenido
        const activeContent = document.getElementById(tabId);
        if (activeContent) activeContent.classList.add('active');

        // Force refresh specific tabs
        if (tabId === 'tab-security') {
            this.renderStaffList();
        }

        if (tabId === 'tab-help') {
            if (window.helpUI) window.helpUI.init();
        }
    }

    /**
     * Carga configuración guardada
     */
    async loadSettings() {
        // Cargar PIN
        const pinConfig = await db.getConfig('security_pin');
        if (pinConfig) {
            this.pin = pinConfig;
            // No mostramos el PIN en el input por seguridad, solo placeholder
            document.getElementById('settings-pin').placeholder = '****';
        }

        // Cargar Logo
        const logoConfig = await db.getConfig('app_logo');
        if (logoConfig) {
            this.showLogo(logoConfig);
        }

        // Cargar Datos Empresa
        const companyName = await db.getConfig('company_name');
        const companyDni = await db.getConfig('company_dni');
        const companyAddress = await db.getConfig('company_address');
        const companyPhone = await db.getConfig('company_phone');
        const companyEmail = await db.getConfig('company_email');

        const elName = document.getElementById('company-name');
        const elDni = document.getElementById('company-dni');
        const elAddress = document.getElementById('company-address');
        const elPhone = document.getElementById('company-phone');
        const elEmail = document.getElementById('company-email');

        if (elName) elName.value = companyName || '';
        if (elDni) elDni.value = companyDni || '';
        if (elAddress) elAddress.value = companyAddress || '';
        if (elPhone) elPhone.value = companyPhone || '';
        if (elEmail) elEmail.value = companyEmail || '';

        // Cargar Impuestos
        const taxIva = await db.getConfig('tax_iva');
        const taxIrpf = await db.getConfig('tax_irpf');
        const taxEntity = await db.getConfig('tax_entity'); // New: Entity Type

        // Accounting Mode & Intl
        const accountingMode = await db.getConfig('accounting_mode') || 'spain';
        const intlTaxLabel = await db.getConfig('intl_tax_label') || 'IVA';
        const intlTaxRates = await db.getConfig('intl_tax_rates') || '21, 10, 4, 0';
        const intlRetLabel = await db.getConfig('intl_ret_label') || 'IRPF';
        const intlRetRates = await db.getConfig('intl_ret_rates') || '15, 7, 0';

        if (document.getElementById('company-tax-iva')) document.getElementById('company-tax-iva').value = taxIva || '21';
        if (document.getElementById('company-tax-irpf')) document.getElementById('company-tax-irpf').value = taxIrpf || '0';
        if (document.getElementById('company-tax-entity')) {
            const elEntity = document.getElementById('company-tax-entity');
            elEntity.value = taxEntity || 'autonomo';
            this.handleEntityChange(elEntity.value);
            // Re-add listener for changes
            elEntity.onchange = (e) => this.handleEntityChange(e.target.value);
        }

        // Apply Accounting Mode UI
        this.handleAccountingModeChange(accountingMode);

        // Load Intl values into fields
        const elIntlTaxLabel = document.getElementById('intl-tax-label');
        const elIntlTaxRates = document.getElementById('intl-tax-rates');
        const elIntlRetLabel = document.getElementById('intl-ret-label');
        const elIntlRetRates = document.getElementById('intl-ret-rates');

        if (elIntlTaxLabel) elIntlTaxLabel.value = intlTaxLabel;
        if (elIntlTaxRates) elIntlTaxRates.value = intlTaxRates;
        if (elIntlRetLabel) elIntlRetLabel.value = intlRetLabel;
        if (elIntlRetRates) elIntlRetRates.value = intlRetRates;

        // Cargar Moneda
        const appCurrency = await db.getConfig('app_currency');
        const elCurrency = document.getElementById('company-currency');
        if (elCurrency) {
            elCurrency.value = appCurrency || 'EUR';
            window.app_currency = elCurrency.value;
        }



        // Cargar Config Supabase
        if (window.supabaseClient && window.supabaseClient.isConfigured) {
            document.getElementById('supabase-url').value = window.supabaseClient.url || '';
            document.getElementById('supabase-key').value = window.supabaseClient.anonKey || ''; // Mostrar key (puedes ocultarla si prefieres)
        }

        if (companyName) document.getElementById('company-name').value = companyName;
        if (companyDni) document.getElementById('company-dni').value = companyDni;
        if (companyAddress) document.getElementById('company-address').value = companyAddress;
        if (companyPhone) document.getElementById('company-phone').value = companyPhone;
        if (companyPhone) document.getElementById('company-phone').value = companyPhone;
        if (companyEmail) document.getElementById('company-email').value = companyEmail;

        // Cargar Tracking URL
        const trackingUrl = await db.getConfig('tracking_url');
        if (document.getElementById('company-tracking-url')) {
            document.getElementById('company-tracking-url').value = trackingUrl || '';
        }

        // Cargar estado Bloqueo App
        const appLockEnabled = localStorage.getItem('app_locked_enabled') === 'true';
        const lockCheck = document.getElementById('check-app-lock');
        if (lockCheck) lockCheck.checked = appLockEnabled;

        // Cargar Google Client ID
        const googleId = await db.getConfig('google_client_id');
        const elGoogleId = document.getElementById('drive-client-id');
        if (elGoogleId) elGoogleId.value = googleId || '';
    }



    /**
     * Comprueba si la app debe bloquearse
     */
    async checkLock() {
        // Solo bloquear si no estamos ya desbloqueados en esta sesión
        if (sessionStorage.getItem('app_unlocked') === 'true') {
            return;
        }

        // Solo bloquear si hay una sesión activa
        const hasSession = localStorage.getItem('user_role') || localStorage.getItem('employee_session');
        const isEnabled = localStorage.getItem('app_locked_enabled') === 'true';
        if (hasSession && isEnabled) {
            this.lockApp();
        }
    }

    /**
     * Alterna el bloqueo de la aplicación
     */
    async toggleAppLock(enabled) {
        localStorage.setItem('app_locked_enabled', enabled);
        app.showToast(enabled ? 'Bloqueo de app activado' : 'Bloqueo de app desactivado', 'info');
    }

    /**
     * Bloquea la aplicación
     */
    lockApp() {
        const lockScreen = document.getElementById('lock-screen');
        const lockInput = document.getElementById('lock-pin');

        lockScreen.style.display = 'flex';
        lockInput.value = '';
        lockInput.focus();
    }

    /**
     * Desbloquea la aplicación
     */
    async unlockApp() {
        const input = document.getElementById('lock-pin');
        const error = document.getElementById('lock-error');

        try {
            const user = await db.verifyPin(input.value);
            if (user) {
                document.getElementById('lock-screen').style.display = 'none';
                sessionStorage.setItem('app_unlocked', 'true');
                error.style.display = 'none';
                input.value = '';
                app.showToast(`Hola de nuevo, ${user.nombre}`, 'success');
            } else {
                error.style.display = 'block';
                input.value = '';
                input.focus();

                // Animación de error
                input.style.borderColor = 'var(--status-pending)';
                setTimeout(() => input.style.borderColor = 'var(--border-color)', 500);
            }
        } catch (err) {
            console.error('Error unlocking app:', err);
            app.showToast('Error al verificar PIN', 'error');
        }
    }

    /**
     * Conectar con Google Drive
     */
    handleConnectDrive() {
        if (!window.googleDriveManager) return;

        window.googleDriveManager.authenticate((token) => {
            app.showToast('Conectado a Google Drive correctamente', 'success');

            // Actualizar UI
            const btnConnect = document.getElementById('btn-connect-drive');
            const btnBackup = document.getElementById('btn-backup-drive');
            const statusText = document.querySelector('#drive-status-text') || document.createElement('span');

            if (btnConnect) btnConnect.style.display = 'none';
            if (btnBackup) btnBackup.disabled = false;

            // Opcional: Mostrar info de usuario, guardar token temporalmente, etc.
        });
    }

    /**
     * Subir Backup a Drive
     */
    async handleDriveBackup() {

        if (!window.googleDriveManager || !window.googleDriveManager.accessToken) {
            app.showInfoModal({ type: 'warning', title: i18n.t('set_drive_no_token_title', 'Drive no Conectado'), message: i18n.t('set_drive_no_token') });
            return;
        }

        try {
            app.showToast(i18n.t('toast_generating_backup', 'Generando copia...'), 'info');
            const data = await this.generateBackupData();

            const jsonString = JSON.stringify(data, null, 2);
            const fileName = `reparapp_backup_${new Date().toISOString().slice(0, 10)}.json`;

            app.showToast(i18n.t('toast_uploading_drive', 'Subiendo a Google Drive...'), 'info');
            await window.googleDriveManager.uploadFile(jsonString, fileName);

            app.showInfoModal({ type: 'success', title: i18n.t('set_backup_success_title'), message: i18n.t('set_backup_success_msg') });
            app.showToast(i18n.t('set_backup_success_msg'), 'success');

        } catch (error) {
            console.error('Error Drive Backup:', error);
            app.showInfoModal({
                type: 'error',
                title: i18n.t('set_drive_sync_error'),
                message: i18n.t('set_drive_sync_error_causes').replace('{error}', error.message)
            });
            app.showToast(i18n.t('toast_error') + ': ' + error.message, 'error');
        }
    }

    /**
     * Restaura una copia desde Drive
     */
    async handleDriveRestore() {
        if (!window.googleDriveManager || !window.googleDriveManager.accessToken) {
            app.showInfoModal({ type: 'warning', title: i18n.t('set_drive_no_token_title', 'Drive no Conectado'), message: i18n.t('set_drive_no_token') });
            return;
        }

        try {
            app.showToast(i18n.t('set_drive_finding_backups'), 'info');
            const files = await window.googleDriveManager.listBackups();

            if (!files || files.length === 0) {
                app.showInfoModal({ type: 'info', title: i18n.t('set_drive_no_backups_title', 'Sin Copias'), message: i18n.t('set_drive_no_backups') });
                return;
            }

            // Simple selection for now: Most recent one
            const latest = files[0];
            const confirmMsg = i18n.t('set_drive_restore_confirm')
                .replace('{name}', latest.name)
                .replace('{date}', latest.createdTime);

            app.showConfirm(i18n.t('set_drive_restore_title'), confirmMsg, async () => {
                try {
                    app.showToast(i18n.t('set_drive_downloading'), 'info');
                    const fileContent = await window.googleDriveManager.downloadFile(latest.id);

                    // Parse JSON
                    let data;
                    if (typeof fileContent === 'string') {
                        data = JSON.parse(fileContent);
                    } else {
                        data = fileContent;
                    }

                    app.showToast(i18n.t('set_drive_restoring'), 'info');
                    await this.importData(data); // Reutilize importData
                } catch (err) {
                    console.error('Error in selection restore:', err);
                    app.showInfoModal({ type: 'error', title: i18n.t('set_drive_restore_error_title', 'Error de Restauración'), message: i18n.t('set_drive_restore_error') + err.message });
                }
            });
            return;

        } catch (error) {
            console.error('Error Drive Restore:', error);
            app.showInfoModal({ type: 'error', title: i18n.t('set_drive_restore_full_error_title', 'Error al Restaurar'), message: i18n.t('set_drive_restore_full_error') + error.message });
            app.showToast(i18n.t('toast_error') + ': ' + error.message, 'error');
        }
    }

    /* GESTIÓN DE PLANTILLAS WHATSAPP */

    /**
     * Carga las plantillas guardadas o establece las por defecto
     */
    async loadTemplates() {
        try {
            const defaults = this.getDefaultTemplates();

            const tplPendiente = await db.getConfig('tpl_pendiente') || defaults.pendiente;
            const tplPresupuesto = await db.getConfig('tpl_presupuesto') || defaults.presupuesto;
            const tplReparado = await db.getConfig('tpl_reparado') || defaults.reparado;
            const tplEntregado = await db.getConfig('tpl_entregado') || defaults.entregado;

            const elPendiente = document.getElementById('tpl-pendiente');
            const elPresupuesto = document.getElementById('tpl-presupuesto');
            const elReparado = document.getElementById('tpl-reparado');
            const elEntregado = document.getElementById('tpl-entregado');

            if (elPendiente) elPendiente.value = tplPendiente;
            if (elPresupuesto) elPresupuesto.value = tplPresupuesto;
            if (elReparado) elReparado.value = tplReparado;
            if (elEntregado) elEntregado.value = tplEntregado;

        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    /**
     * Guarda las plantillas
     */
    async saveTemplates() {
        try {
            const tplPendiente = document.getElementById('tpl-pendiente').value.trim();
            const tplPresupuesto = document.getElementById('tpl-presupuesto').value.trim();
            const tplReparado = document.getElementById('tpl-reparado').value.trim();
            const tplEntregado = document.getElementById('tpl-entregado').value.trim();

            await db.setConfig('tpl_pendiente', tplPendiente);
            await db.setConfig('tpl_presupuesto', tplPresupuesto);
            await db.setConfig('tpl_reparado', tplReparado);
            await db.setConfig('tpl_entregado', tplEntregado);

            app.showToast(i18n.t('tpl_save_success'), 'success');
        } catch (error) {
            console.error('Error saving templates:', error);
            app.showToast(i18n.t('tpl_save_error'), 'error');
        }
    }

    /**
     * Restaura las plantillas por defecto
     */
    async handleResetTemplates() {
        app.showConfirm(
            i18n.t('tpl_reset_confirm_title'),
            i18n.t('tpl_reset_confirm_msg'),
            () => {
                const defaults = this.getDefaultTemplates();
                document.getElementById('tpl-pendiente').value = defaults.pendiente;
                document.getElementById('tpl-presupuesto').value = defaults.presupuesto;
                document.getElementById('tpl-reparado').value = defaults.reparado;
                document.getElementById('tpl-entregado').value = defaults.entregado;
                app.showToast(i18n.t('tpl_restore_info'), 'info');
            }
        );
    }

    /**
     * Retorna los mensajes por defecto
     */
    getDefaultTemplates() {
        return {
            pendiente: `✅ *𝗥𝗲𝗰𝗶𝗯𝗶𝗱𝗼:* {CLIENTE}\r\n\r\nHola, hemos recibido su {DISPOSITIVO} (SN: {IMEI}) para reparación.\r\n\r\n📋 *𝗘𝘀𝘁𝗮𝗱𝗼:* Pendiente de diagnóstico\r\n📍 *𝗦𝗲𝗴𝘂𝗶𝗺𝗶𝗲𝗻𝘁𝗼:* {URL}`,
            presupuesto: `💰 *𝗣𝗿𝗲𝘀𝘂𝗽𝘂𝗲𝘀𝘁𝗼:* {CLIENTE}\r\n\r\nSu {DISPOSITIVO} ya ha sido diagnosticado.\r\n\r\n🛠️ *𝗥𝗲𝗽𝗮𝗿𝗮𝗰𝗶𝗼́𝗻:* {REPUESTOS}\r\n💵 *𝗧𝗼𝘁𝗮𝗹:* {PRECIO}\r\n\r\n¿Desea proceder con la reparación?`,
            reparado: `✨ *¡𝗟𝗶𝘀𝘁𝗼 𝗽𝗮𝗿𝗮 𝗿𝗲𝘁𝗶𝗿𝗮𝗿!* {CLIENTE}\r\n\r\nSu {DISPOSITIVO} ya está reparado y verificado.\r\n\r\n✅ *𝗧𝗿𝗮𝗯𝗮𝗷𝗼 𝗿𝗲𝗮𝗹𝗶𝘇𝗮𝗱𝗼:* {REPUESTOS}\r\n💵 *𝗜𝗺𝗽𝗼𝗿𝘁𝗲:* {PRECIO}\r\n\r\nPuede pasar a recogerlo en nuestro horario comercial.`,
            entregado: `🤝 *𝗚𝗿𝗮𝗰𝗶𝗮𝘀 𝗽𝗼𝗿 𝘀𝘂 𝗰𝗼𝗻𝗳𝗶𝗮𝗻𝘇𝗮* {CLIENTE}\r\n\r\nSe ha completado la entrega de su {DISPOSITIVO}.\r\n\r\n🧾 *𝗙𝗮𝗰𝘁𝘂𝗿𝗮:* {URL}\r\n\r\n¡Que lo disfrute!`
        };
    }

    /**
     * Helper para generar datos de backup (extraído de exportBackup para reutilizar)
     */
    async generateBackupData() {
        const clientes = await db.getAllClientes();
        const reparaciones = await db.getAllReparaciones();
        const config = await db.getAllConfig();
        const facturas = await db.getAllFacturas();
        // const inventory = await db.getAllProducts(); // TODO: Implement inventory
        const inventory = [];

        return {
            version: '1.0',
            timestamp: Date.now(),
            data: {
                clientes,
                reparaciones,
                config,
                facturas,
                inventory
            }
        };
    }

    /**
     * Guarda el PIN de seguridad
     */
    async savePin() {
        const input = document.getElementById('settings-pin');
        const pin = input.value.trim();

        if (pin && !/^\d{4}$/.test(pin)) {
            app.showToast('El PIN debe ser de 4 dígitos', 'error');
            return;
        }

        try {
            if (pin) {
                await db.setConfig('security_pin', pin);
                this.pin = pin;
                app.showToast('PIN de seguridad activado', 'success');
            } else {
                await db.setConfig('security_pin', null);
                this.pin = null;
                app.showToast('PIN de seguridad desactivado', 'info');
            }
            input.value = '';
        } catch (error) {
            console.error('Error saving PIN:', error);
            app.showToast('Error al guardar configuración', 'error');
        }
    }

    /**
     * Gestiona subida de logo
     */
    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 5MB limit (increased from 500KB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            app.showToast('La imagen es demasiado grande (máx 5MB)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;

            // Validar dimensiones
            const img = new Image();
            img.onload = async () => {
                if (img.width < 50 || img.height < 50) {
                    app.showToast('La imagen es demasiado pequeña (mín 50x50)', 'error');
                    return;
                }
                if (img.width > 4096 || img.height > 4096) {
                    app.showToast('La imagen es demasiado grande en dimensiones (máx 4096px)', 'error');
                    return;
                }

                try {
                    await db.setConfig('app_logo', base64);
                    this.showLogo(base64);
                    app.showToast('Logo actualizado', 'success');
                } catch (error) {
                    console.error('Error saving logo:', error);
                    app.showToast('Error al guardar logo', 'error');
                }
            };
            img.onerror = () => {
                app.showToast(i18n.t('toast_error'), 'error');
            };
            img.src = base64;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Muestra el logo en la UI
     */
    showLogo(base64) {
        const img = document.getElementById('logo-preview');
        const container = document.getElementById('logo-preview-container');
        const icon = container ? container.querySelector('span') : null;
        const removeBtn = document.getElementById('btn-delete-logo');

        if (img) {
            img.src = base64;
            img.style.display = 'block';
        }
        if (icon) icon.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-block';
    }

    /**
     * Elimina el logo
     */
    async deleteLogo() {
        app.showConfirm(
            i18n.t('set_confirm_delete_logo'),
            i18n.t('set_confirm_delete_logo_msg'),
            async () => {
                try {
                    await db.setConfig('app_logo', null);

                    const img = document.getElementById('logo-preview');
                    const container = document.getElementById('logo-preview-container');
                    const icon = container ? container.querySelector('span') : null;
                    const removeBtn = document.getElementById('btn-delete-logo');

                    if (img) {
                        img.src = '';
                        img.style.display = 'none';
                    }
                    if (icon) icon.style.display = 'block';
                    if (removeBtn) removeBtn.style.display = 'none';

                    const input = document.getElementById('logo-input');
                    if (input) input.value = '';

                    app.showToast(i18n.t('toast_deleted'), 'success');
                } catch (error) {
                    console.error('Error removing logo:', error);
                    app.showToast(i18n.t('toast_error'), 'error');
                }
            }
        );
    }

    /**
     * Borrado total de datos - Redirigido a la versión nuclear al final del archivo
     */
    async handleClearData() {
        this.handleNuclearWipe();
    }

    /**
     * Wrapper para deduplicación
     */
    async handleDeduplication() {
        return this.cleanDuplicateClients();
    }

    /**
     * Wrapper para deduplicación
     */
    async updateLocalSyncStatus() {
        // Implementation for Sync status (existing or placeholder)
    }

    /* AUTOMATED BACKUP (File System Access API) */

    async updateAutoBackupStatus() {
        const container = document.getElementById('auto-backup-status');
        if (!container) return;

        try {
            const handle = await db.getDirectoryHandle();
            if (handle) {
                container.style.color = 'var(--status-completed)';
                container.innerHTML = `
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: currentColor;"></span>
                    Conectado: <strong>${handle.name}</strong>
                `;
                document.getElementById('btn-setup-autobackup').textContent = "Cambiar Carpeta";
            } else {
                container.style.color = 'var(--status-rejected)';
                container.innerHTML = `
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: currentColor;"></span>
                    Sin configurar
                `;
                const btn = document.getElementById('btn-setup-autobackup');
                btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: black !important;">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                Guardar Copia
            `;
                // Forzar estilos
                btn.style.setProperty('background-color', '#00ffcc', 'important');
                btn.style.setProperty('color', 'black', 'important');
                btn.style.setProperty('font-weight', 'bold', 'important');
                btn.style.setProperty('border', 'none', 'important');
            }
        } catch (e) {
            console.error('Error checking backup trigger:', e);
        }
    }

    async handleSetupAutoBackup() {
        if (!('showDirectoryPicker' in window)) {
            app.showToast('Tu navegador no soporta esta función (usa Chrome/Edge)', 'error');
            return;
        }

        try {
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents'
            });

            if (handle) {
                await db.saveDirectoryHandle(handle);
                await this.updateAutoBackupStatus();
                app.showToast('Carpeta configurada. Se hará un backup de prueba.', 'success');
                await this.performAutoBackup(false); // Force creating a first backup
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error picking directory:', error);
                app.showToast('Error al seleccionar carpeta: ' + error.message, 'error');
            }
        }
    }

    /**
     * Executes the auto-backup
     * @param {boolean} silent - If true, suppressed success toasts (only errors)
     */
    async performAutoBackup(silent = true) {
        try {
            const handle = await db.getDirectoryHandle();
            if (!handle) return; // Not configured

            // Verify permission
            const permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                // If we are running silently (background), we can't ask for permission 
                // as it requires user gesture. We just exit.
                // If not silent, we could try requestPermission() but strict browsers might block it if not direct click.
                return;
            }

            // Prepare Data
            const exportData = await db.exportDatabase();
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `reparapp_autobackup_${dateStr}.json`;

            // Write File
            const fileHandle = await handle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(exportData, null, 2));
            await writable.close();

            if (!silent) app.showToast('Copia automática completada', 'success');

        } catch (error) {
            console.error('AutoBackup failed:', error);
            if (!silent) app.showToast('Error en copia automática: ' + error.message, 'error');
        }
    }

    /**
     * Exporta copia de seguridad simple (JSON)
     */
    async handleExportBackup() {
        try {
            app.showToast('Generando copia de seguridad...', 'info');

            // Fetch data explicitly first
            const clientes = await db.getAllClientes();
            const reparaciones = await db.getAllReparaciones();
            const facturas = await db.getAllFacturas();
            const productos = await db.getAllProducts();

            // Fetch config explicitly
            const configData = {
                company_name: await db.getConfig('company_name'),
                company_dni: await db.getConfig('company_dni'),
                company_address: await db.getConfig('company_address'),
                company_email: await db.getConfig('company_email'),
                company_phone: await db.getConfig('company_phone'),
                app_logo: await db.getConfig('app_logo')
            };

            // ESTRUCTURA JERÁRQUICA
            const clientMap = new Map();
            const orphansRepairs = [];
            const orphansInvoices = [];

            // 1. Prepare Clients
            clientes.forEach(c => {
                c.reparaciones = [];
                c.facturas = [];
                clientMap.set(c.id, c);
            });

            // 2. Nest Repairs
            reparaciones.forEach(r => {
                if (r.cliente_id && clientMap.has(r.cliente_id)) {
                    clientMap.get(r.cliente_id).reparaciones.push(r);
                } else {
                    orphansRepairs.push(r);
                }
            });

            // 3. Nest Invoices
            facturas.forEach(f => {
                if (f.cliente_id && clientMap.has(f.cliente_id)) {
                    clientMap.get(f.cliente_id).facturas.push(f);
                } else {
                    orphansInvoices.push(f);
                }
            });

            const backup = {
                version: 3, // Version bump for hierarchical structure
                timestamp: Date.now(),
                data: {
                    clientes: Array.from(clientMap.values()),
                    reparaciones_huerfanas: orphansRepairs,
                    facturas_huerfanas: orphansInvoices,
                    inventario: productos
                },
                config: configData
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_gestion_simple_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            app.showToast('Copia descargada correctamente', 'success');
            // Modal informativo con estadísticas
            app.showInfoModal({
                type: 'success',
                title: '✅ Copia de Seguridad Creada',
                message: 'La copia de seguridad se ha generado y descargado correctamente.',
                stats: {
                    '👥 Clientes exportados': clientes.length,
                    '🔧 Reparaciones exportadas': reparaciones.length,
                    '📄 Facturas exportadas': facturas.length,
                    '📦 Productos exportados': productos.length
                }
            });
        } catch (error) {
            console.error('Error exporting backup:', error);
            app.showToast('Error al exportar copia', 'error');
            app.showInfoModal({ type: 'error', title: 'Error al Exportar', message: error.message });
        }
    }

    /**
     * Exporta copia de seguridad Avanzada (CSV + PDF + ZIP)
     */
    async handleExportAdvanced() {
        try {
            app.showToast('Generando copia de seguridad avanzada...', 'info');

            const zip = new JSZip();
            const dataFolder = zip.folder("data");
            const pdfFolder = zip.folder("facturas_pdf");

            // 1. Exportar Datos a CSV
            const clients = await db.getAllClientes();
            const repairs = await db.getAllReparaciones();
            const invoices = await db.getAllFacturas();

            dataFolder.file("clientes.csv", CSVService.toCSV(clients));
            dataFolder.file("reparaciones.csv", CSVService.toCSV(repairs));
            dataFolder.file("facturas.csv", CSVService.toCSV(invoices));

            // 2. Generar PDFs de Facturas
            // Necesitamos un contenedor oculto para renderizar
            const hiddenContainer = document.createElement('div');
            hiddenContainer.style.position = 'absolute';
            hiddenContainer.style.left = '-9999px';
            hiddenContainer.style.top = '-9999px';
            document.body.appendChild(hiddenContainer);

            // Importamos la lógica de generación de HTML de invoices.js (simplificada aquí o reusada)
            // Para no duplicar código complejo, vamos a hacer una instancia temporal de InvoicesUI si es posible,
            // pero InvoicesUI usa window.open.
            // MEJOR: Copiamos la lógica de renderizado HTML seguro aquí.

            // Instanciamos InvoicesUI para acceder a sus métodos de formateo si es necesario, 
            // pero para evitar dependencias circulares, mejor reimplementamos lo mínimo necesario o hacemos público el generador.
            // Vamos a usar una función helper interna.

            if (invoices.length > 0) {
                app.showToast(`Generando ${invoices.length} PDFs...`, 'info');
            }

            for (const factura of invoices) {
                try {
                    const htmlContent = await this.getInvoiceHTML(factura);
                    hiddenContainer.innerHTML = htmlContent;

                    // Configuración de html2pdf
                    const opt = {
                        margin: 0, // El CSS ya tiene márgenes para body
                        filename: `Factura_${factura.numero}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2 },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    // Generar PDF como Blob
                    const pdfBlob = await html2pdf().set(opt).from(hiddenContainer).output('blob');
                    pdfFolder.file(`Factura_${factura.numero}.pdf`, pdfBlob);
                } catch (err) {
                    console.error(`Error generando PDF para factura ${factura.numero}:`, err);
                }
            }

            document.body.removeChild(hiddenContainer);

            // 3. Generar ZIP
            const content = await zip.generateAsync({ type: "blob" });

            // Descargar
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_gestion_avanzado_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            app.showToast('Copia avanzada descargada', 'success');
            app.showInfoModal({
                type: 'success',
                title: '✅ Copia Avanzada Creada',
                message: 'Archivo ZIP descargado con CSVs y PDFs de facturas.',
                stats: {
                    '👥 Clientes exportados': clients.length,
                    '🔧 Reparaciones exportadas': repairs.length,
                    '📄 Facturas en PDF': invoices.length
                }
            });

        } catch (error) {
            console.error('Error in advanced backup:', error);
            app.showToast('Error al generar copia avanzada', 'error');
            app.showInfoModal({ type: 'error', title: 'Error en Copia Avanzada', message: error.message });
        }
    }

    /**
     * Gestiona la importación de archivos (JSON or ZIP)
     */
    async handleImportBackup(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const input = event.target;
        const self = this;

        // Usar modal moderno para preguntar modo de importación
        app.showConfirm(
            '📦 Modo de Importación',
            '¿Quieres BORRAR los datos actuales antes de importar?\n\n✅ Confirmar = Restauración limpia (borrar todo)\n❌ Cancelar = Fusionar con datos existentes',
            async () => {
                // Usuario eligió REEMPLAZAR - mostrar advertencia final
                app.showConfirm(
                    '⚠️ ADVERTENCIA FINAL',
                    'Se eliminarán TODOS los clientes, reparaciones y facturas actuales.\n\nEsta acción es irreversible. ¿Estás completamente seguro?',
                    async () => {
                        // Confirmado: Proceder con reemplazo
                        await self.executeImport(file, type, 'replace', input);
                    },
                    () => {
                        // Canceló advertencia final
                        input.value = '';
                    }
                );
            },
            async () => {
                // Usuario eligió FUSIONAR - proceder directamente
                await self.executeImport(file, type, 'merge', input);
            }
        );
    }

    /**
     * Ejecuta la importación con el modo especificado
     */
    async executeImport(file, type, mode, input) {
        app.showToast(`Iniciando importación (${mode === 'replace' ? 'Reemplazo' : 'Fusión'})...`, 'info');

        try {
            if (mode === 'replace') {
                await db.wipeDatabase();
                app.showToast('Base de datos limpiada.', 'success');
            }

            if (type === 'json') {
                await this.handleImportJson(file);
            } else if (type === 'zip') {
                await this.handleImportZip(file);
            }
        } catch (error) {
            console.error('Import failed:', error);
            app.showToast('Error en la importación: ' + error.message, 'error');
            app.showInfoModal({ type: 'error', title: 'Error Crítico', message: error.message });
        } finally {
            input.value = '';
        }
    }

    /**
     * Helper para generar HTML de factura para PDF
     */
    async getInvoiceHTML(factura) {
        const cliente = await db.getCliente(factura.cliente_id);

        // Datos de Empresa
        const companyName = (await db.getConfig('company_name')) || 'Mi Empresa';
        const companyAddress = (await db.getConfig('company_address')) || '';
        const companyDni = (await db.getConfig('company_dni')) || '';
        const companyPhone = (await db.getConfig('company_phone')) || '';
        const companyEmail = (await db.getConfig('company_email')) || '';
        const logo = await db.getConfig('app_logo');

        // Formatos
        const formatDate = (ts) => new Date(ts).toLocaleDateString();
        const formatPrice = (p) => parseFloat(p).toFixed(2) + ' €';
        const escapeHtml = (text) => {
            if (!text) return '';
            return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        };

        let lineasHtml = '';
        if (factura.items && Array.isArray(factura.items)) {
            factura.items.forEach(l => {
                lineasHtml += `
                    <tr>
                        <td>${escapeHtml(l.descripcion)}</td>
                        <td class="text-center">${l.cantidad}</td>
                        <td class="text-right">${formatPrice(l.precio)}</td>
                        <td class="text-right">${formatPrice(l.total)}</td>
                    </tr>
                `;
            });
        }

        // Reutilizamos el CSS definido en invoices.js (simplificado para html2pdf)
        return `
            <div style="font-family: Arial, sans-serif; padding: 40px; color: #333; width: 800px; background: white;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 20px;">
                    <div style="flex: 0 0 200px;">
                        ${logo ? `<img src="${logo}" style="max-width: 150px; max-height: 80px;">` : '<h2>LOGO</h2>'}
                    </div>
                    <div style="text-align: right;">
                        <h1 style="margin: 0; color: #333;">FACTURA</h1>
                        <p style="margin: 5px 0;"><strong>Nº:</strong> ${factura.numero}</p>
                        <p style="margin: 5px 0;"><strong>Fecha:</strong> ${formatDate(factura.fecha)}</p>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                    <div style="width: 45%;">
                        <h3 style="border-bottom: 1px solid #eee;">Emisor</h3>
                        <p><strong>${escapeHtml(companyName)}</strong><br>
                        ${escapeHtml(companyAddress)}<br>
                        ${companyDni}<br>
                        ${escapeHtml(companyPhone)}</p>
                    </div>
                    <div style="width: 45%;">
                        <h3 style="border-bottom: 1px solid #eee;">Cliente</h3>
                        <p><strong>${escapeHtml(cliente ? cliente.nombre : 'Cliente Desconocido')}</strong><br>
                        ${escapeHtml(cliente ? cliente.direccion : '')}<br>
                        ${escapeHtml(cliente ? cliente.dni : '')}<br>
                        ${escapeHtml(cliente ? cliente.telefono : '')}</p>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead style="background: #f5f5f5;">
                        <tr>
                            <th style="padding: 10px; text-align: left;">Descripción</th>
                            <th style="padding: 10px; text-align: center;">Cant.</th>
                            <th style="padding: 10px; text-align: right;">Precio</th>
                            <th style="padding: 10px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${lineasHtml}</tbody>
                </table>

                <div style="text-align: right;">
                    <p><strong>Subtotal:</strong> ${formatPrice(factura.subtotal)}</p>
                    <p><strong>IVA:</strong> ${formatPrice(factura.iva)}</p>
                    <h3 style="border-top: 2px solid #333; padding-top: 10px; display: inline-block;">Total: ${formatPrice(factura.total)}</h3>
                </div>
            </div>
        `;
    }

    /**
     * Importar JSON Estricto
     */
    /**
     * Importar JSON Estricto
     * @param {File} file 
     */
    async handleImportJson(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);

                // DIAGNÓSTICO PROFUNDO: Mostrar qué hay en el archivo
                const keys = Object.keys(json);
                const sampleKey = keys[0] || 'VACÍO';
                const hasData = !!json.data;
                const dataKeys = hasData ? Object.keys(json.data) : 'N/A';


                // Validar estructura básica
                if (!json.data && !Array.isArray(json.data)) {
                    // Intento de recuperación si es un array directo de claves (el error raro del usuario)
                    if (Array.isArray(json)) {
                        app.showToast('Archivo JSON inválido: Parece una lista de claves, no datos.', 'error');
                        return;
                    }
                    // Intento de recuperación si es formato antiguo o diferente
                    if (json.clientes || json.reparaciones) {
                        const self = this;
                        app.showConfirm(
                            'Formato Legacy Detectado',
                            'Parece una copia de seguridad antigua (Android/Legacy). ¿Intentar importar con conversión automática?',
                            async () => {
                                await self.importLegacyData(json);
                                app.showToast('Datos legacy importados.', 'success');
                                setTimeout(() => window.location.reload(), 2000);
                            }
                        );
                        return;
                    }

                    throw new Error("El archivo no tiene la estructura 'data' esperada.");
                }

                await this.processImportData(json);
                app.showToast('Restauración completada con éxito', 'success');
                setTimeout(() => window.location.reload(), 1500);

            } catch (err) {
                console.error("Error parsing/importing JSON:", err);
                app.showInfoModal({ type: 'error', title: 'Error al Restaurar', message: err.message });
                app.showToast('Error crítico al restaurar.', 'error');
            }
        };
        reader.readAsText(file);
    }

    /**
     * Importar ZIP Estricto
     */
    /**
     * Importar ZIP Estricto
     * @param {File} file
     */
    async handleImportZip(file) {
        if (!file) return;

        try {
            const zip = new JSZip();
            await zip.loadAsync(file);

            // Lógica de detección de tipo de ZIP
            const metadataFile = zip.file("metadata.json");
            const backupDataFile = zip.file("backup_data.json");
            const rootClientesCsv = zip.file("clientes.csv");

            if (backupDataFile) {
                await this.importJsonZipBackup(zip);
            } else if (metadataFile && rootClientesCsv) {
                await this.importHybridBackup(zip);
            } else {
                await this.importAdvancedBackup(zip);
            }
        } catch (err) {
            console.error("Error reading ZIP:", err);
            app.showInfoModal({ type: 'error', title: 'Error de Archivo ZIP', message: err.message });
            app.showToast('Error crítico al leer el archivo ZIP.', 'error');
        }
        // Input reset handled by caller handleImportBackup
    }

    /**
     * Importa Backup ZIP que contiene un JSON principal (backup_data.json)
     */
    async importJsonZipBackup(zip) {
        try {
            const jsonFile = zip.file("backup_data.json");
            if (!jsonFile) throw new Error("No se encontró backup_data.json");

            const jsonStr = await jsonFile.async("string");
            const json = JSON.parse(jsonStr);


            // Intentar extraer PDFs de facturas si existen en el ZIP
            if (json.data && Array.isArray(json.data.facturas)) {
                app.showToast(`Analizando ${json.data.facturas.length} facturas y adjuntos...`, 'info');
                let pdfCount = 0;
                for (const f of json.data.facturas) {
                    if (f.filePath && !f.pdf_data) {
                        try {
                            const pdfFile = zip.file(f.filePath);
                            if (pdfFile) {
                                const base64 = await pdfFile.async("base64");
                                f.pdf_data = "data:application/pdf;base64," + base64;
                                pdfCount++;
                            }
                        } catch (e) {
                            console.warn("Could not extract PDF:", f.filePath);
                        }
                    }
                }
                if (pdfCount > 0) console.log(`Extracted ${pdfCount} PDFs from ZIP`);
            }

            // Validar y procesar con la lógica robusta existente
            if (json.data && (json.data.clientes || json.data.reparaciones)) {
                await db.importData(json);
            } else {
                // Si no tiene 'data', puede ser estructura plana
                await this.processImportData(json);
            }

            // TODO: Intentar extraer facturas/imágenes si es posible en el entorno
            // Por ahora priorizamos los datos

            app.showToast('Restauración completada (Formato ZIP+JSON)', 'success');

            // Stats check for alert
            const stats = await db.getStats();
            app.showInfoModal({ type: 'success', title: 'Restauración Completada', stats: { 'Clientes': stats.totalClientes, 'Reparaciones': stats.totalReparaciones, 'Facturas': stats.totalFacturas } });

            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Error en importJsonZipBackup:", error);
            app.showInfoModal({ type: 'error', title: 'Error al Importar ZIP', message: error.message });
        }
    }

    /**
     * Importa Backup Avanzado desde CSVs
     */
    async importAdvancedBackup(zip) {
        try {
            // Usar rutas completas para acceder a los archivos
            const clientesCsvFile = zip.file("data/clientes.csv");
            const reparaCsvFile = zip.file("data/reparaciones.csv");
            const facturasCsvFile = zip.file("data/facturas.csv");

            if (!clientesCsvFile || !reparaCsvFile || !facturasCsvFile) {
                app.showToast('Faltan archivos CSV en el backup', 'error');
                return;
            }

            const clientesCsv = await clientesCsvFile.async("string");
            const reparaCsv = await reparaCsvFile.async("string");
            const facturasCsv = await facturasCsvFile.async("string");

            const clientes = CSVService.parse(clientesCsv);
            const reparaciones = CSVService.parse(reparaCsv);
            const facturas = CSVService.parse(facturasCsv);

            app.showToast(`Leídos: ${clientes.length} clientes, ${reparaciones.length} reparaciones`, 'info');

            // 1. Clientes
            if (clientes.length > 0) app.showToast('Importando clientes...', 'info');
            for (const c of clientes) {
                await db.saveCliente(c);
            }

            // 2. Reparaciones
            if (reparaciones.length > 0) app.showToast('Importando reparaciones...', 'info');
            for (const r of reparaciones) {
                await db.saveReparacion(r);
            }

            // 3. Facturas
            if (facturas.length > 0) app.showToast('Importando facturas...', 'info');
            for (const f of facturas) {
                // Parsear items si vienen como string JSON
                if (typeof f.items === 'string') {
                    try { f.items = JSON.parse(f.items); } catch (e) { f.items = []; }
                }
                await db.saveFactura(f);
            }

            app.showToast('Datos CSV importados correctamente', 'success');

            const stats = await db.getStats();
            app.showInfoModal({ type: 'success', title: 'Restauración CSV Completada', stats: { 'Clientes importados': stats.totalClientes, 'Reparaciones importadas': stats.totalReparaciones } });

            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Error importing CSV backup:", error);
            app.showToast('Error al importar CSVs: ' + error.message, 'error');
            app.showInfoModal({ type: 'error', title: 'Error de Importación CSV', message: error.message });
        }
    }

    /**
     * Importa Backup Hybrid (formato Android) - CSVs en raíz del ZIP
     * Realiza mapeo de campos de Android a formato Web
     */
    async importHybridBackup(zip) {
        // ... (existing code)
    }

    /**
     * Busca y elimina clientes duplicados
     * Criterio: Mismo Nombre+Apellido O Mismo DNI
     * Mantiene: El modificado más recientemente
     */
    async cleanDuplicateClients(silent = false) {
        const self = this;

        if (silent) {
            // Modo silencioso - ejecutar directamente
            await self._executeCleanDuplicates();
        } else {
            // Mostrar confirmación con modal moderno
            app.showConfirm(
                i18n.t('set_dedup_title'),
                i18n.t('set_dedup_msg'),
                async () => await self._executeCleanDuplicates()
            );
        }
    }

    /**
     * Ejecuta la limpieza de duplicados (lógica interna)
     */
    async _executeCleanDuplicates() {
        try {
            app.showToast(i18n.t('set_dedup_analyzing_clients'), 'info');
            const clientes = await db.getAllClientes();

            app.showToast(i18n.t('set_dedup_analyzing_repairs'), 'info');
            const allReparaciones = await db.getAllReparaciones();

            app.showToast(i18n.t('set_dedup_analyzing_invoices'), 'info');
            const allFacturas = await db.getAllFacturas();

            const clientDuplicates = [];
            const repairDuplicates = [];
            const invoiceDuplicates = [];

            // 1. ANALIZAR CLIENTES
            try {
                const clientGroups = {};
                for (const c of clientes) {
                    if (!c) continue;
                    const key = String(c.nombre || '').trim().toLowerCase() + " " + String(c.apellido || '').trim().toLowerCase();
                    if (key.trim() === "") continue;
                    if (!clientGroups[key]) clientGroups[key] = [];
                    clientGroups[key].push(c);
                }

                for (const key in clientGroups) {
                    const group = clientGroups[key];
                    if (group.length > 1) {
                        group.sort((a, b) => (b.ultima_modificacion || 0) - (a.ultima_modificacion || 0));
                        const master = group[0];
                        for (let i = 1; i < group.length; i++) {
                            clientDuplicates.push({ toDelete: group[i], keep: master });
                        }
                    }
                }
            } catch (e) { console.error("Error analizando clientes:", e); }

            // 2. ANALIZAR REPARACIONES
            try {
                const repairGroups = {};
                for (const r of allReparaciones) {
                    if (!r) continue;
                    // Key: Cliente + Dispositivo + Problema + Fecha (Aproximada a minutos)
                    const dateKey = r.fecha_creacion ? Math.floor(r.fecha_creacion / 60000) : 'unknown';
                    const disp = String(r.dispositivo || '').toLowerCase().trim();
                    const prob = String(r.problema || r.descripcion || '').toLowerCase().trim().substring(0, 50); // Solo los primeros 50 para evitar keys gigantes
                    const key = `${r.cliente_id}_${disp}_${prob}_${dateKey}`;

                    if (!repairGroups[key]) repairGroups[key] = [];
                    repairGroups[key].push(r);
                }

                for (const key in repairGroups) {
                    const group = repairGroups[key];
                    if (group.length > 1) {
                        group.sort((a, b) => (b.ultima_modificacion || 0) - (a.ultima_modificacion || 0));
                        for (let i = 1; i < group.length; i++) {
                            repairDuplicates.push(group[i]);
                        }
                    }
                }
            } catch (e) { console.error("Error analizando reparaciones:", e); }

            // 3. ANALIZAR FACTURAS
            try {
                const invoiceGroups = {};
                for (const f of allFacturas) {
                    if (!f || !f.numero) continue;
                    const key = String(f.numero).trim().toUpperCase();
                    if (!invoiceGroups[key]) invoiceGroups[key] = [];
                    invoiceGroups[key].push(f);
                }

                for (const key in invoiceGroups) {
                    const group = invoiceGroups[key];
                    if (group.length > 1) {
                        group.sort((a, b) => (b.ultima_modificacion || 0) - (a.ultima_modificacion || 0));
                        for (let i = 1; i < group.length; i++) {
                            invoiceDuplicates.push(group[i]);
                        }
                    }
                }
            } catch (e) { console.error("Error analizando facturas:", e); }

            const total = clientDuplicates.length + repairDuplicates.length + invoiceDuplicates.length;

            if (total === 0) {
                app.showToast('✅ No se encontraron duplicados', 'success');
                return;
            }

            // Mostrar resumen y confirmar
            let msg = `Se han encontrado:\n`;
            if (clientDuplicates.length > 0) msg += `- ${clientDuplicates.length} clientes duplicados\n`;
            if (repairDuplicates.length > 0) msg += `- ${repairDuplicates.length} reparaciones duplicadas\n`;
            if (invoiceDuplicates.length > 0) msg += `- ${invoiceDuplicates.length} facturas duplicadas\n`;
            msg += `\n¿Deseas eliminarlos de forma segura?`;

            // Forzar cierre de toast anterior antes de mostrar confirmación
            setTimeout(() => {
                app.showConfirm(
                    '🗑️ Limpieza de Duplicados',
                    msg,
                    async () => {
                        await this._deleteDuplicatesConsolidated(clientDuplicates, repairDuplicates, invoiceDuplicates);
                    }
                );
            }, 500);

        } catch (error) {
            console.error('Error general analizando duplicados:', error);
            app.showToast('❌ Error crítico analizando duplicados', 'error');
        }
    }

    /**
     * Elimina los duplicados de forma consolidada
     */
    async _deleteDuplicatesConsolidated(clientDups, repairDups, invoiceDups) {
        try {
            app.showToast('Ejecutando limpieza...', 'info');

            // Pre-fetch for reassigning children of clients
            const allFacturas = await db.getAllFacturas();

            // 1. Clientes (requiere reasignar hijos)
            for (const dup of clientDups) {
                const oldId = dup.toDelete.id;
                const newId = dup.keep.id;

                // Reasignar Reparaciones del cliente borrado (usando index es eficiente)
                const reparaciones = await db.getReparacionesByCliente(oldId);
                for (const r of reparaciones) {
                    r.cliente_id = newId;
                    r.ultima_modificacion = Date.now();
                    await db.saveReparacion(r);
                }

                // Reasignar Facturas (usando pre-fetched array)
                const facturasCliente = allFacturas.filter(f => f.cliente_id === oldId);
                for (const f of facturasCliente) {
                    f.cliente_id = newId;
                    f.ultima_modificacion = Date.now();
                    await db.saveFactura(f);
                }

                await db.deleteCliente(oldId);
            }

            // 2. Reparaciones (simples)
            for (const r of repairDups) {
                await db.deleteReparacion(r.id);
            }

            // 3. Facturas (simples)
            for (const f of invoiceDups) {
                await db.deleteFactura(f.id);
            }

            app.showToast('Limpieza completada correctamente', 'success');

            // Sync y Reload
            if (window.syncManager) {
                try { await window.syncManager.sync(); } catch (e) { }
            }

            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error('Error executing cleaning:', error);
            app.showToast('Error en la eliminación', 'error');
        }
    }

    /**
     * Parsea fechas de Android (timestamp o string de fecha)
     */

    /**
     * Parsea fechas de Android (timestamp o string de fecha)
     */
    parseAndroidDate(dateValue) {
        if (!dateValue) return null;

        // Si es número (timestamp)
        if (typeof dateValue === 'number') return dateValue;

        // Si es string numérico (timestamp como string)
        if (typeof dateValue === 'string' && /^\d+$/.test(dateValue)) {
            return parseInt(dateValue, 10);
        }

        // Si es string de fecha (ej: "15/01/2026 18:40")
        if (typeof dateValue === 'string') {
            // Intentar parsear formato DD/MM/YYYY HH:MM
            const match = dateValue.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
            if (match) {
                const [, day, month, year, hour = '0', min = '0'] = match;
                return new Date(year, month - 1, day, hour, min).getTime();
            }

            // Fallback a Date.parse
            const parsed = Date.parse(dateValue);
            if (!isNaN(parsed)) return parsed;
        }

        return null;
    }



    /**
     * Importa datos (JSON object) directamente al sistema
     */
    async importData(data) {
        if (!data) throw new Error('No data provided');

        // Normalizar estructura
        let json = data;
        if (typeof json === 'string') {
            try { json = JSON.parse(json); } catch (e) { throw new Error('Invalid JSON string'); }
        }

        // Detectar si es legacy o nuevo
        // Caso 1: Backup nativo de esta App (tiene version y data.clientes)
        if (json.version && json.data && (json.data.clientes || json.data.reparaciones)) {
            const cCount = json.data.clientes?.length || 0;
            const rCount = json.data.reparaciones?.length || 0;
            const fCount = json.data.facturas?.length || 0;

            app.progress.show('Restaurando Copia de Seguridad');
            app.progress.update(0, 'Preparando datos...');

            try {
                await db.importData(json, (pct, msg) => {
                    app.progress.update(pct, msg);
                });
                app.progress.update(100, 'Restauración completada');
                setTimeout(() => app.progress.hide(), 1000);
            } catch (e) {
                app.progress.hide();
                throw e;
            }
        }
        // Caso 2: Estructura corregida en handleImportJson (sin version explicita pero con data)
        else if (json.data && (json.data.clientes || json.data.reparaciones)) {
            const cCount = json.data.clientes?.length || 0;
            const rCount = json.data.reparaciones?.length || 0;
            app.showToast(`Restaurando: ${cCount} Clientes, ${rCount} Reparaciones...`, 'info');
            await db.importData({ data: json.data });
        }
        // Caso 3: Legacy (Importar desde JSON antiguo)
        else if (json.clientes || json.reparaciones || json.facturas) {
            const cCount = json.clientes?.length || 0;
            const rCount = json.reparaciones?.length || 0;
            app.showToast(`Restaurando Legacy: ${cCount} Clientes, ${rCount} Reparaciones...`, 'info');
            // Force await to ensure UI updates
            await new Promise(r => setTimeout(r, 100));
            await this.importLegacyData(json);
        }
        else {
            console.error("Formato NO reconocido:", Object.keys(json));
            app.showInfoModal({ type: 'error', title: 'Formato No Válido', message: 'El archivo no tiene un formato válido. No se encontraron clientes ni reparaciones.' });
            throw new Error("Formato de archivo no reconocido.");
        }

        // Verificación post-importación y limpieza
        await this.cleanDuplicateClients(true);
        const stats = await db.getStats();

        // Confirmación final con Modal visual
        app.showInfoModal({ type: 'success', title: 'Restauración Completada', stats: { 'Clientes': stats.totalClientes, 'Reparaciones': stats.totalReparaciones, 'Facturas': stats.totalFacturas, 'Items Inventario': stats.totalProductos || 0 } });

        // Recargar para ver cambios
        window.location.reload();
    }

    async processImportData(json) {
        return this.importData(json);
    }


    async importLegacyData(json) {

        // Mapa para convertir IDs numéricos antiguos a UUIDs nuevos
        // Usamos String() para asegurar que coincidan tipos (ej: "12" vs 12)
        const clientMap = new Map(); // Old ID (String) -> New UUID

        // 1. Importar Clientes
        if (json.clientes) {
            for (const c of json.clientes) {
                const newId = db.generateUUID();
                const oldId = String(c.id); // Normalizar a string
                clientMap.set(oldId, newId);

                const newClient = {
                    id: newId,
                    nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim(),
                    telefono: c.telefono || c.phone || c.movil || '',
                    email: c.email || '',
                    dni: c.dni || '',
                    direccion: c.direccion || '',
                    fecha_creacion: c.fechaRegistro || Date.now(),
                    ultima_modificacion: Date.now()
                };
                await db.saveCliente(newClient);
            }
        }

        // 2. Importar Reparaciones
        if (json.reparaciones) {
            for (const r of json.reparaciones) {
                const clientId = clientMap.get(String(r.clienteId));

                // Si no encontramos el cliente por ID, saltamos
                if (!clientId) continue;

                // Mapeo de estados
                let estado = 'pendiente';
                const oldState = (r.estado || '').toUpperCase();
                if (oldState === 'LISTO' || oldState === 'ENTREGADO' || oldState === 'TERMINADO') estado = 'completada';
                else if (oldState === 'EN PROCESO' || oldState === 'REPARANDO') estado = 'en_proceso';

                // Construir observaciones con datos extra que no tienen campo directo
                let obs = [];
                if (r.descripcionSolucion) obs.push(`Solución: ${r.descripcionSolucion}`);
                if (r.notas) obs.push(`Notas: ${r.notas}`);
                if (r.costoFinal) obs.push(`Costo Final: ${r.costoFinal}€`);
                if (r.fechaEntrega) obs.push(`Entregado: ${new Date(r.fechaEntrega).toLocaleDateString()}`);

                const newRepair = {
                    id: db.generateUUID(),
                    cliente_id: clientId,
                    dispositivo: r.tipoDispositivo || r.dispositivo || r.device || 'Dispositivo',
                    marca: r.marca || '',
                    modelo: r.modelo || '',
                    averia: r.descripcionProblema || r.problema || r.problem || '',
                    estado: estado,
                    fecha_entrada: r.fechaAdmision || Date.now(),
                    // Preferimos costoFinal si existe, si no estimado
                    presupuesto: r.costoEstimado || 0,
                    observaciones: obs.join('\n'),
                    patron: r.codigoPin || '',
                    fecha_creacion: r.fechaAdmision || Date.now(),
                    ultima_modificacion: Date.now()
                };
                await db.saveReparacion(newRepair);
            }
        }

        // 3. Importar Facturas
        if (json.facturas) {
            for (const f of json.facturas) {
                const clientId = clientMap.get(String(f.clienteId));
                if (!clientId) continue;

                // Parse items
                let items = [];
                try {
                    let sourceItems = f.itemsJson;
                    if (typeof sourceItems === 'string') {
                        sourceItems = JSON.parse(sourceItems);
                    }

                    if (Array.isArray(sourceItems)) {
                        items = sourceItems.map(item => ({
                            descripcion: item.description || 'Item',
                            cantidad: item.quantity || 1,
                            precio: item.unitPrice || 0,
                            total: (item.quantity || 1) * (item.unitPrice || 0)
                        }));
                    }
                } catch (e) {
                    console.warn("Error parsing invoice items", e);
                }

                // Calcular desglose
                let total = f.total || 0;

                // Si no hay total pero hay items, calcular
                if (total === 0 && items.length > 0) {
                    total = items.reduce((acc, i) => acc + i.total, 0);
                }

                // Calcular desglose usando el IVA configurado
                const taxRate = window.app_tax_rate || 21;
                const finalTotal = Number(total) || 0;
                const subtotal = finalTotal / (1 + taxRate / 100);
                const iva = finalTotal - subtotal;

                const newInvoice = {
                    id: db.generateUUID(),
                    cliente_id: clientId,
                    numero: f.numero || `FAC-${Date.now()}`,
                    fecha: f.fecha || Date.now(),
                    items: items,
                    subtotal: subtotal,
                    iva: iva,
                    total: finalTotal,
                    notas: f.notes || '',
                    fecha_creacion: f.fecha || Date.now(),
                    ultima_modificacion: Date.now()
                };
                await db.saveFactura(newInvoice);
            }
        }
    }

    downloadFile(content, fileName, contentType) {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    }

    async handleExportBackup() {
        app.progress.show('Exportando Datos (Nativo)');
        try {
            app.progress.update(10, 'Leyendo base de datos...');
            // Fake delay for visual feedback
            await new Promise(r => setTimeout(r, 500));

            const data = await db.exportData();
            app.progress.update(50, 'Generando JSON...');
            await new Promise(r => setTimeout(r, 500));

            const json = JSON.stringify(data, null, 2);
            app.progress.update(80, 'Preparando descarga...');
            await new Promise(r => setTimeout(r, 300));

            this.downloadFile(json, `backup_reparapp_pc_${Date.now()}.json`, 'application/json');

            app.progress.update(100, 'Completado');
            setTimeout(() => {
                app.progress.hide();
                app.showInfoModal({ type: 'success', title: 'Copia PC Lista', message: 'Copia de seguridad descargada correctamente.\n\nSe ha guardado en tu carpeta de descargas.' });
            }, 500);
        } catch (e) {
            app.progress.hide();
            console.error(e);
            app.showInfoModal({ type: 'error', title: 'Error al Exportar', message: e.message });
        }
    }

    async handleExportUniversal() {
        app.progress.show('Exportando Universal (Android/PC)');
        try {
            app.progress.update(10, 'Adaptando formato para Android...');
            await new Promise(r => setTimeout(r, 800)); // More delay as it implies work

            const data = await db.exportUniversalData();
            app.progress.update(60, 'Generando archivo compatible...');
            await new Promise(r => setTimeout(r, 500));

            const json = JSON.stringify(data, null, 2);
            app.progress.update(90, 'Iniciando descarga...');
            await new Promise(r => setTimeout(r, 300));

            this.downloadFile(json, `backup_reparalo_${Date.now()}.json`, 'application/json');

            app.progress.update(100, 'Completado');
            setTimeout(() => {
                app.progress.hide();
                app.showInfoModal({ type: 'success', title: 'Copia Universal Lista', message: 'Compatible con Android y PC.\n\nPuedes usar este archivo en ReparApp móvil o PC.' });
            }, 500);
        } catch (e) {
            app.progress.hide();
            console.error(e);
            app.showInfoModal({ type: 'error', title: 'Error al Exportar Universal', message: e.message });
        }
    }

    showDataInspector(json) {
        // Create a temporary modal to show the data structure
        const modalHtml = `
            <div class="modal-overlay active" id="inspector-modal" style="z-index: 9999;">
                <div class="modal" style="max-width: 800px; height: 80vh;">
                    <div class="modal-header">
                        <h2 class="modal-title">Formato Desconocido Detectado</h2>
                        <button class="modal-close" onclick="document.getElementById('inspector-modal').remove()">x</button>
                    </div>
                    <div class="modal-body" style="overflow-y: auto; height: calc(100% - 120px);">
                        <p style="margin-bottom: 20px; color: var(--text-secondary);">
                            El archivo no coincide con el formato de copia de seguridad estándar. 
                            <br><strong>Por favor, copia el siguiente contenido y envíalo al soporte técnico para que adapten el importador.</strong>
                        </p>
                        <textarea style="width: 100%; height: 400px; background: #111; color: #0f0; font-family: monospace; padding: 10px; border-radius: 5px;" readonly>${this.getInspectorPreview(json)}</textarea>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.querySelector('#inspector-modal textarea').select(); document.execCommand('copy'); app.showToast('Copiado al portapapeles', 'success');">Copiar Contenido</button>
                        <button class="btn btn-primary" onclick="document.getElementById('inspector-modal').remove()">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    getInspectorPreview(json) {
        // Extract a safe snippet of the data structure (keys and 1 example item)
        const snippet = {};
        for (const key in json) {
            if (Array.isArray(json[key])) {
                snippet[key] = `Array(${json[key].length} items)`;
                if (json[key].length > 0) {
                    snippet[key + '_EXAMPLE'] = json[key][0];
                }
            } else if (typeof json[key] === 'object' && json[key] !== null) {
                snippet[key] = Object.keys(json[key]);
            } else {
                snippet[key] = json[key];
            }
            return JSON.stringify(snippet, null, 4);
        }
    }

    async handleDiagnoseData() {
        app.showConfirm(
            '🔧 Diagnóstico de Datos',
            'Esta herramienta analizará y reparará vínculos rotos entre clientes, reparaciones y facturas. ¿Continuar?',
            async () => await this._executeDiagnoseData()
        );
    }

    async _executeDiagnoseData() {
        app.progress.show('Diagnóstico de Datos');
        app.progress.update(0, 'Analizando inconsistencias...');

        try {
            const clientes = await db.getAllClientes();
            const reparaciones = await db.getAllReparaciones();
            const facturas = await db.getAllFacturas();

            let orphansRep = 0;
            let orphansFac = 0;
            let fixed = 0;
            let firstOrphanRep = null;

            const clientIds = new Set(clientes.map(c => String(c.id)));

            // 1. Check Reparaciones
            const totalR = reparaciones.length;
            for (let i = 0; i < totalR; i++) {
                const r = reparaciones[i];
                if (!r.cliente_id) {
                    orphansRep++;
                    if (!firstOrphanRep) firstOrphanRep = r;
                    continue;
                }

                const cid = String(r.cliente_id);
                if (!clientIds.has(cid)) {
                    // Orphan found
                    orphansRep++;
                    if (!firstOrphanRep) firstOrphanRep = r;
                    console.warn(`Reparación huérfana: ${r.id} (Cliente ID: ${r.cliente_id})`);
                } else if (r.cliente_id !== cid) {
                    // Type mismatch fix
                    r.cliente_id = cid; // Force string
                    await db.saveReparacion(r);
                    fixed++;
                }

                if (i % 50 === 0) app.progress.update((i / totalR) * 50, 'Analizando reparaciones...');
            }

            // Show Debug Info for First Orphan (if any)
            if (firstOrphanRep) {
                const sampleStr = JSON.stringify(firstOrphanRep, null, 2);

                // Construct Debug Modal
                const debugHtml = `
                    <div id="orphan-debug-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;">
                        <div style="background:#222;padding:20px;border-radius:10px;width:90%;max-width:600px;max-height:80vh;display:flex;flex-direction:column;box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                            <h3 style="color:#fff;margin-bottom:10px;">🔍 Muestra de Reparación Huérfana</h3>
                            <p style="color:#ccc;margin-bottom:10px;">Envíame una captura de esto para saber cómo recuperar el cliente:</p>
                            <textarea style="flex:1;background:#000;color:#0f0;font-family:monospace;padding:10px;margin:10px 0;border:1px solid #444;border-radius:4px;" readonly>${sampleStr}</textarea>
                            <button onclick="document.getElementById('orphan-debug-modal').remove()" style="padding:10px;background:#666;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Cerrar</button>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', debugHtml);
            }

            // 2. Check Facturas
            const totalF = facturas.length;
            for (let i = 0; i < totalF; i++) {
                const f = facturas[i];
                if (!f.cliente_id) {
                    orphansFac++;
                    continue;
                }
                const cid = String(f.cliente_id);
                if (!clientIds.has(cid)) {
                    orphansFac++;
                    console.warn(`Factura huérfana: ${f.id} (Cliente ID: ${f.cliente_id})`);
                } else if (f.cliente_id !== cid) {
                    f.cliente_id = cid;
                    await db.saveFactura(f);
                    fixed++;
                }
                if (i % 50 === 0) app.progress.update(50 + (i / totalF) * 50, 'Analizando facturas...');
            }

            app.progress.update(100, 'Diagnóstico finalizado');
            setTimeout(() => {
                app.progress.hide();
                app.showInfoModal({
                    type: orphansRep === 0 && orphansFac === 0 ? 'success' : 'warning',
                    title: 'Diagnóstico Completado',
                    stats: {
                        'Reparaciones Huérfanas': orphansRep,
                        'Facturas Huérfanas': orphansFac,
                        'Vínculos Reparados': fixed
                    },
                    message: orphansRep > 0 || orphansFac > 0 ? 'Los registros huérfanos no tienen cliente asociado en la base de datos local.' : 'Todos los registros están correctamente vinculados.'
                });
            }, 1000);

        } catch (e) {
            app.progress.hide();
            console.error(e);
            app.showToast('Error en diagnóstico: ' + e.message, 'error');
        }
    }

    /**
     * Gestión del borrado total (Nuclear Wipe)
     */
    async handleNuclearWipe() {
        app.showConfirm(
            i18n.t('set_nuclear_wipe_title'),
            i18n.t('set_nuclear_wipe_msg'),
            async () => {
                const pin = await db.getConfig('app_pin');
                if (pin) {
                    const input = await app.showPrompt({
                        title: i18n.t('set_security_verify_title'),
                        message: i18n.t('set_security_verify_msg'),
                        placeholder: '****',
                        inputType: 'password',
                        icon: '🔒'
                    });
                    if (input !== pin) {
                        app.showToast(i18n.t('toast_pin_error'), 'error');
                        return;
                    }
                }

                app.progress.show(i18n.t('set_nuclear_wipe_progress'));

                try {
                    // Borrado en Nube
                    if (window.supabaseClient && window.supabaseClient.isConfigured) {
                        app.progress.update(10, i18n.t('set_nuclear_wipe_cloud_analyzing'));

                        const deleteInBatches = async (items, deleteFn, label) => {
                            const total = items.length;
                            const batchSize = 10;
                            for (let i = 0; i < total; i += batchSize) {
                                const batch = items.slice(i, i + batchSize);
                                await Promise.all(batch.map(item => deleteFn(item.id)));
                                app.progress.update(
                                    currentProgress + ((i + batch.length) / total) * 20,
                                    i18n.t('set_nuclear_wipe_cloud_deleting')
                                        .replace('{label}', label)
                                        .replace('{current}', Math.min(i + batch.length, total))
                                        .replace('{total}', total)
                                );
                            }
                        };

                        let currentProgress = 10;
                        // Facturas
                        const f = await supabaseClient.getFacturas();
                        if (f && f.length > 0) {
                            await deleteInBatches(f, (id) => supabaseClient.deleteFactura(id), 'facturas');
                        }

                        currentProgress = 30;
                        // Reparaciones
                        const r = await supabaseClient.getReparaciones();
                        if (r && r.length > 0) {
                            await deleteInBatches(r, (id) => supabaseClient.deleteReparacion(id), 'reparaciones');
                        }

                        currentProgress = 50;
                        // Clientes
                        const c = await supabaseClient.getClientes();
                        if (c && c.length > 0) {
                            await deleteInBatches(c, (id) => supabaseClient.deleteCliente(id), 'clientes');
                        }
                    } else {
                        app.progress.update(50, i18n.t('set_nuclear_wipe_cloud_skipping', 'Saltando nube (no configurada)...'));
                    }

                    app.progress.update(80, i18n.t('set_nuclear_wipe_local_cleaning'));

                    // FIX: Use correct method name
                    await db.wipeDatabase();

                    app.progress.update(100, i18n.t('set_nuclear_wipe_done'));
                    app.showToast(i18n.t('set_nuclear_wipe_done'), 'success');

                    setTimeout(() => {
                        app.progress.hide();
                        window.location.reload();
                    }, 1000);

                } catch (error) {
                    app.progress.hide();
                    console.error('Nuclear wipe error:', error);
                    app.showAlert('Error Crítico', 'No se pudieron borrar todos los datos: ' + error.message);
                }
            }
        );
    }

    /**
     * Maneja la creación de un nuevo usuario de staff
     */
    async handleAddStaff() {
        const nameInput = document.getElementById('staff-name');
        const roleSelect = document.getElementById('staff-role');
        const pinInput = document.getElementById('staff-pin');
        const btnFn = document.getElementById('btn-add-staff');

        if (!nameInput || !roleSelect || !pinInput) return;

        const nombre = nameInput.value.trim();
        const role = roleSelect.value;
        const pin = pinInput.value.trim();

        if (!nombre || !pin) {
            app.showToast('Nombre y PIN son obligatorios', 'error');
            return;
        }

        if (pin.length !== 4 || isNaN(pin)) {
            app.showToast('El PIN debe ser de 4 números', 'error');
            return;
        }

        try {
            if (this.editingUserId) {
                // UPDATE
                await db.saveUser({ id: this.editingUserId, nombre, role, pin, ultima_modificacion: Date.now() });
                app.showToast('Usuario actualizado', 'success');
                this.editingUserId = null;
                if (btnFn) {
                    btnFn.textContent = 'CREAR';
                    btnFn.classList.remove('btn-warning');
                    btnFn.classList.add('btn-primary');
                }
            } else {
                // CREATE
                await db.saveUser({ nombre, role, pin });
                app.showToast(`${role === 'admin' ? 'Jefe' : 'Empleado'} creado con éxito`, 'success');
            }

            nameInput.value = '';
            pinInput.value = '';
            await this.renderStaffList();
        } catch (error) {
            console.error('Error saving staff:', error);
            app.showToast('Error: El PIN ya está en uso', 'error');
        }
    }

    /**
     * Renderiza la lista de usuarios de staff
     */

    async renderStaffList() {
        const container = document.getElementById('staff-list-container');
        if (!container) {
            console.error('CRITICAL: #staff-list-container not found in DOM');
            return;
        }

        try {
            const users = await db.getAllUsers();

            // DEBUG TOAST
            if (users.length > 0) {
                // Solo mostrar toast si hay usuarios, para confirmar que la query funciona
                // app.showToast(`Cargados ${users.length} usuarios`, 'info'); 
            }

            if (users.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 10px;">No hay usuarios creados</p>';
                return;
            }

            // CSS Grid Layout for compact display
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
            container.style.gap = '8px';

            container.innerHTML = users.map(user => `
                <div style="padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 4px; position: relative;">
                    <div style="font-weight: bold; font-size: 0.9rem; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${user.nombre || 'Sin nombre'}
                    </div>
                    <div style="font-size: 0.75rem; color: #aaaaaa; display: flex; align-items: center; gap: 4px;">
                        <span>${user.role === 'admin' ? '👑' : '🛠️'}</span>
                        <span>${user.role === 'admin' ? i18n.t('role_admin') : i18n.t('role_tech')}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: #666;">PIN: ****</div>
                    
                    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <button onclick='window.settingsUI.editStaff(${JSON.stringify(user)})' style="background: transparent; border: none; color: var(--accent-color); cursor: pointer; padding: 4px; opacity: 0.8; transition: opacity 0.2s;" title="${i18n.t('btn_edit')}">
                            <span class="material-icons" style="font-size: 18px;">edit</span>
                        </button>
                        <button onclick="window.settingsUI.deleteStaff('${user.id}')" style="background: transparent; border: none; color: #ff4757; cursor: pointer; padding: 4px; opacity: 0.8; transition: opacity 0.2s;" title="${i18n.t('btn_delete')}">
                            <span class="material-icons" style="font-size: 18px;">delete</span>
                        </button>
                    </div>
                    <style>button:hover { opacity: 1 !important; transform: scale(1.1); }</style>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error rendering staff list:', error);
            container.innerHTML = `<p style="color: red;">${i18n.t('toast_error_loading')}: ${error.message}</p>`;
        }
    }

    /**
     * Elimina un usuario de staff
     */


    /**
     * Carga el usuario en el formulario para editar
     */
    editStaff(user) {
        if (!user) return;
        this.editingUserId = user.id;

        const nameInput = document.getElementById('staff-name');
        const roleSelect = document.getElementById('staff-role');
        const pinInput = document.getElementById('staff-pin');
        const btnFn = document.getElementById('btn-add-staff');

        if (nameInput) nameInput.value = user.nombre;
        if (roleSelect) roleSelect.value = user.role;
        if (pinInput) pinInput.value = user.pin;

        if (btnFn) {
            btnFn.textContent = i18n.t('btn_save').toUpperCase();
            btnFn.classList.remove('btn-primary');
            btnFn.classList.add('btn-warning'); // Color distinto para indicar edición
        }

        // Focus al nombre
        nameInput?.focus();
    }

    /**
     * Elimina un usuario de staff
     */
    async deleteStaff(id) {
        app.showConfirm(
            i18n.t('dlg_delete_confirm'),
            i18n.t('dlg_delete_warning'),
            async () => {
                try {
                    await db.deleteUser(id);
                    app.showToast(i18n.t('toast_deleted'), 'success');
                    await this.renderStaffList();
                } catch (error) {
                    console.error('Error deleting staff:', error);
                    app.showToast(i18n.t('toast_error'), 'error');
                }
            }
        );
    }
}

// Funciones globales de emergencia (Moved from HTML)
window.manualSupabaseSave = async function () {
    try {
        const url = document.getElementById('supabase-url')?.value;
        const key = document.getElementById('supabase-key')?.value;
        if (window.supabaseClient && url && key) {
            window.supabaseClient.configure(url, key);
            if (window.app?.showToast) window.app.showToast(i18n.t('toast_saved'), "success");
        }
    } catch (e) {
        console.error(e);
    }
};

window.manualSupabaseTest = async function () {
    try {
        if (window.supabaseClient) {
            const res = await window.supabaseClient.testConnection();
            if (res.success) {
                if (window.app?.showToast) window.app.showToast(i18n.t('toast_ready'), "success");
            } else {
                if (window.app?.showAlert) window.app.showAlert("Error de conexión", res.error);
            }
        }
    } catch (e) {
        console.error(e);
    }
};

// Instancia global
// Instancia global
window.settingsUI = new SettingsUI();
