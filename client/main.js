import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const electron = require('electron');
const { app, BrowserWindow, desktopCapturer } = electron;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (app && typeof app.disableHardwareAcceleration === 'function') {
  app.disableHardwareAcceleration();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true
    },
    autoHideMenuBar: true,
    backgroundColor: '#141824'
  });

  if (mainWindow.webContents.session.setDisplayMediaRequestHandler) {
    mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        if (sources.length > 0) {
          callback({ video: sources[0], audio: 'loopback' });
        }
      });
    });
  }

  // Restrict permission requests instead of blind approval
  if (mainWindow.webContents.session.setPermissionRequestHandler) {
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media' || permission === 'display-capture') {
        callback(true);
      } else {
        callback(false);
      }
    });
  }

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

if (app) {
  app.whenReady().then(() => {
    createWindow();

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
}
