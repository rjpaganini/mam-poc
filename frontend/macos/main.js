// macOS Native Entry Point
const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, protocol, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.ELECTRON_START_URL != null || process.env.NODE_ENV === 'development';
const log = require('electron-log');

// Configure electron-log
log.initialize({ preload: true });

// Update electron-log configuration
log.transports.file.resolvePathFn = () => path.join(process.cwd(), 'logs', 'app', 'electron.log');
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
log.transports.file.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

// Rotate logs
log.transports.file.sync = true;
log.transports.file.getFile().clear();

// Replace console.log with electron-log
console.log = log.log;
console.error = log.error;
console.warn = log.warn;
console.info = log.info;
console.debug = log.debug;

// Log startup information
log.info('Starting application...');
log.info(`Environment: ${isDev ? 'development' : 'production'}`);
log.info(`User Data Path: ${app.getPath('userData')}`);

// All logging will now go through electron-log to the main logs directory
// No need for separate logging setup

// Register IPC handlers
ipcMain.handle('open-folder', async (event, filePath) => {
    try {
        // Show the file in Finder
        shell.showItemInFolder(filePath);
        log.info('Opening folder for file:', filePath);
        return { success: true };
    } catch (error) {
        log.error('Failed to open folder:', error);
        return { success: false, error: error.message };
    }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    log.info('Another instance is running. Quitting...');
    app.quit();
} else {
    // Handle second instance launch
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        log.info('Second instance detected, focusing main window');
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

    // Add retry logic for development URL
    async function waitForDevServer(url, maxRetries = 30) {
        const http = require('http');
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                await new Promise((resolve, reject) => {
                    const request = http.get(url, (response) => {
                        if (response.statusCode === 200) {
                            resolve();
                        } else {
                            reject(new Error(`Status code: ${response.statusCode}`));
                        }
                    });
                    request.on('error', reject);
                    request.end();
                });
                log.info('Development server is ready');
                return true;
            } catch (error) {
                log.info(`Waiting for development server... (${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return false;
    }

    async function createWindow() {
        if (mainWindow) {
            mainWindow.focus();
            return;
        }

        log.info('Creating window in', isDev ? 'development' : 'production', 'mode');
        
        if (isDev) {
            const devServerUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3001';
            log.info('Waiting for development server at:', devServerUrl);
            
            const serverReady = await waitForDevServer(devServerUrl);
            if (!serverReady) {
                log.error('Development server not ready after timeout');
                app.quit();
                return;
            }
        }
        
        // Create the browser window with native macOS chrome
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: true,
                webviewTag: true,
                allowRunningInsecureContent: false,
                // Enable all available plugins and codecs
                plugins: true,
                additionalArguments: [
                    '--max-old-space-size=4096',
                    '--max-heap-size=2048',
                    '--ignore-gpu-blacklist',
                    '--enable-gpu-rasterization',
                    '--enable-native-gpu-memory-buffers',
                    '--enable-accelerated-video-decode',
                    '--enable-accelerated-video',
                    '--force-video-overlays'
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

        // Capture renderer process errors
        mainWindow.webContents.on('render-process-gone', (event, details) => {
            log.error('Renderer process gone:', details);
        });

        mainWindow.webContents.on('crashed', () => {
            log.error('Renderer process crashed');
        });

        // Handle uncaught exceptions in the main process
        process.on('uncaughtException', (error) => {
            log.error('Uncaught Exception:', error);
            dialog.showErrorBox('Error', `An error occurred: ${error.message}`);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            log.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Register protocols before anything else
        protocol.registerFileProtocol('video', (request, callback) => {
            try {
                const videoPath = decodeURIComponent(request.url.replace('video://', ''));
                // Remove the media/ prefix before joining with base path
                const cleanPath = videoPath.replace('media/', '');
                // Use cleanPath directly if it's absolute, otherwise join with MEDIA_PATH
                const absolutePath = cleanPath.startsWith('/') 
                    ? cleanPath 
                    : path.join('/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos', cleanPath);
                
                log.log('Video request:', JSON.stringify({
                    url: request.url,
                    decodedPath: videoPath,
                    cleanPath,
                    absolutePath,
                    exists: fs.existsSync(absolutePath)
                }, null, 2));
                
                if (!fs.existsSync(absolutePath)) {
                    log.error('Video not found:', absolutePath);
                    callback({ error: -6 }); // NET::ERR_FILE_NOT_FOUND
                    return;
                }

                // Get file extension and set proper MIME type
                const ext = path.extname(absolutePath).toLowerCase();
                const additionalHeaders = {
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'no-cache, must-revalidate',
                    'Access-Control-Allow-Origin': 'http://localhost:3001',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Range, Accept, Content-Type',
                    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
                    'Content-Disposition': 'inline; filename="video' + ext + '"'
                };

                // Treat both MP4 and MOV as MP4 containers since they contain H.264
                let mimeType = 'video/mp4';
                additionalHeaders['Content-Type'] = 'video/mp4';
                if (ext === '.mov' || ext === '.mp4') {
                    additionalHeaders['X-Content-Type-Options'] = 'nosniff';
                }

                // Get file stats for range requests
                const stats = fs.statSync(absolutePath);
                const range = request.headers?.Range;
                
                if (range) {
                    const parts = range.replace(/bytes=/, '').split('-');
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
                    const chunksize = (end - start) + 1;
                    
                    additionalHeaders['Content-Range'] = `bytes ${start}-${end}/${stats.size}`;
                    additionalHeaders['Content-Length'] = chunksize;
                    additionalHeaders['Accept-Ranges'] = 'bytes';
                } else {
                    additionalHeaders['Content-Length'] = stats.size;
                }

                log.log('Video response:', JSON.stringify({
                    path: absolutePath,
                    mimeType,
                    size: stats.size,
                    extension: ext,
                    headers: additionalHeaders,
                    range: range || 'none'
                }, null, 2));

                callback({
                    path: absolutePath,
                    headers: additionalHeaders,
                    mimeType: mimeType
                });
            } catch (error) {
                log.error('Video protocol error:', error, {
                    stack: error.stack,
                    request: request.url
                });
                callback({ error: -2 });
            }
        });

        // Set proper CSP headers with additional media types
        mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self' file: video: http://localhost:* http://127.0.0.1:*;",
                        "connect-src 'self' file: video: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*;",
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
                        "style-src 'self' 'unsafe-inline';",
                        "img-src 'self' file: data: blob: http://localhost:* http://127.0.0.1:*;",
                        "media-src 'self' file: video: quicktime: http://localhost:* http://127.0.0.1:* blob:;"
                    ].join(' ')
                }
            });
        });

        // Register file protocol handler
        protocol.registerFileProtocol('file', (request, callback) => {
            try {
                const filePath = decodeURIComponent(request.url.replace('file://', ''));
                // Handle relative paths
                const absolutePath = filePath.startsWith('/') 
                    ? filePath 
                    : path.join('/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos', filePath);
                
                log.info('Attempting to load file:', absolutePath);
                
                if (fs.existsSync(absolutePath)) {
                    callback({ path: absolutePath });
                } else {
                    log.error('File not found:', absolutePath);
                    callback({ error: -6 }); // NET::ERR_FILE_NOT_FOUND
                }
            } catch (error) {
                log.error('Error handling file protocol:', error);
                callback({ error: -2 }); // NET::ERR_FAILED
            }
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
                log.log('Cache cleared and window reloaded');
                return { success: true };
            } catch (error) {
                log.error('Failed to clear cache:', error);
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

        // Load the app
        if (isDev) {
            const devServerUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3001';
            log.info('Loading URL:', devServerUrl);
            mainWindow.loadURL(devServerUrl);
            mainWindow.webContents.openDevTools();
        } else {
            log.info('Loading production build');
            mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
        }

        // Show window when ready
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
            log.info('Window shown');
        });

        // Handle window being closed
        mainWindow.on('closed', () => {
            mainWindow = null;
            log.info('Window closed');
        });

        // Handle text input context
        mainWindow.on('focus', () => {
            mainWindow.webContents.send('window-focused');
        });

        // Set security privileges for protocols
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            const url = webContents.getURL();
            if (permission === 'media') {
                callback(true);
            } else {
                callback(false);
            }
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
        log.info('App ready, creating window...');
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
        log.info('System going to sleep');
        // Save application state
    });

    powerMonitor.on('resume', () => {
        log.info('System waking up');
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