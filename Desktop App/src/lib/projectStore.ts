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
  return found ? clone(found) : null;
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
    preceptMatrices: [],
    culturalFrictionPoints: [],
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
  const sample = clone(SAMPLE_PROJECT);
  saveWiki(sample);
  return sample;
}
