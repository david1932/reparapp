/**
 * Printer Utility
 * Generación de tickets para impresora térmica (58mm)
 */

class Printer {
    constructor() {
        this.shopData = {
            name: "ReparApp Taller",
            address: "Calle Principal 123",
            phone: "600 123 456",
            website: "www.reparapp.com"
        };
    }

    /**
     * Imprime un ticket de reparación
     * @param {Object} reparacion 
     * @param {Object} cliente 
     */
    printRepairTicket(reparacion, cliente) {
        const ticketHTML = this.generateRepairTemplate(reparacion, cliente);
        this.print(ticketHTML);
    }

    /**
     * Imprime un ticket de factura
     * @param {Object} factura 
     * @param {Object} cliente 
     */
    printInvoiceTicket(factura, cliente) {
        const ticketHTML = this.generateInvoiceTemplate(factura, cliente);
        this.print(ticketHTML);
    }

    /**
     * Envía comando de apertura al cajón portamonedas
     */
    async openDrawer() {
        try {
            const printerName = await db.getConfig('pos_printer_name');
            if (!printerName) {
                console.warn('Printer name for cash drawer not configured');
                return;
            }

            if (window.api && window.api.printer) {
                const result = await window.api.printer.openDrawer(printerName);
                if (!result.success) {
                    console.error('Failed to open drawer:', result.error);
                }
            } else {
                console.warn('IPC Printer API not available');
            }
        } catch (error) {
            console.error('Error in openDrawer:', error);
        }
    }

    /**
     * Inyecta el HTML en el contenedor y lanza el diálogo de impresión
     */
    async print(html) {
        let container = document.getElementById('receipt-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'receipt-container';
            document.body.appendChild(container);
        }

        container.innerHTML = html;

        try {
            const formatType = await db.getConfig('pos_printer_type') || '58mm';
            
            if (formatType === 'a4') {
                setTimeout(() => window.print(), 500);
                return;
            }

            const connectionType = await db.getConfig('pos_connection_type') || 'system';
            const width = formatType === '80mm' ? 42 : (formatType === '57mm' ? 30 : 32);
            const rawText = this.convertToRawESC(html, width);

            if (connectionType === 'wifi') {
                const ip = await db.getConfig('pos_printer_ip');
                const port = parseInt(await db.getConfig('pos_printer_port') || '9100');
                if (ip && window.api && window.api.printer && window.api.printer.printWifi) {
                    console.log(`Printer: Direct WiFi print to ${ip}:${port}`);
                    const result = await window.api.printer.printWifi(ip, port, rawText);
                    if (result.success) {
                        app.showToast('Ticket enviado a impresora WiFi', 'success');
                        return;
                    } else {
                        console.error('WiFi print failed:', result.error);
                        app.showToast('Error de conexión WiFi: ' + result.error, 'error');
                    }
                }
            } else if (connectionType === 'bluetooth') {
                const comPort = await db.getConfig('pos_printer_com');
                if (comPort && window.api && window.api.printer && window.api.printer.printCom) {
                    console.log(`Printer: Direct Bluetooth COM print to ${comPort}`);
                    const result = await window.api.printer.printCom(comPort, rawText);
                    if (result.success) {
                        app.showToast('Ticket enviado a impresora Bluetooth', 'success');
                        return;
                    } else {
                        console.error('Bluetooth COM print failed:', result.error);
                        app.showToast('Error de puerto COM: ' + result.error, 'error');
                    }
                }
            } else {
                const printerName = await db.getConfig('pos_printer_name');
                if (printerName && window.api && window.api.printer && window.api.printer.printRaw) {
                    console.log('Printer: Direct raw system print to:', printerName);
                    const result = await window.api.printer.printRaw(printerName, rawText);
                    if (result.success) {
                        app.showToast('Ticket enviado a impresora (Directo)', 'success');
                        return;
                    } else {
                        console.error('Direct system print failed:', result.error);
                    }
                }
            }
        } catch (e) {
            console.error('Error in direct printing routing:', e);
        }

        setTimeout(() => {
            window.print();
        }, 500);
    }

    async printLabel(rep, cliente) {
        if (!rep) return;
        
        try {
            const printerName = await db.getConfig('label_printer_name') || await db.getConfig('pos_printer_name');
            if (!printerName) {
                app.showToast('Configura el nombre de la impresora de etiquetas en Ajustes', 'warning');
                return;
            }

            const shortId = rep.id.substring(0, 8).toUpperCase();
            const lines = [
                `**Equipo:** ${rep.dispositivo || ''} ${rep.marca || ''}`,
                `**Mod:** ${rep.modelo || ''}`,
                `**Cliente:** ${cliente ? cliente.nombre.substring(0, 18) : 'Cliente'}`,
                `**Tel:** ${cliente ? cliente.telefono : ''}`,
                `**Problema:** ${(rep.problema || rep.descripcion || '').substring(0, 24)}`
            ];
            
            let out = '';
            const width = 32;
            
            const center = (text) => {
                const spaces = Math.max(0, Math.floor((width - text.length) / 2));
                return ' '.repeat(spaces) + text + '\n';
            };
            
            const divider = () => '='.repeat(width) + '\n';
            
            out += '\x1b\x40'; 
            out += center(this.shopData.name.toUpperCase());
            out += divider();
            
            out += center(`ID: ${shortId}`);
            out += divider();
            
            lines.forEach(l => {
                let clean = l;
                if (l.startsWith('**')) {
                    clean = l.replace(/\*\*/g, '');
                }
                out += clean.substring(0, width) + '\n';
            });
            
            out += '\n\n\n\x1dV\x42\x00'; 
            
            let result;
            const cleanName = printerName.trim();
            
            if (window.api && window.api.printer) {
                if (cleanName.toUpperCase().startsWith('COM') && window.api.printer.printCom) {
                    console.log(`Label Printer: Routing to COM Port: ${cleanName}`);
                    result = await window.api.printer.printCom(cleanName, out);
                } else if ((cleanName.includes('.') || cleanName.startsWith('192') || cleanName.startsWith('10.')) && window.api.printer.printWifi) {
                    console.log(`Label Printer: Routing to IP: ${cleanName}`);
                    result = await window.api.printer.printWifi(cleanName, 9100, out);
                } else if (window.api.printer.printRaw) {
                    console.log(`Label Printer: Routing to System Queue: ${cleanName}`);
                    result = await window.api.printer.printRaw(cleanName, out);
                }
                
                if (result && result.success) {
                    app.showToast('Etiqueta enviada correctamente', 'success');
                } else {
                    app.showToast('Fallo al imprimir etiqueta: ' + (result ? result.error : 'error desconocido'), 'error');
                }
            } else {
                console.warn('IPC printer not available');
            }
        } catch (e) {
            console.error('Error in printLabel:', e);
            app.showToast('Error al imprimir etiqueta: ' + e.message, 'error');
        }
    }

    convertToRawESC(html, width = 32) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        let out = '';
        
        const center = (text) => {
            const spaces = Math.max(0, Math.floor((width - text.length) / 2));
            return ' '.repeat(spaces) + text + '\n';
        };
        
        const justify = (left, right) => {
            const spaces = Math.max(1, width - left.length - right.length);
            return left + ' '.repeat(spaces) + right + '\n';
        };

        const divider = () => '-'.repeat(width) + '\n';
        const doubleDivider = () => '='.repeat(width) + '\n';

        const logo = tempDiv.querySelector('.ticket-logo-text')?.textContent || '';
        if (logo) out += center(logo.toUpperCase());
        
        const metas = tempDiv.querySelectorAll('.ticket-meta');
        metas.forEach(m => {
            out += center(m.textContent);
        });
        out += divider();

        const highlight = tempDiv.querySelector('.ticket-highlight')?.textContent || '';
        if (highlight) {
            out += center(highlight);
            out += divider();
        }

        const invoiceNum = tempDiv.querySelector('.ticket-row')?.textContent || '';
        if (invoiceNum) {
            const rows = tempDiv.querySelectorAll('.ticket-row');
            rows.forEach(r => {
                const label = r.querySelector('.row-label')?.textContent || '';
                const val = r.querySelector('.row-value')?.textContent || '';
                if (label || val) out += justify(label.trim(), val.trim());
            });
            out += divider();
        }

        const sections = tempDiv.querySelectorAll('.ticket-section');
        sections.forEach(sec => {
            const title = sec.querySelector('.section-title')?.textContent || '';
            if (title) {
                out += center(`[${title.toUpperCase()}]`);
            }
            
            const textLines = sec.innerText.split('\n');
            textLines.forEach(l => {
                const clean = l.trim();
                if (clean && clean !== title) {
                    out += clean + '\n';
                }
            });
            out += divider();
        });

        const table = tempDiv.querySelector('.ticket-table');
        if (table) {
            out += center('ITEMS');
            out += divider();
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(r => {
                const cols = r.querySelectorAll('td');
                if (cols.length >= 3) {
                    const cant = cols[0].textContent.trim();
                    const desc = cols[1].textContent.trim();
                    const price = cols[2].textContent.trim();
                    
                    out += `${desc}\n`;
                    out += justify(`  Cant: ${cant}`, price);
                }
            });
            out += divider();
        }

        const totalBox = tempDiv.querySelector('.ticket-total-box');
        if (totalBox) {
            const tRows = totalBox.querySelectorAll('.ticket-row');
            tRows.forEach(r => {
                const spans = r.querySelectorAll('span');
                if (spans.length >= 2) {
                    out += justify(spans[0].textContent.trim(), spans[1].textContent.trim());
                }
            });
            
            const totalLine = totalBox.querySelector('.total-line')?.textContent || '';
            if (totalLine) {
                out += doubleDivider();
                out += center(totalLine);
                out += doubleDivider();
            }
        }

        const footer = tempDiv.querySelector('.ticket-footer');
        if (footer) {
            const footerTexts = footer.innerText.split('\n');
            footerTexts.forEach(l => {
                const clean = l.trim();
                if (clean && !clean.includes('FIRMA') && !clean.includes('Consentimiento')) {
                    out += center(clean);
                }
            });
        }
        
        out += '\n\n\n\n\x1dV\x42\x00'; 
        return out;
    }

    formatDate(timestamp) {
        if (!timestamp) return '-';
        try {
            return new Date(timestamp).toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return 'Fecha Inválida';
        }
    }

    formatCurrency(amount) {
        return app.formatPrice(amount);
    }

    /**
     * Plantilla Ticket Reparación (Resguardo)
     */
    /**
     * Plantilla Ticket Reparación (Resguardo Premium)
     */
    generateRepairTemplate(rep, cliente) {
        if (!rep || !rep.id) throw new Error('Datos de reparación inválidos');

        // Generar QR URL
        const qrData = `https://reparapp-track.com/status/${rep.id}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
        const shortId = rep.id.substring(0, 8).toUpperCase();

        return `
            <div class="ticket">
                <div class="ticket-header">
                    <h1 class="ticket-logo-text">${this.shopData?.name || 'TALLER'}</h1>
                    <div class="ticket-meta">${this.shopData?.address || ''}</div>
                    <div class="ticket-meta">${this.shopData?.phone || ''}</div>
                </div>

                <div class="ticket-highlight">
                    RESGUARDO: ${shortId}
                </div>

                <div class="ticket-section">
                    <div class="ticket-row">
                        <span class="row-label">Fecha:</span>
                        <span class="row-value">${this.formatDate(rep.fecha_creacion)}</span>
                    </div>
                    <div class="ticket-row">
                        <span class="row-label">Cliente:</span>
                        <span class="row-value" style="max-width: 60%;">${cliente ? cliente.nombre : 'Cliente Final'}</span>
                    </div>
                    ${cliente && cliente.dni ? `
                    <div class="ticket-row">
                        <span class="row-label">DNI/CIF:</span>
                        <span class="row-value">${cliente.dni}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="ticket-section">
                    <div class="section-title">DISPOSITIVO</div>
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 2px;">
                        ${rep.dispositivo || 'Equipo'} ${rep.marca || ''} ${rep.modelo || ''}
                    </div>
                    ${rep.pin ? `<div style="font-size: 10px;">PIN/Patrón: <strong>${rep.pin}</strong></div>` : ''}
                </div>

                <div class="ticket-section">
                    <div class="section-title">PROBLEMA REPORTADO</div>
                    <div style="text-align: justify; font-size: 10px;">
                        ${rep.problema || rep.descripcion}
                    </div>
                </div>

                <div class="ticket-total-box">
                    <div style="font-size: 9px; text-transform: uppercase; margin-bottom: 1mm;">Presupuesto Estimado</div>
                    <div class="total-line">${this.formatCurrency(rep.precio || 0)}</div>
                </div>

                <div class="ticket-footer">
                    <div class="scan-me-text">Escanear para consultar estado</div>
                    <div class="qr-container">
                        <img src="${qrUrl}" class="qr-img" alt="QR Estado">
                    </div>
                    
                    ${rep.signature ? `
                    <div style="margin-top: 4mm; border-top: 1px dashed #ccc; padding-top: 2mm;">
                        <div style="font-size: 8px; color: #666; margin-bottom: 2mm; text-align: center;">FIRMA DEL CLIENTE</div>
                        <div style="text-align: center;">
                            <img src="${rep.signature}" style="max-width: 100%; height: auto; max-height: 25mm;">
                        </div>
                    </div>
                    ` : ''}

                    <div class="legal-text">
                        ${rep.rgpd_accepted ? `
                        <div style="font-weight: bold; margin-bottom: 2mm;">✓ Consentimiento RGPD aceptado el ${this.formatDate(rep.rgpd_accepted_date || rep.fecha_creacion)}</div>
                        ` : ''}
                        IMPORTANTE: Es imprescindible presentar este resguardo para retirar el equipo.
                        La garantía cubre únicamente la reparación efectuada por un plazo de 3 meses.
                        Pasados 30 días del aviso, se devengarán gastos de almacenaje (1€/día).
                    </div>
                </div>
            </div>
        `;
    }


    /**
     * Plantilla Ticket Factura (Premium)
     */
    generateInvoiceTemplate(fac, cliente) {
        return `
            <div class="ticket">
                <div class="ticket-header">
                    <h1 class="ticket-logo-text">${this.shopData.name}</h1>
                    <div class="ticket-meta">NIF: B-12345678</div>
                    <div class="ticket-meta">${this.shopData.address}</div>
                </div>

                <div class="ticket-section" style="margin-bottom: 2mm;">
                    <div class="ticket-row">
                        <span class="row-label">FACTURA:</span>
                        <span class="row-value" style="font-weight: 800;">${fac.numero}</span>
                    </div>
                    <div class="ticket-row">
                        <span class="row-label">Fecha:</span>
                        <span class="row-value">${this.formatDate(fac.fecha)}</span>
                    </div>
                </div>

                <div class="ticket-section">
                    <div class="section-title">CLIENTE</div>
                    <div style="font-weight: 600;">${cliente ? cliente.nombre : 'Cliente Contado'}</div>
                    ${cliente && cliente.dni ? `<div>DNI/CIF: ${cliente.dni}</div>` : ''}
                    ${cliente && cliente.direccion ? `<div style="font-size: 9px; color: #555;">${cliente.direccion}</div>` : ''}
                </div>

                <table class="ticket-table">
                    <thead>
                        <tr>
                            <th style="width: 15%;">Cant.</th>
                            <th style="width: 60%;">Concepto</th>
                            <th class="col-price" style="width: 25%;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(fac.items || []).map(item => `
                            <tr>
                                <td style="text-align: center;">${item.cantidad}</td>
                                <td>${item.concepto}</td>
                                <td class="col-price">${this.formatCurrency(item.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="ticket-total-box">
                    <div class="ticket-row" style="margin-bottom: 1mm;">
                        <span style="font-size: 9px;">Base Imponible</span>
                        <span style="font-size: 9px;">${this.formatCurrency(fac.subtotal)}</span>
                    </div>
                    <div class="ticket-row" style="margin-bottom: 2mm;">
                        <span style="font-size: 9px;">IVA (${fac.impuestos}%)</span>
                        <span style="font-size: 9px;">${this.formatCurrency(fac.total - fac.subtotal)}</span>
                    </div>
                    <div class="total-line">TOTAL: ${this.formatCurrency(fac.total)}</div>
                </div>

                <div class="ticket-footer">
                    <div class="legal-text" style="font-size: 9px; font-weight: 600;">
                        ¡GRACIAS POR SU CONFIANZA!
                    </div>
                    <div class="legal-text" style="margin-top: 2mm;">
                        Factura simplificada según R.D. 1619/2012. 
                        Copia original. IVA incluido.
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Genera e imprime una Orden de Trabajo en formato A4/PDF
     */
    showDocumentPreview(html, title = 'Previsualización de Documento') {
        const existing = document.getElementById('document-preview-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'document-preview-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.85); display: flex; flex-direction: column;
            align-items: center; justify-content: center; z-index: 10000;
            backdrop-filter: blur(8px); padding: 20px;
        `;

        modal.innerHTML = `
            <div style="background: var(--bg-card, #1c1c1e); border: 1px solid var(--border-color, #2c2c2e); border-radius: 12px; width: 90%; max-width: 850px; height: 90%; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid var(--border-color, #2c2c2e); background: rgba(255,255,255,0.02);">
                    <h3 style="margin: 0; color: white; font-size: 1.1rem;">${title}</h3>
                    
                    <div style="display: flex; gap: 8px; align-items: center; margin-left: 20px; margin-right: auto;">
                        <button id="btn-preview-zoom-out" class="btn btn-secondary" style="padding: 4px 10px; min-width: auto; height: 28px; line-height: 1; font-weight: bold; background: rgba(255,255,255,0.05);">-</button>
                        <span id="preview-zoom-label" style="color: white; font-size: 0.8rem; min-width: 45px; text-align: center;">100%</span>
                        <button id="btn-preview-zoom-in" class="btn btn-secondary" style="padding: 4px 10px; min-width: auto; height: 28px; line-height: 1; font-weight: bold; background: rgba(255,255,255,0.05);">+</button>
                        <button id="btn-preview-fit" class="btn btn-secondary" style="padding: 4px 12px; min-width: auto; height: 28px; line-height: 1; font-size: 0.75rem; background: rgba(0, 255, 198, 0.1); color: #00ffc6; border-color: rgba(0, 255, 198, 0.2);">Ajustar al Alto</button>
                    </div>

                    <button id="btn-preview-close-top" style="background: transparent; border: none; color: var(--text-muted, #8e8e93); cursor: pointer; font-size: 1.5rem; line-height: 1;">&times;</button>
                </div>
                
                <div id="preview-body" style="flex: 1; overflow-y: auto; background: #525659; padding: 40px 20px; display: flex; justify-content: center; align-items: flex-start;">
                    <div id="preview-paper-wrapper" style="width: 100%; max-width: 210mm; display: flex; justify-content: center; transform-origin: top center; transition: transform 0.2s ease;">
                        <div id="preview-paper" style="background: white; color: #333; width: 100%; min-height: 297mm; box-shadow: 0 4px 15px rgba(0,0,0,0.5); padding: 40px; box-sizing: border-box; border-radius: 4px;">
                            ${html}
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 12px; padding: 15px 20px; border-top: 1px solid var(--border-color, #2c2c2e); background: rgba(255,255,255,0.02);">
                    <button id="btn-preview-close" class="btn btn-secondary">Cerrar</button>
                    <button id="btn-preview-print" class="btn btn-primary" style="background: #00ffc6; color: black; font-weight: bold;">
                        🖨️ Imprimir / PDF
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const paper = modal.querySelector('#preview-paper');
        const wrapper = modal.querySelector('#preview-paper-wrapper');
        const bodyContainer = modal.querySelector('#preview-body');
        
        const noPrintElements = paper.querySelectorAll('.no-print');
        noPrintElements.forEach(el => el.remove());

        // Manejo de Zoom
        let currentZoom = 1.0;

        const updateZoom = (zoom) => {
            currentZoom = Math.max(0.3, Math.min(2.0, zoom));
            wrapper.style.transform = `scale(${currentZoom})`;
            modal.querySelector('#preview-zoom-label').textContent = `${Math.round(currentZoom * 100)}%`;
            
            // Compensar altura del scroll del contenedor según la escala del papel
            const baseHeight = wrapper.offsetHeight || 1122;
            const scaledHeight = baseHeight * currentZoom;
            // Modificar la altura del contenedor virtual para habilitar scroll correcto
            const virtualSpacer = document.getElementById('preview-spacer');
            if (virtualSpacer) virtualSpacer.remove();
            
            const spacer = document.createElement('div');
            spacer.id = 'preview-spacer';
            spacer.style.height = `${scaledHeight + 80}px`;
            spacer.style.width = '1px';
            spacer.style.position = 'absolute';
            bodyContainer.appendChild(spacer);
        };

        // Forzar layout inicial para que wrapper tenga altura antes de calcular zoom
        setTimeout(() => updateZoom(1.0), 50);

        modal.querySelector('#btn-preview-zoom-in').addEventListener('click', () => {
            updateZoom(currentZoom + 0.1);
        });

        modal.querySelector('#btn-preview-zoom-out').addEventListener('click', () => {
            updateZoom(currentZoom - 0.1);
        });

        modal.querySelector('#btn-preview-fit').addEventListener('click', () => {
            const viewportHeight = bodyContainer.clientHeight;
            const paperHeight = wrapper.offsetHeight || 1122;
            const fitZoom = (viewportHeight - 80) / paperHeight;
            updateZoom(fitZoom);
        });

        modal.querySelector('#btn-preview-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#btn-preview-close-top').addEventListener('click', () => modal.remove());
        modal.querySelector('#btn-preview-print').addEventListener('click', () => {
            modal.remove();
            this.printHTMLviaIframe(html);
        });
    }

    printHTMLviaIframe(html) {
        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }
        
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
        
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 500);
    }

    async printWorkOrderPDF(rep, cliente) {
        if (!rep || !rep.id) return;
        const shortId = rep.id.substring(0, 8).toUpperCase();
        
        const companyName = (await db.getConfig('company_name')) || 'Mi Empresa de Reparaciones';
        const companyDni = (await db.getConfig('company_dni')) || '';
        const companyAddress = (await db.getConfig('company_address')) || 'Calle Principal, 123';
        const companyPhone = (await db.getConfig('company_phone')) || '91 123 45 67';
        const companyEmail = (await db.getConfig('company_email')) || 'contacto@ejemplo.com';
        const logo = await db.getConfig('app_logo');
        const terms = (await db.getConfig('tpl_terms')) || 'Términos y condiciones por defecto del taller...';

        const checklistHtml = Object.entries(rep.checklist || {})
            .map(([k, v]) => `<div class="check-item">${v ? '☑' : '☒'} ${k.replace('chk-', '').toUpperCase()}</div>`)
            .join('');

        const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Orden de Trabajo ${shortId}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; font-size: 13px; }
                    .header-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
                    .header-logo img { max-width: 150px; max-height: 80px; display: block; }
                    .header-title h1 { margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; }
                    .header-meta { text-align: right; background: #f5f5f5; padding: 10px; border-radius: 4px; border: 1px solid #ddd; }
                    .header-meta p { margin: 2px 0; font-weight: bold; }
                    .info-container { display: flex; justify-content: space-between; margin-bottom: 25px; gap: 30px; }
                    .info-col { flex: 1; }
                    .info-col h3 { margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
                    .name { font-size: 15px; font-weight: bold; margin-bottom: 5px; }
                    .detail-box { background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 12px; margin-bottom: 20px; }
                    .detail-box h4 { margin: 0 0 8px 0; text-transform: uppercase; font-size: 12px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; }
                    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
                    .detail-row { display: flex; justify-content: space-between; }
                    .detail-label { font-weight: bold; color: #555; }
                    .checklist-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px; font-size: 11px; }
                    .check-item { display: flex; align-items: center; gap: 4px; }
                    .legal-terms { font-size: 10px; color: #666; text-align: justify; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #fafafa; margin-top: 30px; max-height: 150px; overflow: hidden; }
                    .signature-section { display: flex; justify-content: space-between; margin-top: 40px; }
                    .signature-box { width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 10px; font-size: 11px; }
                    .signature-img { max-height: 80px; display: block; margin: 5px auto; }
                    @media print {
                        .no-print { display: none !important; }
                        body { margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="header-logo">
                        ${logo ? `<img src="${logo}" alt="Logo">` : '<div style="font-size: 20px; font-weight: bold; color: #ccc;">LOGO</div>'}
                    </div>
                    <div class="header-title">
                        <h1>ORDEN DE TRABAJO</h1>
                    </div>
                    <div class="header-meta">
                        <p>Nº Orden: ${shortId}</p>
                        <p>Fecha: ${this.formatDate(rep.fecha_creacion)}</p>
                    </div>
                </div>

                <div class="info-container">
                    <div class="info-col">
                        <h3>Taller / Emisor:</h3>
                        <div class="name">${this.escapeHtml(companyName)}</div>
                        <p>${this.escapeHtml(companyAddress)}</p>
                        ${companyDni ? `<p>NIF/CIF: ${this.escapeHtml(companyDni)}</p>` : ''}
                        <p>Tel: ${this.escapeHtml(companyPhone)}</p>
                        <p>Email: ${this.escapeHtml(companyEmail)}</p>
                    </div>
                    <div class="info-col">
                        <h3>Cliente:</h3>
                        <div class="name">${cliente ? this.escapeHtml(cliente.nombre) : 'Cliente Final'}</div>
                        ${cliente && cliente.dni ? `<p>DNI/NIF: ${this.escapeHtml(cliente.dni)}</p>` : ''}
                        ${cliente && cliente.direccion ? `<p>Dirección: ${this.escapeHtml(cliente.direccion)}</p>` : ''}
                        ${cliente && cliente.telefono ? `<p>Teléfono: ${this.escapeHtml(cliente.telefono)}</p>` : ''}
                        ${cliente && cliente.email ? `<p>Email: ${this.escapeHtml(cliente.email)}</p>` : ''}
                    </div>
                </div>

                <div class="detail-box">
                    <h4>Datos del Dispositivo y Recepción</h4>
                    <div class="detail-grid">
                        <div class="detail-row"><span class="detail-label">Dispositivo:</span> <span>${this.escapeHtml(rep.dispositivo || 'Genérico')}</span></div>
                        <div class="detail-row"><span class="detail-label">Marca/Modelo:</span> <span>${this.escapeHtml(rep.marca || '')} ${this.escapeHtml(rep.modelo || '')}</span></div>
                        <div class="detail-row"><span class="detail-label">Nº Serie/IMEI:</span> <span>${this.escapeHtml(rep.serial_imei || 'N/D')}</span></div>
                        <div class="detail-row"><span class="detail-label">Código de Desbloqueo:</span> <span>${this.escapeHtml(rep.pin || 'N/D')}</span></div>
                    </div>
                    <div style="margin-top: 15px;">
                        <span class="detail-label">Problema / Avería Reportada:</span>
                        <p style="margin: 5px 0 0 0; background: #fff; border: 1px solid #eee; padding: 8px; border-radius: 4px;">${this.escapeHtml(rep.problema || rep.descripcion || 'Sin descripción')}</p>
                    </div>
                    ${checklistHtml ? `
                    <div style="margin-top: 15px;">
                        <span class="detail-label">Checklist de Recepción:</span>
                        <div class="checklist-grid">${checklistHtml}</div>
                    </div>` : ''}
                </div>

                <div class="legal-terms">
                    <strong>CLÁUSULAS Y PROTECCIÓN DE DATOS:</strong><br>
                    ${this.escapeHtml(terms)}
                </div>

                <div class="signature-section">
                    <div class="signature-box" style="border: none;">
                        Firma del Taller
                    </div>
                    <div class="signature-box">
                        Firma del Cliente
                        ${rep.signature ? `<img class="signature-img" src="${rep.signature}" alt="Firma Cliente">` : '<div style="height: 60px;"></div>'}
                        ${rep.rgpd_accepted_date ? `<div style="font-size: 8px; color: #888;">Aceptado el ${this.formatDate(new Date(rep.rgpd_accepted_date).getTime())}</div>` : ''}
                    </div>
                </div>

                <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 1000;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #00ffc6; color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">🖨️ Imprimir PDF</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 10px;">Cerrar</button>
                </div>
            </body>
            </html>
        `;

        this.showDocumentPreview(html, 'Previsualizar Orden de Trabajo - ' + shortId);
    }

    /**
     * Genera e imprime un Presupuesto de Reparación en formato A4/PDF
     */
    async printBudgetPDF(rep, cliente) {
        if (!rep || !rep.id) return;
        const shortId = rep.id.substring(0, 8).toUpperCase();

        const companyName = (await db.getConfig('company_name')) || 'Mi Empresa de Reparaciones';
        const companyDni = (await db.getConfig('company_dni')) || '';
        const companyAddress = (await db.getConfig('company_address')) || 'Calle Principal, 123';
        const companyPhone = (await db.getConfig('company_phone')) || '91 123 45 67';
        const companyEmail = (await db.getConfig('company_email')) || 'contacto@ejemplo.com';
        const logo = await db.getConfig('app_logo');

        let lineasHtml = '';
        const parts = rep.parts || [];
        
        // Agregar repuestos si los hay
        parts.forEach(p => {
            lineasHtml += `
                <tr>
                    <td>${this.escapeHtml(p.nombre)} (Repuesto)</td>
                    <td style="text-align: center;">${p.cantidad}</td>
                    <td style="text-align: right;">${this.formatCurrency(p.precio)}</td>
                    <td style="text-align: right;">${this.formatCurrency(p.cantidad * p.precio)}</td>
                </tr>
            `;
        });

        // Agregar mano de obra
        const precioPiezas = parts.reduce((acc, curr) => acc + (curr.cantidad * curr.precio), 0);
        const manoDeObra = Math.max(0, (rep.precio_final || rep.precio) - precioPiezas);
        
        if (manoDeObra > 0 || parts.length === 0) {
            lineasHtml += `
                <tr>
                    <td>Mano de Obra / Diagnóstico Técnico</td>
                    <td style="text-align: center;">1</td>
                    <td style="text-align: right;">${this.formatCurrency(manoDeObra || rep.precio)}</td>
                    <td style="text-align: right;">${this.formatCurrency(manoDeObra || rep.precio)}</td>
                </tr>
            `;
        }

        const total = rep.precio_final || rep.precio;
        const subtotal = total / 1.21; // Asumiendo 21% IVA
        const iva = total - subtotal;

        const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Presupuesto ${shortId}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; font-size: 13px; }
                    .header-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #00c6ff; padding-bottom: 15px; }
                    .header-logo img { max-width: 150px; max-height: 80px; display: block; }
                    .header-title h1 { margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; color: #007bff; }
                    .header-meta { text-align: right; background: #f5f5f5; padding: 10px; border-radius: 4px; border: 1px solid #ddd; }
                    .header-meta p { margin: 2px 0; font-weight: bold; }
                    .info-container { display: flex; justify-content: space-between; margin-bottom: 25px; gap: 30px; }
                    .info-col { flex: 1; }
                    .info-col h3 { margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
                    .name { font-size: 15px; font-weight: bold; margin-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
                    th { background-color: #f2f2f2; font-weight: bold; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; }
                    td { padding: 8px; border-bottom: 1px solid #eee; }
                    .totals-container { display: flex; justify-content: flex-end; }
                    .totals-box { width: 250px; }
                    .total-row { display: flex; justify-content: space-between; padding: 4px 0; }
                    .total-row.final { font-weight: bold; font-size: 16px; border-top: 1px solid #333; margin-top: 5px; padding-top: 5px; }
                    .validez { margin-top: 30px; font-size: 11px; color: #666; font-style: italic; }
                    @media print {
                        .no-print { display: none !important; }
                        body { margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="header-logo">
                        ${logo ? `<img src="${logo}" alt="Logo">` : '<div style="font-size: 20px; font-weight: bold; color: #ccc;">LOGO</div>'}
                    </div>
                    <div class="header-title">
                        <h1>PRESUPUESTO</h1>
                    </div>
                    <div class="header-meta">
                        <p>Nº Presupuesto: PRES-${shortId}</p>
                        <p>Fecha: ${this.formatDate(Date.now())}</p>
                    </div>
                </div>

                <div class="info-container">
                    <div class="info-col">
                        <h3>Emisor:</h3>
                        <div class="name">${this.escapeHtml(companyName)}</div>
                        <p>${this.escapeHtml(companyAddress)}</p>
                        ${companyDni ? `<p>NIF/CIF: ${this.escapeHtml(companyDni)}</p>` : ''}
                        <p>Tel: ${this.escapeHtml(companyPhone)}</p>
                        <p>Email: ${this.escapeHtml(companyEmail)}</p>
                    </div>
                    <div class="info-col">
                        <h3>Cliente:</h3>
                        <div class="name">${cliente ? this.escapeHtml(cliente.nombre) : 'Cliente Final'}</div>
                        ${cliente && cliente.dni ? `<p>DNI/NIF: ${this.escapeHtml(cliente.dni)}</p>` : ''}
                        ${cliente && cliente.direccion ? `<p>Dirección: ${this.escapeHtml(cliente.direccion)}</p>` : ''}
                        ${cliente && cliente.telefono ? `<p>Teléfono: ${this.escapeHtml(cliente.telefono)}</p>` : ''}
                        ${cliente && cliente.email ? `<p>Email: ${this.escapeHtml(cliente.email)}</p>` : ''}
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <strong>Equipo a reparar:</strong> ${this.escapeHtml(rep.dispositivo || 'Genérico')} ${this.escapeHtml(rep.marca || '')} ${this.escapeHtml(rep.modelo || '')} 
                    ${rep.serial_imei ? `(S/N: ${this.escapeHtml(rep.serial_imei)})` : ''}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th style="width: 60px; text-align: center;">Cant.</th>
                            <th style="width: 100px; text-align: right;">Precio</th>
                            <th style="width: 100px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineasHtml}
                    </tbody>
                </table>

                <div class="totals-container">
                    <div class="totals-box">
                        <div class="total-row">
                            <span>Base Imponible:</span>
                            <span>${this.formatCurrency(subtotal)}</span>
                        </div>
                        <div class="total-row">
                            <span>IVA (21%):</span>
                            <span>${this.formatCurrency(iva)}</span>
                        </div>
                        <div class="total-row final">
                            <span>TOTAL PRESUPUESTO:</span>
                            <span>${this.formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>

                <div class="validez">
                    * Este presupuesto tiene una validez de 15 días a partir de la fecha de emisión.<br>
                    * Los precios incluyen IVA.
                </div>

                <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 1000;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">🖨️ Imprimir Presupuesto</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 10px;">Cerrar</button>
                </div>
            </body>
            </html>
        `;

        this.showDocumentPreview(html, 'Previsualizar Presupuesto - PRES-' + shortId);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Instancia global explícita
window.printer = new Printer();
