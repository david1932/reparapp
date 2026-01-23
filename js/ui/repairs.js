/**
 * Repairs UI Module
 * Interfaz de gestión de reparaciones
 */

class RepairsUI {
    constructor() {
        this.reparaciones = [];
        this.clientes = [];
        this.searchQuery = '';
        this.filterEstado = '';
        this.filterClienteId = null;
    }

    /**
     * Inicializa el módulo
     */
    init() {
        // Botón nueva reparación
        document.getElementById('btn-add-reparacion')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Cerrar teclado si estuviera abierto
            if (document.activeElement) document.activeElement.blur();
            this.openModal();
        });

        // Búsqueda
        document.getElementById('search-reparaciones')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.render();
        });

        // Filtro de estado
        document.getElementById('filter-estado')?.addEventListener('change', (e) => {
            this.filterEstado = e.target.value;
            this.render();
        });

        // Formulario
        document.getElementById('form-reparacion')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveReparacion();
        });

        // Cerrar modal
        document.querySelectorAll('[data-close-modal="modal-reparacion"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // View Mode Toggle
        document.querySelectorAll('#view-reparaciones .view-mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.classList.contains('mode-list') ? 'mode-list' :
                    btn.classList.contains('mode-small') ? 'mode-small' : 'mode-large';
                this.setViewMode(mode);
            });
        });

        // Restore saved view mode
        this.setViewMode(localStorage.getItem('repairs-view-mode') || 'mode-large');
    }

    setViewMode(mode) {
        // Update grid class
        const grid = document.getElementById('reparaciones-grid');
        grid.classList.remove('mode-list', 'mode-small', 'mode-large');
        grid.classList.add(mode);

        // Update active button
        document.querySelectorAll('#view-reparaciones .view-mode-toggle button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains(mode)) {
                btn.classList.add('active');
            }
        });

        // Save preference
        localStorage.setItem('repairs-view-mode', mode);
    }




    /**
     * Renderiza la lista de reparaciones
     * @param {Object} params - Parámetros opcionales (ej: { clienteId: '...' })
     */
    async render(params = null) {
        try {
            // Manejar filtro por cliente
            if (params && params.clienteId) {
                this.filterClienteId = params.clienteId;
                // Mostrar indicador de filtro (opcional)
                const cliente = await db.getCliente(this.filterClienteId);
                if (cliente) {
                    app.showToast(`Filtrando reparaciones de: ${cliente.nombre}`, 'info');
                }
            } else if (params === null) {
                // Si params es explícitamente null (navegación menú), limpiar filtro
                this.filterClienteId = null;
            }

            // Obtener clientes para referencia
            this.clientes = await db.getAllClientes();

            // Obtener reparaciones
            this.reparaciones = await db.searchReparaciones(this.searchQuery, this.filterEstado || null);

            // filtrar por cliente si es necesario
            if (this.filterClienteId) {
                this.reparaciones = this.reparaciones.filter(r => r.cliente_id === this.filterClienteId);
            }

            // Ordenar por fecha de creación (más recientes primero)
            this.reparaciones.sort((a, b) => b.fecha_creacion - a.fecha_creacion);

            const grid = document.getElementById('reparaciones-grid');
            const empty = document.getElementById('empty-reparaciones');

            if (this.reparaciones.length === 0) {
                grid.innerHTML = '';
                empty.style.display = 'flex';
                return;
            }

            empty.style.display = 'none';
            grid.innerHTML = this.reparaciones.map(rep => this.renderCard(rep)).join('');

            // Event listeners para acciones
            this.attachCardListeners();
        } catch (error) {
            console.error('Error rendering repairs:', error);
            app.showToast('Error al cargar reparaciones', 'error');
        }
    }

    /**
     * Obtiene el nombre del cliente por ID
     */
    getClienteName(clienteId) {
        const cliente = this.clientes.find(c => c.id === clienteId);
        return cliente ? cliente.nombre : 'Cliente desconocido';
    }

    /**
     * Obtiene el badge de estado
     */
    getStatusBadge(estado) {
        const statusMap = {
            'pendiente': { class: 'pending', text: 'Pendiente' },
            'en_proceso': { class: 'in-progress', text: 'En Proceso' },
            'completada': { class: 'completed', text: 'Completada' }
        };
        const status = statusMap[estado] || statusMap.pendiente;
        return `<span class="status-badge ${status.class}">${status.text}</span>`;
    }

    /**
     * Formatea precio
     */
    formatPrice(precio) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(precio || 0);
    }

    /**
     * Formatea fecha
     */
    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    /**
     * Obtiene la etiqueta del tipo de dispositivo
     */
    getDispositivoLabel(dispositivo) {
        const labels = {
            'movil': 'Móvil',
            'tablet': 'Tablet',
            'ordenador': 'Ordenador',
            'videoconsola': 'Videoconsola'
        };
        return labels[dispositivo] || dispositivo;
    }

    /**
     * Renderiza una tarjeta de reparación
     */
    renderCard(reparacion) {
        const clienteName = this.getClienteName(reparacion.cliente_id);

        return `
            <div class="card" data-id="${reparacion.id}">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${this.escapeHtml(clienteName)}</h3>
                        <p class="card-subtitle">${this.formatDate(reparacion.fecha_creacion)}</p>
                    </div>
                    ${this.getStatusBadge(reparacion.estado)}
                </div>
                <div class="card-body">
                    ${reparacion.dispositivo ? `
                    <div class="card-info" style="margin-bottom: 8px;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                        </svg>
                        <span>${this.getDispositivoLabel(reparacion.dispositivo)}${reparacion.marca ? ' - ' + this.escapeHtml(reparacion.marca) : ''}${reparacion.modelo ? ' ' + this.escapeHtml(reparacion.modelo) : ''}</span>
                    </div>
                    ` : ''}
                    <p style="color: var(--text-secondary); margin-bottom: var(--spacing-md);">
                        <strong>Problema:</strong> ${this.escapeHtml(reparacion.problema || reparacion.descripcion)}
                    </p>
                    ${reparacion.solucion ? `
                    <p style="color: var(--electric-cyan); margin-bottom: var(--spacing-md); font-size: 0.85rem;">
                        <strong>Solución:</strong> ${this.escapeHtml(reparacion.solucion)}
                    </p>
                    ` : ''}
                    <div class="price">${this.formatPrice(reparacion.precio)}</div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-secondary btn-status" data-action="status" data-id="${reparacion.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 11 12 14 22 4"></polyline>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                        Estado
                    </button>
                    <button class="btn btn-secondary btn-edit" data-action="edit" data-id="${reparacion.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Editar
                    </button>
                    <button class="btn btn-icon btn-delete" data-action="delete" data-id="${reparacion.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Adjunta listeners a las tarjetas
     */
    attachCardListeners() {
        // Cambiar estado
        document.querySelectorAll('[data-action="status"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await this.cycleStatus(id);
            });
        });

        // Editar
        document.querySelectorAll('.btn-edit[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.openModal(id);
            });
        });

        // Eliminar
        document.querySelectorAll('.btn-delete[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar abrir modal
                const id = btn.dataset.id;
                app.confirmDelete(
                    '¿Eliminar reparación?',
                    'Esta acción no se puede deshacer.',
                    async () => {
                        await this.deleteReparacion(id);
                    }
                );
            });
        });

        // Click en la tarjeta para editar (UX improvement)
        document.querySelectorAll('.card[data-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                // Si el click fue en un botón o dentro de un botón, ignorar
                if (e.target.closest('button')) return;

                const id = card.dataset.id;
                this.openModal(id);
            });
            // Añadir cursor pointer para indicar que es clickeable
            card.style.cursor = 'pointer';
        });
    }

    /**
     * Cicla el estado de una reparación
     */
    async cycleStatus(id) {
        try {
            const reparacion = await db.getReparacion(id);
            if (!reparacion) return;

            const estados = ['pendiente', 'en_proceso', 'completada'];
            const currentIndex = estados.indexOf(reparacion.estado);
            const nextIndex = (currentIndex + 1) % estados.length;
            reparacion.estado = estados[nextIndex];

            await db.saveReparacion(reparacion);
            await this.render();

            app.showToast(`Estado: ${reparacion.estado.replace('_', ' ')}`, 'info');
        } catch (error) {
            console.error('Error cycling status:', error);
            app.showToast('Error al cambiar estado', 'error');
        }
    }

    /**
     * Abre el modal de reparación
     */
    async openModal(id = null) {
        try {
            const modal = document.getElementById('modal-reparacion');
            const title = document.getElementById('modal-reparacion-title');
            const form = document.getElementById('form-reparacion');
            const selectCliente = document.getElementById('reparacion-cliente');

            // 1. Show modal immediately (with slight delay for mobile keyboard dismiss)
            setTimeout(() => {
                modal.classList.add('active');
            }, 100);

            // 2. Prevent keyboard by temporary readonly
            const cleanupReadonly = this.setInputsReadonly(form);

            form.reset();
            document.getElementById('reparacion-id').value = '';

            // Show loading state in select
            selectCliente.innerHTML = '<option value="">Cargando clientes...</option>';

            // 3. Load Data Asynchronously
            try {
                const clientes = await db.getAllClientes();
                selectCliente.innerHTML = '<option value="">Seleccionar cliente...</option>' +
                    clientes.map(c => `<option value="${c.id}">${this.escapeHtml(c.nombre)}</option>`).join('');

                if (id) {
                    // Modo edición
                    title.textContent = 'Editar Reparación';
                    const reparacion = await db.getReparacion(id);
                    if (reparacion) {
                        document.getElementById('reparacion-id').value = reparacion.id;
                        document.getElementById('reparacion-cliente').value = reparacion.cliente_id;
                        document.getElementById('reparacion-dispositivo').value = reparacion.dispositivo || '';
                        document.getElementById('reparacion-marca').value = reparacion.marca || '';
                        document.getElementById('reparacion-modelo').value = reparacion.modelo || '';
                        document.getElementById('reparacion-problema').value = reparacion.problema || reparacion.descripcion || '';
                        document.getElementById('reparacion-solucion').value = reparacion.solucion || '';
                        document.getElementById('reparacion-estado').value = reparacion.estado;
                        document.getElementById('reparacion-precio').value = reparacion.precio || '';
                        document.getElementById('reparacion-precio-final').value = reparacion.precio_final || '';
                        document.getElementById('reparacion-fecha-entrega').value = reparacion.fecha_entrega ? new Date(reparacion.fecha_entrega).toISOString().split('T')[0] : '';
                        document.getElementById('reparacion-pin').value = reparacion.pin || '';
                        document.getElementById('reparacion-notas').value = reparacion.notas || '';
                    }
                } else {
                    title.textContent = 'Nueva Reparación';
                }

                // Restore inputs after small delay ensuring modal is fully visible and stable
                setTimeout(() => {
                    cleanupReadonly();
                }, 400);

            } catch (dataError) {
                console.error('Error loading data for modal:', dataError);
                selectCliente.innerHTML = '<option value="">Error cargando clientes</option>';
                app.showToast('Error cargando datos: ' + dataError.message, 'error');
                cleanupReadonly();
            }

        } catch (error) {
            console.error('Error opening repair modal:', error);
            // Critical error, ensure modal is closed if it failed completely
            document.getElementById('modal-reparacion').classList.remove('active');
            alert('Error crítico al abrir modal: ' + error.message);
        }
    }

    /**
     * Helper to set inputs to readonly temporarily
     */
    setInputsReadonly(formContainer) {
        if (!formContainer) return () => { };

        // Blur active element first
        if (document.activeElement) document.activeElement.blur();

        const inputs = formContainer.querySelectorAll('input, select, textarea');
        const originalState = new Map();

        inputs.forEach(input => {
            originalState.set(input, input.hasAttribute('readonly'));
            input.setAttribute('readonly', 'true');
            // For selects, readonly doesn't always work as expected on mobile, so we disable
            if (input.tagName === 'SELECT') input.disabled = true;
        });

        // Return cleanup function
        return () => {
            inputs.forEach(input => {
                if (!originalState.get(input)) {
                    input.removeAttribute('readonly');
                }
                if (input.tagName === 'SELECT') input.disabled = false;
            });
        };
    }

    /**
     * Cierra el modal de reparación
     */
    closeModal() {
        document.getElementById('modal-reparacion').classList.remove('active');
    }

    /**
     * Guarda una reparación
     */
    async saveReparacion() {
        try {
            const id = document.getElementById('reparacion-id').value;
            const reparacion = {
                cliente_id: document.getElementById('reparacion-cliente').value,
                dispositivo: document.getElementById('reparacion-dispositivo').value || null,
                marca: document.getElementById('reparacion-marca').value.trim() || null,
                modelo: document.getElementById('reparacion-modelo').value.trim() || null,
                problema: document.getElementById('reparacion-problema').value.trim(),
                descripcion: document.getElementById('reparacion-problema').value.trim(),
                solucion: document.getElementById('reparacion-solucion').value.trim() || null,
                estado: document.getElementById('reparacion-estado').value,
                precio: parseFloat(document.getElementById('reparacion-precio').value) || 0,
                precio_final: parseFloat(document.getElementById('reparacion-precio-final').value) || null,
                fecha_entrega: document.getElementById('reparacion-fecha-entrega').value ? new Date(document.getElementById('reparacion-fecha-entrega').value).getTime() : null,
                pin: document.getElementById('reparacion-pin').value.trim() || null,
                notas: document.getElementById('reparacion-notas').value.trim() || null
            };

            if (!reparacion.cliente_id) {
                app.showToast('Selecciona un cliente', 'error');
                return;
            }

            if (id) {
                reparacion.id = id;
            }

            await db.saveReparacion(reparacion);
            this.closeModal();
            await this.render();

            app.showToast(id ? 'Reparación actualizada' : 'Reparación creada', 'success');
        } catch (error) {
            console.error('Error saving repair:', error);
            app.showToast('Error al guardar reparación', 'error');
        }
    }

    /**
     * Elimina una reparación
     */
    async deleteReparacion(id) {
        try {
            await db.deleteReparacion(id);
            await this.render();
            app.showToast('Reparación eliminada', 'success');
        } catch (error) {
            console.error('Error deleting repair:', error);
            app.showToast('Error al eliminar reparación', 'error');
        }
    }

    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Instancia global
const repairsUI = new RepairsUI();
