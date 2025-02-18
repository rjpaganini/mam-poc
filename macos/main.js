const { app, BrowserWindow, ipcMain, shell, protocol } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const log = require('electron-log');
const fs = require('fs');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Keep a global reference of the window object
let mainWindow;

// Register custom protocol
function registerProtocols() {
    protocol.registerFileProtocol('media', (request, callback) => {
        try {
            const filePath = decodeURIComponent(request.url.replace('media://', ''));
            const mediaPath = '/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos';
            const absolutePath = path.join(mediaPath, filePath);
            
            log.info('Media request:', {
                url: request.url,
                decodedPath: filePath,
                absolutePath: absolutePath,
                exists: fs.existsSync(absolutePath)
            });
            
            if (!fs.existsSync(absolutePath)) {
                log.error('Media file not found:', absolutePath);
                callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
                return;
            }

            callback({
                path: absolutePath,
                headers: {
                    'Content-Type': 'video/mp4',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (error) {
            log.error('Protocol error:', error);
            callback({ error: -2 }); // net::FAILED
        }
    });
}

function createWindow() {
    log.info('Creating window...');
    
    // Create the browser window with macOS-specific optimizations
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        titleBarStyle: 'hiddenInset', // macOS-specific
        trafficLightPosition: { x: 20, y: 20 }, // macOS-specific
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            sandbox: true
        }
    });

    // Set Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' http://localhost:* ws://localhost:*; " +
                    "script-src 'self' 'unsafe-inline'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "media-src 'self' media: file: http://localhost:* blob:; " +
                    "img-src 'self' http://localhost:* data: blob:;"
                ]
            }
        });
    });

    // Load the app
    if (isDev) {
        log.info('Loading development URL:', process.env.ELECTRON_START_URL);
        mainWindow.loadURL(process.env.ELECTRON_START_URL);
        mainWindow.webContents.openDevTools();
    } else {
        log.info('Loading production build');
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        log.info('Window ready to show');
        mainWindow.show();
    });

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        log.info('Window closed');
        mainWindow = null;
    });

    log.info('Window created successfully');
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    log.info('Application ready, creating window...');
    registerProtocols();
    createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    log.info('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    log.info('Application activated');
    if (mainWindow === null) {
        createWindow();
    }
});

// Handle IPC events with proper error handling
ipcMain.handle('open-folder', async (event, filePath) => {
    try {
        log.info('Opening folder:', filePath);
        await shell.showItemInFolder(filePath);
        return { success: true };
    } catch (error) {
        log.error('Failed to open folder:', error);
        return { 
            success: false, 
            error: error.message,
            details: {
                code: error.code,
                filePath: filePath
            }
        };
    }
}); 