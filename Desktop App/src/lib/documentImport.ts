/**
 * RimChronicle — document import helpers.
 *
 * Turns locally selected documents (.txt / .md / .docx) into structured
 * inputs the AI classifier can turn into wiki articles while preserving the
 * Obsidian-style folder hierarchy (subfolders become parent articles).
 *
 * Everything here runs in the sandboxed renderer using browser File APIs — no
 * Node / IPC access required. Legacy .doc files are detected and handed back
 * as "skipped" since they cannot be parsed without a native converter.
 */

import JSZip from "jszip";

/** A document selected for import, with its relative path inside its parent folder. */
export interface ImportDocument {
  file: File;
  /** Relative directory path from the selected root ("" = root). */
  folderPath: string;
  /** Extension, lowercased without the dot. */
  ext: "txt" | "md" | "docx" | "doc" | (string & {});
  /** Human title derived from the filename (no extension). */
  title: string;
  /** Inline warning for files that cannot be parsed (e.g. legacy .doc). */
  warning?: string;
  /** Extracted plain/Markdown text (empty when skipped). */
  text: string;
}

/**
 * Pick a directory (Chromium-only). The returned files carry a
 * `path`/`webkitRelativePath` field when available.
 */
export function pickFolder(callback: (files: File[]) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.setAttribute("webkitdirectory", "");
  input.setAttribute("directory", "");
  input.style.display = "none";
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    callback(files);
  });
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

/** Extension of a filename without the dot, lowercased. */
export function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/** Derive a human-readable article title from a filename. */
export function filenameToTitle(name: string): string {
  const idx = name.lastIndexOf(".");
  let base = idx >= 0 ? name.slice(0, idx) : name;
  base = base.trim();
  base = base.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  return base || name;
}

/** Relative directory path from a webkitRelativePath ("" when not nested). */
export function folderPathOf(files: File, name: string): string {
  const rel = (files as File & { webkitRelativePath?: string }).webkitRelativePath || "";
  const dir = rel.slice(0, rel.lastIndexOf("/"));
  // Strip the root folder name so only the internal structure remains.
  const parts = dir.split("/");
  return parts.length > 0 ? parts.slice(1).join("/") : dir === "" ? "" : dir;
}

/** HTML-entity decoding for XML text extraction. */
function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Extract Markdown-ish text from a .docx (a ZIP of XML). Reads
 * `word/document.xml`, maps paragraph/heading styles to #/##/### and flattens
 * runs/tables into plain lines. Lightweight — rich formatting is collapsed.
 */
export async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const doc = zip.file("word/document.xml");
  if (!doc) return "";

  const xml = await doc.async("text");
  const lines: string[] = [];

  // Split into paragraph blocks.
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p[^>]*\/>/g) || [];

  for (const para of paragraphs) {
    // Heading level via the paragraph style id.
    let level = 0;
    const styleMatch = para.match(/<w:pStyle w:val="(\d+)"/);
    if (styleMatch) level = parseInt(styleMatch[1], 10) || 0;

    // Concatenate all run text within the paragraph.
    const runs = para.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?: [^>]*)?\/>/g) || [];
    let text = "";
    for (const run of runs) {
      const inner = run.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/);
      if (inner) text += decodeEntities(inner[1]).replace(/\r/g, "").replace(/&nbsp;/g, " ");
    }
    text = text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (level >= 1 && level <= 3) {
      lines.push(`${"#".repeat(level)} ${text}`);
    } else {
      lines.push(text);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Inspect a selection of files and extract each one's text + folder + title,
 * marking unsupported files (e.g. legacy .doc) with a warning and empty text.
 */
export async function prepareDocuments(files: File[]): Promise<ImportDocument[]> {
  const docs = files
    .filter((f) => f.size > 0)
    .map((file) => {
      const name = file.name;
      const ext = extOf(name);
      const folderPath = folderPathOf(file, name);
      const title = filenameToTitle(name);
      return { file, folderPath, ext, title } as ImportDocument;
    })
    .sort((a, b) => {
      if (a.folderPath !== b.folderPath) return a.folderPath.localeCompare(b.folderPath);
      return a.title.localeCompare(b.title);
    });

  const prepared: ImportDocument[] = [];
  for (const doc of docs) {
    const ext = extOf(doc.file.name);
    try {
      if (ext === "txt" || ext === "md" || ext === "markdown") {
        const arrayBuffer = await doc.file.arrayBuffer();
        // Strip naive BOM / decode with UTF-8 text decoder then fallback.
        const text = await new TextDecoder("utf-8").decode(arrayBuffer);
        prepared.push({ ...doc, text: text.replace(/^\uFEFF/, "").trim() });
      } else if (ext === "docx") {
        const arrayBuffer = await doc.file.arrayBuffer();
        const text = await extractDocxText(arrayBuffer);
        prepared.push({ ...doc, text });
      } else if (ext === "doc") {
        prepared.push({
          ...doc,
          text: "",
          warning:
            "Legacy .doc files can't be read — please save this file as .docx or .txt and re-import.",
        });
      } else {
        prepared.push({
          ...doc,
          text: "",
          warning: `Unsupported file type (.${ext}). Only .txt, .md and .docx are supported.`,
        });
      }
    } catch (err) {
      prepared.push({
        ...doc,
        text: "",
        warning: `Could not read this file: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return prepared;
}
