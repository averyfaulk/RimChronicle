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

// Join a relative path onto the wiki folder, resolving symlinks and ensuring
// the result stays inside the folder. Returns null when the path escapes.
function safeJoin(folder, relPath) {
  const root = path.resolve(String(folder || ""));
  const rel = String(relPath).replace(/^\/+/, "");
  const target = path.resolve(root, rel);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  try {
    const realRoot = fs.realpathSync(root);
    const realTarget = fs.realpathSync(target);
    if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) return null;
  } catch {
    // Folder (or target) may not exist yet — the lexical check above still guards traversal.
  }
  return target;
}

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

    // Prune the app-owned mirror so files for articles, characters, and
    // chapters that were deleted (or renamed/reparented) don't linger on disk.
    // Only the directories/files the export owns are touched — anything under
    // projects/ or unrelated user files is left alone.
    const written = new Set(Object.keys(files).map((p) => String(p).replace(/^\/+/, "")));
    const ownedDirs = ["wiki", "characters", "novel"];
    const ownedRootFiles = ["README.md", "TIMELINE.md"];
    let pruned = 0;
    const pruneDir = (rel) => {
      const abs = path.join(folder, rel);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return;
      for (const entry of fs.readdirSync(abs)) {
        const childAbs = path.join(abs, entry);
        const stat = fs.statSync(childAbs);
        const childRel = `${rel}/${entry}`;
        if (stat.isDirectory()) {
          pruneDir(childRel);
        } else if (stat.isFile() && !written.has(childRel)) {
          const target = safeJoin(folder, childRel);
          if (target) {
            fs.unlinkSync(target);
            pruned++;
          }
        }
      }
      // Children are processed depth-first, so a directory emptied by the sweep
      // above is safe to drop. Without this, folders left over from an older
      // export layout (e.g. the retired per-category tree) would linger empty.
      // The three owned roots stay; only their descendants are removed.
      if (rel.includes("/") && fs.readdirSync(abs).length === 0) {
        const target = safeJoin(folder, rel);
        if (target) {
          fs.rmdirSync(target);
          pruned++;
        }
      }
    };
    ownedDirs.forEach(pruneDir);
    for (const name of ownedRootFiles) {
      if (written.has(name)) continue;
      const target = safeJoin(folder, name);
      if (target && fs.existsSync(target) && fs.statSync(target).isFile()) {
        fs.unlinkSync(target);
        pruned++;
      }
    }
    return { ok: true, folder, count, pruned };
  });

  // List project .json files inside the chosen wiki folder. Returns an array
  // of { name, relPath } for every projects/*.json plus a root-level
  // project-backup.json when present (legacy single-wiki folder).
  ipcMain.handle("file:list-project-files", async (_event, folder) => {
    const root = String(folder || "");
    if (!root) return { ok: true, files: [] };
    const files = [];
    const projectsDir = path.join(root, "projects");
    if (fs.existsSync(projectsDir) && fs.statSync(projectsDir).isDirectory()) {
      for (const name of fs.readdirSync(projectsDir)) {
        if (!name.toLowerCase().endsWith(".json")) continue;
        const abs = path.join(projectsDir, name);
        if (!fs.statSync(abs).isFile()) continue;
        files.push({ name, relPath: `projects/${name}` });
      }
    }
    const legacy = path.join(root, "project-backup.json");
    if (fs.existsSync(legacy) && fs.statSync(legacy).isFile()) {
      files.push({ name: "project-backup.json", relPath: "project-backup.json" });
    }
    return { ok: true, files };
  });

  // Read a single project .json file (path confined to the chosen folder).
  ipcMain.handle("file:read-project", async (_event, payload) => {
    const folder = payload && payload.folder;
    const relPath = payload && payload.relPath;
    if (typeof folder !== "string" || typeof relPath !== "string") {
      throw new Error("Invalid read-project payload");
    }
    const target = safeJoin(folder, relPath);
    if (!target) throw new Error("Path escapes the wiki folder");
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      return { ok: true, content: fs.readFileSync(target, "utf8") };
    }
    return { ok: false, content: null };
  });

  // Write a project .json file into the chosen folder (projects/<id>.json).
  ipcMain.handle("file:write-project", async (_event, payload) => {
    const folder = payload && payload.folder;
    const relPath = payload && payload.relPath;
    const content = payload && payload.content;
    if (typeof folder !== "string" || typeof relPath !== "string" || typeof content !== "string") {
      throw new Error("Invalid write-project payload");
    }
    if (!relPath.toLowerCase().endsWith(".json")) throw new Error("Only .json project files are allowed");
    const target = safeJoin(folder, relPath);
    if (!target) throw new Error("Path escapes the wiki folder");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    return { ok: true, path: target };
  });

  // Delete a project .json file from the chosen folder.
  ipcMain.handle("file:delete-project", async (_event, payload) => {
    const folder = payload && payload.folder;
    const relPath = payload && payload.relPath;
    if (typeof folder !== "string" || typeof relPath !== "string") {
      throw new Error("Invalid delete-project payload");
    }
    const target = safeJoin(folder, relPath);
    if (!target) throw new Error("Path escapes the wiki folder");
    if (fs.existsSync(target)) fs.unlinkSync(target);
    return { ok: true };
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
