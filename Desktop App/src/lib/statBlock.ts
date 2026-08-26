/**
 * RimChronicle — Stat Block Renderer.
 *
 * Takes user-filled numeric fields (structured CombatStats plus "Strength: 18"
 * style entries typed into any attribute slot) and formats a compact Markdown
 * stat block matching the 5e SRD layout. Output is plain Markdown that can be
 * pasted straight into a VTT or a wiki page.
 */

import { Character, CombatStats, StoryProject } from "../types";
import { resolveSlotConfig } from "./wikiParser";

export type AbilityKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export const ABILITY_KEYS: AbilityKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

export const ABILITY_SHORT: Record<AbilityKey, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

const ABILITY_NAMES = new Map<string, AbilityKey>([
  ...ABILITY_KEYS.map((k) => [k, k] as [string, AbilityKey]),
  ...ABILITY_KEYS.map((k) => [ABILITY_SHORT[k].toLowerCase(), k] as [string, AbilityKey]),
]);

/** Standard 5e ability modifier: floor((score - 10) / 2). */
export function modifierFor(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return `${mod >= 0 ? "+" : ""}${mod}`;
}

/**
 * Scan slot entries for ability lines such as "Strength: 18", "DEX = 14"
 * or "Wis +3" (a bare modifier applies to the merged score only when no
 * structured score exists — modifiers alone can't reconstruct a score).
 */
export function parseAbilityEntries(
  entries: string[],
  scores: Partial<Record<AbilityKey, number>> = {}
): Partial<Record<AbilityKey, number>> {
  const out = { ...scores };
  entries.forEach((entry) => {
    const match = entry.match(/^\s*([A-Za-z]+)\s*[:=]\s*(-?\d{1,2})\s*$/);
    if (!match) return;
    const key = ABILITY_NAMES.get(match[1].toLowerCase());
    if (!key) return;
    const value = parseInt(match[2], 10);
    if (value >= 1 && value <= 30 && out[key] === undefined) {
      out[key] = value;
    }
  });
  return out;
}

function findSlotEntries(character: Character, project: StoryProject, pattern: RegExp): string[] {
  const slots = resolveSlotConfig(project);
  const collected: string[] = [];
  slots.forEach((slot) => {
    if (!pattern.test(slot.label)) return;
    (character.slotEntries?.[slot.id] || []).forEach((e) => {
      if (e.trim()) collected.push(e.trim());
    });
  });
  return collected;
}

/** Merge structured combat stats with anything parsed from slot text. */
export function resolveStats(character: Character, project: StoryProject): CombatStats {
  const structured = character.combatStats || {};
  const allSlotEntries = Object.values(character.slotEntries || {}).flat();
  const abilities = parseAbilityEntries(allSlotEntries, {
    strength: structured.strength,
    dexterity: structured.dexterity,
    constitution: structured.constitution,
    intelligence: structured.intelligence,
    wisdom: structured.wisdom,
    charisma: structured.charisma,
  });

  return {
    ...structured,
    strength: abilities.strength,
    dexterity: abilities.dexterity,
    constitution: abilities.constitution,
    intelligence: abilities.intelligence,
    wisdom: abilities.wisdom,
    charisma: abilities.charisma,
  };
}

function savingThrowLine(stats: CombatStats): string | null {
  const parts = ABILITY_KEYS.filter((k) => stats[k] !== undefined).map((k) => {
    const short = ABILITY_SHORT[k];
    // Structured saves aren't tracked separately; derive from ability score.
    return `${short} ${formatModifier(modifierFor(stats[k]!))}`;
  });
  return parts.length > 0 ? `**Saving Throws** ${parts.join(", ")}` : null;
}

/**
 * Render the compact SRD-style stat block. Every line with no backing data
 * is omitted, so partial characters still produce valid, paste-ready blocks.
 */
export function renderStatBlock(character: Character, project: StoryProject): string {
  const stats = resolveStats(character, project);

  const lines: string[] = [`## ${character.name}`];

  if (stats.creatureType?.trim()) {
    lines.push(`*${stats.creatureType.trim()}*`);
  }

  const vitals: string[] = [];
  if (stats.armorClass?.trim()) vitals.push(`**Armor Class** ${stats.armorClass.trim()}`);
  if (stats.hitPoints?.trim()) vitals.push(`**Hit Points** ${stats.hitPoints.trim()}`);
  if (vitals.length > 0) lines.push(vitals.join("\n"));
  if (stats.speed?.trim()) lines.push(`**Speed** ${stats.speed.trim()}`);

  const hasAnyAbility = ABILITY_KEYS.some((k) => stats[k] !== undefined);
  if (hasAnyAbility) {
    lines.push(
      [
        `| ${ABILITY_KEYS.map((k) => ABILITY_SHORT[k]).join(" | ")} |`,
        `|${ABILITY_KEYS.map(() => "---").join("|")}|`,
        `| ${ABILITY_KEYS.map((k) => (stats[k] !== undefined ? `${stats[k]} (${formatModifier(modifierFor(stats[k]!))})` : "—")).join(" | ")} |`,
      ].join("\n")
    );
  }

  const saveEntries = findSlotEntries(character, project, /saving throw/i);
  if (saveEntries.length > 0) {
    // Explicit user-entered saving throws win over derived modifiers.
    lines.push(`**Saving Throws** ${saveEntries.join(", ")}`);
  } else if (hasAnyAbility) {
    const saves = savingThrowLine(stats);
    if (saves) lines.push(saves);
  }

  const skillEntries = findSlotEntries(character, project, /skill|feat|proficien/i);
  if (skillEntries.length > 0) {
    lines.push(`**Skills** ${skillEntries.join(", ")}`);
  }

  const inventory = findSlotEntries(character, project, /inventory|equipment|attuned/i);
  if (inventory.length > 0) {
    lines.push(`**Equipment** ${inventory.join(", ")}`);
  }

  if (stats.senses?.trim()) lines.push(`**Senses** ${stats.senses.trim()}`);
  if (stats.languages?.trim()) lines.push(`**Languages** ${stats.languages.trim()}`);
  if (stats.initiative?.trim()) lines.push(`**Initiative** ${stats.initiative.trim()}`);
  if (stats.challengeRating?.trim()) lines.push(`**Challenge** ${stats.challengeRating.trim()}`);

  return lines.join("\n\n");
}
