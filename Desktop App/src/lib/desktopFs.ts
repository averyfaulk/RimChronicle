/**
 * RimChronicle — desktop file bridge helpers.
 *
 * Inside the packaged Electron app the renderer is sandboxed, so all disk
 * access goes through IPC handlers registered in electron/main.cjs. Outside
 * Electron (plain `vite dev` / `vite preview` in a browser) these helpers
 * degrade gracefully: folder features are disabled and exports fall back to
 * the browser's normal `downloadBlob` behavior.
 *
 * The chosen "Wiki Save Folder" is remembered in localStorage so the user's
 * preference survives restarts without touching the backend settings file.
 */

const WIKI_FOLDER_KEY = "rimchronicle_wiki_folder";

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.rimchronicle;
}

/** The folder the user chose in Settings (or null if never set). */
export function getWikiFolder(): string | null {
  try {
    return localStorage.getItem(WIKI_FOLDER_KEY);
  } catch {
    return null;
  }
}

export function setWikiFolder(folder: string | null): void {
  try {
    if (folder) localStorage.setItem(WIKI_FOLDER_KEY, folder);
    else localStorage.removeItem(WIKI_FOLDER_KEY);
  } catch {
    /* localStorage unavailable — ignore */
  }
}

/** Open the native folder picker; returns the chosen path or null on cancel. */
export async function chooseWikiFolder(): Promise<string | null> {
  if (!isDesktopApp() || !window.rimchronicle?.chooseFolder) return null;
  try {
    return await window.rimchronicle.chooseFolder();
  } catch (err) {
    console.error("Folder picker failed:", err);
    return null;
  }
}

/** Write the rendered wiki file set into `folder` (creates subfolders). */
export async function writeWikiFilesToFolder(
  folder: string,
  files: Record<string, string>
): Promise<boolean> {
  if (!isDesktopApp() || !window.rimchronicle?.writeWikiFiles) return false;
  try {
    const res = await window.rimchronicle.writeWikiFiles(folder, files);
    return !!(res && res.ok);
  } catch (err) {
    console.error("Writing wiki files to folder failed:", err);
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result ? result.indexOf(",") : -1;
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Save a blob (zip / markdown / json) into the chosen wiki folder when running
 * in the desktop app; otherwise fall back to a normal browser download.
 */
export async function saveBlobToFolder(blob: Blob, filename: string): Promise<boolean> {
  const folder = getWikiFolder();
  if (folder && isDesktopApp() && window.rimchronicle?.writeZip) {
    try {
      const base64 = await blobToBase64(blob);
      const res = await window.rimchronicle.writeZip(folder, filename, base64);
      return !!(res && res.ok);
    } catch (err) {
      console.error("Saving blob to folder failed:", err);
      return false;
    }
  }
  return false;
}