const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

let backend = null;

function startBackend() {
  const backendDir = path.join(__dirname, "..", "..", "backend");
  backend = spawn("uv", ["run", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"], {
    cwd: backendDir,
    stdio: "inherit",
  });
  backend.on("error", (err) => {
    console.error("Failed to start backend:", err);
  });
}

function stopBackend() {
  backend?.kill();
  backend = null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: "#080b12",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

ipcMain.handle("pick-folder", async () => {
  const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return res.canceled ? null : res.filePaths[0];
});

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopBackend);
