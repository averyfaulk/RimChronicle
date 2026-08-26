import { WikiArticle, Character, Faction, LocationItem, RelicItem, StoryProject } from "../types";

export interface EntityLookup {
  characters: Map<string, Character>;
  factions: Map<string, Faction>;
  locations: Map<string, LocationItem>;
  relics: Map<string, RelicItem>;
  articles: Map<string, WikiArticle>;
}

const BIONIC_KEYWORDS = [
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
export function extractBionics(character: Character): string[] {
  return (character.healthConditions || []).filter((hc) =>
    BIONIC_KEYWORDS.some((kw) => hc.toLowerCase().includes(kw))
  );
}

/**
 * Canonical markdown body for the mandatory character dossier sections:
 * every character entry must carry "## Traits" and "## Bionics & Health".
 */
export function buildCharacterDossierSections(character?: Character): string {
  const traits = character?.traits || [];
  const health = character?.healthConditions || [];
  const bionics = health.filter((hc) =>
    BIONIC_KEYWORDS.some((kw) => hc.toLowerCase().includes(kw))
  );
  const otherConditions = health.filter(
    (hc) => !BIONIC_KEYWORDS.some((kw) => hc.toLowerCase().includes(kw))
  );

  const traitsSection = `## Traits\n${
    traits.length > 0 ? traits.map((t) => `* **${t}**`).join("\n") : "* *(No recorded traits yet.)*"
  }`;

  const bionicsLines = [
    ...bionics.map((b) => `* **${b}**`),
    ...otherConditions.map((h) => `* ${h}`),
  ];

  const bionicsSection = `## Bionics & Health\n${
    bionicsLines.length > 0
      ? bionicsLines.join("\n")
      : "* *(No prosthetics, augmentations, or medical conditions on record.)*"
  }`;

  return `${traitsSection}\n\n${bionicsSection}`;
}

/**
 * Ensure a character article's markdown contains the mandatory
 * "## Traits" and "## Bionics & Health" sections, appending any that are missing.
 */
export function ensureCharacterArticleSections(
  markdownContent: string,
  character?: Character
): string {
  const hasTraits = /^##\s+Traits\b/im.test(markdownContent);
  const hasBionics = /^##\s+Bionics(&|\s)/im.test(markdownContent);

  if (hasTraits && hasBionics) return markdownContent;

  let updated = markdownContent;

  if (!hasTraits) {
    const traitsBlock =
      character && character.traits.length > 0
        ? `## Traits\n${character.traits.map((t) => `* **${t}**`).join("\n")}`
        : "## Traits\n* *(Trait record pending archivist review.)*";
    updated += `\n\n${traitsBlock}`;
  }

  if (!hasBionics) {
    const health = character?.healthConditions || [];
    const bionicLines = health.filter((hc) =>
      BIONIC_KEYWORDS.some((kw) => hc.toLowerCase().includes(kw))
    );
    const bionicsBlock =
      bionicLines.length > 0
        ? `## Bionics & Health\n${bionicLines.map((b) => `* **${b}**`).join("\n")}`
        : "## Bionics & Health\n* *(No bionics or medical conditions on record.)*";
    updated += `\n\n${bionicsBlock}`;
  }

  return updated.trimEnd() + "\n";
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
