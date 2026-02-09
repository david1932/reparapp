/**
 * Auth UI Module
 * Gestión de la interfaz de autenticación
 */

class AuthUI {
    constructor() {
        this.isLoginMode = true;
        this.currentPin = '';
    }

    /**
     * Actualiza el nombre del usuario en el sidebar
     */
    updateCurrentUserDisplay(name) {
        const display = document.getElementById('current-user-display');
        if (display) {
            display.textContent = name || '';
            // Si hay nombre, mostrar icono usuario, si no vacío
            if (name) display.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:6px;"><span class="material-icons" style="font-size:16px;">person</span>${name}</div>`;
        }
    }

    /**
     * Inicializa el módulo
     */
    async init() {
        // Listeners Jefe
        document.getElementById('auth-form-jefe')?.addEventListener('submit', (e) => this.handleAuthJefe(e));
        document.getElementById('btn-toggle-register')?.addEventListener('click', (e) => this.toggleMode(e));

        // Listeners Empleado (Keypad)
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('click', () => {
                if (key.classList.contains('delete')) {
                    this.currentPin = this.currentPin.slice(0, -1);
                } else if (key.dataset.val) {
                    if (this.currentPin.length < 4) {
                        this.currentPin += key.dataset.val;
                    }
                }
                this.updatePinDisplay();
            });
        });

        // Listener PIN input invisible (para teclado físico)
        const pinInput = document.getElementById('auth-pin');
        if (pinInput) {
            pinInput.addEventListener('input', (e) => {
                this.currentPin = e.target.value.slice(0, 4);
                this.updatePinDisplay();
                e.target.value = ''; // Reset input so it doesn't show
            });
        }

        // Listener PIN Admin Offline
        const pinAdminInput = document.getElementById('auth-pin-admin');
        if (pinAdminInput) {
            pinAdminInput.addEventListener('input', (e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                e.target.value = val;
                if (val.length === 4) {
                    this.currentPin = val;
                    this.handleAuthEmpleado(); // Reutilizamos lógica de PIN
                    e.target.value = ''; // Limpiar tras envío
                }
            });
        }

        document.getElementById('btn-auth-empleado')?.addEventListener('click', () => this.handleAuthEmpleado());

        // Verificar sesión al inicio
        await this.checkSession();
    }

    /**
     * Actualiza visualmente los puntos del PIN
     */
    updatePinDisplay() {
        const dots = document.querySelectorAll('.pin-dot');
        dots.forEach((dot, index) => {
            if (index < this.currentPin.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });

        // Auto-submit if 4 digits
        if (this.currentPin.length === 4) {
            setTimeout(() => this.handleAuthEmpleado(), 300);
        }
    }

    /**
     * Verifica si hay sesión activa
     */
    async checkSession() {
        // 1. Verificar sesión de Empleado (Local)
        const employeeSession = localStorage.getItem('employee_session');
        if (employeeSession) {
            try {
                const user = JSON.parse(employeeSession);
                await navigation.setRole(user.role || 'employee');
                this.updateCurrentUserDisplay(user.nombre || 'Técnico');
            } catch (e) {
                console.error('Error parsing session:', e);
                await navigation.setRole('employee');
                this.updateCurrentUserDisplay('Técnico');
            }
            this.hideAuthScreen();
            return true;
        }

        // 2. Verificar sesión de Jefe (Supabase)
        const session = await supabaseClient.getSession();
        if (session) {
            await navigation.setRole('admin');
            this.updateCurrentUserDisplay(i18n.t('nav_gestor')); // Or a specific key for "Jefe" if preferred
            this.hideAuthScreen();
            return true;
        }

        this.showAuthScreen();
        return false;
    }

    /**
     * Muestra la pantalla de autenticación
     */
    showAuthScreen() {
        const screen = document.getElementById('auth-screen');
        if (screen) {
            screen.classList.add('active');
            // Forzar el foco en el email del Jefe tras un pequeño delay
            setTimeout(() => {
                const emailInput = document.getElementById('auth-email-jefe');
                if (emailInput) {
                    emailInput.focus();
                    emailInput.select();
                }
            }, 800);
        }
    }

    /**
     * Oculta la pantalla de autenticación
     */
    hideAuthScreen() {
        const screen = document.getElementById('auth-screen');
        if (screen) screen.classList.remove('active');
    }

    /**
     * Alterna entre Login y Registro (Jefe)
     */
    toggleMode(e) {
        if (e && e.preventDefault) e.preventDefault();
        this.isLoginMode = !this.isLoginMode;

        const title = document.querySelector('#auth-form-jefe h3');
        const subtitle = document.querySelector('#auth-form-jefe p');
        const btnText = document.querySelector('#auth-form-jefe .btn-primary');
        const toggleBtn = document.getElementById('btn-toggle-register');

        if (this.isLoginMode) {
            title.textContent = i18n.t('auth_admin_title');
            subtitle.textContent = i18n.t('auth_admin_subtitle');
            btnText.textContent = i18n.t('auth_login_admin');
            toggleBtn.textContent = i18n.t('auth_register_link');
        } else {
            title.textContent = i18n.t('auth_create_account');
            subtitle.textContent = i18n.t('auth_register_subtitle');
            btnText.textContent = i18n.t('auth_create_account');
            toggleBtn.textContent = i18n.t('auth_login_link');
        }

        // Foco al cambiar de modo
        setTimeout(() => document.getElementById('auth-email-jefe')?.focus(), 100);
    }

    /**
     * Maneja el login del Jefe
     */
    async handleAuthJefe(e) {
        if (e && e.preventDefault) e.preventDefault();
        const email = document.getElementById('auth-email-jefe').value;
        const password = document.getElementById('auth-password-jefe').value;
        const errorDiv = document.getElementById('auth-error-jefe');
        const btn = document.querySelector('#auth-form-jefe button[type="submit"]');

        errorDiv.style.display = 'none';
        if (btn) btn.disabled = true;

        try {
            if (this.isLoginMode) {
                await supabaseClient.signIn(email, password);
                await navigation.setRole('admin');
                app.showToast(i18n.t('auth_welcome_admin'), 'success');
                this.updateCurrentUserDisplay(i18n.t('nav_gestor'));
                this.hideAuthScreen();
                // Opcional: recargar para asegurar sincronización
                // window.location.reload();
            } else {
                await supabaseClient.signUp(email, password);
                app.showToast(i18n.t('auth_account_created'), 'success');
                this.toggleMode();
            }
        } catch (error) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = error.message;
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Maneja el login del Empleado (PIN)
     */
    async handleAuthEmpleado() {
        if (this.currentPin.length < 4) return;

        const errorDiv = document.getElementById('auth-error-empleado');
        errorDiv.style.display = 'none';

        try {
            const user = await db.verifyPin(this.currentPin);
            if (user) {
                app.showToast(i18n.t('auth_welcome_user', { name: user.nombre }), 'success');
                localStorage.setItem('employee_session', JSON.stringify(user));
                await navigation.setRole(user.role || 'employee');
                this.updateCurrentUserDisplay(user.nombre);
                this.hideAuthScreen();
                this.currentPin = '';
                this.updatePinDisplay();
            } else {
                errorDiv.style.display = 'block';
                errorDiv.textContent = i18n.t('auth_error_pin');
                this.currentPin = '';
                this.updatePinDisplay();
            }
        } catch (error) {
            console.error('Verify PIN error:', error);
            errorDiv.style.display = 'block';
            errorDiv.textContent = i18n.t('err_verify_pin');
        }
    }

    /**
     * Cierra la sesión
     */
    handleLogout() {
        app.showConfirm(
            i18n.t('auth_logout_confirm_title'),
            i18n.t('auth_logout_confirm_msg'),
            async () => {
                try {
                    // Limpiar sesión Cloud si existe
                    if (window.supabaseClient) {
                        await supabaseClient.signOut();
                    }

                    // Limpiar storage local
                    localStorage.removeItem('employee_session');
                    localStorage.removeItem('user_role');
                    sessionStorage.removeItem('app_unlocked');

                    app.showToast('Sesión cerrada correctamente', 'success');

                    // Pequeña pausa para que se vea el toast antes de recargar
                    setTimeout(() => window.location.reload(), 1000);
                } catch (error) {
                    console.error('Logout error:', error);
                    app.showToast('Error al cerrar sesión', 'error');
                }
            }
        );
    }
}

// Inicializar
// Inicializar
// Inicializar
const authUI = new AuthUI();
window.authUI = authUI;
