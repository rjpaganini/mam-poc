// Preload script for Electron
const { contextBridge, ipcRenderer } = require('electron');
let log;

try {
    // Try to require electron-log
    log = require('electron-log');
    
    // Configure renderer process logging
    log.transports.file.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    
    // Expose logging functionality to renderer
    contextBridge.exposeInMainWorld('electronLog', {
        info: (...args) => log.info(...args),
        warn: (...args) => log.warn(...args),
        error: (...args) => log.error(...args),
        debug: (...args) => log.debug(...args)
    });
} catch (error) {
    // Fallback logging if electron-log is not available
    const fallbackLog = {
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console)
    };
    
    contextBridge.exposeInMainWorld('electronLog', fallbackLog);
    console.warn('electron-log not available, using console fallback:', error);
}

// Expose any needed IPC communication
contextBridge.exposeInMainWorld('electron', {
    // Add any IPC methods you need here
    platform: process.platform
});

// Log that preload script has run
console.info('Preload script initialized'); 