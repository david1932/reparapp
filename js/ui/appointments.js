/**
 * Appointments UI Module
 * Gestión de Citas y Calendario
 */

class AppointmentsUI {
    constructor() {
        this.currentDate = new Date();
        this.citas = [];
        this.clients = [];
    }

    async init() {
        // Render initial calendar
        await this.render();

        // Event Listeners for Navigation
        document.getElementById('prev-month')?.addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month')?.addEventListener('click', () => this.changeMonth(1));
        document.getElementById('today-btn')?.addEventListener('click', () => {
            this.currentDate = new Date();
            this.render();
        });

        // Modal Listeners
        document.getElementById('btn-add-cita')?.addEventListener('click', () => this.openModal());
        document.getElementById('form-cita')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCita();
        });

        // Close modal
        document.querySelectorAll('[data-close-modal="modal-cita"]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('modal-cita').classList.remove('active');
            });
        });

        // SearchClient listener for autocomplete - REMOVED for SearchSelect
        // const clientInput = document.getElementById('cita-cliente-search');
        // if (clientInput) {
        //    clientInput.addEventListener('input', (e) => this.handleClientSearch(e));
        // }
    }

    changeMonth(offset) {
        this.currentDate.setMonth(this.currentDate.getMonth() + offset);
        this.render();
    }

    async render() {
        try {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();

            // Update Header
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

            // Fetch Citas for this month (+- padding)
            // Simplified: Fetch all (or optimize later to range)
            const allCitas = await db.getAllCitas();
            this.citas = allCitas.filter(c => {
                const d = new Date(c.fecha);
                return d.getMonth() === month && d.getFullYear() === year;
            });

            this.renderCalendarGrid(year, month);
            this.renderUpcomingList();

        } catch (error) {
            console.error('Error rendering appointments:', error);
            app.showToast('Error al cargar citas', 'error');
        }
    }

    renderCalendarGrid(year, month) {
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // 0 = Sunday, 1 = Monday. We want Monday first.
        let startDay = firstDay.getDay() - 1;
        if (startDay === -1) startDay = 6; // Sunday is 6 in 0-6 mon-sun system logic

        const daysInMonth = lastDay.getDate();

        // Headers
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        days.forEach(day => {
            const el = document.createElement('div');
            el.className = 'calendar-day-header';
            el.textContent = day;
            grid.appendChild(el);
        });

        // Current day check
        const today = new Date();
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

        // Empty slots
        for (let i = 0; i < startDay; i++) {
            const el = document.createElement('div');
            el.className = 'calendar-day empty';
            grid.appendChild(el);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const el = document.createElement('div');
            el.className = 'calendar-day';

            // Highlight today
            if (isCurrentMonth && i === today.getDate()) {
                el.classList.add('today');
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            // Check appointments
            const dayCitas = this.citas.filter(c => c.fecha.startsWith(dateStr));

            // Check passed
            const checkDate = new Date(year, month, i);
            checkDate.setHours(23, 59, 59);
            if (checkDate < new Date()) {
                el.classList.add('past');
            }

            let html = `<div class="day-number">${i}</div>`;

            if (dayCitas.length > 0) {
                html += `<div class="day-pills">`;
                dayCitas.forEach(cita => {
                    const time = cita.hora || '00:00';
                    html += `<div class="cita-pill ${cita.estado || 'pendiente'}" title="${cita.cliente_nombre}">
                        ${time} ${cita.cliente_nombre.split(' ')[0]}
                    </div>`;
                });
                html += `</div>`;
            }

            el.innerHTML = html;
            el.addEventListener('click', () => this.openModal(dateStr));
            grid.appendChild(el);
        }
    }

    renderUpcomingList() {
        const list = document.getElementById('upcoming-citas-list');
        if (!list) return;

        // Sort by date/time
        const upcoming = this.citas
            .filter(c => new Date(c.fecha + 'T' + c.hora) >= new Date()) // Future only? or all month? Let's show all month sorted
            .sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora));

        if (upcoming.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">No hay citas programadas este mes</p>';
            return;
        }

        list.innerHTML = upcoming.map(cita => `
            <div class="cita-item">
                <div class="cita-time">
                    <strong>${new Date(cita.fecha).getDate()}</strong>
                    <span>${cita.hora}</span>
                </div>
                <div class="cita-info">
                    <h4>${cita.cliente_nombre}</h4>
                    <p>${cita.motivo || 'Sin detalle'}</p>
                </div>
                <button class="btn-icon" onclick="appointmentsUI.deleteCita('${cita.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `).join('');
    }

    async openModal(dateStr = null) {
        const modal = document.getElementById('modal-cita');
        const form = document.getElementById('form-cita');
        form.reset();

        document.getElementById('cita-id').value = '';

        // Load Clients for SearchSelect
        const selectCliente = document.getElementById('cita-cliente-select');
        if (selectCliente) {
            try {
                const clients = await db.getAllClientes();
                selectCliente.innerHTML = `<option value="">Seleccionar Cliente...</option>` +
                    clients.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

                // Init SearchSelect
                if (typeof SearchSelect !== 'undefined') {
                    if (!this.clientSearchWidget) {
                        this.clientSearchWidget = new SearchSelect('cita-cliente-select');
                    } else {
                        // Sync new options
                        this.clientSearchWidget.syncOptionsFromSelect();
                        this.clientSearchWidget.reset();
                    }
                }
            } catch (e) {
                console.error("Error loading clients for appointment", e);
            }
        }

        if (dateStr) {
            document.getElementById('cita-fecha').value = dateStr;
        } else {
            document.getElementById('cita-fecha').value = new Date().toISOString().split('T')[0];
        }

        // Set default time next hour
        const now = new Date();
        now.setMinutes(0);
        now.setHours(now.getHours() + 1);
        document.getElementById('cita-hora').value = now.toTimeString().substring(0, 5);

        modal.classList.add('active');
    }

    // handleClientSearch no longer needed


    async saveCita() {
        const id = document.getElementById('cita-id').value;

        // Get client from Select/Widget
        const select = document.getElementById('cita-cliente-select');
        const clientId = select.value;
        let clientName = '';

        if (clientId) {
            clientName = select.options[select.selectedIndex].text;
        } else if (this.clientSearchWidget && this.clientSearchWidget.input.value) {
            // Fallback for custom name (Walk-in)
            clientName = this.clientSearchWidget.input.value;
        }

        if (!clientName) {
            app.showToast('Debes seleccionar un cliente', 'warning');
            return;
        }

        const cita = {
            id: id || undefined,
            cliente_nombre: clientName,
            cliente_id: clientId || null,
            fecha: document.getElementById('cita-fecha').value,
            hora: document.getElementById('cita-hora').value,
            motivo: document.getElementById('cita-motivo').value,
            notas: document.getElementById('cita-notas').value,
            estado: 'pendiente'
        };

        try {
            await db.saveCita(cita);
            document.getElementById('modal-cita').classList.remove('active');
            this.render();
            app.showToast('Cita guardada correctamente', 'success');
        } catch (e) {
            console.error(e);
            app.showToast('Error al guardar cita', 'error');
        }
    }

    async deleteCita(id) {
        app.confirmDelete('Eliminar Cita', '¿Estás seguro?', async () => {
            await db.deleteCita(id);
            this.render();
            app.showToast('Cita eliminada', 'success');
        });
    }
}

// Instancia global
window.appointmentsUI = new AppointmentsUI();
