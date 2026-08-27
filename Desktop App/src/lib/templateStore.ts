/**
 * RimChronicle — Global custom Event Macro (Stencil) library.
 *
 * User-created stencils are stored in localStorage (key:
 * "rimchronicle_event_templates") and shared across ALL story projects, just
 * like custom Crossroads scenarios. Built-in stencils ship in code
 * (templateEngine.BUILTIN_TEMPLATES) and are always merged in front of the
 * custom list. Supports JSON export/import for backup and sharing.
 */

import { EventCategory, EventTemplate, ThreatLevel } from "../types";
import { BUILTIN_TEMPLATES } from "./templateEngine";

const STORAGE_KEY = "rimchronicle_event_templates";

export interface TemplateExportFile {
  version: 1;
  templates: EventTemplate[];
}

const VALID_CATEGORIES: EventCategory[] = [
  "Combat",
  "Social",
  "Mental Break",
  "Miracle",
  "Quest",
  "Tragedy",
  "Discovery",
  "Surgery",
  "Colony Life",
  "Travel",
];

const VALID_THREAT_LEVELS: ThreatLevel[] = ["Minor", "Moderate", "Major", "Catastrophic"];

const VALID_FIELD_TYPES = [
  "colonist",
  "colonist-multi",
  "faction",
  "location",
  "route",
  "slider",
  "text",
  "textarea",
];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidFieldShape(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const f = x as Record<string, unknown>;
  if (!isNonEmptyString(f.id) || !isNonEmptyString(f.label)) return false;
  if (typeof f.type !== "string" || !VALID_FIELD_TYPES.includes(f.type)) return false;
  return true;
}

/** Structural validation so malformed imports/storage never crash the UI. */
export function isValidTemplateShape(x: unknown): x is EventTemplate {
  if (!x || typeof x !== "object") return false;
  const t = x as Record<string, unknown>;

  if (!isNonEmptyString(t.id) || !isNonEmptyString(t.name)) return false;
  if (
    !isNonEmptyString(t.category) ||
    !VALID_CATEGORIES.includes(t.category as EventCategory)
  ) {
    return false;
  }
  if (
    !isNonEmptyString(t.threatLevel) ||
    !VALID_THREAT_LEVELS.includes(t.threatLevel as ThreatLevel)
  ) {
    return false;
  }
  if (!isNonEmptyString(t.titleTemplate) || !isNonEmptyString(t.descriptionTemplate)) {
    return false;
  }
  if (!Array.isArray(t.fields) || t.fields.length === 0) return false;
  if (!t.fields.every(isValidFieldShape)) return false;

  return true;
}

function coerceTemplate(raw: unknown): EventTemplate | null {
  if (!isValidTemplateShape(raw)) return null;
  const t = raw as EventTemplate;
  return {
    ...t,
    icon: typeof t.icon === "string" ? t.icon : undefined,
    accent: typeof t.accent === "string" ? t.accent : undefined,
    impactTemplate: typeof t.impactTemplate === "string" ? t.impactTemplate : undefined,
    fields: t.fields.map((f) => ({ ...f })),
    custom: true,
  };
}

/** Load the global custom stencil library, dropping malformed entries. */
export function loadCustomTemplates(): EventTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: EventTemplate[] = [];
    parsed.forEach((entry) => {
      const tpl = coerceTemplate(entry);
      if (tpl) valid.push(tpl);
    });
    return valid;
  } catch (e) {
    console.warn("Failed to load custom event templates", e);
    return [];
  }
}

/** Built-ins merged with the user's custom stencils. */
export function getAllTemplates(): EventTemplate[] {
  return [...BUILTIN_TEMPLATES, ...loadCustomTemplates()];
}

/** Persist the library; failures are logged but never thrown. */
export function saveCustomTemplates(list: EventTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Failed to save custom event templates", e);
  }
}

/** Insert or replace by id; persists and returns the new library list. */
export function upsertCustomTemplate(tpl: EventTemplate): EventTemplate[] {
  const list = loadCustomTemplates();
  const idx = list.findIndex((s) => s.id === tpl.id);
  if (idx >= 0) {
    list[idx] = { ...tpl, custom: true };
  } else {
    list.unshift({ ...tpl, custom: true });
  }
  saveCustomTemplates(list);
  return list;
}

/** Remove by id; persists and returns the new library list. */
export function deleteCustomTemplate(id: string): EventTemplate[] {
  const list = loadCustomTemplates().filter((s) => s.id !== id);
  saveCustomTemplates(list);
  return list;
}

/** Build a versioned export document from a template list. */
export function makeTemplateExport(list: EventTemplate[]): TemplateExportFile {
  return { version: 1, templates: list };
}

/**
 * Merge imported templates into the current library, skipping entries whose id
 * already exists. Returns the new full list plus merge counts.
 */
export function mergeImportedTemplates(
  current: EventTemplate[],
  incoming: unknown
): { list: EventTemplate[]; added: number; skipped: number; invalid: number } {
  let candidates: unknown[] = [];
  if (incoming && typeof incoming === "object" && Array.isArray((incoming as any).templates)) {
    candidates = (incoming as any).templates;
  } else if (Array.isArray(incoming)) {
    candidates = incoming;
  }

  const existingIds = new Set(current.map((s) => s.id));
  const additions: EventTemplate[] = [];
  let skipped = 0;
  let invalid = 0;

  candidates.forEach((raw) => {
    const tpl = coerceTemplate(raw);
    if (!tpl) {
      invalid++;
      return;
    }
    if (existingIds.has(tpl.id)) {
      skipped++;
      return;
    }
    existingIds.add(tpl.id);
    additions.push(tpl);
  });

  const list = [...additions, ...current];
  saveCustomTemplates(list);
  return { list, added: additions.length, skipped, invalid };
}