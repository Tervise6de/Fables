// Exposes a single, tiny API to the game: achievement forwarding.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('steamAchievement', (id) => {
  ipcRenderer.send('steam-achievement', id);
});
