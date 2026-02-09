/**
 * I18n Manager
 * Maneja las traducciones y la actualización de la interfaz
 */

class I18n {
    constructor() {
        // 1. Prioridad: Preferencia guardada
        // 2. Segunda opción: Idioma del navegador (si es soportado)
        // 3. Por defecto: Español
        const saved = localStorage.getItem('app_language');
        const browserLang = navigator.language.split('-')[0];
        this.availableLocales = ['es', 'en', 'fr', 'pt'];

        if (saved && this.availableLocales.includes(saved)) {
            this.currentLocale = saved;
        } else if (this.availableLocales.includes(browserLang)) {
            this.currentLocale = browserLang;
        } else {
            this.currentLocale = 'es';
        }

        this.translations = { es, en, fr, pt };
    }

    /**
     * Inicializa el sistema de traducción
     */
    init() {
        this.applyTranslations();
    }

    /**
     * Traduce una clave
     * @param {string} key Clave de traducción
     * @param {Object} params Parámetros dinámicos
     */
    t(key, params = {}) {
        const localeData = this.translations[this.currentLocale] || this.translations['es'];
        let text = localeData[key] || key;

        // Reemplazar parámetros {PARAM}
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(new RegExp(`{${k}}`, 'g'), v);
        }

        return text;
    }

    /**
     * Cambia el idioma actual
     * @param {string} locale Código de idioma
     */
    setLocale(locale) {
        if (this.availableLocales.includes(locale)) {
            this.currentLocale = locale;
            localStorage.setItem('app_language', locale);
            this.applyTranslations();

            // Opcional: Notificar a otros módulos si es necesario
            console.log(`Idioma cambiado a: ${locale}`);

            // Forzar actualización de vistas si están activas
            if (window.navigation) {
                navigation.refreshView(navigation.getCurrentView());
            }

            // Actualizar dashboard
            if (window.app) {
                app.renderDashboard();
            }

            // Actualizar plantillas si estamos en ajustes
            if (window.settingsUI) {
                settingsUI.loadTemplates();
            }

            // Actualizar ayuda
            if (window.helpUI) {
                helpUI.init();
            }
        }
    }

    /**
     * Aplica las traducciones a todos los elementos con data-i18n
     */
    applyTranslations() {
        // 1. Traducir contenido de texto (data-i18n)
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);

            // Si es un input/textarea sin placeholder específico, traducimos el value o texto
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.type === 'button' || el.type === 'submit') {
                    el.value = translation;
                }
            } else {
                el.textContent = translation;
            }
        });

        // 2. Traducir placeholders (data-i18n-placeholder)
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // 3. Traducir títulos/tooltips (data-i18n-title)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        // 4. Actualizar el atributo lang del HTML
        document.documentElement.lang = this.currentLocale;
    }
}

// Instancia global
const i18n = new I18n();
