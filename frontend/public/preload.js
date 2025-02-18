const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron', {
        openFolder: (path) => ipcRenderer.invoke('open-folder', path),
        // Add any other IPC methods you need here
    }
); 