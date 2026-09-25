/**
 * RimChronicle — preload bridge.
 *
 * Exposes a minimal, promise-based API to the sandboxed renderer:
 *   window.rimchronicle.aiRequest(method, path, { query?, body? })
 *   window.rimchronicle.chooseFolder()                    -> string | null
 *   window.rimchronicle.writeWikiFiles(folder, files)     -> { ok, folder, count }
 *   window.rimchronicle.writeZip(folder, fileName, base64)-> { ok, path }
 *   window.rimchronicle.listProjects(folder)              -> { ok, files }
 *   window.rimchronicle.readProject(folder, relPath)      -> { ok, content }
 *   window.rimchronicle.writeProject(folder, rel, content)-> { ok, path }
 *   window.rimchronicle.deleteProject(folder, relPath)    -> { ok }
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rimchronicle", {
  aiRequest: (method, pathname, options) =>
    ipcRenderer.invoke("ai:request", method, pathname, options),
  chooseFolder: () => ipcRenderer.invoke("dialog:choose-folder"),
  writeWikiFiles: (folder, files) => ipcRenderer.invoke("file:write-wiki-files", { folder, files }),
  writeZip: (folder, fileName, base64) => ipcRenderer.invoke("file:write-zip", { folder, fileName, base64 }),
  listProjects: (folder) => ipcRenderer.invoke("file:list-project-files", folder),
  readProject: (folder, relPath) => ipcRenderer.invoke("file:read-project", { folder, relPath }),
  writeProject: (folder, relPath, content) => ipcRenderer.invoke("file:write-project", { folder, relPath, content }),
  deleteProject: (folder, relPath) => ipcRenderer.invoke("file:delete-project", { folder, relPath }),
});
