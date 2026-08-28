import { WikiArticle, Character, Faction, LocationItem, RelicItem, StoryProject, AttributeSlotConfig } from "../types";

export interface EntityLookup {
  characters: Map<string, Character>;
  factions: Map<string, Faction>;
  locations: Map<string, LocationItem>;
  relics: Map<string, RelicItem>;
  articles: Map<string, WikiArticle>;
}

export const BIONIC_KEYWORDS = [
  "bionic",
  "archotech",
  "prosthetic",
  "prostophile",
  "implant",
  "neuroformer",
  "eltex",
  "peg leg",
  "denture",
  "hydraulic",
];

/** Pull prosthetic / augmentation items out of a character's health conditions. */
export function extractLegacyBionics(character: Character): string[] {
  return (character.healthConditions || []).filter((hc) =>
    BIONIC_KEYWORDS.some((kw) => hc.toLowerCase().includes(kw))
  );
}

/**
 * Back-compat bionics lookup.
 *
 * When a project is supplied, entries come from the character's dynamic
 * attribute slots — but only while the seeded bionics slot still carries a
 * bionic-flavored label (repurposing it into e.g. "Spells / Prepared" yields
 * no bionics). Without a project, falls back to legacy keyword extraction
 * over healthConditions so old call sites keep working untouched.
 */
export function extractBionics(character: Character, project?: StoryProject): string[] {
  if (project) {
    const slots = resolveSlotConfig(project);
    const slot = slots.find((s) => s.id === BIONICS_SLOT_ID);
    if (slot && /bionic/i.test(slot.label)) {
      return character.slotEntries?.[slot.id] || [];
    }
    // Slot repurposed: check whether any other slot kept a bionic label.
    const alt = slots.find((s) => /bionic/i.test(s.label));
    if (alt) return character.slotEntries?.[alt.id] || [];
    return [];
  }
  return extractLegacyBionics(character);
}

/** Project slot layout with a guaranteed fallback for unmigrated projects. */
export function resolveSlotConfig(project?: StoryProject | null): AttributeSlotConfig[] {
  if (project?.attributeSlots && project.attributeSlots.length > 0) {
    return project.attributeSlots;
  }
  return DEFAULT_SLOT_CONFIG;
}

export const BIONICS_SLOT_ID = "slot-a";
export const HEALTH_SLOT_ID = "slot-b";
export const SKILLS_SLOT_ID = "slot-c";

const DEFAULT_SLOT_CONFIG: AttributeSlotConfig[] = [
  { id: BIONICS_SLOT_ID, label: "Bionics" },
  { id: HEALTH_SLOT_ID, label: "Health Conditions" },
  { id: SKILLS_SLOT_ID, label: "Skills" },
];

function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Strip the duplicated dossier blocks ("## Traits", one section per
 * configured attribute slot, and legacy "## Bionics & Health") from a
 * character article's markdown. This data now renders live in the Dossier
 * card on Characters pages, so keeping static copies in prose would drift.
 * Idempotent; only level-2 headings are matched, and each removed section
 * consumes everything up to the next level-1/2 heading (subsections go with it).
 */
export function sanitizeCharacterArticleSections(
  markdownContent: string,
  slots?: AttributeSlotConfig[]
): string {
  const stripped = new Set([normalizeHeader("Traits"), normalizeHeader("Bionics & Health")]);
  (slots || []).forEach((slot) => stripped.add(normalizeHeader(slot.label)));

  const lines = markdownContent.split("\n");
  const out: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      skipping = stripped.has(normalizeHeader(h2[1]));
      if (skipping) continue;
    } else if (skipping && /^#{1,2}\s+/.test(line)) {
      // A deeper heading can't end a level-2 section, but guard anyway.
      skipping = false;
    }
    if (!skipping) out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Find a Character record by exact name or nickname match (case-insensitive). */
export function findCharacterByTitle(characters: Character[], title: string): Character | undefined {
  const query = title.trim().toLowerCase();
  return characters.find(
    (c) => c.name.toLowerCase() === query || c.nickname.toLowerCase() === query
  );
}

export function buildEntityLookup(
  projectOrCharacters: StoryProject | Character[],
  factions?: Faction[],
  locations?: LocationItem[],
  relics?: RelicItem[],
  articles?: WikiArticle[]
): EntityLookup {
  let charList: Character[] = [];
  let factList: Faction[] = [];
  let locList: LocationItem[] = [];
  let relicList: RelicItem[] = [];
  let artList: WikiArticle[] = [];

  if ("characters" in (projectOrCharacters as any)) {
    const proj = projectOrCharacters as StoryProject;
    charList = proj.characters || [];
    factList = proj.factions || [];
    locList = proj.locations || [];
    relicList = proj.relics || [];
    artList = proj.wikiArticles || [];
  } else {
    charList = (projectOrCharacters as Character[]) || [];
    factList = factions || [];
    locList = locations || [];
    relicList = relics || [];
    artList = articles || [];
  }

  const lookup: EntityLookup = {
    characters: new Map(),
    factions: new Map(),
    locations: new Map(),
    relics: new Map(),
    articles: new Map(),
  };

  charList.forEach((c) => {
    lookup.characters.set(c.name.toLowerCase(), c);
    if (c.nickname) lookup.characters.set(c.nickname.toLowerCase(), c);
  });

  factList.forEach((f) => {
    lookup.factions.set(f.name.toLowerCase(), f);
  });

  locList.forEach((l) => {
    lookup.locations.set(l.name.toLowerCase(), l);
  });

  relicList.forEach((r) => {
    lookup.relics.set(r.name.toLowerCase(), r);
  });

  artList.forEach((a) => {
    lookup.articles.set(a.title.toLowerCase(), a);
  });

  return lookup;
}

/** Map a parent article id (or "" for top level) to its direct children. */
export function getChildrenMap(articles: WikiArticle[]): Map<string, WikiArticle[]> {
  const childrenMap = new Map<string, WikiArticle[]>();
  articles.forEach((child) => {
    const key = child.parentId || "";
    const list = childrenMap.get(key) || [];
    list.push(child);
    childrenMap.set(key, list);
  });
  return childrenMap;
}

/**
 * Ancestor chain from the article up to the root, oldest ancestor first.
 * Returns [] when the article is top-level or not found.
 */
export function getAncestorChain(articles: WikiArticle[], articleId?: string): WikiArticle[] {
  const chain: WikiArticle[] = [];
  if (!articleId) return chain;
  const byId = new Map(articles.map((a) => [a.id, a]));
  let cursor = byId.get(articleId);
  const seen = new Set<string>();
  while (cursor?.parentId && !seen.has(cursor.parentId)) {
    seen.add(cursor.parentId);
    const parent = byId.get(cursor.parentId);
    if (!parent) break;
    chain.unshift(parent);
    cursor = parent;
  }
  return chain;
}

/** All descendant ids (children, grandchildren, ...) of an article. Used to guard reparenting cycles. */
export function getDescendantIds(articles: WikiArticle[], articleId: string): Set<string> {
  const ids = new Set<string>();
  const childrenMap = getChildrenMap(articles);
  const stack = [...(childrenMap.get(articleId) || [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (ids.has(next.id)) continue;
    ids.add(next.id);
    stack.push(...(childrenMap.get(next.id) || []));
  }
  return ids;
}

// Find entity details by name string
export function findEntityByLinkText(
  linkText: string,
  lookup: EntityLookup
): {
  type: "character" | "faction" | "location" | "relic" | "article" | "unknown";
  data?: any;
  targetArticleTitle?: string;
} {
  const query = linkText.trim().toLowerCase();

  if (lookup.articles.has(query)) {
    const art = lookup.articles.get(query)!;
    return { type: "article", data: art, targetArticleTitle: art.title };
  }

  if (lookup.characters.has(query)) {
    const char = lookup.characters.get(query)!;
    return { type: "character", data: char, targetArticleTitle: char.name };
  }

  if (lookup.factions.has(query)) {
    const fac = lookup.factions.get(query)!;
    return { type: "faction", data: fac, targetArticleTitle: fac.name };
  }

  if (lookup.locations.has(query)) {
    const loc = lookup.locations.get(query)!;
    return { type: "location", data: loc, targetArticleTitle: loc.name };
  }

  if (lookup.relics.has(query)) {
    const rel = lookup.relics.get(query)!;
    return { type: "relic", data: rel, targetArticleTitle: rel.name };
  }

  return { type: "unknown", targetArticleTitle: linkText };
}

// Compute backlinks for all articles automatically
export function computeArticleBacklinks(articles: WikiArticle[]): Map<string, string[]> {
  const backlinksMap = new Map<string, Set<string>>();

  articles.forEach((a) => {
    backlinksMap.set(a.title.toLowerCase(), new Set<string>());
  });

  const wikiLinkRegex = /\[\[(.*?)\]\]/g;

  articles.forEach((sourceArticle) => {
    let match;
    const content = sourceArticle.markdownContent || "";
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const targetName = match[1].trim().toLowerCase();
      if (backlinksMap.has(targetName)) {
        backlinksMap.get(targetName)!.add(sourceArticle.title);
      }
    }
  });

  const result = new Map<string, string[]>();
  backlinksMap.forEach((set, key) => {
    result.set(key, Array.from(set));
  });

  return result;
}
