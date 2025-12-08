const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('ibiki', {
    desktop: {
        notify: (title, body) => {
            return ipcRenderer.invoke('notify', title, body);
        },
        platform: process.platform
    }
});
