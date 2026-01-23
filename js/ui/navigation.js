/**
 * Navigation Module
 * Control de navegación entre vistas
 */

class Navigation {
    constructor() {
        this.currentView = 'dashboard';
        this.views = ['dashboard', 'clientes', 'reparaciones', 'facturas', 'settings'];
    }

    /**
     * Inicializa la navegación
     */
    init() {
        // Event listeners para nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if (view) {
                    this.navigateTo(view);
                }
            });
        });
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
            case 'settings':
                // No necesita render explícito, pero podríamos recargar configs
                if (typeof settingsUI !== 'undefined') {
                    settingsUI.loadSettings();
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
