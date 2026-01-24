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
        document.getElementById('backup-input')?.addEventListener('change', (e) => this.importBackup(e));

        // Listeners Seguridad
        document.getElementById('btn-save-pin')?.addEventListener('click', () => this.savePin());
        document.getElementById('btn-unlock')?.addEventListener('click', () => this.unlockApp());

        // Listener Borrado de Datos
        document.getElementById('btn-clear-data')?.addEventListener('click', () => this.handleClearData());

        // Listener Sincronización Local
        document.getElementById('btn-link-folder')?.addEventListener('click', () => this.handleLinkFolder());

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

            const backup = {
                version: 2,
                timestamp: Date.now(),
                data: {
                    clientes: await db.getAllClientes(),
                    reparaciones: await db.getAllReparaciones(),
                    facturas: await db.getAllFacturas()
                },
                config: {
                    company_name: await db.getConfig('company_name'),
                    company_dni: await db.getConfig('company_dni'),
                    company_address: await db.getConfig('company_address'),
                    company_email: await db.getConfig('company_email'),
                    company_phone: await db.getConfig('company_phone')
                }
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
     * Importa copia de seguridad (Soporta JSON plano, ZIP legacy, y ZIP Avanzado)
     */
    async importBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (e) => {
            const result = e.target.result;
            const arr = new Uint8Array(result);

            // Check ZIP Signature
            if (arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04) {
                try {
                    if (!window.JSZip) { app.showToast('Falta librería JSZip', 'error'); return; }

                    const zip = await JSZip.loadAsync(result);

                    // Debug: listar todos los archivos en el ZIP
                    const allFiles = Object.keys(zip.files);
                    console.log("ZIP contiene:", allFiles);

                    // Detectar tipo de backup buscando archivo CSV en carpeta data
                    // JSZip usa rutas como "data/clientes.csv"

                    // 1. Detectar formato "hybrid" de Android (CSVs en raíz + metadata.json)
                    const metadataFile = zip.file("metadata.json");
                    const rootClientesCsv = zip.file("clientes.csv");

                    if (metadataFile && rootClientesCsv) {
                        console.log("Detectado formato Hybrid (Android)");
                        await this.importHybridBackup(zip);
                        return;
                    }

                    // 2. Detectar backup Avanzado de esta web (CSVs en carpeta data/)
                    const clientesCsvFile = zip.file("data/clientes.csv");

                    if (clientesCsvFile) {
                        // Backup Avanzado (CSV)
                        console.log("Detectado Backup Avanzado (CSV)");
                        await this.importAdvancedBackup(zip);
                        return;
                    }

                    // 3. Backup Legacy o JSON dentro de ZIP
                    let jsonFile = zip.file("data.json");

                    if (!jsonFile) {
                        // Buscar cualquier JSON en el ZIP (excepto metadata.json)
                        const jsonFiles = allFiles.filter(name => name.endsWith('.json') && !name.includes('/') && name !== 'metadata.json');
                        if (jsonFiles.length > 0) {
                            jsonFile = zip.file(jsonFiles[0]);
                        }
                    }

                    if (jsonFile) {
                        const jsonStr = await jsonFile.async("string");
                        this.processImportData(JSON.parse(jsonStr));
                    } else {
                        app.showToast('Formato de ZIP no reconocido', 'error');
                    }

                } catch (err) {
                    console.error("ZIP Error:", err);
                    app.showToast('Error al leer ZIP', 'error');
                }
            } else {
                // Try Plain JSON
                const textReader = new FileReader();
                textReader.onload = (te) => {
                    try {
                        this.processImportData(JSON.parse(te.target.result));
                    } catch (err) {
                        app.showToast('Archivo inválido', 'error');
                    }
                };
                textReader.readAsText(file);
            }
        };

        reader.readAsArrayBuffer(file);
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
        try {
            // Leer CSVs desde la raíz del ZIP
            const clientesCsvFile = zip.file("clientes.csv");
            const reparaCsvFile = zip.file("reparaciones.csv");
            const facturasCsvFile = zip.file("facturas.csv");

            if (!clientesCsvFile || !reparaCsvFile || !facturasCsvFile) {
                app.showToast('Faltan archivos CSV en el backup Android', 'error');
                return;
            }

            const clientesCsv = await clientesCsvFile.async("string");
            const reparaCsv = await reparaCsvFile.async("string");
            const facturasCsv = await facturasCsvFile.async("string");

            const clientesRaw = CSVService.parse(clientesCsv);
            const reparacionesRaw = CSVService.parse(reparaCsv);
            const facturasRaw = CSVService.parse(facturasCsv);

            console.log("Clientes raw:", clientesRaw[0]);
            console.log("Reparaciones raw:", reparacionesRaw[0]);
            console.log("Facturas raw:", facturasRaw[0]);

            // Mapa de IDs antiguos (numéricos) a nuevos UUIDs
            const clientIdMap = new Map();

            // 1. MAPEAR CLIENTES
            // Android: ID, Nombre, Apellido, Telefono, DNI, Email, Direccion, Fecha Registro
            // Web: id, nombre, telefono, email, dni, direccion, fecha_creacion, ultima_modificacion
            for (const c of clientesRaw) {
                const oldId = String(c.ID || c.id || c.Id || '');
                const newId = db.generateUUID();
                clientIdMap.set(oldId, newId);

                const mapped = {
                    id: newId,
                    nombre: c.Nombre || c.nombre || '',
                    apellido: c.Apellido || c.apellido || '',
                    telefono: String(c.Telefono || c.telefono || ''),
                    email: c.Email || c.email || '',
                    dni: String(c.DNI || c.dni || c.Dni || ''),
                    direccion: c.Direccion || c.direccion || '',
                    fecha_creacion: this.parseAndroidDate(c['Fecha Registro'] || c.fecha_registro || c.fechaRegistro) || Date.now(),
                    ultima_modificacion: Date.now()
                };
                await db.saveCliente(mapped);
            }

            console.log(`Clientes mapeados: ${clientesRaw.length}`);

            // 2. MAPEAR REPARACIONES
            // Android: ID, Cliente ID, Tipo Dispositivo, Marca, Modelo, Descripcion Problema, 
            //          Descripcion Solucion, Costo Estimado, Costo Final, Estado, 
            //          Fecha Admision, Fecha Entrega, Codigo PIN, Notas
            for (const r of reparacionesRaw) {
                const oldClientId = String(r['Cliente ID'] || r.clienteId || '');
                const newClientId = clientIdMap.get(oldClientId);

                if (!newClientId) {
                    console.warn("Reparación sin cliente válido:", r, "Cliente ID buscado:", oldClientId);
                    continue;
                }

                // Mapeo de estados
                let estado = 'pendiente';
                const oldState = String(r.Estado || r.estado || '').toUpperCase();
                if (oldState === 'LISTO' || oldState === 'ENTREGADO' || oldState === 'TERMINADO' || oldState === 'COMPLETADO') {
                    estado = 'completada';
                } else if (oldState.includes('PROCESO') || oldState === 'REPARANDO') {
                    estado = 'en_proceso';
                }

                // Construir observaciones solo con notas
                let obs = r.Notas || '';

                const mapped = {
                    id: db.generateUUID(),
                    cliente_id: newClientId,
                    dispositivo: r['Tipo Dispositivo'] || r.TipoDispositivo || 'Dispositivo',
                    marca: r.Marca || r.marca || '',
                    modelo: r.Modelo || r.modelo || '',
                    problema: r['Descripcion Problema'] || r.DescripcionProblema || '',
                    descripcion: r['Descripcion Problema'] || r.DescripcionProblema || '',
                    solucion: r['Descripcion Solucion'] || r.DescripcionSolucion || '',
                    estado: estado,
                    fecha_entrada: this.parseAndroidDate(r['Fecha Admision'] || r.FechaAdmision) || Date.now(),
                    precio: parseFloat(r['Costo Estimado'] || r.CostoEstimado || 0),
                    precio_final: parseFloat(r['Costo Final'] || r.CostoFinal || 0) || null,
                    fecha_entrega: this.parseAndroidDate(r['Fecha Entrega'] || r.FechaEntrega) || null,
                    notas: obs,
                    pin: r['Codigo PIN'] || r.CodigoPin || '',
                    fecha_creacion: this.parseAndroidDate(r['Fecha Admision']) || Date.now(),
                    ultima_modificacion: Date.now()
                };
                await db.saveReparacion(mapped);
            }

            console.log(`Reparaciones mapeadas: ${reparacionesRaw.length}`);

            // 3. MAPEAR FACTURAS
            // Android: ID, Cliente ID, Numero, Fecha, Total, Archivo PDF, Notas
            for (const f of facturasRaw) {
                const oldClientId = String(f['Cliente ID'] || f.clienteId || f.ClienteId || f.cliente_id || '');
                const newClientId = clientIdMap.get(oldClientId);

                if (!newClientId) {
                    console.warn("Factura sin cliente válido:", f);
                    continue;
                }

                // Parsear items
                let items = [];
                const itemsStr = f.itemsJson || f.ItemsJson || f.items || f.Items || '';
                if (itemsStr) {
                    try {
                        const parsed = typeof itemsStr === 'string' ? JSON.parse(itemsStr) : itemsStr;
                        if (Array.isArray(parsed)) {
                            items = parsed.map(item => ({
                                descripcion: item.description || item.descripcion || item.Description || 'Item',
                                cantidad: item.quantity || item.cantidad || item.Quantity || 1,
                                precio: item.unitPrice || item.precio || item.UnitPrice || 0,
                                total: (item.quantity || item.cantidad || 1) * (item.unitPrice || item.precio || 0)
                            }));
                        }
                    } catch (e) {
                        console.warn("Error parseando items:", e);
                    }
                }

                const total = parseFloat(f.total || f.Total || 0);
                const subtotal = total / 1.21;
                const iva = total - subtotal;

                // Si no hay items, crear uno por defecto con el total
                if (items.length === 0 && total > 0) {
                    items.push({
                        descripcion: 'Servicio/Reparación',
                        cantidad: 1,
                        precio: subtotal,
                        total: subtotal
                    });
                }

                // Extraer PDF si existe en el ZIP
                let pdfData = null;
                const pdfPath = f['Archivo PDF'] || f.ArchivoPDF || '';
                if (pdfPath) {
                    try {
                        const pdfFile = zip.file(pdfPath);
                        if (pdfFile) {
                            const pdfBlob = await pdfFile.async('base64');
                            pdfData = `data:application/pdf;base64,${pdfBlob}`;
                            console.log(`PDF extraído: ${pdfPath}`);
                        }
                    } catch (e) {
                        console.warn(`Error extrayendo PDF ${pdfPath}:`, e);
                    }
                }

                const mapped = {
                    id: db.generateUUID(),
                    cliente_id: newClientId,
                    numero: f.Numero || f.numero || `FAC-${Date.now()}`,
                    fecha: this.parseAndroidDate(f.Fecha || f.fecha) || Date.now(),
                    items: items,
                    subtotal: subtotal,
                    iva: iva,
                    total: total,
                    notas: f.Notas || f.notas || f.Notes || '',
                    pdf_data: pdfData,
                    fecha_creacion: this.parseAndroidDate(f.Fecha || f.fecha) || Date.now(),
                    ultima_modificacion: Date.now()
                };
                await db.saveFactura(mapped);
            }

            console.log(`Facturas mapeadas: ${facturasRaw.length}`);

            app.showToast('Backup Android importado correctamente', 'success');
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Error importing Hybrid backup:", error);
            app.showToast('Error al importar backup Android: ' + error.message, 'error');
        }
    }

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
        if (!confirm('¿Estás seguro de que quieres BORRAR TODOS LOS DATOS? Esta acción no se puede deshacer.')) {
            return;
        }

        const confirmation = prompt('Para confirmar, escribe "BORRAR" en mayúsculas:');
        if (confirmation !== 'BORRAR') {
            app.showToast('Operación cancelada: Código incorrecto', 'error');
            return;
        }

        try {
            await db.clearAllData();
            app.showToast('Datos eliminados correctamente', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error('Error clearing data:', error);
            app.showToast('Error al eliminar datos', 'error');
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
