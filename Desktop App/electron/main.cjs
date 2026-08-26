/**
 * RimChronicle — Electron main process.
 *
 * Fully local desktop app: the renderer runs from dist/ via file:// and talks
 * to the AI backend in THIS process over IPC. No HTTP server is started.
 */

const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");

const backend = require(path.join(__dirname, "backend.cjs"));

// Some Linux GL drivers crash Electron's GPU process in a loop
// (eglCreateImage EGL_BAD_ALLOC -> "Context was lost" -> restart).
// The UI needs no GPU compositing, so default to software rendering.
// Set RIMCHRONICLE_GPU=1 to keep hardware acceleration.
if (process.env.RIMCHRONICLE_GPU !== "1") {
  app.disableHardwareAcceleration();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0c0c0e",
    title: "RimChronicle",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links (docs, model catalogs...) in the user's browser instead of a new window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // .env lives next to package.json when unpackaged; settings persist per-user.
  backend.initBackend({
    envPath: path.join(app.getAppPath(), ".env"),
    settingsPath: path.join(app.getPath("userData"), "settings.json"),
  });

  ipcMain.handle("ai:request", async (_event, method, pathname, options) => {
    try {
      return await backend.handleAiRequest(String(method || "GET"), String(pathname || ""), {
        query: options && typeof options === "object" ? options.query : undefined,
        body: options && typeof options === "object" ? options.body : undefined,
      });
    } catch (err) {
      console.error("IPC ai:request failed:", err);
      return { status: 500, data: { error: (err && err.message) || "Unexpected backend error" } };
    }
  });

  createWindow();

  app.on("activate", () => {
    // macOS convention: re-create the window when the dock icon is clicked.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
