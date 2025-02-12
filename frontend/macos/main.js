// macOS Native Entry Point
const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.ELECTRON_START_URL != null || process.env.NODE_ENV === 'development';

// Enhanced logging setup with rotation
const LOG_PATH = path.join(app.getPath('userData'), 'logs');
const MAIN_LOG = path.join(LOG_PATH, 'main.log');
const RENDERER_LOG = path.join(LOG_PATH, 'renderer.log');
const ERROR_LOG = path.join(LOG_PATH, 'error.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_PATH)) {
    fs.mkdirSync(LOG_PATH, { recursive: true });
}

// Rotate logs if they exceed 10MB
const rotateLog = (logPath) => {
    try {
        if (fs.existsSync(logPath) && fs.statSync(logPath).size > 10 * 1024 * 1024) {
            fs.renameSync(logPath, `${logPath}.old`);
        }
    } catch (err) {
        console.error(`Failed to rotate log ${logPath}:`, err);
    }
};

// Enhanced logger with rotation
const logger = {
    log: (...args) => {
        rotateLog(MAIN_LOG);
        const message = `[${new Date().toISOString()}] INFO: ${args.join(' ')}\n`;
        fs.appendFileSync(MAIN_LOG, message);
        console.log(message.trim());
    },
    error: (...args) => {
        rotateLog(ERROR_LOG);
        const message = `[${new Date().toISOString()}] ERROR: ${args.join(' ')}\n`;
        fs.appendFileSync(ERROR_LOG, message);
        console.error(message.trim());
    }
};

// Capture uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

// Capture unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    logger.log('Another instance is running. Quitting...');
    app.quit();
} else {
    // Handle second instance launch
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        logger.log('Second instance detected, focusing main window');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Keep global references
    let mainWindow = null;
    let tray = null;

    // Native window state management
    const windowState = {
        isMaximized: false,
        bounds: { x: undefined, y: undefined, width: 1200, height: 800 }
    };

    // Create a fallback tray icon using nativeImage
    function createFallbackTrayIcon() {
        // Create a simple 16x16 transparent icon
        const icon = nativeImage.createEmpty();
        icon.addRepresentation({
            width: 16,
            height: 16,
            buffer: Buffer.alloc(16 * 16 * 4) // Transparent RGBA buffer
        });
        return icon;
    }

    function createTray() {
        try {
            const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
            const icon = require('fs').existsSync(trayIconPath) 
                ? nativeImage.createFromPath(trayIconPath)
                : createFallbackTrayIcon();
            
            tray = new Tray(icon);
            const contextMenu = Menu.buildFromTemplate(getMenuTemplate());
            tray.setToolTip('Media Asset Manager');
            tray.setContextMenu(contextMenu);
        } catch (error) {
            console.warn('Failed to create tray:', error);
            createFallbackMenu();
        }
    }

    function createWindow() {
        if (mainWindow) {
            mainWindow.focus();
            return;
        }

        console.log('Creating window in', isDev ? 'development' : 'production', 'mode');
        
        // Create the browser window with native macOS chrome
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                // Enable native file system access
                webviewTag: true,
                allowRunningInsecureContent: true,
                // Add memory limits
                additionalArguments: [
                    '--max-old-space-size=4096',
                    '--max-heap-size=2048'
                ]
            },
            // Enhanced macOS specific styling with proper window controls
            titleBarStyle: 'hiddenInset',
            trafficLightPosition: { x: 20, y: 20 },
            vibrancy: 'under-window',
            visualEffectState: 'active',
            transparent: true,
            frame: false,
            show: false,
            minWidth: 800,
            minHeight: 600
        });

        // Disable HTTP cache for thumbnails completely
        mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
            { urls: ['http://localhost:*/api/v1/thumbnails/*'] },
            (details, callback) => {
                callback({ 
                    requestHeaders: {
                        ...details.requestHeaders,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        // Add timestamp to force reload
                        'If-None-Match': Date.now().toString()
                    }
                });
            }
        );

        // Add IPC handler for clearing thumbnail cache
        ipcMain.handle('clear-thumbnail-cache', async () => {
            try {
                // Clear all caches
                await mainWindow.webContents.session.clearCache();
                await mainWindow.webContents.session.clearStorageData({
                    storages: ['cachestorage', 'filesystem', 'shadercache', 'localstorage']
                });
                // Force reload the window
                await mainWindow.webContents.reload();
                logger.log('Cache cleared and window reloaded');
                return { success: true };
            } catch (error) {
                logger.error('Failed to clear cache:', error);
                return { success: false, error: error.message };
            }
        });

        // Save window state on changes
        ['resize', 'move'].forEach(eventName => {
            mainWindow.on(eventName, () => {
                if (!mainWindow.isMaximized()) {
                    windowState.bounds = mainWindow.getBounds();
                }
                windowState.isMaximized = mainWindow.isMaximized();
            });
        });

        // Handle window controls
        ipcMain.on('window-controls', (_, command) => {
            switch (command) {
                case 'minimize':
                    mainWindow.minimize();
                    break;
                case 'maximize':
                    if (mainWindow.isMaximized()) {
                        mainWindow.unmaximize();
                    } else {
                        mainWindow.maximize();
                    }
                    break;
                case 'close':
                    mainWindow.close();
                    break;
            }
        });

        // Set CSP headers for both dev and prod
        mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self' http://localhost:* http://127.0.0.1:*;",
                        "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*;",
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
                        "style-src 'self' 'unsafe-inline';",
                        "img-src 'self' data: blob: http://localhost:* http://127.0.0.1:*;",
                        "media-src 'self' http://localhost:* http://127.0.0.1:* blob:;"
                    ].join(' ')
                }
            });
        });

        // Register file protocol for media (in both dev and prod)
        protocol.registerFileProtocol('file', (request, callback) => {
            const filePath = decodeURI(request.url.replace('file://', ''));
            callback({ path: filePath });
        });

        // Load the app
        const startUrl = isDev
            ? process.env.ELECTRON_START_URL || 'http://localhost:3001'
            : `file://${path.join(__dirname, '../build/index.html')}`;
        
        console.log('Loading URL:', startUrl);
        
        // Enhanced error handling for loadURL
        mainWindow.loadURL(startUrl).catch(err => {
            console.error('Failed to load URL:', err);
            dialog.showErrorBox('Loading Error', 
                `Failed to load application: ${err.message}\nURL: ${startUrl}`);
        });

        // Development tools
        if (isDev) {
            mainWindow.webContents.openDevTools();
            console.log('DevTools opened');
        }

        // Show window when ready
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
        });

        // Handle window being closed
        mainWindow.on('closed', () => {
            mainWindow = null;
        });

        // Handle text input context
        mainWindow.on('focus', () => {
            mainWindow.webContents.send('window-focused');
        });
    }

    // System health check
    async function checkSystemHealth() {
        try {
            const response = await fetch('http://localhost:5001/api/v1/health');
            const health = await response.json();
            if (health.status === 'healthy') {
                dialog.showMessageBox({
                    type: 'info',
                    title: 'System Health',
                    message: 'All systems operational',
                    detail: `Backend: ${health.status}\nDisk Usage: ${health.disk_usage}%`
                });
            } else {
                dialog.showErrorBox('System Health Warning', 
                    `System status: ${health.status}\nCheck logs for details.`);
            }
        } catch (error) {
            dialog.showErrorBox('Health Check Failed', 
                'Could not connect to backend service.');
        }
    }

    // IPC Communication
    ipcMain.on('check-health', () => {
        checkSystemHealth();
    });

    ipcMain.on('open-file-dialog', async (event) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Media Files', extensions: ['mp4', 'mov', 'avi', 'mkv'] }
            ]
        });
        event.reply('selected-files', result.filePaths);
    });

    // App lifecycle
    app.whenReady().then(() => {
        // Register file protocol
        protocol.registerFileProtocol('file', (request, callback) => {
            const filePath = request.url.replace('file://', '');
            callback({ path: decodeURI(filePath) });
        });

        console.log('App ready, creating window...');
        createWindow();
        createTray();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (mainWindow === null) {
            createWindow();
        } else {
            mainWindow.show();
        }
    });

    // Handle system sleep/wake
    const powerMonitor = require('electron').powerMonitor;

    powerMonitor.on('suspend', () => {
        console.log('System going to sleep');
        // Save application state
    });

    powerMonitor.on('resume', () => {
        console.log('System waking up');
        // Reconnect to services
        checkSystemHealth();
    });

    // Separated menu template
    function getMenuTemplate() {
        return [
            { label: 'Show App', click: () => mainWindow?.show() },
            { label: 'Check Health', click: () => checkSystemHealth() },
            { type: 'separator' },
            { label: 'Quit', click: () => app.quit() }
        ];
    }

    // Fallback menu creation
    function createFallbackMenu() {
        const appMenu = Menu.buildFromTemplate(getMenuTemplate());
        Menu.setApplicationMenu(appMenu);
    }
} 