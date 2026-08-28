/**
 * RimChronicle — Global custom Crossroads scenario library.
 *
 * User-created storyteller presets are stored in localStorage (key:
 * "rimchronicle_custom_scenarios") and shared across ALL story projects.
 * Supports JSON export/import for backup and sharing between writers.
 *
 * Custom scenarios follow the same shape as built-in LocalCrossroadPresets
 * and support the same template placeholders ({{lead}}, {{colony}}, etc.),
 * which are resolved from real project data when a scenario fires.
 */

import { ThreatLevel } from "../types";
import { LocalCrossroadPreset, LocalCrossroadResolution } from "./localEngine";

const STORAGE_KEY = "rimchronicle_custom_scenarios";

export interface ScenarioExportFile {
  version: 1;
  scenarios: LocalCrossroadPreset[];
}

const VALID_THREAT_LEVELS: ThreatLevel[] = ["Minor", "Moderate", "Major", "Catastrophic"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Structural validation so malformed imports/storage never crash the UI. */
export function isValidPresetShape(x: unknown): x is LocalCrossroadPreset {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;

  if (!isNonEmptyString(p.id) || !isNonEmptyString(p.title)) return false;
  if (!Array.isArray(p.resolutions) || p.resolutions.length === 0) return false;

  for (const raw of p.resolutions) {
    if (!raw || typeof raw !== "object") return false;
    const r = raw as Record<string, unknown>;
    if (!isNonEmptyString(r.label) || !isNonEmptyString(r.title)) return false;
    if (!isNonEmptyString(r.category)) {
      return false;
    }
    if (
      !isNonEmptyString(r.threatLevel) ||
      !VALID_THREAT_LEVELS.includes(r.threatLevel as ThreatLevel)
    ) {
      return false;
    }
  }

  // Optional requirements block
  if (p.requirements !== undefined) {
    if (!p.requirements || typeof p.requirements !== "object") return false;
    const req = p.requirements as Record<string, unknown>;
    for (const key of ["hostileBond", "positiveBond", "deceased"]) {
      if (req[key] !== undefined && typeof req[key] !== "boolean") return false;
    }
    if (req.minCharacters !== undefined && typeof req.minCharacters !== "number") return false;
  }

  return true;
}

function coercePreset(raw: unknown): LocalCrossroadPreset | null {
  if (!isValidPresetShape(raw)) return null;
  const r = raw as LocalCrossroadPreset;
  return {
    ...r,
    summary: typeof r.summary === "string" ? r.summary : "",
    triggerConditions: typeof r.triggerConditions === "string" ? r.triggerConditions : "",
    storyHook: typeof r.storyHook === "string" ? r.storyHook : "",
    resolutions: r.resolutions.map((res) => ({
      ...res,
      summary: res.summary ?? "",
      sceneProse: res.sceneProse ?? "",
      outcome: res.outcome ?? "",
      moodImpact: res.moodImpact ?? "",
      wikiUpdates: Array.isArray(res.wikiUpdates)
        ? res.wikiUpdates
        : []
    }))
  };
}

/** Load the global custom scenario library, dropping malformed entries. */
export function loadCustomScenarios(): LocalCrossroadPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: LocalCrossroadPreset[] = [];
    parsed.forEach((entry) => {
      const preset = coercePreset(entry);
      if (preset) valid.push(preset);
    });
    return valid;
  } catch (e) {
    console.warn("Failed to load custom scenarios", e);
    return [];
  }
}

/** Persist the library; failures are logged but never thrown. */
export function saveCustomScenarios(list: LocalCrossroadPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Failed to save custom scenarios", e);
  }
}

/** Insert or replace by id; persists and returns the new library list. */
export function upsertCustomScenario(preset: LocalCrossroadPreset): LocalCrossroadPreset[] {
  const list = loadCustomScenarios();
  const idx = list.findIndex((s) => s.id === preset.id);
  if (idx >= 0) {
    list[idx] = preset;
  } else {
    list.unshift(preset);
  }
  saveCustomScenarios(list);
  return list;
}

/** Remove by id; persists and returns the new library list. */
export function deleteCustomScenario(id: string): LocalCrossroadPreset[] {
  const list = loadCustomScenarios().filter((s) => s.id !== id);
  saveCustomScenarios(list);
  return list;
}

/** Build a versioned export document from a library list. */
export function makeScenarioExport(list: LocalCrossroadPreset[]): ScenarioExportFile {
  return { version: 1, scenarios: list };
}

/**
 * Merge imported scenarios into the current library, skipping entries whose
 * id already exists. Returns the new full list plus merge counts.
 */
export function mergeImportedScenarios(
  current: LocalCrossroadPreset[],
  incoming: unknown
): { list: LocalCrossroadPreset[]; added: number; skipped: number; invalid: number } {
  let candidates: unknown[] = [];
  if (incoming && typeof incoming === "object" && Array.isArray((incoming as any).scenarios)) {
    candidates = (incoming as any).scenarios;
  } else if (Array.isArray(incoming)) {
    candidates = incoming;
  }

  const existingIds = new Set(current.map((s) => s.id));
  const additions: LocalCrossroadPreset[] = [];
  let skipped = 0;
  let invalid = 0;

  candidates.forEach((raw) => {
    const preset = coercePreset(raw);
    if (!preset) {
      invalid++;
      return;
    }
    if (existingIds.has(preset.id)) {
      skipped++;
      return;
    }
    existingIds.add(preset.id);
    additions.push(preset);
  });

  const list = [...additions, ...current];
  saveCustomScenarios(list);
  return { list, added: additions.length, skipped, invalid };
}
