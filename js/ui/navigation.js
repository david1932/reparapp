/**
 * Navigation Module
 * Control de navegación entre vistas
 */

class Navigation {
    constructor() {
        this.currentView = 'dashboard';
        this.views = ['dashboard', 'clientes', 'reparaciones', 'facturas', 'inventory', 'settings', 'gestor', 'citas', 'pos'];
        this.userRole = 'employee'; // Por defecto restringido
    }

    /**
     * Inicializa la navegación
     */
    async init() {
        // Cargar rol de la sesión actual
        const savedRole = localStorage.getItem('user_role');
        if (savedRole) {
            this.userRole = savedRole;
        }

        // Aplicar permisos iniciales
        this.applyPermissions();

        // Event listeners para nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;

                // Verificar si tiene permiso para esta vista
                if (!this.hasPermission(view)) {
                    app.showToast('No tienes permiso para acceder a Ajustes', 'error');
                    return;
                }

                if (view) {
                    this.navigateTo(view);
                }
            });
        });
    }

    /**
     * Verifica si el usuario tiene permiso para una vista
     */
    hasPermission(viewName) {
        if (this.userRole === 'admin') return true;

        // Vistas restringidas para empleados
        const restricted = ['settings', 'gestor'];
        return !restricted.includes(viewName);
    }

    /**
     * Aplica restricciones visuales según el rol
     */
    applyPermissions() {

        // Ocultar nav items prohibidos
        document.querySelectorAll('.nav-item').forEach(item => {
            const view = item.dataset.view;
            if (!this.hasPermission(view)) {
                item.style.display = 'none';
            } else {
                item.style.display = 'flex';
            }
        });

        // Si estamos en una vista prohibida, volver al dashboard
        if (!this.hasPermission(this.currentView)) {
            this.navigateTo('dashboard');
        }
    }

    /**
     * Cambia el rol del usuario (tras login)
     */
    async setRole(role) {
        this.userRole = role;
        localStorage.setItem('user_role', role);
        this.applyPermissions();
    }

    /**
     * Navega a una vista específica
     */
    navigateTo(viewName, params = null) {
        if (!this.views.includes(viewName)) {
            console.error(`View '${viewName}' not found`);
            return;
        }

        // Actualizar nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Mostrar vista correspondiente
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.classList.add('active');
        }

        this.currentView = viewName;

        // Refrescar datos de la vista
        this.refreshView(viewName, params);
    }

    /**
     * Refresca los datos de una vista
     */
    refreshView(viewName, params = null) {
        switch (viewName) {
            case 'dashboard':
                if (typeof dashboardUI !== 'undefined') {
                    dashboardUI.render();
                }
                break;
            case 'clientes':
                if (typeof clientsUI !== 'undefined') {
                    clientsUI.render();
                }
                break;
            case 'reparaciones':
                if (typeof repairsUI !== 'undefined') {
                    repairsUI.render(params);
                }
                break;
            case 'facturas':
                if (typeof invoicesUI !== 'undefined') {
                    invoicesUI.render();
                }
                break;
            case 'inventory':
                if (typeof inventoryUI !== 'undefined') {
                    inventoryUI.render();
                }
                break;
            case 'citas':
                if (typeof appointmentsUI !== 'undefined') {
                    appointmentsUI.render();
                }
                break;
            case 'settings':
                // No necesita render explícito, pero podríamos recargar configs
                if (typeof settingsUI !== 'undefined') {
                    settingsUI.loadSettings();
                }
                break;
            case 'pos':
                if (typeof posUI !== 'undefined') {
                    posUI.renderProducts();
                    // optional: re-render cart or keep state
                }
                break;
        }
    }

    /**
     * Obtiene la vista actual
     */
    getCurrentView() {
        return this.currentView;
    }
}

// Instancia global
const navigation = new Navigation();
