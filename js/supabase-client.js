/**
 * Supabase Client Module
 * Conexión con el backend en la nube
 */

// Configuración de Supabase
// Credenciales del proyecto
const SUPABASE_CONFIG = {
    url: 'https://yihgvgsajrncsamkwjlq.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA'
};

class SupabaseClient {
    constructor() {
        this.url = SUPABASE_CONFIG.url;
        this.anonKey = SUPABASE_CONFIG.anonKey;

        // Si ya hay configuración por defecto (hardcodeada), marcar como configurado
        if (this.url && this.anonKey) {
            this.isConfigured = true;
        } else {
            this.isConfigured = false;
        }
    }

    /**
     * Verifica si el cliente está configurado
     */
    checkConfiguration() {
        this.isConfigured = this.url !== '' && this.anonKey !== '';
        return this.isConfigured;
    }

    /**
     * Configura las credenciales de Supabase
     */
    configure(url, anonKey) {
        this.url = url;
        this.anonKey = anonKey;
        SUPABASE_CONFIG.url = url;
        SUPABASE_CONFIG.anonKey = anonKey;
        this.isConfigured = true;

        // Guardar en localStorage para persistencia
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', anonKey);
    }

    /**
     * Carga configuración guardada
     */
    loadConfiguration() {
        const savedUrl = localStorage.getItem('supabase_url');
        const savedKey = localStorage.getItem('supabase_key');

        if (savedUrl && savedKey) {
            this.configure(savedUrl, savedKey);
            return true;
        }
        return false;
    }

    /**
     * Headers comunes para requests
     */
    getHeaders() {
        return {
            'apikey': this.anonKey,
            'Authorization': `Bearer ${this.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    /**
     * Hace una petición al API de Supabase
     */
    async request(endpoint, options = {}) {
        if (!this.isConfigured) {
            throw new Error('Supabase no está configurado');
        }

        const url = `${this.url}/rest/v1/${endpoint}`;

        // Obtener token de sesión actual si existe
        const session = await this.getSession();
        const token = session?.access_token;

        const headers = {
            ...this.getHeaders(),
            ...options.headers
        };

        // Si hay token de usuario, usarlo en lugar de la anon key para RLS
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers: headers
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error de API: ${response.status} - ${error}`);
        }

        // DELETE y algunos otros métodos pueden no devolver JSON
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    // ==================== AUTHENTICATION ====================

    /**
     * Iniciar sesión con email y contraseña
     */
    async signIn(email, password) {
        if (!this.isConfigured) throw new Error('Supabase no configurado');

        const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': this.anonKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error_description || data.msg || 'Error al iniciar sesión');

        this.saveSession(data);
        return data;
    }

    /**
     * Registrarse con email y contraseña
     */
    async signUp(email, password) {
        if (!this.isConfigured) throw new Error('Supabase no configurado');

        const response = await fetch(`${this.url}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'apikey': this.anonKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || data.error?.message || 'Error al registrarse');

        // Si autoconfirm está activado, guardamos sesión si viene
        if (data.access_token) {
            this.saveSession(data);
        }

        return data;
    }

    /**
     * Cerrar sesión
     */
    async signOut() {
        if (!this.isConfigured) return;

        const token = localStorage.getItem('supabase_access_token');
        if (token) {
            try {
                await fetch(`${this.url}/auth/v1/logout`, {
                    method: 'POST',
                    headers: {
                        'apikey': this.anonKey,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (e) {
                console.error('Error logout:', e);
            }
        }

        this.clearSession();
    }

    /**
     * Obtener usuario actual
     */
    async getUser() {
        const session = await this.getSession();
        return session?.user || null;
    }

    /**
     * Obtener sesión actual (valida expiración)
     */
    async getSession() {
        const token = localStorage.getItem('supabase_access_token');
        if (!token) return null;

        const expiresAt = parseInt(localStorage.getItem('supabase_expires_at') || '0');
        if (Date.now() / 1000 > expiresAt) {
            // Token expirado, intentar refresh (simplificado: logout)
            this.clearSession();
            return null;
        }

        return {
            access_token: token,
            user: JSON.parse(localStorage.getItem('supabase_user') || 'null')
        };
    }

    /**
     * Guardar sesión en local
     */
    saveSession(data) {
        if (data.access_token) {
            localStorage.setItem('supabase_access_token', data.access_token);
            localStorage.setItem('supabase_expires_in', data.expires_in);
            localStorage.setItem('supabase_expires_at', Math.floor(Date.now() / 1000) + data.expires_in);
            localStorage.setItem('supabase_user', JSON.stringify(data.user));
            if (data.refresh_token) {
                localStorage.setItem('supabase_refresh_token', data.refresh_token);
            }
        }
    }

    /**
     * Limpiar sesión
     */
    clearSession() {
        localStorage.removeItem('supabase_access_token');
        localStorage.removeItem('supabase_expires_in');
        localStorage.removeItem('supabase_expires_at');
        localStorage.removeItem('supabase_user');
        localStorage.removeItem('supabase_refresh_token');
    }

    // ==================== CLIENTES ====================

    /**
     * Obtiene todos los clientes
     */
    async getClientes() {
        return this.request('clientes?select=*');
    }

    /**
     * Obtiene clientes modificados después de un timestamp
     */
    async getClientesModifiedAfter(timestamp) {
        return this.request(`clientes?select=*&ultima_modificacion=gt.${timestamp}`);
    }

    /**
     * Obtiene un cliente por ID
     */
    async getCliente(id) {
        const result = await this.request(`clientes?id=eq.${id}`);
        return result[0] || null;
    }

    /**
     * Crea un cliente
     */
    async createCliente(cliente) {
        const result = await this.request('clientes', {
            method: 'POST',
            body: JSON.stringify(cliente)
        });
        return result[0];
    }

    /**
     * Actualiza un cliente
     */
    async updateCliente(id, cliente) {
        const result = await this.request(`clientes?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(cliente)
        });
        return result[0];
    }

    /**
     * Upsert cliente (crear o actualizar)
     */
    async upsertCliente(cliente) {
        const result = await this.request('clientes', {
            method: 'POST',
            headers: {
                'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(cliente)
        });
        return result[0];
    }

    /**
     * Elimina un cliente
     */
    async deleteCliente(id) {
        await this.request(`clientes?id=eq.${id}`, {
            method: 'DELETE'
        });
        return true;
    }

    // ==================== REPARACIONES ====================

    /**
     * Obtiene todas las reparaciones
     */
    async getReparaciones() {
        return this.request('reparaciones?select=*');
    }

    /**
     * Obtiene reparaciones modificadas después de un timestamp
     */
    async getReparacionesModifiedAfter(timestamp) {
        return this.request(`reparaciones?select=*&ultima_modificacion=gt.${timestamp}`);
    }

    /**
     * Obtiene una reparación por ID
     */
    async getReparacion(id) {
        const result = await this.request(`reparaciones?id=eq.${id}`);
        return result[0] || null;
    }

    /**
     * Obtiene reparaciones por cliente
     */
    async getReparacionesByCliente(clienteId) {
        return this.request(`reparaciones?cliente_id=eq.${clienteId}`);
    }

    /**
     * Crea una reparación
     */
    async createReparacion(reparacion) {
        const result = await this.request('reparaciones', {
            method: 'POST',
            body: JSON.stringify(reparacion)
        });
        return result[0];
    }

    /**
     * Actualiza una reparación
     */
    async updateReparacion(id, reparacion) {
        const result = await this.request(`reparaciones?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(reparacion)
        });
        return result[0];
    }

    /**
     * Upsert reparación (crear o actualizar)
     */
    async upsertReparacion(reparacion) {
        const result = await this.request('reparaciones', {
            method: 'POST',
            headers: {
                'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(reparacion)
        });
        return result[0];
    }

    /**
     * Elimina una reparación
     */
    async deleteReparacion(id) {
        await this.request(`reparaciones?id=eq.${id}`, {
            method: 'DELETE'
        });
        return true;
    }

    // ==================== TEST CONNECTION ====================

    /**
     * Prueba la conexión con Supabase
     */
    async testConnection() {
        try {
            await this.request('clientes?limit=1');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==================== FACTURAS ====================

    /**
     * Obtiene todas las facturas
     */
    async getFacturas() {
        return this.request('facturas?select=*');
    }

    /**
     * Obtiene facturas modificadas después de un timestamp
     */
    async getFacturasModifiedAfter(timestamp) {
        return this.request(`facturas?select=*&ultima_modificacion=gt.${timestamp}`);
    }

    /**
     * Obtiene una factura por ID
     */
    async getFactura(id) {
        const result = await this.request(`facturas?id=eq.${id}`);
        return result[0] || null;
    }

    /**
     * Crea una factura
     */
    async createFactura(factura) {
        const result = await this.request('facturas', {
            method: 'POST',
            body: JSON.stringify(factura)
        });
        return result[0];
    }

    /**
     * Actualiza una factura
     */
    async updateFactura(id, factura) {
        const result = await this.request(`facturas?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(factura)
        });
        return result[0];
    }

    /**
     * Elimina una factura
     */
    async deleteFactura(id) {
        await this.request(`facturas?id=eq.${id}`, {
            method: 'DELETE'
        });
        return true;
    }
}

// Instancia global
const supabaseClient = new SupabaseClient();
