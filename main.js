const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { exec, execSync } = require('child_process');
const licenseHandler = require('./src/main/license-handler');

let mainWindow;

// Initialize License Handler
// Moved to app.whenReady()

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // preload.js uses require('electron') which needs sandbox off
            preload: path.join(__dirname, 'preload.js'),
            // webSecurity: true // Default
        },
        backgroundColor: '#000000',
        show: false
    });

    mainWindow.loadFile('index.html');

    // mainWindow.webContents.openDevTools(); // Uncomment for debug

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // OPEN LINKS IN BROWSER
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

app.whenReady().then(() => {
    // Initialize License Handler safely
    licenseHandler.init();

    createWindow();

    // Periodic license revalidation (every 2 hours, like Android LicenseWorker)
    setInterval(() => {
        licenseHandler.revalidateOnline();
    }, 7200000); // 2 hours

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

let signatureServer = null;
let signatureServerPort = 8080;

function startSignatureServer() {
    if (signatureServer) return signatureServerPort;

    signatureServer = http.createServer((req, res) => {
        // Simple CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.url.startsWith('/remote_sign.html')) {
            const filePath = path.join(__dirname, 'remote_sign.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not Found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
            return;
        }

        if (req.url === '/upload-signature' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    console.log('Signature data received in main process for repair:', data.id);

                    const windows = BrowserWindow.getAllWindows();
                    if (windows.length > 0) {
                        windows[0].webContents.send('signature:received', data);
                        console.log('Signal sent to first available window');
                    } else {
                        console.error('No windows available to receive signature');
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    console.error('Error parsing signature upload:', e);
                    res.writeHead(400);
                    res.end('Bad Request');
                }
            });
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    });

    signatureServer.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            signatureServerPort++;
            startSignatureServer();
        }
    });

    signatureServer.listen(signatureServerPort);
    console.log(`Local Signature Server running on port ${signatureServerPort}`);
    return signatureServerPort;
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// IPC HANDLERS
// ==========================================

// --- License Handlers ---
ipcMain.handle('license:check', async () => {
    return licenseHandler.getLicense();
});

ipcMain.handle('license:activate', async (event, name, key) => {
    // console.log('Activating...', name, key);
    return licenseHandler.activate(name, key);
});

ipcMain.handle('license:get-hwid', async () => {
    return licenseHandler.getHardwareId();
});

ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.handle('app:get-local-ip', async () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
});

ipcMain.handle('signature:start-server', async () => {
    console.log('IPC: signature:start-server called');
    return startSignatureServer();
});

ipcMain.handle('signature:stop-server', async () => {
    console.log('IPC: signature:stop-server called');
    if (signatureServer) {
        signatureServer.close(() => {
            console.log('Local Signature Server stopped.');
        });
        signatureServer = null;
    }
    return true;
});

// --- Printer / Cash Drawer Handlers ---
ipcMain.handle('printer:open-drawer', async (event, printerName) => {
    if (!printerName) return { success: false, error: 'No printer name provided' };

    // Sanitize printer name to prevent command injection
    const safeName = printerName.replace(/[^a-zA-Z0-9\s\-_().]/g, '');
    if (safeName !== printerName) {
        console.warn('Printer name sanitized:', printerName, '->', safeName);
    }

    const tempScript = path.join(app.getPath('temp'), 'open_drawer.ps1');

    try {
        // Comando ESC/POS para abrir cajón: ASCII ESC p m t1 t2
        // Decimal: 27 112 0 25 250
        const scriptContent = `
$escPos = [char]27 + [char]112 + [char]0 + [char]25 + [char]250
$escPos | Out-Printer -Name "${safeName}"
`;
        fs.writeFileSync(tempScript, scriptContent, 'utf8');

        return new Promise((resolve) => {
            exec(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, (error) => {
                // Eliminar script temporal tras ejecución
                try { if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript); } catch (e) { }

                if (error) {
                    console.error('Error opening drawer:', error);
                    resolve({ success: false, error: error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    } catch (err) {
        console.error('Unexpected error opening drawer:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('security:check-os', async () => {
    let isVM = false;
    let details = '';
    
    try {
        if (process.platform === 'win32') {
            const manufacturer = execSync('powershell -Command "Get-CimInstance Win32_ComputerSystem | Select-Object -ExpandProperty Manufacturer"', { timeout: 3000 }).toString().toLowerCase();
            const model = execSync('powershell -Command "Get-CimInstance Win32_ComputerSystem | Select-Object -ExpandProperty Model"', { timeout: 3000 }).toString().toLowerCase();
            
            details = `${manufacturer.trim()} / ${model.trim()}`;
            
            if (manufacturer.includes('vmware') || 
                manufacturer.includes('virtualbox') || 
                manufacturer.includes('xen') || 
                manufacturer.includes('qemu') || 
                (manufacturer.includes('microsoft corporation') && model.includes('virtual')) ||
                model.includes('virtualbox') ||
                model.includes('vmware') ||
                model.includes('hvm') ||
                model.includes('kvm')) {
                isVM = true;
            }
        }
    } catch (e) {
        console.warn('Security BIOS Check failed:', e.message);
    }
    
    const windows = BrowserWindow.getAllWindows();
    const isDevToolsOpen = windows.some(w => w.webContents.isDevToolsOpened());
    
    return {
        isVM,
        isDevToolsOpen,
        details
    };
});

ipcMain.handle('printer:print-raw', async (event, printerName, rawText) => {
    if (!printerName) return { success: false, error: 'No printer name provided' };
    
    const safeName = printerName.replace(/[^a-zA-Z0-9\s\-_().]/g, '');
    const tempFile = path.join(app.getPath('temp'), `print_raw_${Date.now()}.txt`);
    const tempScript = path.join(app.getPath('temp'), `print_raw_${Date.now()}.ps1`);
    
    try {
        fs.writeFileSync(tempFile, rawText, 'utf8');
        const scriptContent = `Get-Content "${tempFile}" -Raw | Out-Printer -Name "${safeName}"`;
        fs.writeFileSync(tempScript, scriptContent, 'utf8');
        
        return new Promise((resolve) => {
            exec(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, (error) => {
                try {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
                } catch (e) {}
                
                if (error) {
                    resolve({ success: false, error: error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('printer:print-wifi', async (event, ip, port, rawText) => {
    const net = require('net');
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.setTimeout(5000);
        
        client.connect(port || 9100, ip, () => {
            client.write(Buffer.from(rawText, 'utf8'), () => {
                client.destroy();
                resolve({ success: true });
            });
        });
        
        client.on('error', (err) => {
            client.destroy();
            resolve({ success: false, error: err.message });
        });
        
        client.on('timeout', () => {
            client.destroy();
            resolve({ success: false, error: 'Connection timeout' });
        });
    });
});

ipcMain.handle('printer:print-com', async (event, comPort, rawText) => {
    const tempFile = path.join(app.getPath('temp'), `print_com_${Date.now()}.txt`);
    try {
        fs.writeFileSync(tempFile, rawText, 'utf8');
        return new Promise((resolve) => {
            exec(`cmd.exe /c "copy /b \\"${tempFile}\\" \\"${comPort}\\""`, (error) => {
                try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
                if (error) {
                    resolve({ success: false, error: error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// ==========================================
// ERROR HANDLING
// ==========================================
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});