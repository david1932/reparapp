/**
 * Settings UI Module
 * Gestión de ajustes, logo y copias de seguridad
 */

class SettingsUI {
    constructor() {
        this.pin = null;
    }

    /**
     * Inicializa el módulo
     */
    async init() {
        // Cargar configuración inicial
        await this.loadSettings();

        // Listeners Logo
        document.getElementById('logo-input')?.addEventListener('change', (e) => this.handleLogoUpload(e));
        document.getElementById('btn-remove-logo')?.addEventListener('click', () => this.removeLogo());

        // Listeners Backup
        document.getElementById('btn-export-backup')?.addEventListener('click', () => this.exportBackup());
        document.getElementById('btn-export-advanced')?.addEventListener('click', () => this.exportAdvancedBackup());

        // Listeners Import Separate
        document.getElementById('backup-input-json')?.addEventListener('change', (e) => this.handleImportJson(e));
        document.getElementById('backup-input-zip')?.addEventListener('change', (e) => this.handleImportZip(e));

        // Listeners Seguridad
        document.getElementById('btn-save-pin')?.addEventListener('click', () => this.savePin());
        document.getElementById('btn-unlock')?.addEventListener('click', () => this.unlockApp());

        // Listener Borrado de Datos
        document.getElementById('btn-clear-data')?.addEventListener('click', () => this.handleClearData());

        // Listener Sincronización Local
        document.getElementById('btn-link-folder')?.addEventListener('click', () => this.handleLinkFolder());

        // Listener Deduplicación
        document.getElementById('btn-deduplicate')?.addEventListener('click', () => this.cleanDuplicates());

        // Inicializar estado de sincronización local
        this.updateLocalSyncStatus();

        // Listeners Datos Empresa (evitar recarga formulario)
        document.getElementById('form-company-data')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCompanyData();
        });

        // Lock Screen Input (Enter key)
        document.getElementById('lock-pin')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.unlockApp();
        });

        // Verificar bloqueo al inicio
        this.checkLock();
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

        if (companyName) document.getElementById('company-name').value = companyName;
        if (companyDni) document.getElementById('company-dni').value = companyDni;
        if (companyAddress) document.getElementById('company-address').value = companyAddress;
        if (companyPhone) document.getElementById('company-phone').value = companyPhone;
        if (companyEmail) document.getElementById('company-email').value = companyEmail;
    }

    /**
     * Comprueba si la app debe bloquearse
     */
    async checkLock() {
        // Solo bloquear si no estamos ya desbloqueados en esta sesión (esto es simple, se podría mejorar con sessionStorage)
        if (sessionStorage.getItem('app_unlocked') === 'true') {
            return;
        }

        const pinConfig = await db.getConfig('security_pin');
        if (pinConfig) {
            this.pin = pinConfig;
            this.lockApp();
        }
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
    unlockApp() {
        const input = document.getElementById('lock-pin');
        const error = document.getElementById('lock-error');

        if (input.value === this.pin) {
            document.getElementById('lock-screen').style.display = 'none';
            sessionStorage.setItem('app_unlocked', 'true');
            error.style.display = 'none';
        } else {
            error.style.display = 'block';
            input.value = '';
            input.focus();

            // Animación de error
            input.style.borderColor = 'var(--status-pending)';
            setTimeout(() => input.style.borderColor = 'var(--border-color)', 500);
        }
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
                app.showToast('Error al procesar la imagen', 'error');
            };
            img.src = base64;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Muestra el logo en la UI
     */
    showLogo(base64) {
        const img = document.getElementById('custom-logo-img');
        const icon = document.getElementById('default-logo-icon');
        const removeBtn = document.getElementById('btn-remove-logo');

        img.src = base64;
        img.style.display = 'block';
        icon.style.display = 'none';
        removeBtn.style.display = 'inline-block';
    }

    /**
     * Elimina el logo
     */
    async removeLogo() {
        try {
            await db.setConfig('app_logo', null);

            const img = document.getElementById('custom-logo-img');
            const icon = document.getElementById('default-logo-icon');
            const removeBtn = document.getElementById('btn-remove-logo');

            img.src = '';
            img.style.display = 'none';
            icon.style.display = 'block';
            removeBtn.style.display = 'none';
            document.getElementById('logo-input').value = ''; // Reset input

            app.showToast('Logo eliminado', 'success');
        } catch (error) {
            console.error('Error removing logo:', error);
        }
    }

    /**
     * Exporta copia de seguridad simple (JSON)
     */
    async exportBackup() {
        try {
            app.showToast('Generando copia de seguridad...', 'info');

            // Fetch data explicitly first
            const clientes = await db.getAllClientes();
            const reparaciones = await db.getAllReparaciones();
            const facturas = await db.getAllFacturas();

            // Fetch config explicitly
            const configData = {
                company_name: await db.getConfig('company_name'),
                company_dni: await db.getConfig('company_dni'),
                company_address: await db.getConfig('company_address'),
                company_email: await db.getConfig('company_email'),
                company_phone: await db.getConfig('company_phone')
            };

            const backup = {
                version: 2,
                timestamp: Date.now(),
                data: {
                    clientes: Array.isArray(clientes) ? clientes : [],
                    reparaciones: Array.isArray(reparaciones) ? reparaciones : [],
                    facturas: Array.isArray(facturas) ? facturas : []
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
        } catch (error) {
            console.error('Error exporting backup:', error);
            app.showToast('Error al exportar copia', 'error');
        }
    }

    /**
     * Exporta copia de seguridad Avanzada (CSV + PDF + ZIP)
     */
    async exportAdvancedBackup() {
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

        } catch (error) {
            console.error('Error in advanced backup:', error);
            app.showToast('Error al generar copia avanzada', 'error');
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
    async handleImportJson(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                // Validar estructura básica
                if (!json.data && !Array.isArray(json.data)) {
                    // Intento de recuperación si es un array directo de claves (el error raro del usuario)
                    if (Array.isArray(json)) {
                        app.showToast('Archivo JSON inválido: Parece una lista de claves, no datos.', 'error');
                        return;
                    }
                }

                await this.processImportData(json);
            } catch (err) {
                console.error("Error parsing JSON:", err);
                app.showToast('Error al leer el archivo JSON. Asegúrate que no está corrupto.', 'error');
            }
            // Reset input
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    /**
     * Importar ZIP Estricto
     */
    async handleImportZip(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const zip = new JSZip();
            await zip.loadAsync(file);

            // Lógica de detección de tipo de ZIP (Hybrid o Advanced)
            const metadataFile = zip.file("metadata.json");
            const rootClientesCsv = zip.file("clientes.csv");

            if (metadataFile && rootClientesCsv) {
                console.log("Detectado formato Android/Hybrid");
                await this.importHybridBackup(zip);
            } else {
                console.log("Asumiendo formato Avanzado Web");
                await this.importAdvancedBackup(zip);
            }

        } catch (err) {
            console.error("Error reading ZIP:", err);
            app.showToast('Error al leer el archivo ZIP.', 'error');
        }
        // Reset input
        event.target.value = '';
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

            console.log(`Importando: ${clientes.length} clientes, ${reparaciones.length} reparaciones, ${facturas.length} facturas`);

            // 1. Clientes
            for (const c of clientes) {
                await db.saveCliente(c);
            }

            // 2. Reparaciones
            for (const r of reparaciones) {
                await db.saveReparacion(r);
            }

            // 3. Facturas
            for (const f of facturas) {
                // Parsear items si vienen como string JSON
                if (typeof f.items === 'string') {
                    try { f.items = JSON.parse(f.items); } catch (e) { f.items = []; }
                }
                await db.saveFactura(f);
            }

            app.showToast('Datos CSV importados correctamente', 'success');
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Error importing CSV backup:", error);
            app.showToast('Error al importar CSVs: ' + error.message, 'error');
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
    async cleanDuplicates() {
        if (!confirm('Esta acción buscará clientes duplicados y borrará las versiones antiguas. ¿Continuar?')) return;

        try {
            app.showToast('Analizando duplicados...', 'info');
            const clientes = await db.getAllClientes();

            const duplicates = [];
            const processedIds = new Set();

            // Mapa para agrupar
            const groups = {};

            // 1. Agrupar por Nombre Completo (normalizado)
            for (const c of clientes) {
                const key = `${c.nombre || ''} ${c.apellido || ''}`.trim().toLowerCase();
                if (!key) continue;

                if (!groups[key]) groups[key] = [];
                groups[key].push(c);
            }

            // 2. Identificar duplicados en grupos
            for (const key in groups) {
                const group = groups[key];
                if (group.length > 1) {
                    // Ordenar por fecha modificación (más reciente primero)
                    group.sort((a, b) => b.ultima_modificacion - a.ultima_modificacion);

                    // El primero se queda (master), el resto se borran
                    const master = group[0];
                    for (let i = 1; i < group.length; i++) {
                        duplicates.push({
                            toDelete: group[i],
                            keep: master
                        });
                        processedIds.add(group[i].id);
                    }
                }
            }

            if (duplicates.length === 0) {
                app.showToast('No se encontraron duplicados', 'success');
                return;
            }

            if (!confirm(`Se encontraron ${duplicates.length} duplicados. ¿Eliminarlos ahora?`)) return;

            // 3. Eliminar y reasignar reparaciones/facturas
            let deletedCount = 0;
            for (const dup of duplicates) {
                const oldId = dup.toDelete.id;
                const newId = dup.keep.id;

                // Reasignar Reparaciones
                const reparaciones = await db.getReparacionesByCliente(oldId);
                for (const r of reparaciones) {
                    r.cliente_id = newId;
                    r.ultima_modificacion = Date.now();
                    await db.saveReparacion(r);
                }

                // Reasignar Facturas (filtro manual porque no hay método getFacturasByCliente directo expuesto o eficiente)
                const facturas = await db.getAllFacturas();
                const facturasCliente = facturas.filter(f => f.cliente_id === oldId);
                for (const f of facturasCliente) {
                    f.cliente_id = newId;
                    f.ultima_modificacion = Date.now();
                    await db.saveFactura(f);
                }

                // Eliminar Cliente duplicado
                await db.deleteCliente(oldId);
                deletedCount++;
            }

            app.showToast(`Limpieza completada: ${deletedCount} duplicados eliminados`, 'success');

            // --- NUEVO: Limpieza de Reparaciones Duplicadas ---
            const allReparaciones = await db.getAllReparaciones();
            const repGroups = {};
            let deletedRepairs = 0;

            // Agrupar por: Cliente + Dispositivo + Problema + Fecha
            for (const r of allReparaciones) {
                // Key compuesta
                const key = `${r.cliente_id}_${r.dispositivo}_${r.problema}_${r.fecha_entrada}`;
                if (!repGroups[key]) repGroups[key] = [];
                repGroups[key].push(r);
            }

            for (const key in repGroups) {
                const group = repGroups[key];
                if (group.length > 1) {
                    group.sort((a, b) => b.ultima_modificacion - a.ultima_modificacion); // Keep newest
                    const master = group[0];
                    for (let i = 1; i < group.length; i++) {
                        await db.deleteReparacion(group[i].id);
                        deletedRepairs++;
                    }
                }
            }

            if (deletedRepairs > 0) {
                app.showToast(`Eliminadas ${deletedRepairs} reparaciones duplicadas`, 'success');
            }

            // --- NUEVO: Limpieza de Facturas Duplicadas ---
            const allFacturas = await db.getAllFacturas();
            const facGroups = {};
            let deletedInvoices = 0;

            // Agrupar por: Número de Factura
            for (const f of allFacturas) {
                const key = f.numero; // El número debe ser único
                if (!facGroups[key]) facGroups[key] = [];
                facGroups[key].push(f);
            }

            for (const key in facGroups) {
                const group = facGroups[key];
                if (group.length > 1) {
                    group.sort((a, b) => b.ultima_modificacion - a.ultima_modificacion); // Keep newest
                    const master = group[0];
                    for (let i = 1; i < group.length; i++) {
                        await db.deleteFactura(group[i].id);
                        deletedInvoices++;
                    }
                }
            }

            if (deletedInvoices > 0) {
                app.showToast(`Eliminadas ${deletedInvoices} facturas duplicadas`, 'success');
            }

            // Forzar sync para subir cambios
            app.showToast('Sincronizando cambios con la nube...', 'info');
            if (window.syncManager) {
                try {
                    await window.syncManager.sync();
                } catch (err) {
                    console.error("Error auto-syncing after clean:", err);
                }
            }

            window.location.reload();

        } catch (error) {
            console.error('Error cleaning duplicates:', error);
            app.showToast('Error al limpiar duplicados', 'error');
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

    async processImportData(json) {
        try {
            // Caso 1: Backup nativo de esta App (tiene version y data.clientes)
            if (json.version && json.data && (json.data.clientes || json.data.reparaciones)) {
                await db.importData(json);
                app.showToast('Datos restaurados correctamente', 'success');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }

            // Caso 2: Backup Legacy (Android App)
            // Detectamos campos clave del JSON legacy provisto por el usuario
            if (json.clientes && Array.isArray(json.clientes) && json.reparaciones && Array.isArray(json.reparaciones)) {
                await this.importLegacyData(json);
                app.showToast('Datos antiguos importados correctamente', 'success');
                setTimeout(() => window.location.reload(), 2000);
                return;
            }

            // Unknown format
            this.showDataInspector(json);
        } catch (error) {
            console.error('Import error:', error);
            this.showDataInspector(json);
        }
    }

    async importLegacyData(json) {
        console.log("Importing legacy data...");

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
                    telefono: c.telefono || '',
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
                    dispositivo: r.tipoDispositivo || 'Dispositivo',
                    marca: r.marca || '',
                    modelo: r.modelo || '',
                    averia: r.descripcionProblema || '',
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

                // Asumimos que el total ya tiene IVA (21%)
                const finalTotal = Number(total) || 0;
                const subtotal = finalTotal / 1.21;
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
        }
        return JSON.stringify(snippet, null, 4);
    }

    /**
     * Gestiona el borrado total de datos
     */
    async handleClearData() {
        try {
            if (confirm('¡ATENCIÓN! ESTA ACCIÓN ES IRREVERSIBLE.\n\nSe borrarán TODOS los clientes, reparaciones y facturas.\nSe borrará la Nube también.\n\n¿Estás realmente seguro?')) {
                const pin = await db.getConfig('app_pin');
                if (pin) {
                    const input = prompt('Introduce el PIN de seguridad:');
                    if (input !== pin) {
                        app.showToast('PIN incorrecto', 'error');
                        return;
                    }
                }

                app.showToast('Iniciando BORRADO REAL... (Esto puede tardar)', 'info');

                // 1. Borrado Nube (Nuclear Wipe)
                if (window.supabaseClient && window.supabaseClient.isConfigured) {
                    try {
                        console.log("Wiping Cloud Data...");
                        // Borrar Facturas Cloud
                        const f = await supabaseClient.getFacturas();
                        if (f && f.length) {
                            await Promise.all(f.map(item => supabaseClient.deleteFactura(item.id)));
                        }

                        // Borrar Reparaciones Cloud
                        const r = await supabaseClient.getReparaciones();
                        if (r && r.length) {
                            await Promise.all(r.map(item => supabaseClient.deleteReparacion(item.id)));
                        }

                        // Borrar Clientes Cloud
                        const c = await supabaseClient.getClientes();
                        if (c && c.length) {
                            await Promise.all(c.map(item => supabaseClient.deleteCliente(item.id)));
                        }
                        console.log("Cloud Wipe Complete");
                    } catch (e) {
                        console.error("Error wiping cloud:", e);
                        // Continue to local wipe anyway
                    }
                }

                // 2. Borrado Local
                await db.clearAllData();

                // 3. Reset Timestamp Sync
                await db.setConfig('last_sync', 0);

                app.showToast('Sistema formateado correctamente. Base de datos vacía.', 'success');
                setTimeout(() => window.location.reload(), 2000);
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            app.showToast('Error al borrar datos', 'error');
        }
    }

    /**
     * Guarda datos de la empresa
     */
    async saveCompanyData() {
        const name = document.getElementById('company-name').value.trim();
        const dni = document.getElementById('company-dni').value.trim();
        const address = document.getElementById('company-address').value.trim();
        const phone = document.getElementById('company-phone').value.trim();
        const email = document.getElementById('company-email').value.trim();

        try {
            await db.setConfig('company_name', name);
            await db.setConfig('company_dni', dni);
            await db.setConfig('company_address', address);
            await db.setConfig('company_phone', phone);
            await db.setConfig('company_email', email);

            app.showToast('Datos de empresa guardados', 'success');
        } catch (error) {
            console.error('Error saving company data:', error);
            app.showToast('Error al guardar datos', 'error');
        }
    }

    /**
     * Maneja el proceso de vincular una carpeta local
     */
    async handleLinkFolder() {
        if (typeof fileSync === 'undefined') return;

        const result = await fileSync.linkFolder();
        if (result.success) {
            app.showToast(`Vinculado correctamente a: ${result.folderName}`, 'success');
            this.updateLocalSyncStatus();
        } else if (!result.aborted) {
            app.showToast('Error al vincular carpeta: ' + (result.error || 'Desconocido'), 'error');
        }
    }

    /**
     * Actualiza la interfaz con el estado de la sincronización local
     */
    updateLocalSyncStatus() {
        if (typeof fileSync === 'undefined') return;

        const messageEl = document.getElementById('local-sync-message');
        const btnEl = document.getElementById('btn-link-folder');

        if (!messageEl || !btnEl) return;

        if (fileSync.isLinked) {
            messageEl.textContent = `Vinculado a: ${fileSync.folderName}`;
            messageEl.style.color = 'var(--status-completada)';
            btnEl.textContent = 'Cambiar Carpeta';
        } else if (fileSync.dirHandle) {
            messageEl.textContent = 'Pendiente de permiso';
            messageEl.style.color = 'var(--status-en-proceso)';
            btnEl.textContent = 'Dar Permiso';
        } else {
            messageEl.textContent = 'No vinculado';
            messageEl.style.color = 'var(--status-pending)';
            btnEl.textContent = 'Vincular Carpeta';
        }
    }
}

// Instancia global
const settingsUI = new SettingsUI();
