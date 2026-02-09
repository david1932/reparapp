/**
 * Clients UI Module
 * Interfaz de gestión de clientes
 */

class ClientsUI {
    constructor() {
        this.clientes = [];
        this.searchQuery = '';
    }

    /**
     * Inicializa el módulo
     */
    init() {
        // Botón nuevo cliente
        document.getElementById('btn-add-cliente')?.addEventListener('click', () => {
            this.openModal();
        });

        // Búsqueda
        document.getElementById('search-clientes')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.render();
        });

        // Formulario
        document.getElementById('form-cliente')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCliente();
        });

        // Cerrar modal
        document.querySelectorAll('[data-close-modal="modal-cliente"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // View Mode Toggle
        document.querySelectorAll('#view-clientes .view-mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.classList.contains('mode-list') ? 'mode-list' :
                    btn.classList.contains('mode-small') ? 'mode-small' : 'mode-large';
                this.setViewMode(mode);
            });
        });

        // Restore saved view mode
        this.setViewMode(localStorage.getItem('clients-view-mode') || 'mode-large');
    }

    setViewMode(mode) {
        // Update grid class
        const grid = document.getElementById('clientes-grid');
        grid.classList.remove('mode-list', 'mode-small', 'mode-large');
        grid.classList.add(mode);

        // Update active button
        document.querySelectorAll('#view-clientes .view-mode-toggle button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains(mode)) {
                btn.classList.add('active');
            }
        });

        // Save preference
        localStorage.setItem('clients-view-mode', mode);
    }

    /**
     * Renderiza la lista de clientes
     */
    async render() {
        try {
            // Obtener clientes
            if (this.searchQuery) {
                this.clientes = await db.searchClientes(this.searchQuery);
            } else {
                this.clientes = await db.getAllClientes();
            }

            // Ordenar por nombre
            this.clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));

            const grid = document.getElementById('clientes-grid');
            const empty = document.getElementById('empty-clientes');

            if (this.clientes.length === 0) {
                grid.innerHTML = '';
                empty.style.display = 'flex';
                return;
            }

            empty.style.display = 'none';
            grid.innerHTML = this.clientes.map(cliente => this.renderCard(cliente)).join('');

            // Event listeners para acciones
            this.attachCardListeners();
        } catch (error) {
            console.error('Error rendering clients:', error);
            app.showToast(i18n.t('toast_error_loading'), 'error');
        }
    }

    /**
     * Renderiza una tarjeta de cliente
     */
    renderCard(cliente) {
        return `
            <div class="card" data-id="${cliente.id}">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${this.escapeHtml(cliente.nombre)}</h3>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-info">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        <span>${this.escapeHtml(cliente.telefono)}</span>
                    </div>
                    ${cliente.email ? `
                    <div class="card-info">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        <span>${this.escapeHtml(cliente.email)}</span>
                    </div>
                    ` : ''}
                    ${cliente.dispositivo ? `
                    <div class="card-info">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                        </svg>
                        <span>${this.getDispositivoLabel(cliente.dispositivo)}${cliente.marca ? ' - ' + this.escapeHtml(cliente.marca) : ''}${cliente.modelo ? ' ' + this.escapeHtml(cliente.modelo) : ''}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="card-footer">
                    <button class="btn btn-secondary btn-edit" data-action="edit" data-id="${cliente.id}" title="${i18n.t('btn_edit')}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        ${i18n.t('btn_edit')}
                    </button>
                    <button class="btn btn-secondary btn-repairs" data-action="repairs" data-id="${cliente.id}" title="${i18n.t('btn_view')}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                        </svg>
                        ${i18n.t('btn_view')}
                    </button>
                    <button class="btn btn-icon btn-delete" data-action="delete" data-id="${cliente.id}" title="${i18n.t('btn_delete')}">
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
        // Editar
        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.openModal(id);
            });
        });

        // Ver reparaciones
        document.querySelectorAll('[data-action="repairs"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                // Navegar a reparaciones y filtrar por cliente
                navigation.navigateTo('reparaciones', { clienteId: id });
            });
        });

        // Eliminar
        document.querySelectorAll('.btn-delete[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar abrir modal
                const id = btn.dataset.id;
                // Loose equality or String conversion to handle potential type mismatch (string vs number)
                const cliente = this.clientes.find(c => String(c.id) === String(id));
                if (cliente) {
                    app.confirmDelete(
                        i18n.t('cli_delete_confirm', { name: cliente.nombre }),
                        i18n.t('cli_delete_warning'),
                        async () => {
                            await this.deleteCliente(id);
                        }
                    );
                } else {
                    console.error('Cliente no encontrado para eliminar:', id);
                    // Fallback para permitir eliminar incluso si no se encuentra en el array local
                    app.confirmDelete(
                        i18n.t('dlg_delete_confirm'),
                        i18n.t('dlg_delete_warning'),
                        async () => {
                            await this.deleteCliente(id);
                        }
                    );
                }
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
            // Añadir cursor pointer
            card.style.cursor = 'pointer';
        });
    }

    /**
     * Abre el modal de cliente
     */
    async openModal(id = null) {
        const modal = document.getElementById('modal-cliente');
        const title = document.getElementById('modal-cliente-title');
        const form = document.getElementById('form-cliente');

        form.reset();
        document.getElementById('cliente-id').value = '';

        if (id) {
            // Modo edición
            title.textContent = i18n.t('cli_edit_title');
            const cliente = await db.getCliente(id);
            if (cliente) {
                document.getElementById('cliente-id').value = cliente.id;
                document.getElementById('cliente-nombre').value = cliente.nombre || '';
                document.getElementById('cliente-apellido').value = cliente.apellido || '';
                document.getElementById('cliente-telefono').value = cliente.telefono;
                document.getElementById('cliente-email').value = cliente.email || '';
                document.getElementById('cliente-direccion').value = cliente.direccion || '';
                document.getElementById('cliente-dni').value = cliente.dni || '';
                document.getElementById('cliente-notas').value = cliente.notas || '';
            }
        } else {
            title.textContent = i18n.t('mod_client_new');
        }

        modal.classList.add('active');
    }

    /**
     * Cierra el modal de cliente
     */
    closeModal() {
        document.getElementById('modal-cliente').classList.remove('active');
    }

    /**
     * Guarda un cliente
     */
    async saveCliente() {
        try {
            const id = document.getElementById('cliente-id').value;
            const cliente = {
                nombre: document.getElementById('cliente-nombre').value.trim(),
                apellido: document.getElementById('cliente-apellido').value.trim() || null,
                direccion: document.getElementById('cliente-direccion').value.trim() || null,
                dni: document.getElementById('cliente-dni').value.trim() || null,
                telefono: document.getElementById('cliente-telefono').value.trim(),
                email: document.getElementById('cliente-email').value.trim() || null,
                notas: document.getElementById('cliente-notas').value.trim() || null
            };

            if (id) {
                cliente.id = id;
            }

            await db.saveCliente(cliente);
            this.closeModal();
            await this.render();

            app.showToast(id ? i18n.t('toast_updated') : i18n.t('toast_saved'), 'success');
        } catch (error) {
            console.error('Error saving client:', error);
            app.showToast(i18n.t('toast_error'), 'error');
        }
    }

    /**
     * Elimina un cliente
     */
    async deleteCliente(id) {
        try {
            await db.deleteCliente(id);
            await this.render();
            app.showToast(i18n.t('toast_deleted'), 'success');
        } catch (error) {
            console.error('Error deleting client:', error);
            app.showToast(i18n.t('toast_error'), 'error');
        }
    }

    /**
     * Obtiene la etiqueta del tipo de dispositivo
     */
    getDispositivoLabel(dispositivo) {
        if (window.i18n) {
            const keys = {
                'movil': 'dev_movil',
                'tablet': 'dev_tablet',
                'ordenador': 'dev_ordenador',
                'videoconsola': 'dev_videoconsola',
                'otro': 'dev_otro'
            };
            if (keys[dispositivo]) return i18n.t(keys[dispositivo]);
        }

        const labels = {
            'movil': 'Móvil',
            'tablet': 'Tablet',
            'ordenador': 'Ordenador',
            'videoconsola': 'Videoconsola',
            'otro': 'Otro'
        };
        return labels[dispositivo] || dispositivo;
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
const clientsUI = new ClientsUI();
