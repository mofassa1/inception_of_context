const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("node:path");

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

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function windowFrom(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle("pick-folder", async () => {
  const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return res.canceled ? null : res.filePaths[0];
});

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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
