/**
 * Manager UI Module
 * Gestión Fiscal, Gastos y OCR
 */
class ManagerUI {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.currentQuarter = this.getQuarter(new Date());
    }

    async init() {
        this.renderFilters();
        this.setupListeners();
        this.checkAccess(); // Verify PIN on enter
        await this.loadSettings();
        await this.renderDashboard(); // Fix: Load data on startup
    }

    async loadSettings() {
        const accountingMode = await db.getConfig('accounting_mode') || 'spain';
        const annualView = await db.getConfig('gestor_annual_view');
        const intlToggle = document.getElementById('gestor-intl-mode');
        const reportToggle = document.getElementById('gestor-report-view');

        // Logic sync: if mode is international, force toggle but keep db state
        if (intlToggle) intlToggle.checked = accountingMode === 'international';
        if (reportToggle) reportToggle.checked = annualView === true || annualView === 'true';

        this.applyInternationalMode(accountingMode === 'international');
    }

    async applyInternationalMode(isIntl) {
        const taxLabel = await db.getConfig('intl_tax_label') || i18n.t('ges_default_tax_label');
        const retLabel = await db.getConfig('intl_ret_label') || i18n.t('ges_default_ret_label');

        const ivaPayLabels = document.querySelectorAll('.label-iva-pay');
        const irpfLabels = document.querySelectorAll('.label-irpf');
        const netResultLabels = document.querySelectorAll('.label-net-result');
        const breakdownLabels = document.querySelectorAll('.label-breakdown');

        ivaPayLabels.forEach(el => {
            el.textContent = isIntl ? `${taxLabel} a Pagar` : i18n.t('ges_tax_iva_pay');
        });

        irpfLabels.forEach(el => {
            el.textContent = isIntl ? retLabel : i18n.t('ges_tax_irpf');
        });

        // Update table headers if visible
        const thIva = document.querySelector('th[data-i18n="ges_th_tax"]');
        if (thIva) thIva.textContent = isIntl ? taxLabel : i18n.t('ges_th_tax');

        netResultLabels.forEach(el => {
            el.textContent = isIntl ? i18n.t('ges_net_result_intl') : i18n.t('ges_net_result');
        });

        breakdownLabels.forEach(el => {
            el.textContent = isIntl ? `${i18n.t('ges_iva_breakdown_intl')} (${taxLabel})` : i18n.t('ges_iva_breakdown');
        });
    }

    async exportMonthData() {
        // Granular selection: show a prompt or just use the current select
        const monthSelect = document.getElementById('export-month-select');
        const month = monthSelect ? parseInt(monthSelect.value) : new Date().getMonth() + 1;
        await this.exportData('month', month);
    }

    async exportQuarterData() {
        const quarter = this.currentQuarter;
        await this.exportData('quarter', quarter);
    }

    async exportYearData() {
        await this.exportData('year', this.currentYear);
    }

    async exportData(periodType, periodValue) {
        try {
            app.showToast('Generando exportación...', 'info');

            const allGastos = await db.getAllGastos();
            const allFacturas = await db.getAllFacturas();
            const allExtra = await db.getAllIngresosExtra();

            let filteredGastos = [];
            let filteredIngresos = [];

            if (periodType === 'month') {
                const month = parseInt(periodValue);
                filteredGastos = allGastos.filter(g => {
                    const d = new Date(g.fecha);
                    return d.getMonth() + 1 === month && d.getFullYear() === this.currentYear;
                });
                filteredIngresos = [
                    ...allFacturas.filter(f => {
                        const d = new Date(f.fecha);
                        return d.getMonth() + 1 === month && d.getFullYear() === this.currentYear && !f.excluded_from_accounting;
                    }),
                    ...allExtra.filter(i => {
                        const d = new Date(i.fecha);
                        return d.getMonth() + 1 === month && d.getFullYear() === this.currentYear;
                    })
                ];
            } else if (periodType === 'quarter') {
                filteredGastos = allGastos.filter(g => g.trimestre === periodValue && g.anio === this.currentYear);
                filteredIngresos = [
                    ...allFacturas.filter(f => f.trimestre === periodValue && f.anio === this.currentYear && !f.excluded_from_accounting),
                    ...allExtra.filter(i => i.trimestre === periodValue && i.anio === this.currentYear)
                ];
            } else {
                filteredGastos = allGastos.filter(g => g.anio === this.currentYear);
                filteredIngresos = [
                    ...allFacturas.filter(f => f.anio === this.currentYear && !f.excluded_from_accounting),
                    ...allExtra.filter(i => i.anio === this.currentYear)
                ];
            }

            const data = {
                periodType,
                periodValue,
                year: this.currentYear,
                gastos: filteredGastos,
                ingresos: filteredIngresos,
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gestor_export_${periodType}_${periodValue}_${this.currentYear}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            app.showToast('Exportación completada', 'success');
        } catch (error) {
            console.error('Export error:', error);
            app.showToast('Error en exportación: ' + error.message, 'error');
        }
    }

    setupListeners() {
        // Tab Switching (Gestor-specific)
        document.querySelectorAll('#gestor-tabs [data-subtab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#gestor-tabs [data-subtab]').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.gestor-subtab').forEach(t => t.style.display = 'none');

                e.target.classList.add('active');
                document.getElementById(e.target.dataset.subtab).style.display = 'block';
            });
        });

        // International Mode Toggle (Simplified, now delegates to Settings for full config)
        const intlToggle = document.getElementById('gestor-intl-mode');
        if (intlToggle) {
            intlToggle.addEventListener('change', async (e) => {
                const isIntl = e.target.checked;
                await db.saveConfig('accounting_mode', isIntl ? 'international' : 'spain');
                this.renderDashboard();
                this.applyInternationalMode(isIntl);
            });
        }

        // Report View Toggle (Monthly/Annual)
        const reportToggle = document.getElementById('gestor-report-view');
        if (reportToggle) {
            reportToggle.addEventListener('change', async (e) => {
                const isAnnual = e.target.checked;
                await db.saveConfig('gestor_annual_view', isAnnual);
                this.renderDashboard();
            });
        }

        // Export Buttons
        document.getElementById('btn-export-month')?.addEventListener('click', () => this.exportMonthData());
        document.getElementById('btn-export-quarter')?.addEventListener('click', () => this.exportQuarterData());
        document.getElementById('btn-export-year')?.addEventListener('click', () => this.exportYearData());

        // Add Concept Row
        document.getElementById('btn-add-concepto-row')?.addEventListener('click', () => {
            this.addConceptRow();
        });

        // Add Gasto
        document.getElementById('btn-add-gasto')?.addEventListener('click', () => {
            this.openModal();
        });

        // Add Ingreso
        document.getElementById('btn-add-ingreso')?.addEventListener('click', () => {
            this.addManualIncome();
        });

        // Form Gasto
        document.getElementById('form-gasto')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGasto();
        });

        // Close Modal Gasto
        document.querySelectorAll('[data-close-modal="modal-gasto"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // Form Ingreso
        document.getElementById('form-ingreso')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveIngreso();
        });

        // Close Modal Ingreso
        document.querySelectorAll('[data-close-modal="modal-ingreso"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeIngresoModal());
        });

        // Auto-update Quarter when Ingreso Date changes
        document.getElementById('ingreso-fecha')?.addEventListener('change', (e) => {
            const date = new Date(e.target.value);
            if (!isNaN(date)) {
                document.getElementById('ingreso-trimestre').value = this.getQuarter(date);
                document.getElementById('ingreso-anio').value = date.getFullYear();
            }
        });

        // Auto-calc IVA/IRPF/Total when Ingreso values change
        document.getElementById('ingreso-base')?.addEventListener('input', () => this.calcIngresoBreakdown());
        document.getElementById('ingreso-iva-type')?.addEventListener('change', () => this.calcIngresoBreakdown());
        document.getElementById('ingreso-irpf-type')?.addEventListener('change', () => this.calcIngresoBreakdown());


        // Auto-calc Base/IVA when Total changes
        document.getElementById('gasto-total')?.addEventListener('input', () => this.calcBreakdown());
        document.getElementById('gasto-iva-type')?.addEventListener('change', () => this.calcBreakdown());

        // Auto-update Quarter when Date changes
        document.getElementById('gasto-fecha')?.addEventListener('change', (e) => {
            const date = new Date(e.target.value);
            if (!isNaN(date)) {
                // Only update if not manually set? better to auto-update always on date change
                document.getElementById('gasto-trimestre').value = this.getQuarter(date);
                document.getElementById('gasto-anio').value = date.getFullYear();
            }
        });

        // OCR Stuff (New UI Logic)
        const btnWebcam = document.getElementById('btn-ocr-webcam');
        if (btnWebcam) {
            btnWebcam.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleWebcamButton();
            });
        }

        // El input file listener se mantiene igual, aunque el botón 'btn-ocr-upload' ahora solo hace click() en él
        document.getElementById('ocr-file-input')?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                this.handleOCRFile(file);
            }
        });

        // Filter Changes
        document.getElementById('gestor-quarter')?.addEventListener('change', (e) => {
            this.currentQuarter = e.target.value;
            this.renderDashboard();
        });
        document.getElementById('gestor-year')?.addEventListener('change', (e) => {
            this.currentYear = parseInt(e.target.value);
            this.renderDashboard();
        });
    }

    // Custom Confirm Dialog
    // Force close any invisible overlay blocking the screen
    forceResetModals() {
        document.querySelectorAll('.modal-overlay').forEach(el => {
            if (!el.classList.contains('active')) {
                el.style.pointerEvents = 'none'; // Ensure invisible overlays are click-through
            }
        });
    }

    // New Sync Method
    async syncIngresos() {
        const btn = document.getElementById('btn-sync-ingresos');
        if (btn) {
            btn.style.transition = 'transform 0.5s';
            btn.style.transform = 'rotate(360deg)';
        }

        // Force refresh data
        await this.renderDashboard();

        if (btn) {
            setTimeout(() => btn.style.transform = 'none', 500);
        }
        app.showToast(i18n.t('ges_sync_success'), 'success');
    }

    // Custom Confirm Dialog
    // Custom Confirm Dialog - Bulletproof Version
    confirm(message) {
        this.forceResetModals();

        return new Promise((resolve) => {
            const modal = document.getElementById('modal-confirm');
            const btnOk = document.getElementById('btn-confirm-ok');
            const btnCancel = document.getElementById('btn-confirm-cancel');
            const msg = document.getElementById('confirm-message');

            if (!modal || !btnOk) {
                // Fallback if elements are missing
                resolve(window.confirm(message));
                return;
            }

            msg.textContent = message;
            modal.classList.add('active');

            // FORCE STYLES (Fix z-index/pointer-events issues)
            btnOk.style.position = 'relative'; // Crucial for z-index
            btnOk.style.zIndex = '20000';
            btnOk.style.pointerEvents = 'auto'; // Force clickable
            btnOk.style.cursor = 'pointer';

            btnCancel.style.position = 'relative';
            btnCancel.style.zIndex = '20000';
            btnCancel.style.pointerEvents = 'auto';

            const cleanup = () => {
                modal.classList.remove('active');
                btnOk.onclick = null;
                btnCancel.onclick = null;
            };

            btnOk.onclick = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                cleanup();
                resolve(true);
            };

            btnCancel.onclick = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                cleanup();
                resolve(false);
            };
        });
    }




    async checkAccess() {
        // Simple check, can be expanded
        const lock = document.getElementById('nav-gestor');
        if (lock) {
            lock.addEventListener('click', async (e) => {
                // Determine if we need PIN
                const pin = await db.getConfig('app_pin');
                if (pin) {
                    const input = await app.showPrompt({
                        title: i18n.t('ges_access_title'),
                        message: i18n.t('ges_access_msg'),
                        placeholder: '****',
                        inputType: 'password',
                        icon: '🔒'
                    });
                    if (input !== pin) {
                        app.showInfoModal({
                            type: 'warning',
                            title: i18n.t('ges_access_denied_title'),
                            message: i18n.t('ges_access_denied_msg')
                        });
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation(); // Ensure we stop navigation
                        return false;
                    }
                }
            }, true); // CAPTURE PHASE: Run this BEFORE navigation.js
        }
    }

    /**
     * Determine Quarter: 1T, 2T, 3T, 4T
     */
    getQuarter(date) {
        const month = date.getMonth() + 1; // 1-12
        if (month <= 3) return '1T';
        if (month <= 6) return '2T';
        if (month <= 9) return '3T';
        return '4T';
    }

    /**
     * Format price with global currency
     */
    formatPrice(precio) {
        return app.formatPrice(precio);
    }

    renderFilters() {
        const selQ = document.getElementById('gestor-quarter');
        const selY = document.getElementById('gestor-year');
        if (!selQ || !selY) return;

        selQ.innerHTML = `
            <option value="1T">${i18n.t('ges_q1')}</option>
            <option value="2T">${i18n.t('ges_q2')}</option>
            <option value="3T">${i18n.t('ges_q3')}</option>
            <option value="4T">${i18n.t('ges_q4')}</option>
        `;
        selQ.value = this.currentQuarter;

        const currentY = new Date().getFullYear();
        selY.innerHTML = `
            <option value="${currentY}">${currentY}</option>
            <option value="${currentY - 1}">${currentY - 1}</option>
        `;
        selY.value = this.currentYear;
    }

    addConceptRow(value = '') {
        const container = document.getElementById('gasto-conceptos-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'concepto-row';
        div.style.cssText = 'display:flex; gap:5px; align-items:center;';

        div.innerHTML = `
            <input type="text" class="form-input concepto-input" placeholder="${i18n.t('ges_th_concept')}..." value="${value.replace(/"/g, '&quot;')}">
            <button type="button" class="btn-del-row" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:1.2rem; padding:0 5px;">×</button>
        `;

        div.querySelector('.btn-del-row').addEventListener('click', () => {
            if (container.children.length > 1) {
                div.remove();
            } else {
                div.querySelector('input').value = ''; // Don't remove last one, just clear
            }
        });

        container.appendChild(div);

        // Focus if empty (manual add)
        if (!value) {
            const input = div.querySelector('input');
            if (input) setTimeout(() => input.focus(), 50);
        }
    }

    async openModal() {
        document.getElementById('modal-gasto').classList.add('active');
        document.getElementById('form-gasto').reset();
        await this.populateTaxOptions('gasto');

        // Reset Concept Container
        const container = document.getElementById('gasto-conceptos-container');
        if (container) {
            container.innerHTML = '';
            this.addConceptRow(); // Add one empty
        }

        // Defaults
        const now = new Date();
        document.getElementById('gasto-fecha').value = now.toISOString().split('T')[0];
        document.getElementById('gasto-trimestre').value = this.getQuarter(now);
        document.getElementById('gasto-anio').value = now.getFullYear();

        // Clear ID & Manual Clear (More robust than reset)
        document.getElementById('gasto-id').value = '';
        document.getElementById('gasto-proveedor').value = '';
        document.getElementById('gasto-nif').value = '';
        document.getElementById('gasto-total').value = '';

        // Categoría default
        if (document.getElementById('gasto-categoria')) document.getElementById('gasto-categoria').selectedIndex = 0;

        // Reset calculated display fields explicitly
        document.getElementById('gasto-calc-base').textContent = `0.00 ${window.app_currency || '€'}`;
        document.getElementById('gasto-calc-iva').textContent = `0.00 ${window.app_currency || '€'}`;

        // Focus first field
        document.getElementById('gasto-fecha').focus();

        this.calcBreakdown();
    }

    closeModal() {
        document.getElementById('modal-gasto').classList.remove('active');
        this.stopCamera(); // Stop camera if running
    }

    calcBreakdown() {
        const totalEl = document.getElementById('gasto-total');
        const rateEl = document.getElementById('gasto-iva-type');

        if (!totalEl || !rateEl) return;

        const total = parseFloat(totalEl.value) || 0;
        const rate = parseFloat(rateEl.value) || 0;

        // Total = Base * (1 + rate/100) -> Base = Total / (1 + rate/100)
        const base = total / (1 + rate / 100);
        const iva = total - base;

        const baseEl = document.getElementById('gasto-calc-base');
        const ivaEl = document.getElementById('gasto-calc-iva');

        if (baseEl) baseEl.textContent = this.formatPrice(base);
        if (ivaEl) ivaEl.textContent = this.formatPrice(iva);
    }

    async saveGasto() {
        const fechaEl = document.getElementById('gasto-fecha');
        const totalEl = document.getElementById('gasto-total');
        const rateEl = document.getElementById('gasto-iva-type');
        const provEl = document.getElementById('gasto-proveedor');
        const catEl = document.getElementById('gasto-categoria'); // Defined here

        if (!fechaEl || !totalEl || !rateEl) {
            console.error("Missing Gasto Form Elements");
            app.showToast(i18n.t('ges_error_form'), 'error');
            return;
        }

        const fechaVal = fechaEl.value;
        const total = parseFloat(totalEl.value) || 0;
        const rate = parseFloat(rateEl.value) || 0;

        const base = total / (1 + rate / 100);
        const iva = total - base;

        const irpfEl = document.getElementById('gasto-deducible-irpf');
        const idVal = document.getElementById('gasto-id').value;

        // Gather items
        const rawItems = Array.from(document.querySelectorAll('.concepto-input'))
            .map(i => i.value.trim())
            .filter(v => v.length > 0);

        const finalConcepto = rawItems.length > 0 ? rawItems.join('\n') : i18n.t('ges_default_concept');

        // Calculate Quarter/Year safely from Date
        const dateObj = new Date(fechaVal);
        const safeQuarter = this.getQuarter(dateObj);
        const safeYear = dateObj.getFullYear();

        const expense = {
            fecha: fechaVal,
            trimestre: safeQuarter,
            anio: safeYear,
            proveedor: provEl ? provEl.value.toUpperCase() : i18n.t('ges_default_provider'),
            nif: document.getElementById('gasto-nif')?.value?.toUpperCase() || '',
            concepto: finalConcepto,
            categoria: catEl ? catEl.value : 'otros',
            deducible_irpf: irpfEl ? (irpfEl.checked ? 1 : 0) : 0,
            base: base,
            iva_rate: rate,
            iva_cuota: iva,
            total: total,
            created_at: idVal ? undefined : Date.now() // Don't overwrite created_at on edit
        };

        if (idVal) expense.id = parseInt(idVal);

        if (total <= 0) {
            app.showInfoModal({
                type: 'error',
                title: i18n.t('ges_invalid_amount_title'),
                message: i18n.t('ges_invalid_amount_msg')
            });
            return;
        }

        try {
            await db.addGasto(expense);
            app.showToast(i18n.t('toast_saved'), 'success');
            this.closeModal();

            // Auto-switch view to match the saved expense
            this.currentQuarter = safeQuarter;
            this.currentYear = safeYear;
            // Update UI filters
            if (document.getElementById('gestor-quarter')) document.getElementById('gestor-quarter').value = safeQuarter;
            if (document.getElementById('gestor-year')) document.getElementById('gestor-year').value = safeYear;

            this.renderDashboard();
        } catch (e) {
            console.error(e);
            app.showToast(i18n.t('toast_error') + ': ' + e.message, 'error');
        }
    }

    async renderDashboard() {
        const annualView = await db.getConfig('gestor_annual_view');
        const isAnnual = annualView === true || annualView === 'true';
        const accountingMode = await db.getConfig('accounting_mode') || 'spain';
        const isIntl = accountingMode === 'international';

        // Update labels
        this.applyInternationalMode(isIntl);

        // Update title based on view
        const summaryTitle = document.getElementById('ges-summary-title');
        if (summaryTitle) {
            summaryTitle.textContent = isAnnual ?
                i18n.t('ges_annual_summary') || 'Resumen Anual' :
                i18n.t('ges_quarterly_summary');
        }

        // Update filters visibility based on view
        const quarterFilter = document.getElementById('gestor-quarter-container');
        if (quarterFilter) {
            quarterFilter.style.display = isAnnual ? 'none' : 'flex';
        }

        // 1. Get Expenses for period
        const allGastos = await db.getAllGastos();
        let qGastos;

        if (isAnnual) {
            qGastos = allGastos.filter(g => g.anio === this.currentYear);
        } else {
            qGastos = allGastos.filter(g => g.trimestre === this.currentQuarter && g.anio === this.currentYear);
        }

        // Render Table
        const tbody = document.getElementById('gastos-tbody');
        tbody.innerHTML = '';
        if (qGastos.length === 0) {
            document.getElementById('gastos-empty').style.display = 'block';
            document.getElementById('gastos-list').style.display = 'none';
        } else {
            document.getElementById('gastos-empty').style.display = 'none';
            document.getElementById('gastos-list').style.display = 'block';

            qGastos.forEach(g => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="white-space: nowrap;">${new Date(g.fecha).toLocaleDateString()}</td>
                    <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${g.proveedor}</td>
                    <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${(g.concepto || '').replace(/\n/g, ', ')}</td>
                    <td style="text-align: right; white-space: nowrap;">${this.formatPrice(g.base)}</td>
                    <td style="text-align: right; white-space: nowrap;">${this.formatPrice(g.iva_cuota)}</td>
                    <td style="text-align: right; white-space: nowrap;"><b>${this.formatPrice(g.total)}</b></td>
                    <td style="white-space: nowrap;">
                         <button class="btn-edit-gasto" data-id="${g.id}" title="${i18n.t('btn_edit')}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; margin-right: 5px; padding: 0;">✏️</button>
                        <button class="btn-delete-gasto" data-id="${g.id}" title="${i18n.t('btn_delete')}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0; filter: grayscale(100%) brightness(40%) sepia(100%) hue-rotate(-50deg) saturate(600%) contrast(0.8);">🗑️</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Listeners for edit
            document.querySelectorAll('.btn-edit-gasto').forEach(b => {
                b.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id);
                    await this.editGasto(id);
                });
            });

            // Listeners for delete
            document.querySelectorAll('.btn-delete-gasto').forEach(b => {
                b.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id);
                    await this.deleteGasto(id);
                });
            });
        }

        // 2. Get Incomes (Invoices) for period
        const allFacturas = await db.getAllFacturas();
        let qFacturas;

        if (isAnnual) {
            qFacturas = allFacturas.filter(f => {
                const d = new Date(f.fecha);
                if (f.excluded_from_accounting) return false;
                return d.getFullYear() === this.currentYear;
            });
        } else {
            qFacturas = allFacturas.filter(f => {
                const d = new Date(f.fecha);
                if (f.excluded_from_accounting) return false;
                return this.getQuarter(d) === this.currentQuarter && d.getFullYear() === this.currentYear;
            });
        }

        // 3. Manual Incomes
        const allExtra = await db.getAllIngresosExtra();
        let qExtra;

        if (isAnnual) {
            qExtra = allExtra ? allExtra.filter(i => i.anio === this.currentYear) : [];
        } else {
            qExtra = allExtra ? allExtra.filter(i => i.trimestre === this.currentQuarter && i.anio === this.currentYear) : [];
        }

        // COMBINE BOTH FOR DISPLAY
        const displayedIncomes = [
            ...qFacturas.map(f => {
                const taxRate = (f.impuestos !== undefined ? f.impuestos : (window.app_tax_rate || 21));
                const base = f.subtotal || f.base || (f.total / (1 + taxRate / 100));
                const iva = f.iva !== undefined ? f.iva : (f.iva_cuota || (f.total - base));
                return {
                    id: f.id,
                    fecha: f.fecha,
                    nfactura: f.numero,
                    cliente: f.cliente_nombre || i18n.t('ges_default_client'),
                    concepto: i18n.t('ges_repair_invoice'),
                    base: base,
                    iva_cuota: iva,
                    total: f.total,
                    is_system: true,
                    tax_label: f.tax_label,
                    ret_label: f.ret_label,
                    retencion_cuota: f.irpf || 0
                };
            }),
            ...qExtra.map(i => ({ ...i, is_system: false }))
        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // Sort desc

        // Render Ingresos Table
        const ingresosTbody = document.getElementById('ingresos-tbody');
        ingresosTbody.innerHTML = '';

        if (displayedIncomes.length === 0) {
            document.getElementById('ingresos-empty').style.display = 'block';
        } else {
            document.getElementById('ingresos-empty').style.display = 'none';

            displayedIncomes.forEach(i => {
                const tr = document.createElement('tr');
                const typeBadge = i.is_system ? '<span style="font-size:0.8em; opacity:0.7">🤖</span>' : '';
                // Note: We ENABLE edit button but it will show a message
                const editDisabledStyle = i.is_system ? 'opacity: 0.5;' : '';

                tr.innerHTML = `
                <td style="padding: 12px; white-space: nowrap;">${new Date(i.fecha).toLocaleDateString()}</td>
                <td style="padding: 12px; white-space: nowrap;">${i.nfactura || '-'}</td>
                <td style="padding: 12px; white-space: nowrap;">${this.escapeHtml(i.cliente)} ${typeBadge}</td>
                <td style="padding: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(i.concepto)}</td>
                <td style="padding: 12px; text-align: right; white-space: nowrap;">${this.formatPrice(i.base)}</td>
                <td style="padding: 12px; text-align: right; white-space: nowrap;">${this.formatPrice(i.iva_cuota)}</td>
                <td style="padding: 12px; text-align: right; white-space: nowrap;"><b>${this.formatPrice(i.total)}</b></td>
                <td style="padding: 12px; white-space: nowrap; text-align: center;">
                    <button class="btn-edit-ingreso" data-id="${i.id}" title="${i18n.t('btn_edit')}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; margin-right: 5px; padding: 0; ${editDisabledStyle}">✏️</button>
                    <button class="btn-delete-ingreso" data-id="${i.id}" data-type="${i.is_system ? 'factura' : 'manual'}" title="${i18n.t('btn_delete')}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0;">🗑️</button>
                </td>
            `;
                ingresosTbody.appendChild(tr);
            });

            // Listeners
            document.querySelectorAll('.btn-edit-ingreso').forEach(b => {
                b.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    const type = e.target.getAttribute('data-type');

                    if (type === 'factura') {
                        app.showToast(i18n.t('ges_edit_auto_invoice_info'), 'info');
                        return;
                    }
                    await this.editIngreso(parseInt(id));
                });
            });

            document.querySelectorAll('.btn-delete-ingreso').forEach(b => {
                b.addEventListener('click', async (e) => {
                    const btn = e.target.closest('button'); // Robust click handling
                    if (!btn) return;

                    const idRaw = btn.getAttribute('data-id');
                    const type = btn.getAttribute('data-type');

                    // CRITICAL FIX: Facturas use UUID (string), Manual Incomes use AutoIncrement (int)
                    const id = type === 'factura' ? idRaw : parseInt(idRaw);

                    await this.deleteIngreso(id, type);
                });
            });
        }

        // Totals for calculations
        // We use displayedIncomes since it has normalized fields

        // 4. Calc Totals (Modelo 303)
        // IVA Devengado (Facturas + Extra)
        const totalIvaRepercutido = displayedIncomes.reduce((acc, i) => acc + (i.iva_cuota || 0), 0);
        // IVA Soportado (Gastos)
        const totalIvaSoportado = qGastos.reduce((acc, g) => acc + (g.iva_cuota || 0), 0);

        const resultIva = totalIvaRepercutido - totalIvaSoportado;

        document.getElementById('tax-iva-balance').textContent = this.formatPrice(resultIva);
        document.getElementById('tax-iva-balance').style.color = resultIva > 0 ? '#ef4444' : '#10b981'; // Red = To Pay

        // 5. Calc Net Yield & Irpf/Tax
        const totalIngresosBase = displayedIncomes.reduce((acc, i) => acc + (i.base || 0), 0);
        const totalGastosBase = qGastos.reduce((acc, g) => acc + (g.base || 0), 0);
        const rendimientoNeto = totalIngresosBase - totalGastosBase;

        // Simplified calculation for Pago Fraccionado (España: 20%) or International
        const yieldTaxRate = isIntl ? (parseFloat(await db.getConfig('intl_yield_tax')) || 0) : 20;
        const pagoImpuesto = Math.max(0, rendimientoNeto * (yieldTaxRate / 100));

        const lblIrpf = document.getElementById('label-irpf-summary');
        const taxEntity = await db.getConfig('tax_entity') || 'autonomo';

        if (lblIrpf) {
            lblIrpf.textContent = isIntl ? (await db.getConfig('intl_ret_label') || i18n.t('ges_tax_irpf')) :
                (taxEntity === 'sociedad' ? i18n.t('set_tax_irpf_label_sociedad') : i18n.t('set_tax_irpf_label_autonomo'));
        }

        const elIrpfBalance = document.getElementById('tax-irpf-balance');
        if (elIrpfBalance) {
            elIrpfBalance.textContent = this.formatPrice(pagoImpuesto);
            elIrpfBalance.style.color = pagoImpuesto > 0 ? '#ef4444' : '#10b981';
        }

        const elNetResult = document.getElementById('tax-net-result');
        if (elNetResult) {
            elNetResult.textContent = this.formatPrice(rendimientoNeto);
            elNetResult.style.color = rendimientoNeto >= 0 ? 'var(--electric-cyan)' : '#ef4444';
        }
    }

    // Open Ingreso Modal
    addManualIncome() {
        this.openIngresoModal();
    }

    /**
     * Populates tax/retention selects based on accounting mode
     */
    async populateTaxOptions(type) {
        const accountingMode = await db.getConfig('accounting_mode') || 'spain';
        const isIntl = accountingMode === 'international';

        let taxRates = [21, 10, 4, 0];
        let retRates = [15, 7, 0];
        let taxLabel = i18n.t('ges_default_tax_label');
        let retLabel = i18n.t('ges_default_ret_label');

        if (isIntl) {
            const intlTaxRatesStr = await db.getConfig('intl_tax_rates') || '21, 10, 4, 0';
            const intlRetRatesStr = await db.getConfig('intl_ret_rates') || '15, 7, 0';
            taxLabel = await db.getConfig('intl_tax_label') || taxLabel;
            retLabel = await db.getConfig('intl_ret_label') || retLabel;

            taxRates = intlTaxRatesStr.split(',').map(r => parseFloat(r.trim())).filter(r => !isNaN(r));
            retRates = intlRetRatesStr.split(',').map(r => parseFloat(r.trim())).filter(r => !isNaN(r));
        }

        if (type === 'gasto') {
            const elTax = document.getElementById('gasto-iva-type');
            const elTaxLbl = document.getElementById('label-gasto-tax');
            if (elTaxLbl) elTaxLbl.textContent = isIntl ? `${taxLabel} Soportado` : i18n.t('mod_expense_tax_type');

            // Update Deductible Label (remove Modelo 130 if intl)
            const elDedLbl = document.getElementById('label-gasto-deducible');
            if (elDedLbl) {
                if (isIntl) {
                    const dedText = i18n.t('ges_deducible_intl') || 'Deducible';
                    elDedLbl.textContent = `${dedText} (${retLabel})`;
                } else {
                    elDedLbl.textContent = i18n.t('mod_expense_deducible');
                }
            }
            if (elTax) {
                elTax.innerHTML = taxRates.map(r => `<option value="${r}">${r}%</option>`).join('');
            }
        } else {
            const elTax = document.getElementById('ingreso-iva-type');
            const elRet = document.getElementById('ingreso-irpf-type');
            const elTaxLbl = document.getElementById('label-ingreso-tax');
            const elRetLbl = document.getElementById('label-ingreso-ret');

            if (elTaxLbl) elTaxLbl.textContent = isIntl ? `${taxLabel} (%)` : i18n.t('mod_income_tax');
            if (elRetLbl) elRetLbl.textContent = isIntl ? `${retLabel} (%)` : i18n.t('mod_income_ret');

            if (elTax) elTax.innerHTML = taxRates.map(r => `<option value="${r}">${r}%</option>`).join('');
            if (elRet) elRet.innerHTML = retRates.map(r => `<option value="${r}">${r}%</option>`).join('');
        }
    }

    async openIngresoModal() {
        console.log("Opening Ingreso Modal...");
        try {
            const modal = document.getElementById('modal-ingreso');
            if (!modal) {
                console.error("Modal ingreso not found");
                return;
            }

            await this.populateTaxOptions('ingreso');
            modal.classList.add('active');
            // ... rest of openIngresoModal logic ...

            const form = document.getElementById('form-ingreso');
            if (form) form.reset();

            // Defaults
            const now = new Date();
            const dateEl = document.getElementById('ingreso-fecha');
            if (dateEl) dateEl.value = now.toISOString().split('T')[0];

            const trimEl = document.getElementById('ingreso-trimestre');
            if (trimEl) trimEl.value = this.getQuarter(now);

            const yearEl = document.getElementById('ingreso-anio');
            if (yearEl) yearEl.value = now.getFullYear();

            const idEl = document.getElementById('ingreso-id');
            if (idEl) idEl.value = ''; // Clear ID

            // Reset calculated fields
            if (document.getElementById('ingreso-calc-iva')) document.getElementById('ingreso-calc-iva').value = '0.00 €';
            if (document.getElementById('ingreso-calc-irpf')) document.getElementById('ingreso-calc-irpf').value = '0.00 €';
            if (document.getElementById('ingreso-calc-total')) document.getElementById('ingreso-calc-total').textContent = `0.00 ${window.app_currency || '€'}`;
        } catch (e) {
            console.error("Error opening ingreso modal:", e);
            app.showInfoModal({
                type: 'error',
                title: i18n.t('toast_error'),
                message: i18n.t('toast_error') + ": " + e.message
            });
        }
    }

    closeIngresoModal() {
        document.getElementById('modal-ingreso').classList.remove('active');
    }

    // Auto-calculate IVA, IRPF, and Total for Ingreso form
    // Auto-calculate IVA, IRPF, and Total for Ingreso form
    calcIngresoBreakdown() {
        const baseEl = document.getElementById('ingreso-base');
        const ivaEl = document.getElementById('ingreso-iva-type');
        const irpfEl = document.getElementById('ingreso-irpf-type');

        if (!baseEl || !ivaEl || !irpfEl) return;

        const base = parseFloat(baseEl.value) || 0;
        const ivaRate = parseFloat(ivaEl.value) || 0;
        const irpfRate = parseFloat(irpfEl.value) || 0;

        const ivaCuota = base * (ivaRate / 100);
        const irpfCuota = base * (irpfRate / 100);
        const total = base + ivaCuota - irpfCuota;

        const calcIvaEl = document.getElementById('ingreso-calc-iva');
        const calcIrpfEl = document.getElementById('ingreso-calc-irpf');
        const calcTotalEl = document.getElementById('ingreso-calc-total');

        if (calcIvaEl) calcIvaEl.value = this.formatPrice(ivaCuota);
        if (calcIrpfEl) calcIrpfEl.value = '-' + this.formatPrice(irpfCuota);
        if (calcTotalEl) calcTotalEl.textContent = this.formatPrice(total);
    }

    async saveIngreso() {
        const fechaEl = document.getElementById('ingreso-fecha');
        const baseEl = document.getElementById('ingreso-base');
        const ivaEl = document.getElementById('ingreso-iva-type');
        const irpfEl = document.getElementById('ingreso-irpf-type');

        if (!fechaEl || !baseEl || !ivaEl || !irpfEl) {
            console.error("Missing Ingreso Form Elements");
            return;
        }

        const fechaVal = fechaEl.value;
        const base = parseFloat(baseEl.value) || 0;
        const ivaRate = parseFloat(ivaEl.value) || 0;
        const irpfRate = parseFloat(irpfEl.value) || 0;

        const ivaCuota = base * (ivaRate / 100);
        const irpfCuota = base * (irpfRate / 100);
        const total = base + ivaCuota - irpfCuota;

        const income = {
            fecha: fechaVal,
            trimestre: document.getElementById('ingreso-trimestre')?.value || this.currentQuarter,
            anio: parseInt(document.getElementById('ingreso-anio')?.value || this.currentYear),
            nfactura: document.getElementById('ingreso-nfactura')?.value || '',
            cliente: document.getElementById('ingreso-cliente')?.value || i18n.t('ges_default_client'),
            nif: document.getElementById('ingreso-nif')?.value?.toUpperCase() || '',
            concepto: document.getElementById('ingreso-concepto')?.value || i18n.t('ges_default_income_concept'),
            base: base,
            iva_rate: ivaRate,
            iva_cuota: ivaCuota,
            irpf_rate: irpfRate,
            irpf_cuota: irpfCuota,
            total: total,
            created_at: document.getElementById('ingreso-id').value ? undefined : Date.now()
        };

        const idVal = document.getElementById('ingreso-id').value;
        if (idVal) income.id = parseInt(idVal);

        if (base <= 0) {
            app.showInfoModal({
                type: 'error',
                title: i18n.t('ges_invalid_base_title'),
                message: i18n.t('ges_invalid_base_msg')
            });
            return;
        }

        await db.addIngresoExtra(income);
        this.closeIngresoModal();
        this.renderDashboard();
        app.showToast(i18n.t('toast_saved'), 'success');
    }




    async deleteGasto(id) {
        if (await this.confirm(i18n.t('ges_confirm_delete_expense'))) {
            await db.deleteGasto(id);
            this.renderDashboard();
            app.showToast(i18n.t('ges_expense_deleted'), 'success');
        }
    }

    async deleteIngreso(id, type) {
        const msg = type === 'factura' ?
            i18n.t('ges_confirm_exclude_invoice') :
            i18n.t('ges_confirm_delete_manual_income');

        const confirmed = await this.confirm(msg);

        if (confirmed) {
            if (type === 'factura') {
                try {
                    const factura = await db.getFactura(id);
                    if (factura) {
                        factura.excluded_from_accounting = true;
                        await db.saveFactura(factura);
                        app.showToast(i18n.t('ges_invoice_excluded'), 'success');
                    } else {
                        app.showToast(i18n.t('ges_invoice_not_found'), 'error');
                    }
                } catch (err) {
                    console.error("Error excluding invoice", err);
                    app.showToast(i18n.t('ges_invoice_exclude_error'), 'error');
                }
            } else {
                try {
                    await db.deleteIngresoExtra(parseInt(id));
                    app.showToast(i18n.t('ges_manual_income_deleted'), 'success');
                } catch (e) {
                    console.error('Error borrando ingreso manual', e);
                    app.showToast(i18n.t('ges_manual_income_delete_error'), 'error');
                }
            }
            this.renderDashboard();
        }
    }

    // --- EDIT METHODS ---
    async editGasto(id) {
        const all = await db.getAllGastos();
        const gasto = all.find(g => g.id === id);
        if (!gasto) return;

        this.openModal();

        // Populate
        document.getElementById('gasto-id').value = gasto.id;
        document.getElementById('gasto-fecha').value = gasto.fecha;
        document.getElementById('gasto-trimestre').value = gasto.trimestre;
        document.getElementById('gasto-anio').value = gasto.anio;
        document.getElementById('gasto-proveedor').value = gasto.proveedor;
        document.getElementById('gasto-nif').value = gasto.nif;

        // Populate Conceptos List
        const container = document.getElementById('gasto-conceptos-container');
        if (container) {
            container.innerHTML = ''; // Start clean
            const lines = (gasto.concepto || '').split('\n');
            if (lines.length > 0 && lines[0]) {
                lines.forEach(line => this.addConceptRow(line));
            } else {
                this.addConceptRow();
            }
        }
        document.getElementById('gasto-total').value = gasto.total;
        document.getElementById('gasto-iva-type').value = gasto.iva_rate;
        document.getElementById('gasto-categoria').value = gasto.categoria;
        if (document.getElementById('gasto-deducible-irpf')) {
            document.getElementById('gasto-deducible-irpf').checked = !!gasto.deducible_irpf;
        }

        // Trigger calc
        this.calcBreakdown();
    }

    async editIngreso(id) {
        const all = await db.getAllIngresosExtra();
        const ingreso = all.find(i => i.id === id);
        if (!ingreso) return;

        this.addManualIncome(); // Opens modal and resets

        // Populate
        document.getElementById('ingreso-id').value = ingreso.id;
        document.getElementById('ingreso-fecha').value = ingreso.fecha;
        document.getElementById('ingreso-nfactura').value = ingreso.nfactura;
        document.getElementById('ingreso-trimestre').value = ingreso.trimestre;
        document.getElementById('ingreso-anio').value = ingreso.anio;
        document.getElementById('ingreso-cliente').value = ingreso.cliente;
        document.getElementById('ingreso-nif').value = ingreso.nif;
        document.getElementById('ingreso-concepto').value = ingreso.concepto;
        document.getElementById('ingreso-base').value = ingreso.base;
        document.getElementById('ingreso-iva-type').value = ingreso.iva_rate;
        document.getElementById('ingreso-irpf-type').value = ingreso.irpf_rate;

        // Trigger calc
        this.calcIngresoBreakdown();
    }

    // --- OCR SECTION (TESSERACT) ---
    async handleWebcamButton() {
        const btn = document.getElementById('btn-ocr-webcam');
        const txt = document.getElementById('txt-ocr-webcam');

        if (!this.stream) {
            // Apagado -> Encender
            await this.startCamera();
            if (txt) txt.textContent = "Capturar Foto";
            if (btn) btn.style.background = "#ef4444"; // Red for capture action
        } else {
            // Encendido -> Capturar
            this.captureAndScan();
            this.stopCamera();
            if (txt) txt.textContent = "Tomar Foto";
            if (btn) btn.style.background = ""; // Reset to primary
        }
    }

    async startCamera() {
        const video = document.getElementById('ocr-video');
        const canvas = document.getElementById('ocr-canvas'); // Get canvas to hide it
        const placeholder = document.getElementById('ocr-placeholder');

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" } // Rear camera on mobile
            });
            video.srcObject = this.stream;

            // UI RESET: Show video, Hide Canvas & Placeholder
            video.style.display = 'block';
            if (canvas) canvas.style.display = 'none'; // IMPORTANT: Hide previous frozen image
            if (placeholder) placeholder.style.display = 'none';
        } catch (err) {
            console.error("Error accessing camera", err);
            app.showInfoModal({ type: 'error', title: 'Error de Cámara', message: 'No se pudo acceder a la cámara. Asegúrate de dar los permisos necesarios.' });
        }
    }

    stopCamera() {
        if (this.stream) {
            const video = document.getElementById('ocr-video');
            const placeholder = document.getElementById('ocr-placeholder');

            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;

            if (video) video.style.display = 'none';
            if (placeholder) placeholder.style.display = 'block';
        }
    }

    async captureAndScan() {
        const video = document.getElementById('ocr-video');
        const canvas = document.getElementById('ocr-canvas');
        const ctx = canvas.getContext('2d');

        // 1. CAPTURE INSTANTLY (Freeze frame)
        if (video && video.videoWidth > 0) {
            const scale = 1.5;
            canvas.width = video.videoWidth * scale; // Upscale 
            canvas.height = video.videoHeight * scale;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Show captured image immediately
            canvas.style.display = 'block';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'contain';

            video.style.display = 'none';
            const ph = document.getElementById('ocr-placeholder');
            if (ph) {
                ph.style.display = 'none';
                ph.style.visibility = 'hidden';
            }
        }

        // 2. Load Tesseract (Heavy operation)
        if (typeof Tesseract === 'undefined') {
            const statusDiv = document.getElementById('ocr-status');
            statusDiv.textContent = i18n.t('ocr_engine_loading');
            await this.loadTesseract();
        }

        // 3. Process
        // 3. Process
        await this.preprocessImage(canvas);
        this.runOCR(canvas);
    }

    // --- NEW: Handle Photo Upload ---
    async handleOCRFile(file) {
        if (typeof Tesseract === 'undefined') {
            const statusDiv = document.getElementById('ocr-status');
            statusDiv.textContent = i18n.t('ocr_engine_loading');
            await this.loadTesseract();
        }

        const statusDiv = document.getElementById('ocr-status');
        statusDiv.textContent = i18n.t('ocr_image_loading');

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.getElementById('ocr-canvas');
                const ctx = canvas.getContext('2d');

                // Limit resolution to prevent crash (max 2500px)
                // Much better than video (usually 720p)
                let width = img.width;
                let height = img.height;
                const maxDim = 2500;

                if (width > maxDim || height > maxDim) {
                    const ratio = Math.min(maxDim / width, maxDim / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // SHOW IMAGE
                canvas.style.display = 'block';
                canvas.style.width = '100%';
                canvas.style.objectFit = 'contain';
                const vid = document.getElementById('ocr-video');
                const ph = document.getElementById('ocr-placeholder');
                if (vid) vid.style.display = 'none';
                if (ph) ph.style.display = 'none';

                // Important: Preprocess
                statusDiv.textContent = "⏳ Mejorando imagen...";
                // Small delay to allow UI update
                setTimeout(async () => {
                    await this.preprocessImage(canvas);
                    this.runOCR(canvas);
                }, 100);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Convert to strict Black & White to remove noise
    // Convert to Grayscale & High Contrast (Better than strict B&W)
    // Advanced Adaptive Thresholding to remove shadows/background
    async preprocessImage(canvas) {
        // Cargar OpenCV si no existe
        if (typeof cv === 'undefined') {
            const statusDiv = document.getElementById('ocr-status');
            statusDiv.textContent = "Cargando motor de visión artificial...";
            try {
                await this.loadOpenCV();
            } catch (e) {
                console.warn("OpenCV load failed:", e);
                statusDiv.textContent = "⚠️ OpenCV no disponible, usando modo básico...";
            }
        }

        try {
            const src = cv.imread(canvas);
            const dst = new cv.Mat();

            // 1. Detección de Bordes
            let temp = new cv.Mat();
            cv.cvtColor(src, temp, cv.COLOR_RGBA2GRAY, 0);
            cv.GaussianBlur(temp, temp, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
            cv.Canny(temp, temp, 75, 200);

            // 2. Encontrar Contornos (Find Quadrilateral)
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(temp, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let maxArea = 0;
            let maxContour = null;

            for (let i = 0; i < contours.size(); ++i) {
                let cnt = contours.get(i);
                let area = cv.contourArea(cnt);
                if (area > 5000) { // Filtro de tamaño mínimo
                    let peri = cv.arcLength(cnt, true);
                    let approx = new cv.Mat();
                    cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

                    if (area > maxArea && approx.rows === 4) {
                        maxArea = area;
                        maxContour = approx; // Guardo solo los puntos
                    } else {
                        approx.delete();
                    }
                }
            }

            // 3. Recortar si se encuentra documento
            if (maxContour) {
                // Ordenar puntos (tl, tr, br, bl) - Implementación simplificada
                // Asumiendo que OpenCV js no tiene un helper fácil, usamos boundingRect para recortar simple
                // WARP es complejo de implementar robusto en un solo paso sin helpers geometricos
                // Haremos un recorte al Bounding Rect que es seguro y mejora mucho
                let rect = cv.boundingRect(maxContour);

                let roi = src.roi(rect);

                // Redimensionar canvas al recorte
                canvas.width = rect.width;
                canvas.height = rect.height;
                cv.imshow(canvas, roi);

                roi.delete();
                maxContour.delete();
            }

            // 4. Post-Proceso: Escala de Grises SUAVE (No Binarización)
            // Recargar imagen recortada
            const processed = cv.imread(canvas);
            cv.cvtColor(processed, dst, cv.COLOR_RGBA2GRAY, 0);

            // Aumentar contraste ligeramente sin binarizar
            // src = alpha * src + beta
            // dst.convertTo(dst, -1, 1.2, 10); // Alpha 1.2, Beta 10 (Funciona en C++, en JS cv.Mat.convertTo is tricky)

            // Alternativa JS para contraste en Mat es compleja, usamos canvas manipulation al final
            cv.imshow(canvas, dst);

            // Limpieza
            src.delete(); dst.delete(); temp.delete(); contours.delete(); hierarchy.delete();

        } catch (err) {
            console.error("OpenCV Process Error:", err);
            // Fallback a escala de grises simple si OpenCV falla
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
                const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                d[i] = d[i + 1] = d[i + 2] = g;
            }
            ctx.putImageData(imgData, 0, 0);
        }
    }

    async loadOpenCV() {
        if (typeof cv !== 'undefined' && cv.Mat) return; // Already loaded

        return new Promise((resolve, reject) => {
            // Check if already inserted
            if (document.querySelector('script[src*="opencv.js"]')) {
                if (typeof cv !== 'undefined' && cv.onRuntimeInitialized) {
                    // Hook into existing
                    const old = cv.onRuntimeInitialized;
                    cv.onRuntimeInitialized = () => { old(); resolve(); };
                    return;
                }
            }

            const script = document.createElement('script');
            script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
            script.async = true;
            script.id = 'opencv-script';

            // Timeout 15s
            const timeout = setTimeout(() => {
                reject(new Error("Timeout loading OpenCV"));
            }, 15000);

            script.onload = () => {
                if (cv.getBuildInformation) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    // Wait for runtime initialized callback
                    cv['onRuntimeInitialized'] = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                }
            };

            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Failed to load OpenCV script"));
            };

            document.head.appendChild(script);
        });
    }

    async loadTesseract() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async runOCR(canvas) {
        const statusDiv = document.getElementById('ocr-status');
        const debugDiv = document.getElementById('ocr-debug');

        statusDiv.textContent = "⏳ Mejorando imagen y leyendo...";

        try {
            const { data: { text } } = await Tesseract.recognize(
                canvas,
                'spa', // Spanish
                {
                    logger: m => statusDiv.textContent = `Progreso: ${Math.round(m.progress * 100)}%`
                }
            );

            debugDiv.textContent = text;
            statusDiv.textContent = "✅ Texto extraído. Procesando...";

            // Use NEW Parser V2
            this.parseReceiptDataV2(text);

        } catch (err) {
            console.error(err);
            statusDiv.textContent = "❌ Error en el análisis OCR.";
        }
    }

    parseReceiptData(text) {
        if (!text) return;

        console.log("OCR Text:", text); // Debug

        const lines = text.split('\n');
        const statusDiv = document.getElementById('ocr-status');

        // 1. Find DATE
        const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})/;
        const dateMatch = text.match(dateRegex);
        if (dateMatch) {
            let day = dateMatch[1].padStart(2, '0');
            let month = dateMatch[2].padStart(2, '0');
            let year = dateMatch[3];
            if (year.length === 2) year = '20' + year;
            const isoDate = `${year}-${month}-${day}`;
            const elDate = document.getElementById('gasto-fecha');
            if (elDate) {
                elDate.value = isoDate;
                elDate.dispatchEvent(new Event('change'));
            }
        }

        // 3. Find TOTAL AMOUNT (Improved for spaces like "9 9 . 4 4")
        let maxAmount = 0;

        // Regex allows spaces between digits, requires dot/comma and 2 decimals
        const amountRegex = /(\d[\d\s]*[.,][\s]*\d{2})/g;

        // Helper to parse amount string
        const parseAmount = (str) => {
            // Remove spaces, replace comma with dot
            const clean = str.replace(/\s/g, '').replace(',', '.');
            return parseFloat(clean);
        };

        let foundTotal = false;

        // Try direct usage of regex on full text first for simplicity? 
        // No, Context matters (TOTAL word).

        for (const line of lines) {
            const cleanLine = line.toUpperCase().replace(/\s/g, ''); // "TOTAL:99.44"
            // Keywords
            if (cleanLine.includes('TOTAL') || cleanLine.includes('IMPORTE') || cleanLine.includes('PAGAR')) {
                const matches = line.match(amountRegex);
                if (matches) {
                    // Get last match (usually the final total)
                    let val = parseAmount(matches[matches.length - 1]);
                    if (!isNaN(val) && val < 10000) { // Safety cap
                        maxAmount = val;
                        foundTotal = true;
                    }
                }
            }
        }

        // Fallback: Biggest number
        if (!foundTotal) {
            const allAmounts = text.match(amountRegex);
            if (allAmounts) {
                for (const amt of allAmounts) {
                    let val = parseAmount(amt);
                    if (!isNaN(val) && val > maxAmount && val < 5000) {
                        maxAmount = val;
                    }
                }
            }
        }

        if (maxAmount > 0) {
            const elTotal = document.getElementById('gasto-total');
            if (elTotal) {
                elTotal.value = maxAmount.toFixed(2);
                elTotal.style.backgroundColor = "#dcfce7"; // Flash green
                setTimeout(() => elTotal.style.backgroundColor = "", 1000);
            }
            if (statusDiv) statusDiv.textContent = `✅ Detectado: ${maxAmount.toFixed(2)}€`;
        } else {
            if (statusDiv) statusDiv.textContent = "⚠️ No se encontró el importe total.";
        }
    }

    // --- OCR V2 (Advanced) ---
    parseReceiptDataV2(text) {
        if (!text) return;
        const statusDiv = document.getElementById('ocr-status');
        const lines = text.split('\n');

        // ==== 1. FECHA (Mejorado) ====
        // Buscamos todas las posibles fechas y elegimos la más lógica (más cercana a hoy)
        const dateRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})\b/g;
        const matches = [...text.matchAll(dateRegex)];
        let bestDate = null;
        let minDiff = Infinity;
        const now = new Date();

        matches.forEach(m => {
            let day = parseInt(m[1]);
            let month = parseInt(m[2]);
            let year = parseInt(m[3]);

            if (year < 100) year += 2000; // Asumir 20xx

            // Validar fecha real
            if (month < 1 || month > 12) return;
            if (day < 1 || day > 31) return;

            const d = new Date(year, month - 1, day);
            const diff = Math.abs(now - d);

            // Preferimos fechas del presente/pasado cercano, no futuro lejano ni pasado lejano
            // Penalizar fechas futuras si es necesario, pero aquí solo buscamos cercanía
            if (diff < minDiff) {
                minDiff = diff;
                bestDate = { year, month, day };
            }
        });

        if (bestDate) {
            const yStr = bestDate.year;
            const mStr = String(bestDate.month).padStart(2, '0');
            const dStr = String(bestDate.day).padStart(2, '0');
            const isoDate = `${yStr}-${mStr}-${dStr}`;

            const elDate = document.getElementById('gasto-fecha');
            if (elDate) {
                elDate.value = isoDate;
                // Emitir evento para recalcular trimestre
                elDate.dispatchEvent(new Event('change'));
            }
        }

        // ==== 2. NIF ====
        const nifRegex = /([A-Z]\-?\d{8}[A-Z]?)|(\d{8}\-?[A-Z])/;
        const nifMatch = text.match(nifRegex);
        if (nifMatch) {
            const elNif = document.getElementById('gasto-nif');
            if (elNif) elNif.value = nifMatch[0].replace(/-/g, '');
        }

        // ==== 3. PROVEEDOR ====
        const knownVendors = ["MERCADONA", "CARREFOUR", "LIDL", "DIA", "ALCAMPO", "LEROY", "IKEA", "AMAZON", "REPSOL", "CEPSA", "BP", "CORTE INGLES", "ZARA", "H&M", "PRIMARK"];
        let detectedVendor = "";
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const l = lines[i].toUpperCase();
            for (const v of knownVendors) {
                if (l.includes(v)) {
                    detectedVendor = v;
                    break;
                }
            }
            if (detectedVendor) break;
        }
        if (detectedVendor) {
            const elProv = document.getElementById('gasto-proveedor');
            if (elProv && !elProv.value) elProv.value = detectedVendor;
        }

        // ==== 4. CONCEPTO ====
        let products = [];
        const ignoreWords = ["TOTAL", "SUBTOTAL", "ENTREGADO", "CAMBIO", "TARJETA", "EFECTIVO", "IVA", "BASE", "CUOTA", "PAGAR", "FACTURA", "MERCADONA", "CLIENTE", "PUNTOS", "VENTA", "IMPORT", "FECHA", "HORA", "TICKET"];

        for (const line of lines) {
            const upper = line.toUpperCase();
            if (upper.length < 5) continue;
            if (ignoreWords.some(w => upper.includes(w))) continue;

            // Texto + Precio al final
            if (/[\d.,]+[€$]?\s*$/.test(line.trim()) && /[A-Za-z]/.test(line)) {
                let name = line.replace(/[\d.,]+[€$]?\s*$/, '').trim();
                name = name.replace(/^[\d\W]+/, '');
                if (name.length > 3) products.push(name);
            }
        }

        // Populate List
        const container = document.getElementById('gasto-conceptos-container');
        if (container) {
            container.innerHTML = ''; // Clean

            if (products.length > 0) {
                // Use extracted products
                products.forEach(p => {
                    // Cleanup formatting
                    let clean = p.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
                    this.addConceptRow(clean);
                });
            } else {
                // Fallback
                const fallback = detectedVendor ? i18n.t('ocr_fallback_buy').replace('{vendor}', detectedVendor) : i18n.t('ocr_fallback_ticket');
                this.addConceptRow(fallback);
            }
        }

        // ==== 5. IVA ====
        let detectedIva = "21";
        if (text.includes("4%") || text.includes("4.00") || text.includes("4,00")) detectedIva = "4";
        else if (text.includes("10%") || text.includes("10.00") || text.includes("10,00")) detectedIva = "10";
        // Update Select
        const elIva = document.getElementById('gasto-iva-type');
        if (elIva) elIva.value = detectedIva;

        // ==== 6. TOTAL ====
        let maxAmount = 0;
        const amountRegex = /(\d[\d\s]*[.,][\s]*\d{2})/g;
        const parseAmount = (str) => parseFloat(str.replace(/\s/g, '').replace(',', '.'));
        let foundTotal = false;

        // Palabras a EVITAR cerca del total
        const badTotalWords = ["AHORRO", "DESCUENTO", "VENTAJA", "CUPON", "PUNTOS", "BASE", "CUOTA", "AHORRADO"];

        for (const line of lines) {
            const cleanLine = line.toUpperCase().replace(/\s/g, '');
            const upperLine = line.toUpperCase();

            // Salta línea si es obviamente un descuento o base
            if (badTotalWords.some(w => upperLine.includes(w))) continue;

            if (cleanLine.includes('TOTAL') || cleanLine.includes('IMPORTE') || cleanLine.includes('PAGAR')) {
                const matches = line.match(amountRegex);
                if (matches) {
                    let val = parseAmount(matches[matches.length - 1]);
                    if (!isNaN(val) && val < 50000) {
                        // Si la línea tiene "A PAGAR" o es explícitamente el TOTAL final, asignamos y paramos si es valor positivo
                        if (upperLine.includes("PAGAR") || (cleanLine === "TOTAL" && val > 0)) {
                            maxAmount = val;
                            foundTotal = true;
                            break; // PRIORIDAD MAXIMA, DEJAR DE BUSCAR
                        }

                        // Si solo dice TOTAL, lo guardamos pero seguimos buscando por si hay un "TOTAL A PAGAR" mejor
                        maxAmount = val;
                        foundTotal = true;
                    }
                }
            }
        }

        if (!foundTotal) {
            const allAmounts = text.match(amountRegex);
            if (allAmounts) {
                for (const amt of allAmounts) {
                    let val = parseAmount(amt);
                    if (!isNaN(val) && val > maxAmount && val < 5000) {
                        maxAmount = val;
                    }
                }
            }
        }

        if (maxAmount > 0) {
            const elTotal = document.getElementById('gasto-total');
            if (elTotal) {
                elTotal.value = maxAmount.toFixed(2);
                elTotal.style.backgroundColor = "#dcfce7";
                setTimeout(() => elTotal.style.backgroundColor = "", 1500);

                elTotal.dispatchEvent(new Event('input'));
                elTotal.dispatchEvent(new Event('change'));
            }
            if (statusDiv) statusDiv.textContent = i18n.t('ocr_status_detected').replace('{amount}', maxAmount.toFixed(2)).replace('{iva}', detectedIva);
        } else {
            if (statusDiv) statusDiv.textContent = i18n.t('ocr_status_unclear');
        }
    }
}

// Global hook
window.managerUI = new ManagerUI();
