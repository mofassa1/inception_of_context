const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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

const MAIN_WINDOW_OPTIONS = {
  width: 1280,
  height: 820,
  minWidth: 720,
  minHeight: 480,
  frame: false,
  autoHideMenuBar: true,
  backgroundColor: "#1e2227",
  webPreferences: {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    spellcheck: false,
  },
};

const DASHBOARD_PAGE = path.join(__dirname, "..", "dist", "index.html");

let launchPaths = [];

function resolveRealPath(rawPath) {
  let expandedPath = rawPath;
  if (rawPath.startsWith("~")) {
    expandedPath = path.join(os.homedir(), rawPath.slice(1));
  }

  try {
    return fs.realpathSync.native(path.resolve(expandedPath));
  } catch {
    return null;
  }
}

function parseLaunchPaths(commandLineArguments) {
  // Skip the executable, the switches, and the app folder itself ("electron . <folder>"):
  // a Chromium switch before "." would shift any count of positions.
  const appPath = resolveRealPath(app.getAppPath());
  const foundPaths = [];

  for (const argument of commandLineArguments.slice(1)) {
    if (argument.startsWith("-")) continue;

    const realPath = resolveRealPath(argument);
    if (!realPath || realPath === appPath) continue;

    try {
      foundPaths.push({ path: realPath, isDir: fs.statSync(realPath).isDirectory() });
    } catch {
      continue;
    }
  }

  return foundPaths;
}

function getMainWindow() {
  const openWindows = BrowserWindow.getAllWindows();
  return openWindows.length > 0 ? openWindows[0] : null;
}

function getWindowOfRequest(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function sendToRenderer(mainWindow, channel, value) {
  mainWindow.webContents.send(channel, value);
}

function sendLaunchPaths(mainWindow, paths) {
  if (paths.length === 0) return;
  sendToRenderer(mainWindow, CHANNELS.OPEN_PATHS, paths);
}

function buildMenuTemplate(sendMenuAction) {
  const isMac = process.platform === "darwin";

  const fileMenu = {
    label: "File",
    submenu: [
      {
        label: "Open Folder…",
        accelerator: "CmdOrCtrl+O",
        click: () => sendMenuAction("open-folder"),
      },
      {
        label: "Close Folder",
        accelerator: "CmdOrCtrl+W",
        click: () => sendMenuAction("close-folder"),
      },
      { type: "separator" },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  };

  const editMenu = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };

  const viewMenu = {
    label: "View",
    submenu: [
      {
        label: "Toggle Chat",
        accelerator: "CmdOrCtrl+\\",
        click: () => sendMenuAction("toggle-chat"),
      },
      { type: "separator" },
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  };

  return [fileMenu, editMenu, viewMenu];
}

function setApplicationMenu(mainWindow) {
  function sendMenuAction(action) {
    sendToRenderer(mainWindow, CHANNELS.MENU_ACTION, action);
  }

  const applicationMenu = Menu.buildFromTemplate(buildMenuTemplate(sendMenuAction));
  Menu.setApplicationMenu(applicationMenu);
}

const LOG_LEVELS = {
  debug: "DEBUG",
  info: "INFO",
  warning: "WARNING",
  error: "ERROR",
};

function logPageMessage(details) {
  const source = `${path.basename(details.sourceId)}:${details.lineNumber}`;
  const message = details.message.replace(/\s*\n\s*/g, " ");
  console.log(`${LOG_LEVELS[details.level]}: page: ${message} (${source})`);
}

function logPageLoadFailure(_event, errorCode, errorDescription, url) {
  console.log(`ERROR: could not load ${url}: ${errorDescription} (${errorCode})`);
}

function logPageProcessGone(_event, details) {
  console.log(`ERROR: the page process stopped: ${details.reason} (exit code ${details.exitCode})`);
}

function logPageUnresponsive() {
  console.log("WARNING: the page is not responding");
}

function logPageProblems(mainWindow) {
  mainWindow.webContents.on("console-message", logPageMessage);
  mainWindow.webContents.on("did-fail-load", logPageLoadFailure);
  mainWindow.webContents.on("render-process-gone", logPageProcessGone);
  mainWindow.on("unresponsive", logPageUnresponsive);
}

function createMainWindow() {
  const mainWindow = new BrowserWindow(MAIN_WINDOW_OPTIONS);

  setApplicationMenu(mainWindow);
  logPageProblems(mainWindow);

  mainWindow.on("maximize", () => {
    sendToRenderer(mainWindow, CHANNELS.MAXIMIZE_CHANGED, true);
  });
  mainWindow.on("unmaximize", () => {
    sendToRenderer(mainWindow, CHANNELS.MAXIMIZE_CHANGED, false);
  });

  mainWindow.loadFile(DASHBOARD_PAGE);
}

function getLaunchPaths() {
  return launchPaths;
}

async function pickFolder() {
  const dialogResult = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (dialogResult.canceled) return null;
  return resolveRealPath(dialogResult.filePaths[0]);
}

function resolveRealPathRequest(_event, rawPath) {
  return resolveRealPath(String(rawPath));
}

function minimizeWindow(event) {
  const requestWindow = getWindowOfRequest(event);
  if (requestWindow) requestWindow.minimize();
}

function toggleMaximizeWindow(event) {
  const requestWindow = getWindowOfRequest(event);
  if (!requestWindow) return;

  if (requestWindow.isMaximized()) {
    requestWindow.unmaximize();
  } else {
    requestWindow.maximize();
  }
}

function closeWindow(event) {
  const requestWindow = getWindowOfRequest(event);
  if (requestWindow) requestWindow.close();
}

function isWindowMaximized(event) {
  const requestWindow = getWindowOfRequest(event);
  return Boolean(requestWindow && requestWindow.isMaximized());
}

function listenToRendererRequests() {
  ipcMain.handle(CHANNELS.GET_LAUNCH_PATHS, getLaunchPaths);
  ipcMain.handle(CHANNELS.PICK_FOLDER, pickFolder);
  ipcMain.handle(CHANNELS.RESOLVE_REAL_PATH, resolveRealPathRequest);
  ipcMain.handle(CHANNELS.IS_WINDOW_MAXIMIZED, isWindowMaximized);
  ipcMain.on(CHANNELS.MINIMIZE_WINDOW, minimizeWindow);
  ipcMain.on(CHANNELS.TOGGLE_MAXIMIZE_WINDOW, toggleMaximizeWindow);
  ipcMain.on(CHANNELS.CLOSE_WINDOW, closeWindow);
}

function focusExistingWindow(_event, commandLineArguments) {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  sendLaunchPaths(mainWindow, parseLaunchPaths(commandLineArguments));
}

function openWindowIfNoneIsOpen() {
  if (!getMainWindow()) createMainWindow();
}

function quitUnlessMac() {
  if (process.platform !== "darwin") app.quit();
}

function startApp() {
  const isFirstInstance = app.requestSingleInstanceLock();
  if (!isFirstInstance) {
    app.quit();
    return;
  }

  launchPaths = parseLaunchPaths(process.argv);

  app.on("second-instance", focusExistingWindow);
  app.on("activate", openWindowIfNoneIsOpen);
  app.on("window-all-closed", quitUnlessMac);

  app.whenReady().then(() => {
    listenToRendererRequests();
    createMainWindow();
  });
}

startApp();
