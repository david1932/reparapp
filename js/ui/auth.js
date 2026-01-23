/**
 * Auth UI Module
 * Gestión de la interfaz de autenticación
 */

class AuthUI {
    constructor() {
        this.isLoginMode = true;
    }

    /**
     * Inicializa el módulo
     */
    async init() {
        // Listeners
        document.getElementById('auth-form')?.addEventListener('submit', (e) => this.handleAuth(e));
        document.getElementById('btn-toggle-auth')?.addEventListener('click', (e) => this.toggleMode(e));

        // Verificar sesión al inicio
        await this.checkSession();
    }

    /**
     * Verifica si hay sesión activa
     */
    async checkSession() {
        const session = await supabaseClient.getSession();

        if (session) {
            console.log('Sesión activa:', session.user.email);
            this.hideAuthScreen();
            return true;
        } else {
            console.log('No hay sesión activa');
            this.showAuthScreen();
            return false;
        }
    }

    /**
     * Muestra la pantalla de autenticación
     */
    showAuthScreen() {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-container').style.filter = 'blur(5px)';
    }

    /**
     * Oculta la pantalla de autenticación
     */
    hideAuthScreen() {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-container').style.filter = 'none';
    }

    /**
     * Alterna entre Login y Registro
     */
    toggleMode(e) {
        e.preventDefault();
        this.isLoginMode = !this.isLoginMode;

        const title = document.getElementById('auth-subtitle');
        const btnText = document.getElementById('btn-auth-text');
        const switchText = document.getElementById('auth-switch-text');
        const toggleBtn = document.getElementById('btn-toggle-auth');
        const errorDiv = document.getElementById('auth-error');

        errorDiv.style.display = 'none';

        if (this.isLoginMode) {
            title.textContent = 'Inicia sesión para acceder';
            btnText.textContent = 'Iniciar Sesión';
            switchText.textContent = '¿No tienes cuenta?';
            toggleBtn.textContent = 'Regístrate';
        } else {
            title.textContent = 'Crea una cuenta nueva';
            btnText.textContent = 'Registrarse';
            switchText.textContent = '¿Ya tienes cuenta?';
            toggleBtn.textContent = 'Inicia Sesión';
        }
    }

    /**
     * Maneja el envío del formulario
     */
    async handleAuth(e) {
        e.preventDefault(); // IMPORTANTE: Prevenir recarga

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const errorDiv = document.getElementById('auth-error');
        const btn = e.target.querySelector('button[type="submit"]');

        // Reset error
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            if (this.isLoginMode) {
                // LOGIN
                await supabaseClient.signIn(email, password);
                app.showToast('Sesión iniciada correctamente', 'success');
                this.hideAuthScreen();

                // Recargar datos para este usuario
                window.location.reload();
            } else {
                // REGISTRO
                const data = await supabaseClient.signUp(email, password);

                if (data.user && !data.session) {
                    // Caso: Requiere confirmación de email
                    errorDiv.style.display = 'block';
                    errorDiv.style.background = 'rgba(0, 255, 198, 0.1)';
                    errorDiv.style.color = 'var(--text-primary)';
                    errorDiv.textContent = 'Registro exitoso. Por favor confirma tu email antes de iniciar sesión.';
                    this.toggleMode({ preventDefault: () => { } }); // Volver a login
                } else {
                    // Caso: Auto-login
                    app.showToast('Cuenta creada correctamente', 'success');
                    this.hideAuthScreen();
                    window.location.reload();
                }
            }
        } catch (error) {
            console.error('Auth error:', error);
            errorDiv.style.display = 'block';
            errorDiv.textContent = error.message;
        } finally {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}

// Inicializar
const authUI = new AuthUI();
