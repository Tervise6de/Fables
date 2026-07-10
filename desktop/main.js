// Electron shell for FINAL FORM. Loads the HTML5 game fullscreen and
// bridges achievements to Steamworks when the Steam client is present.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Steamworks is optional: the game runs fine without Steam (dev mode),
// and steamworks.js only loads when packaged with a valid steam_appid.txt.
let steam = null;
try {
  const steamworks = require('steamworks.js');
  steam = steamworks.init(); // reads steam_appid.txt next to the executable
  console.log('[steam] initialized as', steam.localplayer.getName());
} catch (e) {
  console.log('[steam] not available, running without Steamworks:', e.message);
}

// Required for steamworks.js IPC in sandboxed renderers.
try { require('steamworks.js').electronEnableSteamOverlay?.(); } catch { /* optional */ }

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#05040c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, app.isPackaged ? 'web/index.html' : '../web/index.html'));

  // F11 toggles fullscreen; Alt+F4 / Cmd+Q quit as usual.
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
    }
  });
}

ipcMain.on('steam-achievement', (_e, id) => {
  if (!steam) return;
  try {
    if (steam.achievement.activate(String(id))) steam.achievement.store?.();
  } catch (err) {
    console.log('[steam] achievement failed:', id, err.message);
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
