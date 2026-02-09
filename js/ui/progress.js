/**
 * Progress UI Component
 * Shows a modal with a progress bar and status text
 */
class ProgressUI {
    constructor() {
        this.modal = null;
        this.progressBar = null;
        this.statusText = null;
        this.titleElement = null;
        this.createDOM();
    }

    createDOM() {
        this.modal = document.createElement('div');
        this.modal.id = 'progress-modal';
        this.modal.className = 'modal-overlay';
        this.modal.style.zIndex = '9999'; // Topmost

        this.modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <h3 id="progress-title" style="margin-bottom: 20px;">Procesando...</h3>
                
                <div class="progress-container" style="background: var(--bg-secondary); border-radius: 8px; height: 20px; overflow: hidden; margin-bottom: 10px;">
                    <div id="progress-bar" style="width: 0%; height: 100%; background: var(--accent-color); transition: width 0.3s ease;"></div>
                </div>
                
                <p id="progress-status" style="font-size: 0.9rem; color: var(--text-muted);">Iniciando...</p>
            </div>
        `;

        document.body.appendChild(this.modal);

        this.progressBar = this.modal.querySelector('#progress-bar');
        this.statusText = this.modal.querySelector('#progress-status');
        this.titleElement = this.modal.querySelector('#progress-title');
    }

    /**
     * Shows the progress modal
     * @param {string} title - Operation title
     */
    show(title = 'Procesando...') {
        this.titleElement.textContent = title;
        this.progressBar.style.width = '0%';
        this.statusText.textContent = 'Iniciando...';
        this.modal.classList.add('active');
    }

    /**
     * Updates the progress
     * @param {number} percent - 0 to 100
     * @param {string} text - Status message
     */
    update(percent, text) {
        // Clamp 0-100
        const p = Math.max(0, Math.min(100, percent));
        this.progressBar.style.width = `${p}%`;
        if (text) this.statusText.textContent = text;
    }

    /**
     * Hides the modal
     */
    hide() {
        this.modal.classList.remove('active');
    }
}
