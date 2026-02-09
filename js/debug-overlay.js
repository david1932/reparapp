/**
 * Debug Overlay - Intercepts console logs and shows them on screen
 */
(function () {
    const overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    overlay.style.cssText = `
        position: fixed;
        bottom: 0;
        right: 0;
        width: 100%;
        height: 200px;
        background: rgba(0, 0, 0, 0.9);
        color: lime;
        font-family: monospace;
        font-size: 12px;
        z-index: 99999;
        overflow-y: auto;
        padding: 10px;
        pointer-events: none; /* Let clicks pass through */
        border-top: 2px solid red;
    `;
    document.body.appendChild(overlay);

    function logToOverlay(type, args) {
        const line = document.createElement('div');
        line.textContent = `[${type}] ${args.map(a => {
            if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack}`;
            return (typeof a === 'object' ? JSON.stringify(a) : String(a));
        }).join(' ')}`;

        if (type === 'ERROR') line.style.color = 'red';
        if (type === 'WARN') line.style.color = 'orange';

        overlay.appendChild(line);
        overlay.scrollTop = overlay.scrollHeight;
    }

    // Hijack console
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function (...args) {
        originalLog.apply(console, args);
        logToOverlay('LOG', args);
    };

    console.error = function (...args) {
        originalError.apply(console, args);
        logToOverlay('ERROR', args);
        alert('DEBUGGER CAUGHT ERROR:\n' + args.join('\n')); // Force alert on error
    };

    console.warn = function (...args) {
        originalWarn.apply(console, args);
        logToOverlay('WARN', args);
    };

    // Global Error Handler
    window.onerror = function (msg, url, line, col, error) {
        logToOverlay('CRITICAL', [`${msg} at ${url}:${line}:${col}`]);
        alert('CRITICAL ERROR:\n' + msg);
        return false;
    };

})();
