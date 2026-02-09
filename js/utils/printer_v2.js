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
     * Inyecta el HTML en el contenedor y lanza el diálogo de impresión
     */
    print(html) {
        let container = document.getElementById('receipt-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'receipt-container';
            document.body.appendChild(container);
        }

        container.innerHTML = html;

        // Pequeño delay para asegurar renderizado
        setTimeout(() => {
            window.print();
        }, 500);
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
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
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
                    
                    <div class="legal-text">
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
}

// Instancia global explícita
window.printer = new Printer();
