/**
 * RimChronicle — local multi-wiki storage.
 *
 * Every playthrough wiki lives in localStorage under its own id, so users can
 * maintain several colonies side by side. The currently open wiki autosaves on
 * every change; the last opened one is remembered (but the app still greets
 * the user with the wiki picker on launch).
 */

import { StoryProject } from "../types";
import { SAMPLE_PROJECT } from "../data/samplePlaythroughs";
import { migrateProjectTaxonomy, DEFAULT_TAXONOMY } from "./taxonomy";
import {
  deleteProjectFile,
  listProjectFiles,
  readProjectFile,
  writeProjectFile,
} from "./desktopFs";

const STORE_KEY = "rimchronicle_wikis";
const LAST_OPEN_KEY = "rimchronicle_last_wiki";
const LEGACY_KEY = "rimchronicle_project";

export const SAMPLE_WIKI_ID = SAMPLE_PROJECT.id;

export interface WikiSummary {
  id: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  articleCount: number;
  eventCount: number;
  characterCount: number;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function readStore(): Record<string, StoryProject> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, StoryProject>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Failed to persist wikis (storage quota?)", e);
  }
}

/**
 * One-time import of the old single-project localStorage entry so existing
 * users don't lose their chronicle when upgrading to the multi-wiki layout.
 */
export function migrateLegacyProject(): void {
  try {
    if (localStorage.getItem(LEGACY_KEY)) {
      const store = readStore();
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      if (legacy && typeof legacy === "object" && legacy.id && !store[legacy.id]) {
        store[legacy.id] = legacy;
        writeStore(store);
      }
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch (e) {
    console.warn("Legacy project migration failed", e);
  }
}

export function listWikis(): WikiSummary[] {
  return Object.values(readStore())
    .map((p) => ({
      id: String(p.id),
      title: p.title || "Untitled Chronicle",
      subtitle: p.subtitle || "",
      lastUpdated: p.lastUpdated || "",
      articleCount: p.wikiArticles?.length || 0,
      eventCount: p.timelineEvents?.length || 0,
      characterCount: p.characters?.length || 0,
    }))
    .sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
}

export function loadWiki(id: string): StoryProject | null {
  const found = readStore()[id];
  if (!found) return null;
  const project = clone(found);
  // Ensure new map fields exist on older persisted projects
  if (!project.mapSettings) project.mapSettings = { mapStyle: "hexGrid", themeTerrain: "temperate", gridCols: 60, gridRows: 45, showHeatmap: false, heatmapType: "all", showRoutes: true, showLabels: true, showCoordinates: false, showFactions: true, mapSkin: "world" };
  else if (!project.mapSettings.mapSkin) project.mapSettings.mapSkin = "world";
  if (!project.mapRoutes) project.mapRoutes = [];
  // Backfill the user taxonomy (and remap legacy data to stable ids).
  return migrateProjectTaxonomy(project);
}

export function saveWiki(project: StoryProject): void {
  const store = readStore();
  store[project.id] = { ...project, lastUpdated: new Date().toISOString() };
  writeStore(store);
}

export function deleteWiki(id: string): void {
  const store = readStore();
  delete store[id];
  writeStore(store);
  if (localStorage.getItem(LAST_OPEN_KEY) === id) {
    localStorage.removeItem(LAST_OPEN_KEY);
  }
}

export function getLastOpenedWikiId(): string | null {
  return localStorage.getItem(LAST_OPEN_KEY);
}

export function setLastOpenedWikiId(id: string): void {
  localStorage.setItem(LAST_OPEN_KEY, id);
}

/* ------------------------------------------------------------------ */
/* Disk-first persistence (Wiki Save Folder)                           */
/* ------------------------------------------------------------------ */

/** A wiki summary that also knows where its project file lives on disk. */
export interface DiskWikiSummary extends WikiSummary {
  relPath: string;
}

/** Relative path (inside the wiki folder) for a project's live JSON file. */
export function projectRelPath(project: Pick<StoryProject, "id">): string {
  const safeId = String(project.id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `projects/${safeId}.json`;
}

/** Persist a project as a JSON file inside the wiki save folder. */
export async function saveWikiDisk(project: StoryProject, folder: string): Promise<boolean> {
  const content = JSON.stringify(
    { ...project, lastUpdated: new Date().toISOString() },
    null,
    2
  );
  return writeProjectFile(folder, projectRelPath(project), content);
}

/** Load a project from a JSON file inside the wiki save folder. */
export async function loadWikiDisk(folder: string, relPath: string): Promise<StoryProject | null> {
  const raw = await readProjectFile(folder, relPath);
  if (!raw) return null;
  try {
    const project = JSON.parse(raw) as StoryProject;
    if (!project || typeof project.id !== "string") return null;
    if (!project.mapSettings)
      project.mapSettings = { mapStyle: "hexGrid", themeTerrain: "temperate", gridCols: 60, gridRows: 45, showHeatmap: false, heatmapType: "all", showRoutes: true, showLabels: true, showCoordinates: false, showFactions: true, mapSkin: "world" };
    else if (!project.mapSettings.mapSkin) project.mapSettings.mapSkin = "world";
    if (!project.mapRoutes) project.mapRoutes = [];
    return migrateProjectTaxonomy(project);
  } catch (e) {
    console.warn(`Failed to parse project file ${relPath}`, e);
    return null;
  }
}

/** Delete a project's JSON file from the wiki save folder. */
export async function deleteWikiDisk(folder: string, id: string): Promise<boolean> {
  return deleteProjectFile(folder, projectRelPath({ id }));
}

/**
 * List every wiki stored in the wiki save folder. projects/*.json files are the
 * source of truth; a root-level project-backup.json (legacy mirror) is only
 * surfaced when it holds a project not already present as a project file.
 */
export async function listWikisDisk(folder: string): Promise<DiskWikiSummary[]> {
  const files = await listProjectFiles(folder);
  const out: DiskWikiSummary[] = [];
  const seenIds = new Set<string>();
  for (const file of files) {
    const project = await loadWikiDisk(folder, file.relPath);
    if (!project) continue;
    if (seenIds.has(project.id)) continue;
    seenIds.add(project.id);
    out.push({
      id: project.id,
      title: project.title || "Untitled Chronicle",
      subtitle: project.subtitle || "",
      lastUpdated: project.lastUpdated || "",
      articleCount: project.wikiArticles?.length || 0,
      eventCount: project.timelineEvents?.length || 0,
      characterCount: project.characters?.length || 0,
      relPath: file.relPath,
    });
  }
  return out.sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
}

/**
 * Copy every localStorage wiki into the chosen folder so nothing is lost when
 * switching to disk-first storage. Returns how many wikis were written.
 */
export async function migrateLocalStorageToDisk(folder: string): Promise<number> {
  const store = readStore();
  const existing = new Set((await listWikisDisk(folder)).map((w) => w.id));
  let migrated = 0;
  for (const project of Object.values(store)) {
    if (!project || typeof project.id !== "string") continue;
    if (existing.has(project.id)) continue;
    if (await saveWikiDisk(project, folder)) migrated++;
  }
  return migrated;
}

/** Blank scaffold for a brand-new chronicle. */
export function createFreshProject(title: string): StoryProject {
  return {
    id: `wiki-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || "Untitled Chronicle",
    subtitle: "",
    chronicleLogHistory: [],
    wikiArticles: [],
    characters: [],
    factions: [],
    timelineEvents: [],
    locations: [],
    relics: [],
    relationships: [],
    storyHierarchy: [],
    canonConstraints: [],
    preceptMatrices: [],
    culturalFrictionPoints: [],
    mapSettings: { mapStyle: "hexGrid", themeTerrain: "temperate", gridCols: 60, gridRows: 45, showHeatmap: false, heatmapType: "all", showRoutes: true, showLabels: true, showCoordinates: false, showFactions: true, mapSkin: "world" },
    mapRoutes: [],
    taxonomy: DEFAULT_TAXONOMY,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * The canonical sample playthrough. First use stores it under its own id so
 * later sessions continue the user's edited copy instead of resetting it.
 */
export function getSampleProject(): StoryProject {
  const stored = loadWiki(SAMPLE_WIKI_ID);
  if (stored) return stored;
  const sample = migrateProjectTaxonomy(clone(SAMPLE_PROJECT));
  saveWiki(sample);
  return sample;
}
