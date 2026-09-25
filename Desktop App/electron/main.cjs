/**
 * RimChronicle — Electron main process.
 *
 * Fully local desktop app: the renderer runs from dist/ via file:// and talks
 * to the AI backend in THIS process over IPC. No HTTP server is started.
 */

const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

const backend = require(path.join(__dirname, "backend.cjs"));

// Some Linux GL drivers crash Electron's GPU process in a loop
// (eglCreateImage EGL_BAD_ALLOC -> "Context was lost" -> restart).
// The UI needs no GPU compositing, so default to software rendering.
// Set RIMCHRONICLE_GPU=1 to keep hardware acceleration.
if (process.env.RIMCHRONICLE_GPU !== "1") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
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

  // Some Linux setups never fire "ready-to-show" (e.g. broken GL / GPU
  // process crash), which would leave the window hidden forever. Show it
  // after a short grace period regardless.
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 3000);
  mainWindow.on("closed", () => clearTimeout(showFallback));

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

  // Directory picker for the wiki save folder (Settings -> Wiki Save Folder).
  ipcMain.handle("dialog:choose-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose Wiki Save Folder",
      buttonLabel: "Use This Folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Write the rendered wiki file set (markdown + JSON) straight into a folder.
  ipcMain.handle("file:write-wiki-files", async (_event, payload) => {
    const folder = payload && payload.folder;
    const files = payload && payload.files;
    if (typeof folder !== "string" || !files || typeof files !== "object") {
      throw new Error("Invalid wiki-files payload");
    }
    let count = 0;
    for (const [relPath, content] of Object.entries(files)) {
      const safeRel = String(relPath).replace(/^\/+/, "");
      const target = path.join(folder, safeRel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, typeof content === "string" ? content : String(content), "utf8");
      count++;
    }
    return { ok: true, folder, count };
  });

  // Write an exported .zip archive into the chosen folder.
  ipcMain.handle("file:write-zip", async (_event, payload) => {
    const folder = payload && payload.folder;
    const fileName = payload && payload.fileName;
    const base64 = payload && payload.base64;
    if (typeof folder !== "string" || typeof fileName !== "string" || typeof base64 !== "string") {
      throw new Error("Invalid zip payload");
    }
    const safeName = String(fileName).replace(/[\/\\]/g, "-");
    const target = path.join(folder, safeName);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(base64, "base64"));
    return { ok: true, path: target };
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
