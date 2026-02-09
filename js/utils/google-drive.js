/**
 * Google Drive Backup Utility
 * Handles authentication and file operations with Google Drive API
 */

class GoogleDriveManager {
    constructor() {
        // Remplazar con credenciales reales de Google Cloud Console
        // Remplazar con credenciales reales de Google Cloud Console
        // Production Client ID for ReparApp Web
        this.DEFAULT_CLIENT_ID = '296031856546-0rep5tgsvn0iqf3tq6gq8tgrjnph1n8i.apps.googleusercontent.com';
        this.CLIENT_ID = this.DEFAULT_CLIENT_ID;
        this.API_KEY = '';

        this.DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';

        this.tokenClient = null;
        this.accessToken = null;
        this.isInitialized = false;
    }

    /**
     * Inicializa el cliente de Google Identity
     */
    async init() {
        if (this.isInitialized) return;

        // Cargar ID dinámico desde IndexedDB
        if (typeof db !== 'undefined') {
            try {
                const stored = await db.getConfig('google_client_id');
                // Ignorar si es el email erróneo o está vacío
                if (stored && stored.trim() !== '' && !stored.includes('@')) {
                    this.CLIENT_ID = stored.trim();
                } else {
                    this.CLIENT_ID = this.DEFAULT_CLIENT_ID;
                }
            } catch (e) { console.error(e); }
        }

        if (!this.CLIENT_ID) {
            console.warn('Google Client ID not configured');
            if (typeof app !== 'undefined') {
                app.showToast('⚠️ Error interno: ID de Google no disponible.', 'error');
            }
            return;
        }

        if (typeof google === 'undefined') {
            console.error('Google GSI library not loaded.');
            if (typeof app !== 'undefined') app.showToast('Error: Librería de Google no cargada. Revisa tu conexión.', 'error');
            return;
        }

        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error !== undefined) {
                        console.error('Auth Error:', response);
                        if (typeof app !== 'undefined') app.showToast('Error de Autenticación: ' + JSON.stringify(response), 'error');
                        throw (response);
                    }
                    this.accessToken = response.access_token;
                    this.onAuthSuccess();
                },
            });
            this.isInitialized = true;
        } catch (error) {
            console.error('Error initializing Google Drive Manager:', error);
            if (typeof app !== 'undefined') app.showToast('Error de Inicialización: ' + error.message, 'error');
        }
    }

    /**
     * Inicia el flujo de autenticación (Popup)
     */
    async authenticate(callback) {
        this.onAuthSuccessCallback = callback;
        try {
            if (!this.tokenClient) await this.init();

            if (!this.tokenClient) {
                // Mensaje ya emitido en init()
                return;
            }

            // Request access token
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (e) {
            console.error("Auth Exception:", e);
            if (typeof app !== 'undefined') app.showToast('Excepción al conectar: ' + e.message, 'error');
        }
    }

    onAuthSuccess() {
        if (typeof app !== 'undefined') app.showToast('¡Autenticado con éxito!', 'success');
        if (this.onAuthSuccessCallback) {
            this.onAuthSuccessCallback(this.accessToken);
        }
    }

    /**
     * Sube un archivo a Google Drive
     * @param {string} content - Contenido del archivo (JSON string)
     * @param {string} fileName - Nombre del archivo
     */
    async uploadFile(content, fileName) {
        if (!this.accessToken) throw new Error('Not authenticated');

        const file = new Blob([content], { type: 'application/json' });
        const metadata = {
            'name': fileName,
            'mimeType': 'application/json',
            // 'parents': ['appDataFolder'] // Opcional: usara carpeta de app oculta
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken }),
            body: form
        });

        if (!response.ok) {
            let errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Lista los backups existentes
     */
    async listBackups() {
        if (!this.accessToken) throw new Error('Not authenticated');

        const query = encodeURIComponent("name contains 'reparapp_backup' and trashed = false");
        const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name, createdTime)&orderBy=createdTime desc`;

        const response = await fetch(url, {
            method: 'GET',
            headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken })
        });

        if (!response.ok) {
            throw new Error('List failed: ' + response.statusText);
        }

        const data = await response.json();
        return data.files;
    }

    /**
     * Descarga un archivo por ID
     */
    async downloadFile(fileId) {
        if (!this.accessToken) throw new Error('Not authenticated');

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

        const response = await fetch(url, {
            method: 'GET',
            headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken })
        });

        if (!response.ok) {
            throw new Error('Download failed: ' + response.statusText);
        }

        return await response.json(); // Asumiendo JSON
    }
}

// Instancia global
window.googleDriveManager = new GoogleDriveManager();
