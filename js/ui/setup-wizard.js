/**
 * Setup Wizard Module
 * Guides the user through initial configuration (Shop Info -> Admin Account)
 */
class SetupWizard {
    constructor() {
        this.currentStep = 1;
        this.wizardPane = document.getElementById('setup-wizard-overlay');
        this.steps = document.querySelectorAll('.wizard-step');

        this.initForms();
    }

    initForms() {
        const shopForm = document.getElementById('wizard-form-shop');
        if (shopForm) {
            shopForm.onsubmit = (e) => {
                e.preventDefault();
                this.saveShopInfo();
            };
        }

        const adminForm = document.getElementById('wizard-form-admin');
        if (adminForm) {
            adminForm.onsubmit = (e) => {
                e.preventDefault();
                this.createFinalAdmin();
            };
        }
    }

    show() {
        if (this.wizardPane) {
            this.wizardPane.style.display = 'flex';
            this.setStep(1);
        }
    }

    hide() {
        if (this.wizardPane) {
            this.wizardPane.style.display = 'none';
        }
    }

    setStep(stepNumber) {
        this.currentStep = stepNumber;
        this.steps.forEach(step => {
            const sNum = parseInt(step.dataset.step);
            step.style.display = (sNum === stepNumber) ? 'block' : 'none';
        });
    }

    nextStep() {
        if (this.currentStep < this.steps.length) {
            this.setStep(this.currentStep + 1);
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.setStep(this.currentStep - 1);
        }
    }

    async saveShopInfo() {
        const name = document.getElementById('wizard-shop-name').value;
        const nif = document.getElementById('wizard-shop-nif').value;
        const address = document.getElementById('wizard-shop-address').value;

        try {
            await db.setConfig('company_name', name);
            if (nif) await db.setConfig('company_dni', nif);
            if (address) await db.setConfig('company_address', address);

            app.showToast(i18n.t('toast_saved'), 'success');
            this.nextStep();
        } catch (error) {
            console.error('Error saving shop info:', error);
            app.showToast(i18n.t('toast_error'), 'error');
        }
    }

    async createFinalAdmin() {
        const nombre = document.getElementById('wizard-admin-name').value;
        const pin = document.getElementById('wizard-admin-pin').value;

        if (pin.length !== 4) {
            app.showToast(i18n.t('auth_error_pin_length'), 'warning');
            return;
        }

        try {
            // 1. Create the REAL admin
            const newAdmin = {
                id: db.generateUUID(),
                nombre: nombre,
                role: 'admin',
                pin: pin,
                fecha_creacion: db.getTimestamp()
            };
            await db.saveUser(newAdmin);

            // 2. Identify the rescue user "Jefe (Rescate)" to delete it
            const allUsers = await db.getAllUsers();
            const rescueUser = allUsers.find(u => u.nombre === 'Jefe (Rescate)' && u.pin === '1234');

            if (rescueUser) {
                await db.deleteUser(rescueUser.id);
            }

            app.showToast(i18n.t('wiz_finish_success'), 'success');

            // 3. Force Log Out and Refresh
            setTimeout(() => {
                localStorage.removeItem('employee_session');
                localStorage.removeItem('user_role');
                localStorage.removeItem('user_session');
                localStorage.removeItem('admin_session');
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('Error in final setup:', error);
            app.showToast(i18n.t('toast_error'), 'error');
        }
    }
}

// Global instance
window.setupWizard = new SetupWizard();
