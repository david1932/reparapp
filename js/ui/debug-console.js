/**
 * ReparApp Debug Console UI
 * Consola interactiva de desarrollo para diagnóstico y ejecución de comandos
 */

class DebugConsole {
    constructor() {
        this.overlay = document.getElementById('debug-terminal-overlay');
        this.output = document.getElementById('debug-terminal-output');
        this.input = document.getElementById('debug-terminal-input');
        
        this.history = [];
        this.historyIndex = -1;
        
        this.init();
    }

    init() {
        if (!this.overlay || !this.output || !this.input) return;

        // Key Listeners
        window.addEventListener('keydown', (e) => {
            // Toggle terminal on Ctrl + ~ (tilde / backtick) or Ctrl + Alt + D
            const isTilde = e.key === '`';
            const isAltD = e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd';
            
            if (isTilde || isAltD) {
                e.preventDefault();
                this.toggle();
            }
        });

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = this.input.value.trim();
                if (cmd) {
                    this.executeCommand(cmd);
                    this.input.value = '';
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.history.length > 0 && this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.input.value = this.history[this.history.length - 1 - this.historyIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.input.value = this.history[this.history.length - 1 - this.historyIndex];
                } else if (this.historyIndex === 0) {
                    this.historyIndex = -1;
                    this.input.value = '';
                }
            }
        });

        // Intercept console.log to write to terminal output in real time
        const originalLog = console.log;
        console.log = (...args) => {
            originalLog.apply(console, args);
            const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            this.writeLine(text, '#94a3b8'); // Grayish color for regular logs
        };

        const originalError = console.error;
        console.error = (...args) => {
            originalError.apply(console, args);
            const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            this.writeLine(`[Error] ${text}`, '#f87171'); // Soft red for errors
        };
    }

    toggle() {
        if (this.overlay.style.display === 'none' || !this.overlay.style.display) {
            this.overlay.style.display = 'flex';
            this.input.focus();
            this.writeLine('Consola de Diagnóstico Iniciada.', 'var(--status-success)');
        } else {
            this.overlay.style.display = 'none';
        }
    }

    writeLine(text, color = '#c5cdd8') {
        const line = document.createElement('div');
        line.style.color = color;
        line.textContent = text;
        this.output.appendChild(line);
        this.output.scrollTop = this.output.scrollHeight;
    }

    async executeCommand(line) {
        this.writeLine(`reparapp:$ ${line}`, '#fff');
        this.history.push(line);
        this.historyIndex = -1;
        
        const parts = line.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (cmd) {
            case 'help':
                this.writeLine('Comandos disponibles:', 'var(--electric-cyan)');
                this.writeLine('  help              - Muestra esta lista.');
                this.writeLine('  info              - Información del sistema y estadísticas generales.');
                this.writeLine('  db [stats]        - Estado e información de la base de datos local SQLite/IndexedDB.');
                this.writeLine('  sync              - Fuerza y visualiza el log del sincronizador de Supabase.');
                this.writeLine('  license           - Muestra los detalles de licencia y hardware hash.');
                this.writeLine('  clear             - Limpia la pantalla.');
                this.writeLine('  close             - Cierra la consola.');
                break;
                
            case 'info':
                this.writeLine(`Plataforma: Electron / Node.js (${process.versions.node})`, '#60a5fa');
                this.writeLine(`OS: Windows (${process.platform} - ${process.arch})`, '#60a5fa');
                this.writeLine(`Estado Red: ${navigator.onLine ? 'Online 🟢' : 'Offline 🔴'}`, '#60a5fa');
                this.writeLine(`Resolución: ${window.innerWidth}x${window.innerHeight}`, '#60a5fa');
                break;

            case 'db':
                try {
                    const clients = await db.getAllClientes();
                    const products = await db.getAllProducts();
                    const repairs = await db.searchReparaciones('', null);
                    this.writeLine(`--- Estadísticas de Base de Datos ---`, 'var(--status-pending)');
                    this.writeLine(`Clientes en Local: ${clients.length}`, '#38bdf8');
                    this.writeLine(`Productos en Inventario: ${products.length}`, '#38bdf8');
                    this.writeLine(`Reparaciones: ${repairs.length}`, '#38bdf8');
                } catch (err) {
                    this.writeLine(`Error cargando base de datos: ${err.message}`, '#f87171');
                }
                break;

            case 'sync':
                this.writeLine('Iniciando sincronización forzada...', 'var(--status-pending)');
                if (window.syncManager) {
                    try {
                        await window.syncManager.sync();
                        this.writeLine('Sincronización completada con éxito.', 'var(--status-success)');
                    } catch (err) {
                        this.writeLine(`Fallo en sincronización: ${err.message}`, '#f87171');
                    }
                } else {
                    this.writeLine('Error: syncManager no está disponible en este momento.', '#f87171');
                }
                break;

            case 'license':
                try {
                    const status = await db.getConfig('license_status');
                    const key = await db.getConfig('license_key');
                    const hwId = await db.getConfig('hardware_id') || 'No calculado';
                    this.writeLine(`--- Licencia ---`, 'var(--electric-purple)');
                    this.writeLine(`Estado: ${status === 'active' ? 'Activa 🟢' : 'Inactiva / Bloqueada 🔴'}`, '#d8b4fe');
                    this.writeLine(`Clave: ${key || 'Ninguna'}`, '#d8b4fe');
                    this.writeLine(`Hardware ID: ${hwId}`, '#d8b4fe');
                } catch (err) {
                    this.writeLine(`Error leyendo licencia: ${err.message}`, '#f87171');
                }
                break;

            case 'clear':
                this.output.innerHTML = '';
                break;

            case 'close':
                this.toggle();
                break;

            default:
                this.writeLine(`Comando no reconocido: '${cmd}'. Escribe 'help' para ver los comandos.`, '#f87171');
        }
    }
}

// Instanciar la consola de depuración globalmente
document.addEventListener('DOMContentLoaded', () => {
    window.debugConsole = new DebugConsole();
});
