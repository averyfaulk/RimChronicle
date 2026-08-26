/**
 * RimChronicle — preload bridge.
 *
 * Exposes a minimal, promise-based API to the sandboxed renderer:
 *   window.rimchronicle.aiRequest(method, path, { query?, body? })
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rimchronicle", {
  aiRequest: (method, pathname, options) =>
    ipcRenderer.invoke("ai:request", method, pathname, options),
});
