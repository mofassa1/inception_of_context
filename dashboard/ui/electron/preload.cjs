const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = {
  GET_LAUNCH_PATHS: "ide:launch-paths",
  OPEN_PATHS: "ide:open-paths",
  MENU_ACTION: "menu:action",
  PICK_FOLDER: "pick-folder",
  RESOLVE_REAL_PATH: "fs:real-path",
  MINIMIZE_WINDOW: "win:minimize",
  TOGGLE_MAXIMIZE_WINDOW: "win:toggle-maximize",
  CLOSE_WINDOW: "win:close",
  IS_WINDOW_MAXIMIZED: "win:is-maximized",
  MAXIMIZE_CHANGED: "win:maximize-changed",
};

function listenToMain(channel, callback) {
  function listener(_event, value) {
    callback(value);
  }

  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("ide", {
  pickFolder: () => ipcRenderer.invoke(CHANNELS.PICK_FOLDER),
  realPath: (rawPath) => ipcRenderer.invoke(CHANNELS.RESOLVE_REAL_PATH, rawPath),
  minimize: () => ipcRenderer.send(CHANNELS.MINIMIZE_WINDOW),
  toggleMaximize: () => ipcRenderer.send(CHANNELS.TOGGLE_MAXIMIZE_WINDOW),
  close: () => ipcRenderer.send(CHANNELS.CLOSE_WINDOW),
  isMaximized: () => ipcRenderer.invoke(CHANNELS.IS_WINDOW_MAXIMIZED),
  onMaximizeChange: (callback) => listenToMain(CHANNELS.MAXIMIZE_CHANGED, callback),
  onMenu: (callback) => listenToMain(CHANNELS.MENU_ACTION, callback),
  getLaunchPaths: () => ipcRenderer.invoke(CHANNELS.GET_LAUNCH_PATHS),
  onOpenPaths: (callback) => listenToMain(CHANNELS.OPEN_PATHS, callback),
});
