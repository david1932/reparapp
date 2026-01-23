const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
    // Crear la ventana del navegador
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'icon.png'), // Asume que existe icono, si no, usa default
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Permitir acceso a APIs de Node si es necesario
            enableRemoteModule: true
        }
    });

    // Cargar el index.html de la app
    mainWindow.loadFile('index.html');

    // Ocultar el menú superior por defecto (opcional)
    mainWindow.setMenuBarVisibility(false);

    // Abrir DevTools en desarrollo (opcional)
    // mainWindow.webContents.openDevTools();
}

// Cuando Electron esté listo, crear ventana
app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Cerrar app cuando todas las ventanas se cierren (Windows/Linux)
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
