/**
 * RimChronicle — Native Lexicon
 *
 * A presentation-only terminology layer. The lexicon NEVER mutates project
 * data: enum values ("Characters", "Factions", "Aprimay"...), saved wikis,
 * timestamps and AI prompts stay canonical across every mode. Only what is
 * RENDERED (labels, headers, dropdown option text) resolves through here.
 *
 * Modes:
 *   - "rimworld": RimWorld (Default) — original sci-fi colony vocabulary
 *   - "fantasy":  Fantasy/TTRPG       — kingdoms, dungeons & campaign flavor
 *   ("space-opera" and "modern-urban" are reserved future modes.)
 */

import { createContext, useContext } from "react";
import {
  ArticleCategory,
  CharacterStatus,
  EventCategory,
  RimWorldDate,
} from "../types";
import { EventTemplate } from "../types";

/* ------------------------------------------------------------------ */
/* Mode type + persistence                                             */
/* ------------------------------------------------------------------ */

export type LexiconMode = "rimworld" | "fantasy";

export const LEXICON_STORAGE_KEY = "rimchronicle_lexicon";

export const LEXICON_OPTIONS: { value: LexiconMode; label: string }[] = [
  { value: "rimworld", label: "RimWorld (Default)" },
  { value: "fantasy", label: "Fantasy/TTRPG" },
];

export function loadLexiconMode(): LexiconMode {
  try {
    return localStorage.getItem(LEXICON_STORAGE_KEY) === "fantasy" ? "fantasy" : "rimworld";
  } catch {
    return "rimworld";
  }
}

export function saveLexiconMode(mode: LexiconMode): void {
  try {
    localStorage.setItem(LEXICON_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable — setting simply won't persist */
  }
}

/* ------------------------------------------------------------------ */
/* Core dictionary                                                     */
/* ------------------------------------------------------------------ */

interface TermPair {
  rimworld: string;
  fantasy: string;
}

export const TERMS = {
  // Tabs & surfaces
  chronicleTab: { rimworld: "Chronicle Timeline", fantasy: "Campaign Chronicle" },
  timelineHeader: { rimworld: "Colony Chronicle Timeline", fantasy: "Campaign Chronicle" },
  timelineSubtitle: {
    rimworld: "Chronological history of RimWorld playthrough seasons, combat sieges, breakthroughs, and tragedies.",
    fantasy: "Chronological history of campaign sessions, monster attacks, breakthroughs, and tragedies.",
  },

  // Wiki categories (display only — stored values never change)
  charactersCategory: { rimworld: "Characters", fantasy: "Heroes & NPCs" },
  factionsCategory: { rimworld: "Factions", fantasy: "Kingdoms" },
  locationsCategory: { rimworld: "Locations", fantasy: "Settlements & Ruins" },
  relicsCategory: { rimworld: "Relics", fantasy: "Artifacts" },
  chroniclesCategory: { rimworld: "Chronicles", fantasy: "Quest Log" },

  // Singular nouns
  colonistSingular: { rimworld: "Colonist", fantasy: "Hero" },
  factionSingular: { rimworld: "Faction", fantasy: "Kingdom" },
  relicSingular: { rimworld: "Relic", fantasy: "Artifact" },
  dossierWord: { rimworld: "Dossier", fantasy: "Character Sheet" },

  // Character management
  colonistsPlural: { rimworld: "Colonists", fantasy: "Heroes" },
  addColonist: { rimworld: "Add Colonist", fantasy: "Add Hero" },
  addFirstColonist: { rimworld: "Add First Colonist", fantasy: "Add First Hero" },
  createColonist: { rimworld: "Create Colonist", fantasy: "Create Hero" },
  sourceCharacter: { rimworld: "Source Colonist", fantasy: "Source Hero" },
  targetCharacter: { rimworld: "Target Colonist", fantasy: "Target Hero" },
  defaultRole: { rimworld: "Colonist", fantasy: "Adventurer" },

  // Body & condition fields
  bionicsLabel: { rimworld: "Bionics", fantasy: "Enchantments" },
  healthConditionsLabel: { rimworld: "Health Conditions", fantasy: "Afflictions" },
  healthScarsBionics: { rimworld: "Health, Scars & Bionics", fantasy: "Vitality, Scars & Enchantments" },
  healthPlaceholder: {
    rimworld: "Mangled Torso scar, Bionic Left Arm, Frostbitten finger",
    fantasy: "Old battle scar, Enchanted gauntlet, Cursed ring finger",
  },

  // Statuses / events
  mentalBreak: { rimworld: "Mental Break", fantasy: "Madness" },

  // Relationships graph
  manageFactions: { rimworld: "Manage Factions", fantasy: "Manage Kingdoms" },
  addNewFaction: { rimworld: "Add New Faction", fantasy: "Add New Kingdom" },
  noFaction: { rimworld: "— No Faction —", fantasy: "— No Kingdom —" },

  // Timeline filters
  involvedCharacter: { rimworld: "Involved Colonist", fantasy: "Involved Hero" },
  allCharacters: { rimworld: "All Colonists", fantasy: "All Heroes" },
  searchChronicle: { rimworld: "Search Chronicle", fantasy: "Search Campaign" },
  quadrumUnit: { rimworld: "Quadrum", fantasy: "Tenday" },
  quadrumEpoch: { rimworld: "Quadrum / Epoch", fantasy: "Tenday / Epoch" },

  // Master clock
  masterClockTitle: { rimworld: "Colony Master Clock", fantasy: "Campaign Master Clock" },
} satisfies Record<string, TermPair>;

export type TermKey = keyof typeof TERMS;

export function term(key: TermKey, mode: LexiconMode): string {
  return TERMS[key][mode];
}

/* ------------------------------------------------------------------ */
/* Enum label resolvers                                                */
/* ------------------------------------------------------------------ */

const CATEGORY_TERMS: Record<ArticleCategory, TermPair> = {
  Characters: TERMS.charactersCategory,
  Factions: TERMS.factionsCategory,
  Locations: TERMS.locationsCategory,
  Relics: TERMS.relicsCategory,
  Chronicles: TERMS.chroniclesCategory,
  Lore: { rimworld: "Lore", fantasy: "Lore" },
  Battles: { rimworld: "Battles", fantasy: "Battles" },
};

export function categoryLabel(cat: ArticleCategory, mode: LexiconMode): string {
  return CATEGORY_TERMS[cat][mode];
}

/** Descriptive hints shown inside the Create-Article category dropdown. */
const CATEGORY_CREATE_HINTS: Record<ArticleCategory, TermPair> = {
  Characters: {
    rimworld: "Characters (Colonists, Enemies, Nobles)",
    fantasy: "Heroes & NPCs (Heroes, Monsters, Villains)",
  },
  Factions: {
    rimworld: "Factions (Settlements, Cartels, Tribes)",
    fantasy: "Kingdoms (Guilds, Pantheons, Royal Courts)",
  },
  Locations: {
    rimworld: "Locations (Base Sectors, Ruins, Shrines)",
    fantasy: "Settlements & Ruins (Dungeons, Ruins, Shrines)",
  },
  Relics: {
    rimworld: "Relics & Tech (Persona Weapons, Archotech)",
    fantasy: "Artifacts & Magic (Magic Items, Cursed Objects)",
  },
  Chronicles: {
    rimworld: "Chronicles (Sieges, Cold Snaps, Tragedies)",
    fantasy: "Quest Log (Sieges, Monster Attacks, Tragedies)",
  },
  Lore: {
    rimworld: "Lore & Ideoligions (Philosophy, Legends)",
    fantasy: "Lore & Pantheons (Philosophy, Legends)",
  },
  Battles: { rimworld: "Battles", fantasy: "Battles" },
};

export function categoryCreateHint(cat: ArticleCategory, mode: LexiconMode): string {
  return CATEGORY_CREATE_HINTS[cat][mode];
}

const EVENT_CATEGORY_TERMS: Record<EventCategory, TermPair> = {
  Combat: { rimworld: "Combat", fantasy: "Combat" },
  Social: { rimworld: "Social", fantasy: "Social" },
  "Mental Break": TERMS.mentalBreak,
  Miracle: { rimworld: "Miracle", fantasy: "Miracle" },
  Quest: { rimworld: "Quest", fantasy: "Quest" },
  Tragedy: { rimworld: "Tragedy", fantasy: "Tragedy" },
  Discovery: { rimworld: "Discovery", fantasy: "Discovery" },
  Surgery: { rimworld: "Surgery", fantasy: "Surgery" },
  "Colony Life": { rimworld: "Colony Life", fantasy: "Colony Life" },
  Travel: { rimworld: "Travel", fantasy: "Journey" },
};

export function eventCategoryLabel(cat: EventCategory, mode: LexiconMode): string {
  return EVENT_CATEGORY_TERMS[cat][mode];
}

const STATUS_TERMS: Record<CharacterStatus, TermPair> = {
  Active: { rimworld: "Active", fantasy: "Active" },
  Injured: { rimworld: "Injured", fantasy: "Wounded" },
  "In Mental Break": { rimworld: "In Mental Break", fantasy: "In Madness" },
  Missing: { rimworld: "Missing", fantasy: "Missing" },
  Deceased: { rimworld: "Deceased", fantasy: "Deceased" },
  "Transhumanist Ascended": { rimworld: "Transhumanist Ascended", fantasy: "Ascended" },
};

export function statusLabel(status: CharacterStatus, mode: LexiconMode): string {
  return STATUS_TERMS[status][mode];
}

/* ------------------------------------------------------------------ */
/* Quadrum display names                                               */
/* ------------------------------------------------------------------ */

const QUADRUM_DISPLAY: Record<LexiconMode, readonly string[]> = {
  rimworld: ["Aprimay", "Jugust", "Septober", "Decembary"],
  fantasy: ["Waxing Moon", "Full Moon", "Waning Moon", "Dark Moon"],
};

/** Display-only quadrum name; canonical names remain in downtime.QUADRUMS. */
export function quadrumDisplay(index: number, mode: LexiconMode): string {
  return QUADRUM_DISPLAY[mode][index] ?? QUADRUM_DISPLAY.rimworld[index];
}

/** Display-only date stamp, e.g. "12 Aprimay, 5501" / "12 Waxing Moon, 5501". */
export function formatDateDisplay(date: RimWorldDate, mode: LexiconMode): string {
  return `${date.day} ${quadrumDisplay(date.quadrumIndex, mode)}, ${date.year}`;
}

/* ------------------------------------------------------------------ */
/* Built-in stencil display names                                      */
/* ------------------------------------------------------------------ */

const TEMPLATE_NAME_OVERRIDES: Record<string, TermPair> = {
  "stencil-raid": { rimworld: "Raid", fantasy: "Monster Attack" },
  "stencil-mental-break": { rimworld: "Mental Break", fantasy: "Madness" },
};

/** Display-only stencil name; ids and body templates stay canonical. */
export function templateName(tpl: Pick<EventTemplate, "id" | "name">, mode: LexiconMode): string {
  return TEMPLATE_NAME_OVERRIDES[tpl.id]?.[mode] ?? tpl.name;
}

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

export const LexiconContext = createContext<LexiconMode>("rimworld");

export function useLexiconMode(): LexiconMode {
  return useContext(LexiconContext);
}

export interface LexiconApi {
  mode: LexiconMode;
  t: (key: TermKey) => string;
  cat: (cat: ArticleCategory) => string;
  catHint: (cat: ArticleCategory) => string;
  evCat: (cat: EventCategory) => string;
  status: (status: CharacterStatus) => string;
  quadrum: (index: number) => string;
  date: (date: RimWorldDate) => string;
  tplName: (tpl: Pick<EventTemplate, "id" | "name">) => string;
}

/** Convenience hook: resolvers pre-bound to the active lexicon mode. */
export function useLexicon(): LexiconApi {
  const mode = useLexiconMode();
  return {
    mode,
    t: (key) => term(key, mode),
    cat: (cat) => categoryLabel(cat, mode),
    catHint: (cat) => categoryCreateHint(cat, mode),
    evCat: (cat) => eventCategoryLabel(cat, mode),
    status: (status) => statusLabel(status, mode),
    quadrum: (index) => quadrumDisplay(index, mode),
    date: (date) => formatDateDisplay(date, mode),
    tplName: (tpl) => templateName(tpl, mode),
  };
}
