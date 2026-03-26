const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Check if we are running in dev mode
  const isDev = process.env.NODE_ENV === 'development';
  
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Excalidraw Clone',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // Open the DevTools automatically if desired
    // win.webContents.openDevTools();
  } else {
    // In production, load the built static HTML index
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// When Electron has finished initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS (darwin)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window when the dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
