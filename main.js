const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

class OATSApp {
  constructor() {
    this.mainWindow = null;
    this.loadingWindow = null;
  }

  createLoadingWindow() {
    this.loadingWindow = new BrowserWindow({
      width: 800,
      height: 600,
      frame: false,
      alwaysOnTop: true,
      transparent: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(__dirname, 'src/assets/icon.png')
    });

    this.loadingWindow.loadFile('src/renderer/pages/loading.html');
    this.loadingWindow.setMenuBarVisibility(false);
    this.loadingWindow.center();
  }

  createMainWindow() {
    // Different window settings based on platform
    const windowOptions = {
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(__dirname, 'src/assets/icon.png')
    };

    // Platform-specific title bar handling
    if (process.platform === 'darwin') {
      windowOptions.titleBarStyle = 'hiddenInset';
    } else {
      windowOptions.frame = false;
    }

    this.mainWindow = new BrowserWindow(windowOptions);
    this.mainWindow.loadFile('src/renderer/pages/dashboard.html');
    this.mainWindow.setMenuBarVisibility(false);
    this.mainWindow.setTitle('');
  }

  showMainWindow() {
    if (this.loadingWindow) {
      this.loadingWindow.close();
      this.loadingWindow = null;
    }
    
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.center();
    }
  }

  initialize() {
    app.whenReady().then(() => {
      this.createLoadingWindow();
      this.createMainWindow();
      
      setTimeout(() => {
        this.showMainWindow();
      }, 3000);
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createLoadingWindow();
        this.createMainWindow();
      }
    });
  }
}

ipcMain.on('loading-complete', () => {
  console.log('Loading completed');
});

const oatsApp = new OATSApp();
oatsApp.initialize();