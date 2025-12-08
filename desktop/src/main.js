const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // Disable for file:// protocol
        },
        show: false,
        title: 'Ibiki SMS'
    });

    // Determine the correct URL to load
    let startUrl;
    
    if (app.isPackaged) {
        // Production - load from resources
        const publicPath = path.join(process.resourcesPath, 'public', 'index.html');
        if (fs.existsSync(publicPath)) {
            // Use file:// protocol
            startUrl = `file://${publicPath}`;
            console.log('Production URL:', startUrl);
        }
    } else {
        // Development
        const devPath = path.join(__dirname, '../../dist/public/index.html');
        if (fs.existsSync(devPath)) {
            startUrl = `file://${devPath}`;
            console.log('Development URL:', startUrl);
        }
    }

    if (!startUrl) {
        console.error('Could not determine start URL');
        mainWindow.loadURL(`data:text/html,<h1>Error: Could not find app files</h1>`);
        return;
    }

    // Load the URL
    mainWindow.loadURL(startUrl).catch(err => {
        console.error('Failed to load URL:', err);
        
        // Try alternative method
        try {
            mainWindow.loadFile(startUrl.replace('file://', ''));
        } catch (err2) {
            console.error('Alternative load also failed:', err2);
            mainWindow.loadURL(`data:text/html,<h1>Load Error</h1><p>${err2.message}</p>`);
        }
    });

    // Debug: Log all network requests
    mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        console.log('Request:', details.url);
        callback({ cancel: false });
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('Failed load:', { errorCode, errorDescription, validatedURL });
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.webContents.openDevTools(); // Always open DevTools for debugging
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ... rest of your tray and app code remains the same
// Copy from your existing main.js starting from createTray() function

app.whenReady().then(() => {
    createWindow();
    // createTray(); // Uncomment if you have tray code
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
