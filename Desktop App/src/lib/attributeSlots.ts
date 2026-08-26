/**
 * RimChronicle — Dynamic Attribute Slot engine.
 *
 * Replaces the hardcoded Bionics/Health character fields with a project-wide
 * slot layout that users can rename and repurpose per lexicon mode:
 *
 *   rimworld: Bionics · Health Conditions · Skills
 *   fantasy:  Spells / Prepared · Feats & Class Features · Saving Throws ·
 *             Inventory (Attuned Items)
 *
 * Slot ids are stable positional keys ("slot-a".."slot-d"), so switching the
 * mode preset relabels slots in place and every character's entries survive
 * — renaming IS repurposing. Hand-renamed slots (customLabel) are never
 * auto-relabelled.
 */

import { AttributeSlotConfig, Character, StoryProject } from "../types";
import { LexiconMode } from "./lexicon";
import {
  BIONICS_SLOT_ID,
  HEALTH_SLOT_ID,
  SKILLS_SLOT_ID,
  extractLegacyBionics,
  sanitizeCharacterArticleSections,
} from "./wikiParser";

export { BIONICS_SLOT_ID, HEALTH_SLOT_ID, SKILLS_SLOT_ID };

interface SlotPreset {
  id: string;
  label: string;
}

const CORE_IDS = [BIONICS_SLOT_ID, HEALTH_SLOT_ID, SKILLS_SLOT_ID, "slot-d"];

export const SLOT_PRESETS: Record<LexiconMode, AttributeSlotConfig[]> = {
  rimworld: [
    { id: CORE_IDS[0], label: "Bionics" },
    { id: CORE_IDS[1], label: "Health Conditions" },
    { id: CORE_IDS[2], label: "Skills" },
  ],
  fantasy: [
    { id: CORE_IDS[0], label: "Spells / Prepared" },
    { id: CORE_IDS[1], label: "Feats & Class Features" },
    { id: CORE_IDS[2], label: "Saving Throws" },
    { id: CORE_IDS[3], label: "Inventory (Attuned Items)" },
  ],
};

/** Every preset label ever used — renaming back to one un-flags customLabel. */
const ALL_PRESET_LABELS = new Set(
  [...SLOT_PRESETS.rimworld, ...SLOT_PRESETS.fantasy].map((s) => s.label.toLowerCase())
);

function uniqueId(existing: Set<string>, base: string): string {
  let candidate = base;
  let n = 1;
  while (existing.has(candidate)) candidate = `${base}-${++n}`;
  return candidate;
}

/* ------------------------------------------------------------------ */
/* Migration                                                           */
/* ------------------------------------------------------------------ */

/**
 * Split legacy healthConditions into the seeded slot layout:
 * bionic-matching items land in the "Bionics" slot, everything else stays in
 * "Health Conditions", "Skills" starts empty. Idempotent — characters with
 * slotEntries and projects with an attributeSlots config pass through clean.
 */
export function migrateProjectSlots(project: StoryProject): StoryProject {
  const hadConfig = !!project.attributeSlots && project.attributeSlots.length > 0;
  const config: AttributeSlotConfig[] = hadConfig
    ? project.attributeSlots!
    : SLOT_PRESETS.rimworld.map((p) => ({ ...p }));

  let changed = !hadConfig;

  const characters = project.characters.map((c) => {
    if (c.slotEntries) return c;

    const legacy = c.healthConditions || [];
    const bionics = extractLegacyBionics(c);
    const other = legacy.filter((hc) => !bionics.includes(hc));

    changed = true;
    return {
      ...c,
      slotEntries: {
        [CORE_IDS[0]]: bionics,
        [CORE_IDS[1]]: other,
        [CORE_IDS[2]]: [] as string[],
      },
    };
  });

  // Traits & attribute slots render live in the Dossier card on Characters
  // pages — strip stale static copies from article markdown so they never
  // drift from the live data.
  let articlesChanged = false;
  const wikiArticles = (project.wikiArticles || []).map((art) => {
    if (art.category !== "Characters") return art;
    const cleaned = sanitizeCharacterArticleSections(art.markdownContent, config);
    if (cleaned === art.markdownContent) return art;
    articlesChanged = true;
    return {
      ...art,
      markdownContent: cleaned,
      wordCount: cleaned.split(/\s+/).filter(Boolean).length,
    };
  });

  if (!changed && !articlesChanged) return project;

  return { ...project, attributeSlots: config, characters, wikiArticles };
}

/* ------------------------------------------------------------------ */
/* Mode presets                                                        */
/* ------------------------------------------------------------------ */

/**
 * Relabel untouched slots to the target mode's preset (matched by position),
 * appending any preset slots the project doesn't have yet. User-renamed
 * slots keep their names; user-created extra slots are never removed.
 */
export function applyModePreset(project: StoryProject, nextMode: LexiconMode): StoryProject {
  const migrated = migrateProjectSlots(project);
  const current = migrated.attributeSlots!;
  const preset = SLOT_PRESETS[nextMode];

  const takenIds = new Set(current.map((s) => s.id));
  const next: AttributeSlotConfig[] = current.map((slot, i) =>
    i < preset.length && !slot.customLabel ? { ...slot, label: preset[i].label } : slot
  );

  for (let i = current.length; i < preset.length; i++) {
    const p = preset[i];
    next.push({ id: uniqueId(takenIds, p.id), label: p.label });
    takenIds.add(next[next.length - 1].id);
  }

  return { ...migrated, attributeSlots: next };
}

/** Rename a slot by hand; flags it so mode switches leave the name alone. */
export function renameSlot(project: StoryProject, slotId: string, rawLabel: string): StoryProject {
  const label = rawLabel.trim();
  if (!label || !project.attributeSlots) return project;
  return {
    ...project,
    attributeSlots: project.attributeSlots.map((s) =>
      s.id === slotId
        ? { ...s, label, customLabel: !ALL_PRESET_LABELS.has(label.toLowerCase()) }
        : s
    ),
  };
}

export function addSlot(project: StoryProject, rawLabel: string): StoryProject {
  const label = rawLabel.trim();
  if (!label) return project;
  const current = project.attributeSlots || [];
  const takenIds = new Set(current.map((s) => s.id));
  return {
    ...project,
    attributeSlots: [
      ...current,
      { id: uniqueId(takenIds, "slot-custom"), label, customLabel: true },
    ],
  };
}

export function removeSlot(project: StoryProject, slotId: string): StoryProject {
  return {
    ...project,
    attributeSlots: (project.attributeSlots || []).filter((s) => s.id !== slotId),
    characters: project.characters.map((c) => {
      if (!c.slotEntries || !(slotId in c.slotEntries)) return c;
      const { [slotId]: _dropped, ...rest } = c.slotEntries;
      return syncLegacyMirror({ ...c, slotEntries: rest });
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Per-character entry helpers                                         */
/* ------------------------------------------------------------------ */

/** Mirror every slot entry into the flat healthConditions list so legacy
 *  consumers (keyword scans, tooltips) keep seeing the full picture. */
function syncLegacyMirror(character: Character): Character {
  const flat = Object.values(character.slotEntries || {}).flat();
  return { ...character, healthConditions: flat };
}

export function getSlotEntries(character: Character, slotId: string): string[] {
  if (character.slotEntries && slotId in character.slotEntries) {
    return character.slotEntries[slotId] || [];
  }
  // Unmigrated character: approximate from legacy fields by slot position.
  if (slotId === BIONICS_SLOT_ID) return extractLegacyBionics(character);
  if (slotId === HEALTH_SLOT_ID) return character.healthConditions || [];
  return [];
}

function setSlotEntries(character: Character, entriesById: Record<string, string[]>): Character {
  return syncLegacyMirror({ ...character, slotEntries: { ...entriesById } });
}

/** Build slotEntries from comma-separated form inputs keyed by slot id. */
export function buildSlotEntries(inputs: Record<string, string>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  Object.entries(inputs).forEach(([id, text]) => {
    out[id] = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });
  return out;
}

/** Apply comma-separated form inputs onto any character (saved or unsaved). */
export function applySlotInputs(
  character: Character,
  inputs: Record<string, string>
): Character {
  return syncLegacyMirror({ ...character, slotEntries: buildSlotEntries(inputs) });
}
