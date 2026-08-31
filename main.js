const { app, BrowserWindow, ipcMain, systemPreferences } = require('electron');
const path = require('path');
const errorLogger = require('./src/shared/logging/error-logger');

require('@electron/remote/main').initialize();

// Catch anything that would otherwise crash the app silently (from a
// technician's point of view) and write it to a log file instead.
process.on('uncaughtException', (error) => {
  errorLogger.logError('Main process uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  errorLogger.logError('Main process unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

class OATSApp {
  constructor() {
    this.mainWindow = null;
    this.loadingWindow = null;
  }

  async requestMicrophonePermission() {
    if (process.platform === 'darwin') {
      try {
        const microphoneAccess = systemPreferences.getMediaAccessStatus('microphone');
        console.log('Current microphone access status:', microphoneAccess);
        
        if (microphoneAccess !== 'granted') {
          console.log('Requesting microphone permission...');
          const granted = await systemPreferences.askForMediaAccess('microphone');
          console.log('Microphone permission granted:', granted);
          return granted;
        }
        return true;
      } catch (error) {
        console.error('Error requesting microphone permission:', error);
        return false;
      }
    }
    // On Windows/Linux, permissions are handled at OS level
    return true;
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

    this.loadingWindow.webContents.on('render-process-gone', (event, details) => {
      errorLogger.logError('Loading window renderer process gone', new Error(`reason=${details.reason}, exitCode=${details.exitCode}`));
    });
  }

  createMainWindow() {
    // Different window settings based on platform
    const windowOptions = {
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
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
    require('@electron/remote/main').enable(this.mainWindow.webContents);
    this.mainWindow.loadFile('src/renderer/pages/dashboard.html');
    this.mainWindow.setMenuBarVisibility(false);
    this.mainWindow.setTitle('');

    this.mainWindow.webContents.on('render-process-gone', (event, details) => {
      errorLogger.logError('Main window renderer process gone', new Error(`reason=${details.reason}, exitCode=${details.exitCode}`));
    });
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

  async initialize() {
    app.whenReady().then(async () => {
      // Request microphone permissions first
      await this.requestMicrophonePermission();
      
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

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.requestMicrophonePermission();
        this.createLoadingWindow();
        this.createMainWindow();
      }
    });
  }
}

// IPC handlers
ipcMain.on('loading-complete', () => {
  console.log('Loading completed');
});

// Add handler for checking microphone permission status
ipcMain.handle('check-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('microphone');
  }
  return 'granted'; // Assume granted on other platforms
});

// Add handler for requesting microphone permission from renderer
ipcMain.handle('request-microphone-permission', async () => {
  const oatsApp = new OATSApp();
  return await oatsApp.requestMicrophonePermission();
});

const oatsApp = new OATSApp();
oatsApp.initialize();