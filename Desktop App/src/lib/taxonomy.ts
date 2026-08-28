/**
 * RimChronicle — Worldbuilding Taxonomy engine.
 *
 * Overrides the four fixed enum dropdowns (article categories, event
 * categories, location types, biomes) with a project-wide, user-editable
 * config. This mirrors the attribute-slot pattern: every entry has a STABLE id
 * plus a renameable label, so renaming a built-in (or adding custom entries)
 * never orphans existing articles/events/locations — stored data references the
 * id, not the label.
 *
 * Built-in entries carry semantic behavior via `flags`. Custom entries default
 * to no flags (pure editorial) but can opt in so engine logic keeps working.
 */

import {
  ProjectTaxonomy,
  StoryProject,
  TaxonomyEntry,
} from "../types";

/* ------------------------------------------------------------------ */
/* Semantic flags                                                       */
/* ------------------------------------------------------------------ */

export interface FlagDef {
  key: string;
  label: string;
  appliesTo: string[]; // taxonomy list keys this flag is meaningful for
}

/**
 * Semantic flags opt custom / built-in entries into engine behavior that used
 * to be hardcoded literal comparisons. Built-ins get them by default; custom
 * entries can opt in where the engine needs to know what a thing "is".
 */
export const SEMANTIC_FLAGS: FlagDef[] = [
  {
    key: "is-character",
    label: "Character dossier (trim Traits/slots from prose)",
    appliesTo: ["articleCategories"],
  },
  {
    key: "is-location",
    label: "Auto-created location articles use this category",
    appliesTo: ["articleCategories"],
  },
  {
    key: "social-mood",
    label: "Feeds the colony/party mood snapshot",
    appliesTo: ["eventCategories"],
  },
  {
    key: "colony-type",
    label: "Treated as the home colony by the travel engine",
    appliesTo: ["locationTypes"],
  },
];

export function flagLabel(key: string): string {
  return SEMANTIC_FLAGS.find((f) => f.key === key)?.label || key;
}

export function flagsForList(listKey: string): FlagDef[] {
  return SEMANTIC_FLAGS.filter((f) => f.appliesTo.includes(listKey));
}

export function hasFlag(entry: TaxonomyEntry | undefined, key: string): boolean {
  return !!entry?.flags?.includes(key);
}

/**
 * True for any value that represents the home colony — the built-in `loc-colony`
 * id, the original label, or legacy free-text values. Kept a plain string check
 * so engine code that only has a type (not a full taxonomy context) still works.
 */
export function isColonyLocationType(value: string): boolean {
  return value === "loc-colony" || /colony|settlement|base/i.test(value);
}

/* ------------------------------------------------------------------ */
/* Stable ids for the four lists                                        */
/* ------------------------------------------------------------------ */

const ARTICLE_CATEGORY_DEFAULTS: TaxonomyEntry[] = [
  { id: "category-characters", label: "Characters", builtin: true, flags: ["is-character"] },
  { id: "category-factions", label: "Factions", builtin: true },
  { id: "category-locations", label: "Locations", builtin: true, flags: ["is-location"] },
  { id: "category-relics", label: "Relics", builtin: true },
  { id: "category-chronicles", label: "Chronicles", builtin: true },
  { id: "category-lore", label: "Lore", builtin: true },
  { id: "category-battles", label: "Battles", builtin: true },
];

const BIOME_DEFAULTS: TaxonomyEntry[] = [
  { id: "biome-glacial", label: "Glacial Ice Sheet", builtin: true },
  { id: "biome-tundra", label: "Tundra", builtin: true },
  { id: "biome-boreal", label: "Boreal Mountain Forest", builtin: true },
  { id: "biome-temperate", label: "Temperate Valley", builtin: true },
  { id: "biome-arid", label: "Arid Shrubland", builtin: true },
  { id: "biome-desert", label: "Desert Badlands", builtin: true },
  { id: "biome-toxic", label: "Toxic Swampland", builtin: true },
  { id: "biome-volcanic", label: "Volcanic Ridge", builtin: true },
];

const LOCATION_TYPE_DEFAULTS: TaxonomyEntry[] = [
  { id: "loc-colony", label: "Colony Settlement", builtin: true, flags: ["colony-type"] },
  { id: "loc-mining", label: "Mining Outpost", builtin: true },
  { id: "loc-battlefield", label: "Battlefield & War Zone", builtin: true },
  { id: "loc-cryptosleep", label: "Ancient Cryptosleep Ruins", builtin: true },
  { id: "loc-resource", label: "Resource Deposit", builtin: true },
  { id: "loc-psychic", label: "Psychic Hotspot", builtin: true },
  { id: "loc-ship", label: "Crashed Ship Hull", builtin: true },
  { id: "loc-trade", label: "Trading Hub", builtin: true },
  { id: "loc-tribal", label: "Tribal Camp", builtin: true },
  { id: "loc-raider", label: "Raider Fortress", builtin: true },
];

const EVENT_CATEGORY_DEFAULTS: TaxonomyEntry[] = [
  { id: "event-combat", label: "Combat", builtin: true },
  { id: "event-social", label: "Social", builtin: true, flags: ["social-mood"] },
  { id: "event-mental-break", label: "Mental Break", builtin: true },
  { id: "event-miracle", label: "Miracle", builtin: true },
  { id: "event-quest", label: "Quest", builtin: true },
  { id: "event-tragedy", label: "Tragedy", builtin: true },
  { id: "event-discovery", label: "Discovery", builtin: true },
  { id: "event-surgery", label: "Surgery", builtin: true },
  { id: "event-colony-life", label: "Colony Life", builtin: true },
  { id: "event-travel", label: "Travel", builtin: true },
];

export const DEFAULT_TAXONOMY: ProjectTaxonomy = {
  articleCategories: ARTICLE_CATEGORY_DEFAULTS.map((e) => ({ ...e })),
  biomes: BIOME_DEFAULTS.map((e) => ({ ...e })),
  locationTypes: LOCATION_TYPE_DEFAULTS.map((e) => ({ ...e })),
  eventCategories: EVENT_CATEGORY_DEFAULTS.map((e) => ({ ...e })),
};

export const TAXONOMY_LIST_KEYS: (keyof ProjectTaxonomy & string)[] = [
  "articleCategories",
  "eventCategories",
  "biomes",
  "locationTypes",
];

export const TAXONOMY_LIST_LABELS: Record<keyof ProjectTaxonomy, string> = {
  articleCategories: "Article Categories",
  eventCategories: "Event Categories",
  biomes: "Biomes",
  locationTypes: "Location Types",
};

/* ------------------------------------------------------------------ */
/* Migration                                                            */
/* ------------------------------------------------------------------ */

function uniqueId(list: TaxonomyEntry[], base: string, existing: Set<string>): string {
  let candidate = base;
  let n = 1;
  while (existing.has(candidate) || list.some((e) => e.id === candidate)) {
    candidate = `${base}-${++n}`;
  }
  return candidate;
}

/**
 * Ensure a project carries a taxonomy and that stored data references stable
 * ids. For projects that predate the feature, any distinct value already in use
 * is preserved (matched by label), and legacy label-stored values are rewritten
 * to their entry's stable id so future renames never orphan data. Idempotent.
 */
export function migrateProjectTaxonomy(project: StoryProject): StoryProject {
  const hadTaxonomy =
    !!project.taxonomy && TAXONOMY_LIST_KEYS.every((k) => (project.taxonomy![k] || []).length > 0);
  const tax: ProjectTaxonomy = hadTaxonomy ? clone(project.taxonomy!) : clone(DEFAULT_TAXONOMY);

  // Preserve any in-use values (by label) not already covered.
  (project.wikiArticles || []).forEach((a) => ensureEntry(tax.articleCategories, a.category, "category"));
  (project.timelineEvents || []).forEach((e) => ensureEntry(tax.eventCategories, e.category, "event"));
  (project.locations || []).forEach((l) => {
    if (l.biome) ensureEntry(tax.biomes, l.biome, "biome");
    ensureEntry(tax.locationTypes, l.type, "loc");
  });

  // Rewrite legacy label-stored values to stable ids (skips values already ids).
  const wikiArticles = (project.wikiArticles || []).map((a) => {
    const id = entryIdFor(tax.articleCategories, a.category);
    return id && id !== a.category ? { ...a, category: id } : a;
  });
  const timelineEvents = (project.timelineEvents || []).map((e) => {
    const id = entryIdFor(tax.eventCategories, e.category);
    return id && id !== e.category ? { ...e, category: id } : e;
  });
  const locations = (project.locations || []).map((l) => {
    const out: any = { ...l };
    const biomeId = l.biome ? entryIdFor(tax.biomes, l.biome) : undefined;
    if (biomeId) out.biome = biomeId;
    const typeId = entryIdFor(tax.locationTypes, l.type);
    if (typeId) out.type = typeId;
    return out;
  });

  // Backfill default semantic flags on built-in entries.
  markDefaultFlags(tax);

  const changed =
    !hadTaxonomy ||
    wikiArticles !== project.wikiArticles ||
    timelineEvents !== project.timelineEvents ||
    locations !== project.locations;
  if (!changed && JSON.stringify(project.taxonomy) === JSON.stringify(tax)) return project;

  return { ...project, taxonomy: tax, wikiArticles, timelineEvents, locations };
}

/** Ensure default semantic flags on the built-in entries (custom entries untouched). */
function markDefaultFlags(tax: ProjectTaxonomy): void {
  const setFlag = (list: TaxonomyEntry[], id: string, flag: string) => {
    const e = list.find((x) => x.id === id && x.builtin);
    if (e && !e.flags?.includes(flag)) e.flags = [...(e.flags || []), flag];
  };
  setFlag(tax.articleCategories, "category-characters", "is-character");
  setFlag(tax.articleCategories, "category-locations", "is-location");
  setFlag(tax.eventCategories, "event-social", "social-mood");
  setFlag(tax.locationTypes, "loc-colony", "colony-type");
}

/** Given a stored value (label or id), return the matching entry's stable id. */
function entryIdFor(list: TaxonomyEntry[], value: string): string | undefined {
  if (!value) return undefined;
  const entry =
    list.find((e) => e.id === value) ||
    list.find((e) => e.label.toLowerCase() === value.toLowerCase());
  return entry?.id;
}

function ensureEntry(list: TaxonomyEntry[], value: string, base: string): void {
  const v = (value || "").trim();
  if (!v) return;
  if (list.some((e) => e.id === v)) return;
  if (list.some((e) => e.label.toLowerCase() === v.toLowerCase())) return;
  list.push({ id: uniqueId(list, `${base}-custom`, new Set()), label: v });
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                         */
/* ------------------------------------------------------------------ */

export function getTaxonomy(project: StoryProject): ProjectTaxonomy {
  return migrateProjectTaxonomy(project).taxonomy!;
}

/** Resolve the label for a stored id / builtin value, falling back to the raw value. */
export function taxonomyLabel(list: TaxonomyEntry[], idOrLabel: string): string {
  if (!idOrLabel) return idOrLabel;
  const entry = list.find((e) => e.id === idOrLabel || e.label === idOrLabel);
  return entry ? entry.label : idOrLabel;
}

/**
 * Resolve an id used in stored data to its canonical TaxonomyEntry. Built-in
 * ids are stable, so renaming a label never changes the id that data stores.
 */
export function entryByLabel(list: TaxonomyEntry[], label: string): TaxonomyEntry | undefined {
  return list.find((e) => e.label === label || e.id === label);
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                 */
/* ------------------------------------------------------------------ */

function patchList(
  project: StoryProject,
  listKey: keyof ProjectTaxonomy,
  fn: (list: TaxonomyEntry[]) => TaxonomyEntry[]
): StoryProject {
  const tax = migrateProjectTaxonomy(project).taxonomy!;
  return { ...project, taxonomy: { ...tax, [listKey]: fn(tax[listKey]) } };
}

export function addTaxonomyEntry(
  project: StoryProject,
  listKey: keyof ProjectTaxonomy,
  rawLabel: string
): StoryProject {
  const label = rawLabel.trim();
  if (!label) return project;
  return patchList(project, listKey, (list) => [
    ...list,
    { id: uniqueId(list, `${listKey}-custom`, new Set()), label, flags: [] },
  ]);
}

export function renameTaxonomyEntry(
  project: StoryProject,
  listKey: keyof ProjectTaxonomy,
  id: string,
  rawLabel: string
): StoryProject {
  const label = rawLabel.trim();
  if (!label) return project;
  return patchList(project, listKey, (list) =>
    list.map((e) => (e.id === id ? { ...e, label } : e))
  );
}

export function setTaxonomyEntryColor(
  project: StoryProject,
  listKey: keyof ProjectTaxonomy,
  id: string,
  color: string
): StoryProject {
  const c = color.trim();
  return patchList(project, listKey, (list) =>
    list.map((e) => (e.id === id ? { ...e, color: c || undefined } : e))
  );
}

export function setTaxonomyEntryFlag(
  project: StoryProject,
  listKey: keyof ProjectTaxonomy,
  id: string,
  flag: string,
  on: boolean
): StoryProject {
  return patchList(project, listKey, (list) =>
    list.map((e) => {
      if (e.id !== id) return e;
      const flags = new Set(e.flags || []);
      if (on) flags.add(flag);
      else flags.delete(flag);
      return { ...e, flags: Array.from(flags) };
    })
  );
}

/**
 * Remove an entry. Refuses if any saved article/event/location still references
 * it (by id or label), returning `{ ok: false, usage }` so the UI can warn.
 */
export function removeTaxonomyEntry(
  project: StoryProject,
  listKey: keyof ProjectTaxonomy,
  id: string
): { project: StoryProject; ok: boolean; usage: string[] } {
  const tax = migrateProjectTaxonomy(project).taxonomy!;
  const list = tax[listKey];
  const entry = list.find((e) => e.id === id);
  if (!entry) return { project, ok: false, usage: [] };

  const usage = usageFor(project, listKey, entry.id, entry.label);
  if (usage.length > 0) return { project, ok: false, usage };

  return {
    project: patchList(project, listKey, (l) => l.filter((e) => e.id !== id)),
    ok: true,
    usage: [],
  };
}

/** Which saved entities reference this entry (by id or label). */
export function usageFor(
  project: StoryProject,
  listKey: keyof ProjectTaxonomy,
  id: string,
  label: string
): string[] {
  const refs =
    (v: unknown) =>
    (s: string): boolean =>
      s === id || s === label || s === id.replace(/^[a-z]+-/, "");

  switch (listKey) {
    case "articleCategories":
      return (project.wikiArticles || [])
        .filter((a) => refs(undefined)(a.category))
        .map((a) => a.title);
    case "eventCategories":
      return (project.timelineEvents || [])
        .filter((e) => refs(undefined)(e.category))
        .map((e) => e.title);
    case "biomes":
      return (project.locations || [])
        .filter((l) => l.biome && refs(undefined)(l.biome))
        .map((l) => l.name);
    case "locationTypes":
      return (project.locations || [])
        .filter((l) => refs(undefined)(l.type))
        .map((l) => l.name);
    default:
      return [];
  }
}
