const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false, // Security: disable Node integration
            contextIsolation: true, // Security: enable context isolation
            preload: path.join(__dirname, 'preload.js'), // Use our preload script
            // Add security policies
            webSecurity: true,
            sandbox: true
        }
    });

    // Set Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': ["default-src 'self' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"]
            }
        });
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:3001');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
    }

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Handle IPC events
ipcMain.handle('open-folder', async (event, filePath) => {
    try {
        // Get the directory path from the file path
        const dirPath = path.dirname(filePath);
        
        // Show the folder in file explorer
        await shell.showItemInFolder(filePath);
        
        return { success: true };
    } catch (error) {
        console.error('Error opening folder:', error);
        return { success: false, error: error.message };
    }
}); 