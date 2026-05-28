/**
 * Universal Import Module
 * Asistente de importación de Clientes e Inventario desde CSV
 */

class UniversalImportUI {
    constructor() {
        this.csvData = [];
        this.csvHeaders = [];
        this.importType = ''; // 'clients' or 'stock'
        this.mapping = {};
        this.fileInput = null;
    }

    init() {
        this.fileInput = document.getElementById('import-input-csv');
        
        // Trigger file input click
        document.getElementById('btn-trigger-import-csv')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.fileInput.value = '';
            this.fileInput.click();
        });

        // Listen for file selection
        this.fileInput?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFileSelected(e.target.files[0]);
            }
        });

        // Step 1: Type selection
        document.getElementById('btn-import-type-clients')?.addEventListener('click', () => {
            this.setImportType('clients');
        });
        document.getElementById('btn-import-type-stock')?.addEventListener('click', () => {
            this.setImportType('stock');
        });

        // Prev button on step 2
        document.getElementById('btn-import-prev')?.addEventListener('click', () => {
            this.showStep(1);
        });

        // Confirm import
        document.getElementById('btn-import-confirm')?.addEventListener('click', () => {
            this.executeImport();
        });

        // Close modal buttons
        document.querySelectorAll('[data-close-modal="modal-universal-import"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('modal-universal-import').classList.remove('active');
            });
        });
    }

    showStep(stepNum) {
        document.getElementById('import-step-1').style.display = stepNum === 1 ? 'block' : 'none';
        document.getElementById('import-step-2').style.display = stepNum === 2 ? 'block' : 'none';
        document.getElementById('import-step-3').style.display = stepNum === 3 ? 'block' : 'none';
    }

    /**
     * Reads and parses the selected CSV file
     */
    handleFileSelected(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            this.parseCSV(text);
            
            // Reset wizard states
            this.mapping = {};
            this.showStep(1);
            document.getElementById('import-success-icon').style.display = 'none';
            document.getElementById('import-progress-bar').style.width = '0%';
            document.getElementById('import-progress-percent').textContent = '0%';
            document.getElementById('import-progress-title').textContent = 'Importando datos...';
            document.getElementById('import-progress-bar').parentElement.style.display = 'block';
            document.getElementById('import-progress-percent').style.display = 'inline';

            // Open modal
            document.getElementById('modal-universal-import').classList.add('active');
        };
        reader.onerror = () => {
            app.showToast('Error al leer el archivo CSV', 'error');
        };
        reader.readAsText(file, 'UTF-8');
    }

    /**
     * Simple but robust CSV parser that handles quotes and commas
     */
    parseCSV(text) {
        const lines = [];
        let row = [""];
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            const next = text[i + 1];

            if (c === '"') {
                if (inQuotes && next === '"') {
                    row[row.length - 1] += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ',' && !inQuotes) {
                row.push("");
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') {
                    i++;
                }
                lines.push(row);
                row = [""];
            } else {
                row[row.length - 1] += c;
            }
        }
        if (row.length > 1 || row[0] !== "") {
            lines.push(row);
        }

        if (lines.length === 0) {
            this.csvHeaders = [];
            this.csvData = [];
            return;
        }

        this.csvHeaders = lines[0].map(h => h.trim());
        this.csvData = lines.slice(1).filter(r => r.some(cell => cell.trim() !== ''));
        console.log(`Parsed CSV. Headers: ${this.csvHeaders.join(', ')}. Rows: ${this.csvData.length}`);
    }

    setImportType(type) {
        this.importType = type;
        this.renderMappingWizard();
        this.showStep(2);
    }

    /**
     * Renders matching options between CSV columns and DB fields
     */
    renderMappingWizard() {
        const container = document.getElementById('import-mapping-container');
        container.innerHTML = '';

        const fields = this.getTargetFields();
        document.getElementById('import-detected-format').textContent = 
            `Format Detectado: CSV con ${this.csvHeaders.length} columnas y ${this.csvData.length} registros`;

        fields.forEach(field => {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);';

            // Try to auto-detect matching headers based on keywords
            const autoMatch = this.detectAutoMatch(field.key, this.csvHeaders);
            if (autoMatch) {
                this.mapping[field.key] = autoMatch;
            }

            const headerOptions = this.csvHeaders.map(header => {
                const selected = this.mapping[field.key] === header ? 'selected' : '';
                return `<option value="${this.escapeHtml(header)}" ${selected}>${this.escapeHtml(header)}</option>`;
            }).join('');

            div.innerHTML = `
                <div style="flex: 1;">
                    <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${field.label}</span>
                    ${field.required ? '<span style="color: var(--danger); font-size: 0.75rem; display: block;">Requerido</span>' : '<span style="color: var(--text-muted); font-size: 0.75rem; display: block;">Opcional</span>'}
                </div>
                <select class="form-select mapping-select" data-field="${field.key}" style="width: 250px;">
                    <option value="">-- Ignorar --</option>
                    ${headerOptions}
                </select>
            `;

            // Listen for changes
            div.querySelector('.mapping-select').addEventListener('change', (e) => {
                this.mapping[field.key] = e.target.value;
            });

            container.appendChild(div);
        });
    }

    /**
     * Heuristics to auto-map CSV headers to DB fields
     */
    detectAutoMatch(fieldKey, headers) {
        const keywords = {
            nombre: ['nombre', 'name', 'firstname', 'first_name', 'cliente'],
            apellido: ['apellido', 'lastname', 'last_name', 'apellidos'],
            telefono: ['telefono', 'tel', 'phone', 'mobile', 'móvil', 'movil'],
            email: ['email', 'correo', 'mail', 'contacto'],
            dni: ['dni', 'nif', 'cif', 'identificación', 'identificacion', 'documento'],
            direccion: ['direccion', 'dirección', 'address', 'calle'],
            notas: ['notas', 'observaciones', 'description', 'notas_cliente', 'comentarios'],
            
            // Stock
            name: ['nombre', 'name', 'artículo', 'articulo', 'producto', 'repuesto'],
            sku: ['sku', 'código', 'codigo', 'referencia', 'ref'],
            category: ['category', 'categoría', 'categoria', 'tipo'],
            stock: ['stock', 'cantidad', 'qty', 'inventario', 'unidades'],
            min_stock: ['min', 'mínimo', 'minimo', 'alerta', 'stock_minimo'],
            price: ['precio', 'p_venta', 'venta', 'price', 'pvp'],
            purchase_price: ['compra', 'coste', 'costo', 'p_compra', 'purchase'],
            barcode: ['barcode', 'barras', 'ean', 'upc', 'código_barras'],
            description: ['descripcion', 'descripción', 'notas', 'detalles']
        };

        const list = keywords[fieldKey] || [];
        for (const header of headers) {
            const hLower = header.toLowerCase();
            if (list.some(k => hLower.includes(k) || k.includes(hLower))) {
                return header;
            }
        }
        return '';
    }

    getTargetFields() {
        if (this.importType === 'clients') {
            return [
                { key: 'nombre', label: 'Nombre', required: true },
                { key: 'apellido', label: 'Apellidos', required: false },
                { key: 'telefono', label: 'Teléfono', required: true },
                { key: 'email', label: 'Correo Electrónico', required: false },
                { key: 'dni', label: 'CIF / NIF / DNI', required: false },
                { key: 'direccion', label: 'Dirección', required: false },
                { key: 'notas', label: 'Notas', required: false }
            ];
        } else {
            return [
                { key: 'name', label: 'Nombre del Artículo', required: true },
                { key: 'sku', label: 'SKU / Código', required: false },
                { key: 'category', label: 'Categoría', required: false },
                { key: 'stock', label: 'Cantidad en Stock', required: true },
                { key: 'min_stock', label: 'Stock Mínimo', required: false },
                { key: 'price', label: 'Precio de Venta', required: true },
                { key: 'purchase_price', label: 'Precio de Compra', required: false },
                { key: 'barcode', label: 'Código de Barras', required: false },
                { key: 'description', label: 'Descripción', required: false }
            ];
        }
    }

    /**
     * Runs the bulk import transaction
     */
    async executeImport() {
        // Validate required fields are mapped
        const fields = this.getTargetFields();
        const missing = fields.filter(f => f.required && !this.mapping[f.key]);
        if (missing.length > 0) {
            app.showToast(`Por favor mapea los campos requeridos: ${missing.map(f => f.label).join(', ')}`, 'error');
            return;
        }

        this.showStep(3);
        const progressBar = document.getElementById('import-progress-bar');
        const progressPercent = document.getElementById('import-progress-percent');
        const progressTitle = document.getElementById('import-progress-title');

        const total = this.csvData.length;
        let imported = 0;
        let errors = 0;

        // Perform import in batches of 20 to avoid locking UI
        const batchSize = 20;
        
        for (let i = 0; i < total; i += batchSize) {
            const batch = this.csvData.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (row) => {
                try {
                    const rowData = {};
                    this.csvHeaders.forEach((header, idx) => {
                        rowData[header] = row[idx] ? row[idx].trim() : '';
                    });

                    if (this.importType === 'clients') {
                        const nameHeader = this.mapping['nombre'];
                        const phoneHeader = this.mapping['telefono'];
                        
                        const nombre = rowData[nameHeader];
                        const telefono = rowData[phoneHeader] || '000000000';

                        if (!nombre) return; // Skip empty rows

                        const client = {
                            nombre: nombre,
                            apellido: this.mapping['apellido'] ? rowData[this.mapping['apellido']] : null,
                            telefono: telefono,
                            email: this.mapping['email'] ? rowData[this.mapping['email']] : null,
                            dni: this.mapping['dni'] ? rowData[this.mapping['dni']] : null,
                            direccion: this.mapping['direccion'] ? rowData[this.mapping['direccion']] : null,
                            notas: this.mapping['notas'] ? rowData[this.mapping['notas']] : null,
                            deleted: 0
                        };
                        await db.saveCliente(client);
                    } else {
                        const nameHeader = this.mapping['name'];
                        const stockHeader = this.mapping['stock'];
                        const priceHeader = this.mapping['price'];

                        const name = rowData[nameHeader];
                        if (!name) return;

                        const rawStock = this.mapping['stock'] ? rowData[stockHeader] : '0';
                        const rawPrice = this.mapping['price'] ? rowData[priceHeader] : '0';

                        // Parse numbers safely
                        const stock = parseInt(rawStock.replace(/[^\d-]/g, '')) || 0;
                        const price = parseFloat(rawPrice.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
                        const pPrice = this.mapping['purchase_price'] ? parseFloat(rowData[this.mapping['purchase_price']].replace(',', '.').replace(/[^\d.-]/g, '')) || 0 : 0;
                        const minStock = this.mapping['min_stock'] ? parseInt(rowData[this.mapping['min_stock']].replace(/[^\d-]/g, '')) || 0 : 0;

                        const product = {
                            name: name,
                            sku: this.mapping['sku'] ? rowData[this.mapping['sku']] : '',
                            category: this.mapping['category'] ? rowData[this.mapping['category']] : 'General',
                            stock: stock,
                            min_stock: minStock,
                            price: price,
                            purchase_price: pPrice,
                            barcode: this.mapping['barcode'] ? rowData[this.mapping['barcode']] : '',
                            description: this.mapping['description'] ? rowData[this.mapping['description']] : '',
                            deleted: 0
                        };
                        await db.saveProduct(product);
                    }
                    imported++;
                } catch (e) {
                    console.error('Import row error:', e);
                    errors++;
                }
            }));

            // Update UI progress
            const percent = Math.round((imported / total) * 100);
            progressBar.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}%`;
            progressTitle.textContent = `Procesando: ${imported} de ${total}...`;
            
            // Allow render thread to breath
            await new Promise(r => setTimeout(r, 30));
        }

        // Show Success
        progressTitle.textContent = 'Proceso terminado';
        document.getElementById('import-progress-bar').parentElement.style.display = 'none';
        document.getElementById('import-progress-percent').style.display = 'none';
        
        const successMsg = document.getElementById('import-success-message');
        successMsg.innerHTML = `Se han importado con éxito <b>${imported}</b> registros.<br>Errores u omisiones: <b>${errors}</b>.`;
        document.getElementById('import-success-icon').style.display = 'block';

        // Refresh lists if relevant views are active
        if (typeof navigation !== 'undefined') {
            if (navigation.getCurrentView() === 'clientes' && typeof clientsUI !== 'undefined') {
                clientsUI.render();
            } else if (navigation.getCurrentView() === 'inventory' && typeof inventoryUI !== 'undefined') {
                inventoryUI.render();
            }
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global instance initialization
window.universalImportUI = new UniversalImportUI();

// Hook to app init after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    window.universalImportUI.init();
});
