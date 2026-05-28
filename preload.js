const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    license: {
        check: () => ipcRenderer.invoke('license:check'),
        activate: (name, key) => ipcRenderer.invoke('license:activate', name, key),
        getHwid: () => ipcRenderer.invoke('license:get-hwid')
    },
    app: {
        getVersion: () => ipcRenderer.invoke('app:get-version'),
        reload: () => ipcRenderer.send('app:reload'),
        toggleFullScreen: () => ipcRenderer.send('app:toggle-fullscreen'),
        quit: () => ipcRenderer.send('app:quit')
    },
    printer: {
        openDrawer: (printerName) => ipcRenderer.invoke('printer:open-drawer', printerName),
        printRaw: (printerName, rawText) => ipcRenderer.invoke('printer:print-raw', printerName, rawText),
        printWifi: (ip, port, rawText) => ipcRenderer.invoke('printer:print-wifi', ip, port, rawText),
        printCom: (comPort, rawText) => ipcRenderer.invoke('printer:print-com', comPort, rawText)
    },
    security: {
        checkOSSecurity: () => ipcRenderer.invoke('security:check-os')
    },
    signature: {
        getLocalIp: () => ipcRenderer.invoke('app:get-local-ip'),
        startServer: () => ipcRenderer.invoke('signature:start-server'),
        stopServer: () => ipcRenderer.invoke('signature:stop-server'),
        onReceived: (callback) => ipcRenderer.on('signature:received', (event, data) => callback(data))
    },
    openExternal: (url) => ipcRenderer.send('open-external', url)
});
