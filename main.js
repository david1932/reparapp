const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 5500;
let server;

// Servidor Estático Simple para "engañar" a Google Auth
function startServer() {
    server = http.createServer((req, res) => {
        // Fix: Ignorar query params (ej: ?v=123) para que no rompa la ruta del archivo
        const safeUrl = req.url.split('?')[0];
        let filePath = '.' + safeUrl;
        if (filePath === './') filePath = './index.html';

        const extname = path.extname(filePath);
        let contentType = 'text/html';
        switch (extname) {
            case '.js': contentType = 'text/javascript'; break;
            case '.css': contentType = 'text/css'; break;
            case '.json': contentType = 'application/json'; break;
            case '.png': contentType = 'image/png'; break;
            case '.jpg': contentType = 'image/jpg'; break;
            case '.svg': contentType = 'image/svg+xml'; break;
        }

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code == 'ENOENT') {
                    res.writeHead(404);
                    res.end('404 File Not Found');
                } else {
                    res.writeHead(500);
                    res.end('500 Internal Error: ' + error.code);
                }
            } else {
                const headers = {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                };
                res.writeHead(200, headers);
                res.end(content, 'utf-8');
            }
        });
    });

    server.listen(PORT, '127.0.0.1', () => {
    });
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: true // ACTIVADO para producción
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });

    // Cargar desde el servidor local 
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

    // Ocultar menú en producción
    mainWindow.setMenuBarVisibility(false);

    // Bloquear atajos de DevTools en producción (Ctrl+Shift+I)
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
            event.preventDefault();
        }
    });

    // Abrir enlaces externos en el navegador del sistema (WhatsApp, etc)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http') && !url.includes('127.0.0.1')) {
            require('electron').shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

app.whenReady().then(() => {
    // Sincronizar UserAgent globalmente en la sesión
    const { session } = require('electron');
    const modernChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    session.defaultSession.setUserAgent(modernChromeUA);

    startServer();
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
