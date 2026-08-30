const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ide", {
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
});
