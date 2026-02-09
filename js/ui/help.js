/**
 * Help & FAQ Module
 * Manages the documentation content inside Settings
 */
class HelpUI {
    constructor() {
        this.initialized = false;
    }

    init() {
        this.render();
        this.initialized = true;
    }

    render() {
        this.renderGuide();
        this.renderFAQ();
    }

    renderGuide() {
        const container = document.getElementById('help-content-guide');
        if (!container) return;

        const sections = [
            {
                title: i18n.t('help_guide_dash_title'),
                content: i18n.t('help_guide_dash_desc')
            },
            {
                title: i18n.t('help_guide_clients_title'),
                content: i18n.t('help_guide_clients_desc')
            },
            {
                title: i18n.t('help_guide_repairs_title'),
                content: i18n.t('help_guide_repairs_desc')
            },
            {
                title: i18n.t('help_guide_inventory_title'),
                content: i18n.t('help_guide_inventory_desc')
            },
            {
                title: i18n.t('help_guide_invoices_title'),
                content: i18n.t('help_guide_invoices_desc')
            }
        ];

        container.innerHTML = sections.map(sec => `
            <div style="margin-bottom: 20px;">
                <h4 style="color: var(--accent-color); margin-bottom: 8px; font-size: 1rem;">${sec.title}</h4>
                <p style="color: var(--text-secondary); line-height: 1.5; font-size: 0.9rem;">${sec.content}</p>
            </div>
        `).join('');
    }

    renderFAQ() {
        const container = document.getElementById('help-content-faq');
        if (!container) return;

        const faqs = [
            {
                q: i18n.t('help_faq_data_q'),
                a: i18n.t('help_faq_data_a')
            },
            {
                q: i18n.t('help_faq_pin_q'),
                a: i18n.t('help_faq_pin_a')
            },
            {
                q: i18n.t('help_faq_devices_q'),
                a: i18n.t('help_faq_devices_a')
            },
            {
                q: i18n.t('help_faq_backup_q'),
                a: i18n.t('help_faq_backup_a')
            }
        ];

        container.innerHTML = faqs.map(item => `
            <details style="margin-bottom: 12px; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; background: rgba(255,255,255,0.03);">
                <summary style="cursor: pointer; font-weight: 500; color: var(--text-primary); outline: none;">
                    ${item.q}
                </summary>
                <p style="margin-top: 10px; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4; padding-left: 5px;">
                    ${item.a}
                </p>
            </details>
        `).join('');
    }
}

// Global instance
window.helpUI = new HelpUI();
