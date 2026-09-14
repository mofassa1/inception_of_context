const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

// The API may run in a container that mounts host directories at their real
// paths only, so every path the renderer uses is resolved first: "~" expanded,
// symlinks followed. Returns null when nothing exists there.
function toRealPath(rawPath) {
  const expanded = rawPath.startsWith("~")
    ? path.join(os.homedir(), rawPath.slice(1))
    : rawPath;

  try {
    return fs.realpathSync.native(path.resolve(expanded));
  } catch {
    return null;
  }
}

function parseLaunchPaths(argv) {
  return argv
    .slice(app.isPackaged ? 1 : 2)
    .filter((arg) => !arg.startsWith("-"))
    .map((arg) => toRealPath(arg))
    .filter(Boolean)
    .flatMap((candidate) => {
      try {
        return [
          { path: candidate, isDir: fs.statSync(candidate).isDirectory() },
        ];
      } catch {
        return [];
      }
    });
}

let launchPaths = parseLaunchPaths(process.argv);

function sendLaunchPaths(win, paths) {
  if (paths.length === 0) return;
  win.webContents.send("ide:open-paths", paths);
}

function buildMenu(win) {
  const isMac = process.platform === "darwin";
  const sendMenu = (action) => win.webContents.send("menu:action", action);

  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Folder…",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenu("open-folder"),
        },
        {
          label: "Close Folder",
          accelerator: "CmdOrCtrl+W",
          click: () => sendMenu("close-folder"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
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
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Chat",
          accelerator: "CmdOrCtrl+\\",
          click: () => sendMenu("toggle-chat"),
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
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
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
    },
  });

  buildMenu(win);

  win.on("maximize", () => win.webContents.send("win:maximize-changed", true));
  win.on("unmaximize", () =>
    win.webContents.send("win:maximize-changed", false),
  );

  win.webContents.once("did-finish-load", () => sendLaunchPaths(win, launchPaths));

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function windowFrom(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle("ide:launch-paths", () => launchPaths);

ipcMain.handle("pick-folder", async () => {
  const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return res.canceled ? null : toRealPath(res.filePaths[0]);
});

ipcMain.handle("fs:real-path", (_event, rawPath) => toRealPath(String(rawPath)));

ipcMain.on("win:minimize", (e) => windowFrom(e)?.minimize());
ipcMain.on("win:toggle-maximize", (e) => {
  const win = windowFrom(e);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on("win:close", (e) => windowFrom(e)?.close());
ipcMain.handle("win:is-maximized", (e) =>
  Boolean(windowFrom(e)?.isMaximized()),
);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on("second-instance", (_event, argv) => {
  const paths = parseLaunchPaths(argv);
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;

  if (win.isMinimized()) win.restore();
  win.focus();
  sendLaunchPaths(win, paths);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
