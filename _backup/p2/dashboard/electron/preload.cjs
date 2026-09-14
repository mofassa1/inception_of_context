const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, cb) {
  const handler = (_event, value) => cb(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("ide", {
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  realPath: (rawPath) => ipcRenderer.invoke("fs:real-path", rawPath),
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggle-maximize"),
  close: () => ipcRenderer.send("win:close"),
  isMaximized: () => ipcRenderer.invoke("win:is-maximized"),
  onMaximizeChange: (cb) => subscribe("win:maximize-changed", cb),
  onMenu: (cb) => subscribe("menu:action", cb),
  getLaunchPaths: () => ipcRenderer.invoke("ide:launch-paths"),
  onOpenPaths: (cb) => subscribe("ide:open-paths", cb),
});
