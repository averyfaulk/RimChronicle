/**
 * RimChronicle — Offline "AI Mode" replacement engine.
 *
 * Everything in this file runs 100% locally with zero network or AI calls:
 *  - rollLocalDowntimeSnippets: rule-based Downtime Dice using RimWorld-themed
 *    event templates seeded from the project's own colonists and locations.
 *  - LOCAL_CROSSROAD_PRESETS / buildLocalCrossroadDraft: character-driven
 *    storyteller scenarios (social dilemmas anchored to existing canon — never
 *    game-event claims) with multi-choice resolutions, merged with a user's
 *    custom scenario library via pickLocalPresets(count, project, extra).
 *  - runStaticNarrativeScan: deterministic plot-gap analyzer (12 checks:
 *    dead links, orphaned articles, loners, missing appearances, pending
 *    drafts, unlinked articles, ghost events, duplicate titles, broken faction
 *    refs, timeline stagnation, cultural friction, hazard unpreparedness)
 *    plus a cohesion score.
 */

import {
  Character,
  CharacterRelationship,
  CrossroadScenario,
  DowntimeColonistProfile,
  DowntimeSnippet,
  EventCategory,
  PlotGap,
  PlotGapAnalysisReport,
  PlotGapSeverity,
  PlotGapType,
  StoryProject,
  ThreatLevel,
  TimelineEvent,
  WikiArticle
} from "../types";
import { buildEntityLookup, computeArticleBacklinks } from "./wikiParser";
import { parseRimWorldTimestamp } from "./downtime";
import { isColonyLocationType, getTaxonomy, taxonomyLabel, hasFlag, entryByLabel } from "./taxonomy";
import { buildCulturalFrictionGaps } from "./preceptEngine";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pickRandom<T>(arr: T[]): T {
  return arr[randInt(arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const RIM_ANIMALS = [
  "muffalo",
  "timber wolf",
  "megasloth",
  "boomalope",
  "thrumbo",
  "snowhare",
  "husky",
  "elk",
  "ibex",
  "cassowary"
];

/**
 * Find the relationship whose opinion is the lowest ("lowest") or highest
 * ("highest") among pairs where both ends match a known character by name or
 * nickname. Returns the raw source/target strings, or null when no matched
 * bond exists.
 */
function findExtremeBond(
  project: StoryProject,
  direction: "lowest" | "highest"
): CharacterRelationship | null {
  const nameSet = new Set<string>();
  project.characters.forEach((c) => {
    nameSet.add(c.name.trim().toLowerCase());
    if (c.nickname) nameSet.add(c.nickname.trim().toLowerCase());
  });

  let best: CharacterRelationship | null = null;
  for (const rel of project.relationships || []) {
    if (
      !nameSet.has(rel.source.trim().toLowerCase()) ||
      !nameSet.has(rel.target.trim().toLowerCase())
    ) {
      continue;
    }
    if (best === null) {
      best = rel;
      continue;
    }
    if (direction === "lowest" ? rel.opinion < best.opinion : rel.opinion > best.opinion) {
      best = rel;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Rule-based Downtime Dice                                            */
/* ------------------------------------------------------------------ */

export interface LocalRollContext {
  snippetCount: number;
  daysCovered: number;
  eligibleColonists: DowntimeColonistProfile[];
  locations: { name: string; type: string; biome?: string }[];
}

interface LocalSnippetTemplate {
  id: string;
  /** Solo templates need one colonist, duo templates need two. */
  castSize: 1 | 2;
  category: string; // EventCategory id — customizable via project taxonomy
  threatLevel: ThreatLevel;
  intensityRange: [number, number];
  build: (ctx: { a: DowntimeColonistProfile; b?: DowntimeColonistProfile; location: string }) => {
    title: string;
    description: string;
    narrativeImpact: string;
  };
}

const DOWNTIME_TEMPLATES: LocalSnippetTemplate[] = [
  {
    id: "zztt-fire",
    castSize: 1,
    category: "event-colony-life",
    threatLevel: "Moderate",
    intensityRange: [4, 7],
    build: ({ a, location }) => ({
      title: `Zzztt! Electrical Fire at ${location}`,
      description: `A rogue power surge arced through the conduits of ${location}, erupting in a crackling Zzztt that scorched the nearest wall. ${a.name} grabbed the firefoam popper and smothered the flames before they spread, coughing on acrid smoke but keeping the blaze contained.`,
      narrativeImpact: `${a.nickname || a.name} prevented an electrical inferno, though ${location} needs rewiring and the battery reserve took a hit.`
    })
  },
  {
    id: "campfire-chat",
    castSize: 2,
    category: "event-social",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, b, location }) => ({
      title: "Fireside Confessions",
      description: `${a.name} and ${b!.name} lingered after evening mess at ${location}, trading stories of glitterworlds, botched surgeries, and home planets they may never see again. The conversation drifted long past lights-out.`,
      narrativeImpact: `${a.nickname || a.name} and ${b!.nickname || b!.name} grew closer over shared confessions — morale quietly mends around the fire.`
    })
  },
  {
    id: "fridge-raid",
    castSize: 1,
    category: "event-mental-break",
    threatLevel: "Minor",
    intensityRange: [2, 4],
    build: ({ a }) => ({
      title: "Midnight Fridge Raid",
      description: `Stress got the better of ${a.name}. Under cover of darkness they raided the food stores, devouring three lavish meals back-to-back and leaving a trail of empty nutrient paste wrappers across the rec room floor.`,
      narrativeImpact: `The colony's meal count dips and ${a.nickname || a.name} owes the cook an apology — but the binge seems to have lifted their mood.`
    })
  },
  {
    id: "hunt",
    castSize: 1,
    category: "Discovery",
    threatLevel: "Minor",
    intensityRange: [3, 5],
    build: ({ a, location }) => {
      const animal = pickRandom(RIM_ANIMALS);
      return {
        title: `Hunt: ${animal.replace(/^\w/, (m) => m.toUpperCase())}`,
        description: `${a.name} slipped out beyond ${location} with a bolt-action rifle and stalked a ${animal} for most of the day. A single clean shot brought it down, and the haul of meat and leather was hauled back before dusk.`,
        narrativeImpact: `The freezer gains fresh ${animal} meat; ${a.nickname || a.name}'s shooting steadied with every tracked mile.`
      };
    }
  },
  {
    id: "taming",
    castSize: 1,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [2, 6],
    build: ({ a, location }) => {
      const animal = pickRandom(RIM_ANIMALS);
      const success = Math.random() < 0.45;
      return success
        ? {
            title: `Tamed a ${animal.replace(/^\w/, (m) => m.toUpperCase())}`,
            description: `After hours of patient coaxing beside ${location}, ${a.name} finally won the trust of a wild ${animal}. It now follows them everywhere, sniffing at pockets for treats.`,
            narrativeImpact: `The colony has a new bonded ${animal}; ${a.nickname || a.name} beams with quiet pride.`
          }
        : {
            title: `Taming Attempt: ${animal.replace(/^\w/, (m) => m.toUpperCase())}`,
            description: `${a.name} spent the day near ${location} waving handfuls of kibble at a deeply unimpressed ${animal}. It bolted before sundown, and only a narrowly dodged kick was gained.`,
            narrativeImpact: `The ${animal} remains wild — ${a.nickname || a.name} vows to try again with better bait.`
          };
    }
  },
  {
    id: "bionic-ache",
    castSize: 1,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a }) => {
      const part = a.bionics.length > 0 ? a.bionics[0] : "old wound";
      return {
        title: "Ache Beneath the Plating",
        description: `The cold front rolling in made ${a.name}'s ${part} throb dully. They spent the afternoon by the stove, oiling joints and flexing scar tissue while regaling passers-by with exaggerated tales of the surgery.`,
        narrativeImpact: `Nothing permanent — but ${a.nickname || a.name}'s body keeps a ledger the mind would rather forget.`
      };
    }
  },
  {
    id: "target-practice",
    castSize: 1,
    category: "event-combat",
    threatLevel: "Minor",
    intensityRange: [2, 4],
    build: ({ a, location }) => ({
      title: "Target Practice Drills",
      description: `${a.name} stacked scrap plates into targets outside ${location} and drilled trigger discipline until the barrel was too hot to touch. Several cans gave their lives for the cause.`,
      narrativeImpact: `${a.nickname || a.name}'s aim sharpens — when raiders next breach the wall, these hours will matter.`
    })
  },
  {
    id: "sparring-match",
    castSize: 2,
    category: "event-combat",
    threatLevel: "Minor",
    intensityRange: [2, 4],
    build: ({ a, b }) => ({
      title: "Sparring Grudge Match",
      description: `${a.name} and ${b!.name} settled an old argument the frontier way: padded fists behind the barracks. Three rounds of bruises later both were laughing too hard to remember what started it.`,
      narrativeImpact: `Respect earned the hard way — ${a.nickname || a.name} and ${b!.nickname || b!.name} fight better knowing each other's tells.`
    })
  },
  {
    id: "foraging-sweep",
    castSize: 1,
    category: "Discovery",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, location }) => ({
      title: "Foraging Sweep",
      description: `${a.name} ranged out past ${location} with a woven basket, returning at dusk with wild berries, agarilux mushrooms, and one unidentified fungus that everyone agreed nobody should eat.`,
      narrativeImpact: `A modest but welcome supplement to the food stores, gathered by ${a.nickname || a.name}'s patience alone.`
    })
  },
  {
    id: "repair-day",
    castSize: 1,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, location }) => ({
      title: "Repair & Maintenance Day",
      description: `${a.name} declared a maintenance day and swarmed over ${location} with a wrench and welding torch — patching roof leaks, tightening conduit clamps, and silencing the geothermal generator's ominous new rattle.`,
      narrativeImpact: `${location} stands a little sturdier tonight thanks to ${a.nickname || a.name}'s elbow grease.`
    })
  },
  {
    id: "night-terrors",
    castSize: 1,
    category: "event-mental-break",
    threatLevel: "Minor",
    intensityRange: [3, 5],
    build: ({ a }) => ({
      title: "Night Terrors",
      description: `${a.name} woke the barracks with shouting — some nightmare about drop pods and screaming metal. They insisted they were fine, then sat by the embers until dawn, watching the door.`,
      narrativeImpact: `Old scars speak at night. Keep an eye on ${a.nickname || a.name}; the mind heals slower than flesh.`
    })
  },
  {
    id: "letter-home",
    castSize: 1,
    category: "event-social",
    threatLevel: "Minor",
    intensityRange: [1, 2],
    build: ({ a }) => ({
      title: "Letters to the Rim",
      description: `${a.name} spent the quiet afternoon drafting letters that will take years to reach any civilized relay — messages to family, old crewmates, and one cryptic note addressed only to 'the archivist'.`,
      narrativeImpact: `Hope, folded and sealed. Whatever happens next, ${a.nickname || a.name} put their heart on paper today.`
    })
  },
  {
    id: "medical-rounds",
    castSize: 1,
    category: "Surgery",
    threatLevel: "Minor",
    intensityRange: [2, 4],
    build: ({ a }) => ({
      title: "Field Medicine Rounds",
      description: `${a.name} made the rounds of the medical bay, changing bandages, administering penoxycyline, and reprimanding two patients for picking at stitches. The medicine cabinet is restocked and every chart updated.`,
      narrativeImpact: `Preventative care pays dividends — the colony's wounds were tended early thanks to ${a.nickname || a.name}.`
    })
  },
  {
    id: "stargazing",
    castSize: 2,
    category: "Miracle",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, b }) => ({
      title: "Stargazing on the Ridge",
      description: `${a.name} dragged ${b!.name} up onto the ridge to watch the ringed gas giant rise above the horizon. For a long while neither said anything at all — and somehow that was the point.`,
      narrativeImpact: `A rare moment of stillness. ${a.nickname || a.name} and ${b!.nickname || b!.name} will remember this night longer than any battle.`
    })
  },
  {
    id: "crafting-fervor",
    castSize: 1,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, location }) => ({
      title: "Crafting Fervor",
      description: `Inspiration struck ${a.name} mid-shift at ${location}. By lamplight they churned out a batch of flak vests and repaired half the colony's worn boots, humming off-key the entire time.`,
      narrativeImpact: `The armory is fuller and the wardrobe warmer — ${a.nickname || a.name} was a machine today.`
    })
  },
  {
    id: "raid-drill",
    castSize: 2,
    category: "event-combat",
    threatLevel: "Moderate",
    intensityRange: [3, 6],
    build: ({ a, b, location }) => ({
      title: "Raid Alarm Drill",
      description: `${a.name} ran an unannounced raid drill on ${location}, sounding the alarm at dawn while ${b!.name} scrambled the defenders to their posts. Response time: respectable. Confusion: considerable. Lessons: logged.`,
      narrativeImpact: `${a.nickname || a.name} sharpened the colony's reflexes and ${b!.nickname || b!.name}'s squad found every gap in their own defenses — before raiders do.`
    })
  },
  {
    id: "mentoring-lesson",
    castSize: 2,
    category: "event-social",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, b, location }) => ({
      title: "Lessons Behind the Barn",
      description: `${a.name} took ${b!.name} aside behind ${location} for patient instruction — steady hands on a rifle stock, the right way to hold a suture needle, when to stop digging. The student repeated each step until it stuck.`,
      narrativeImpact: `Knowledge passed hand to hand; ${b!.nickname || b!.name} is measurably more useful and ${a.nickname || a.name} secretly proud of it.`
    })
  },
  {
    id: "kitchen-disaster",
    castSize: 1,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [2, 4],
    build: ({ a, location }) => ({
      title: "Culinary Incident",
      description: `A cooking experiment at ${location} went catastrophically wrong — smoke, swearing, and one pot that will never be the same. ${a.name} salvaged what could be saved and buried the evidence behind the kitchen.`,
      narrativeImpact: `The colony eats mystery stew tonight with suspicious politeness; ${a.nickname || a.name} has been quietly reassigned from chef duty.`
    })
  },
  {
    id: "graveside-visit",
    castSize: 1,
    category: "event-mental-break",
    threatLevel: "Minor",
    intensityRange: [2, 4],
    build: ({ a }) => ({
      title: "A While Among the Markers",
      description: `${a.name} slipped out alone to the graves and memorial markers, spending a quiet hour pulling weeds, straightening stones, and talking softly to people who couldn't answer.`,
      narrativeImpact: `${a.nickname || a.name} came back steadier — grief tended like a garden stays a garden.`
    })
  },
  {
    id: "aurora-vigil",
    castSize: 2,
    category: "Miracle",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, b }) => ({
      title: "The Night the Sky Danced",
      description: `An aurora unfurled across half the heavens, and ${a.name} woke ${b!.name} just to stand outside in the cold and watch it ripple green and violet over the dark.`,
      narrativeImpact: `Some nights are worth losing sleep over. ${a.nickname || a.name} and ${b!.nickname || b!.name} will describe this one badly for years.`
    })
  },
  {
    id: "research-breakthrough",
    castSize: 1,
    category: "Discovery",
    threatLevel: "Minor",
    intensityRange: [3, 5],
    build: ({ a, location }) => ({
      title: "Bench Breakthrough",
      description: `Deep in the research bench's glow at ${location}, ${a.name} cracked a problem that had resisted days of work — scribbling equations and muttering until the whole approach suddenly made sense at once.`,
      narrativeImpact: `One more piece of the universe bent to ${a.nickname || a.name}'s patience; progress compounds quietly.`
    })
  },
  {
    id: "brewing-batch",
    castSize: 1,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, location }) => ({
      title: "Batch Bottled",
      description: `${a.name} bottled the latest brew at ${location}, sampling exactly one bottle for quality control purposes and declaring this batch 'the good one' with the confidence of someone who says it every batch.`,
      narrativeImpact: `Future morale secured in brown glass; ${a.nickname || a.name}'s reputation as brewer remains unverified but enthusiastic.`
    })
  },
  {
    id: "prank-war",
    castSize: 2,
    category: "event-social",
    threatLevel: "Minor",
    intensityRange: [1, 2],
    build: ({ a, b }) => ({
      title: "The Prank Accord",
      description: `It started with salted tea and ended with ${a.name} hiding under ${b!.name}'s bed wearing a thrumbo hat. By sundown both had laughed hard enough to forgive the other everything, twice.`,
      narrativeImpact: `Morale up, trust of furniture down. The prank war ends in an armistice neither will admit losing.`
    })
  },
  {
    id: "fever-scare",
    castSize: 1,
    category: "Surgery",
    threatLevel: "Minor",
    intensityRange: [3, 5],
    build: ({ a }) => ({
      title: "The Fever Scare",
      description: `${a.name} spiked a temperature overnight and spent a tense day quarantined with a thermometer, herbal tea, and worst-case thoughts — until the fever broke by evening and turned out to be nothing but exhaustion.`,
      narrativeImpact: `False alarm, real lesson: ${a.nickname || a.name} is resting whether they like it or not, and the medicine cabinet got audited.`
    })
  },
  {
    id: "mining-strike",
    castSize: 1,
    category: "Discovery",
    threatLevel: "Moderate",
    intensityRange: [3, 6],
    build: ({ a, location }) => {
      const find = pickRandom(["a rich steel vein", "compacted machinery", "a pocket of jade", "an ancient collapsed shaft", "gold-flecked quartz"]);
      return {
        title: `Struck Something In the Deep`,
        description: `Pickaxe met promise today: ${a.name} broke through into ${find} beneath ${location}, and the whole tunnel echoed with a whoop that brought half the colony running with lamps.`,
        narrativeImpact: `Wealth where there was only rock — ${a.nickname || a.name} has earned first bragging rights at dinner for a week.`
      };
    }
  },
  {
    id: "gambling-night",
    castSize: 2,
    category: "event-social",
    threatLevel: "Minor",
    intensityRange: [1, 3],
    build: ({ a, b }) => ({
      title: "Cards For Chores",
      description: `${a.name} and ${b!.name} played cards well past lights-out, wagering chore rotations instead of silver. The final hand was disputed loudly, replayed twice, and settled with accusations of cheating that were probably entirely true.`,
      narrativeImpact: `Dish duty changed hands through sheer luck; ${a.nickname || a.name} and ${b!.nickname || b!.name} are banned from unsupervised decks for a week.`
    })
  },
  {
    id: "caravan-prep",
    castSize: 2,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [2, 4],
    build: ({ a, b, location }) => ({
      title: "Packing for the Road",
      description: `${a.name} and ${b!.name} spent the day at ${location} preparing trade goods — weighing silver, crating surplus clothes, and arguing about how many meals a pack animal realistically needs for three days (all of them, apparently).`,
      narrativeImpact: `Trade-ready inventory staged; ${a.nickname || a.name} and ${b!.nickname || b!.name} learned they argue like siblings about packing.`
    })
  },
  {
    id: "loyal-shadow",
    castSize: 1,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [1, 2],
    build: ({ a }) => {
      const animal = pickRandom(RIM_ANIMALS);
      return {
        title: "The Loyal Shadow",
        description: `Wherever ${a.name} went today, a tame ${animal} followed at heel — to the fields, the workshop, the dining hall — sitting down with the long-suffering patience of a creature that has decided whose colonist this is.`,
        narrativeImpact: `${a.nickname || a.name} has acquired a permanent shadow; the bond deepens without a single word spent.`
      };
    }
  },
  {
    id: "ice-storm-shelter",
    castSize: 2,
    category: "event-colony-life",
    threatLevel: "Minor",
    intensityRange: [2, 4],
    build: ({ a, b }) => ({
      title: "Whiteout Shelter Duty",
      description: `A screaming ice storm pinned ${a.name} and ${b!.name} in the nearest shelter for hours — one shared thermos, two blankets, and a long conversation about nothing that somehow mattered more than the weather outside.`,
      narrativeImpact: `Forced stillness did its quiet work; ${a.nickname || a.name} and ${b!.nickname || b!.name} came out of the storm closer than the storm found them.`
    })
  }
];

/**
 * Roll rule-based downtime snippets entirely offline. Templates are shuffled
 * without repeats so each roll feels fresh, participants are drawn from the
 * supplied eligible (off-screen) colonists, and locations come from the
 * player's own map.
 */
export function rollLocalDowntimeSnippets(ctx: LocalRollContext): DowntimeSnippet[] {
  const count = Math.max(0, ctx.snippetCount);

  if (count === 0 || ctx.eligibleColonists.length === 0) return [];

  // Prefer colony-flavoured locations, fall back to anything on the map.
  const colonyLocations = ctx.locations.filter((l) => isColonyLocationType(l.type));
  const locationPool =
    colonyLocations.length > 0 ? colonyLocations : ctx.locations.length > 0 ? ctx.locations : null;

  // Bionic-ache template only applies when someone actually has augmentations.
  const augmented = ctx.eligibleColonists.filter((c) => c.bionics.length > 0);

  let pool = DOWNTIME_TEMPLATES.filter(
    (t) => t.id !== "bionic-ache" || augmented.length > 0
  );
  pool = shuffle(pool);

  // Duo templates degrade gracefully to solo casts when only one pawn exists.
  const finalPool = pool.filter((t) => t.castSize === 1 || ctx.eligibleColonists.length >= 2);

  const snippets: DowntimeSnippet[] = [];

  for (let i = 0; i < count; i++) {
    const template = finalPool[i % finalPool.length];

    const shuffledCast = shuffle(ctx.eligibleColonists);
    const a = shuffledCast[0];
    const b = template.castSize === 2 ? shuffledCast[1] || shuffledCast[0] : undefined;

    const locationName = locationPool ? pickRandom(locationPool).name : "Colony Grounds";

    const built = template.build({ a, b, location: locationName });
    const [minI, maxI] = template.intensityRange;

    // Spread snippets evenly across the days this roll covers.
    const offsetDays =
      ctx.daysCovered <= 1 ? 0 : Math.min(ctx.daysCovered - 1, Math.floor((i / count) * ctx.daysCovered));

    snippets.push({
      title: built.title,
      offsetDays,
      category: template.category,
      threatLevel: template.threatLevel,
      location: locationName,
      participants: b && b.name !== a.name ? [a.name, b.name] : [a.name],
      description: built.description,
      narrativeImpact: built.narrativeImpact,
      intensityScore: minI + randInt(maxI - minI + 1)
    });
  }

  return snippets;
}

/* ------------------------------------------------------------------ */
/* Local Crossroads presets                                            */
/* ------------------------------------------------------------------ */

export interface LocalCrossroadResolution {
  label: string;
  title: string;
  summary: string;
  sceneProse: string;
  outcome: string;
  category: string; // EventCategory id — customizable via project taxonomy
  threatLevel: ThreatLevel;
  moodImpact: string;
  wikiUpdates: { articleTitle: string; updateSummary: string }[];
}

export interface LocalCrossroadPresetRequirements {
  /** Needs at least one hostile relationship (opinion <= -50) among living characters. */
  hostileBond?: boolean;
  /** Needs at least one warm relationship (opinion >= 60) among living characters. */
  positiveBond?: boolean;
  /** Needs at least one Deceased character in the roster. */
  deceased?: boolean;
  /** Minimum number of living characters required. */
  minCharacters?: number;
}

export interface LocalCrossroadPreset {
  id: string;
  title: string;
  summary: string;
  triggerConditions: string;
  storyHook: string;
  requirements?: LocalCrossroadPresetRequirements;
  resolutions: LocalCrossroadResolution[];
}

export const LOCAL_CROSSROAD_PRESETS: LocalCrossroadPreset[] = [
  {
    id: "preset-last-bunk",
    title: "The Last Bunk",
    summary:
      "The colony finishes its newest bedroom block with exactly one private room left over — and two colonists both feel they have earned it.",
    triggerConditions:
      "Fits any colony with two or more colonists; sharpest when morale is middling and privacy is scarce.",
    storyHook: "Who claims the last private room — and what does that choice say about who matters here?",
    requirements: { minCharacters: 2 },
    resolutions: [
      {
        label: "Seniority Wins",
        title: "The Oldest Claim",
        summary:
          "{{lead}} rules that the longest-serving colonist takes the room; service is the colony's only currency of rank.",
        sceneProse:
          "Two hopeful colonists stood in the empty room while {{lead}} weighed their claims on nothing but time. Seniority spoke first on the rim — the oldest bedroll takes the wall. One face fell, one brightened, and the door closed on {{colony}}'s newest private quarters.",
        outcome:
          "The veteran sleeps behind a door at last; the runner-up keeps a stiff smile and a small, patient grudge.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "-1 mood for the loser's circle; precedent set without shouting.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Settled the last-bunk dispute by honoring seniority." },
          { articleTitle: "{{colony}}", updateSummary: "Bedroom block completed; final private room assigned by tenure." }
        ]
      },
      {
        label: "Raffle It",
        title: "Names in a Helmet",
        summary:
          "Every name goes into a dented helmet; luck alone decides who sleeps alone.",
        sceneProse:
          "{{lead}} held the helmet high while folded slips rattled like dry seeds. The colony crowded in, breath held. When the winning name was read, cheers tangled with groans — and somewhere in the crowd, someone began planning how to trade their luck away next raffle.",
        outcome: "Chance crowned a winner; nobody can argue with a helmet, though several try.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+1 mood from the spectacle; fairness performed is fairness half-believed.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Adopted lottery as the fair way to divide scarce comforts." }
        ]
      },
      {
        label: "Make It an Infirmary",
        title: "A Bed For the Worst Day",
        summary:
          "{{lead}} converts the contested room into a proper sick bay — no one wins the bunk, everyone gains the answer to a bad day.",
        sceneProse:
          "'Nobody gets it,' {{lead}} said, dragging a medical cot through the door. 'Everybody might.' By nightfall the disputed room held sterile cloth, a lamp on a chain, and the quiet dignity of a place prepared for the colony's worst day instead of its pettiest argument.",
        outcome: "No private rooms gained; {{colony}} owns its first real infirmary bed and the moral high ground.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "Neutral now, +2 later when injury comes knocking; pettiness defused by purpose.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Turned the housing dispute into the colony's first infirmary." },
          { articleTitle: "{{colony}}", updateSummary: "Medical capacity expanded during the great bunk debate." }
        ]
      }
    ]
  },
  {
    id: "preset-night-shift-grudge",
    title: "Night Shift Grudge",
    summary:
      "The work rota shuffles and puts {{grudgeA}} on overlapping shifts with {{grudgeB}} — every tool handoff between them crackles.",
    triggerConditions: "Requires an existing hostile bond; fires whenever schedules force rivals together.",
    storyHook: "Can two people who despise each other share a shiftline without the colony paying for it?",
    requirements: { hostileBond: true, minCharacters: 2 },
    resolutions: [
      {
        label: "Split the Handoffs",
        title: "The Redrawn Rota",
        summary:
          "{{lead}} quietly redraws the schedule so the rivals never overlap — at the cost of slower shift changes everywhere else.",
        sceneProse:
          "{{lead}} studied the rota until the candles guttered, then redrew it like a battlefield map. {{grudgeA}} would leave before {{grudgeB}} arrived; not one shared minute remained. The shifts ran longer and lonelier, but the tools stopped being slammed down hard enough to crack handles.",
        outcome: "Peace purchased with efficiency; the colony works around its own wounds, literally.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "-1 mood from stretched shifts; zero incidents at handoff.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Redrew the rota to keep warring colonists apart." }
        ]
      },
      {
        label: "Force One Conversation",
        title: "Tea Under Supervision",
        summary:
          "Before the next overlap, {{lead}} sits both rivals down with tea and refuses to leave until words happen.",
        sceneProse:
          "Three cups were poured. Only two were wanted. {{lead}} planted themselves between {{grudgeA}} and {{grudgeB}}, slid the tea across anyway, and said the magic words: 'Nobody leaves until somebody talks.' The talk started ugly, went quiet, and ended somewhere no one predicted.",
        outcome: "A cold truce at minimum, occasionally the seed of respect — never an apology out loud.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+1 mood if it holds; the colony exhales.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Mediated the night-shift standoff over enforced tea." }
        ]
      },
      {
        label: "Let Them Work It Out",
        title: "Sparks on the Shift Line",
        summary:
          "{{lead}} declines to intervene; whatever happens at handoff, happens.",
        sceneProse:
          "{{lead}} heard the complaints and shrugged them toward the schedule board. Some pressures make diamonds; others make explosions, and there was exactly one way to find out which this was. The first overlapped shift passed in silence sharp enough to draw blood. The second was almost professional.",
        outcome: "Either a working rivalry or a spectacular blowup — resolved by them, witnessed by all.",
        category: "event-social",
        threatLevel: "Moderate",
        moodImpact: "Volatile: -2 while it burns, +2 pride colony-wide if they sort it themselves.",
        wikiUpdates: [
          { articleTitle: "{{grudgeA}}", updateSummary: "Endured forced overlap with an old rival." },
          { articleTitle: "{{grudgeB}}", updateSummary: "Shared a shiftline with an enemy — and survived it." }
        ]
      }
    ]
  },
  {
    id: "preset-unspoken-debt",
    title: "The Unspoken Debt",
    summary:
      "{{bondA}} owes {{bondB}} far more than thanks since the day everything went wrong — and the debt sits between them, unspoken, getting heavier.",
    triggerConditions: "Requires a warm bond; fires when gratitude has outgrown casual words.",
    storyHook: "How do you repay something that cannot be repaid?",
    requirements: { positiveBond: true, minCharacters: 2 },
    resolutions: [
      {
        label: "Repay In Deeds",
        title: "The Silent Ledger",
        summary:
          "{{bondA}} starts quietly taking {{bondB}}'s worst rotations — latrine detail, night watch, the cold jobs — and never says why.",
        sceneProse:
          "It began small: {{bondA}} appearing early to take {{bondB}}'s shift, waving off questions with talk of insomnia. But ledgers read both ways. {{bondB}} counted the stolen chores, understood each one, and let the silence stand — because some thank-yous only work unspoken.",
        outcome: "The debt shrinks one chore at a time; both pretend not to notice, which is the point.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+2 mood; quiet loyalty noticed by the whole colony even if never named.",
        wikiUpdates: [
          { articleTitle: "{{bondA}}", updateSummary: "Repaid an unspoken debt through silent service." },
          { articleTitle: "{{bondB}}", updateSummary: "Accepted repayment in deeds rather than words." }
        ]
      },
      {
        label: "Speak It Aloud",
        title: "Said Before Supper",
        summary:
          "At evening mess, {{bondA}} stands up and says the thing plainly — what happened, and what it has meant ever since.",
        sceneProse:
          "Spoons paused mid-air. {{bondA}} rose, throat working, and told the table exactly what {{bondB}} had done on the worst day — plainly, completely, without ornament. When it was done, {{bondB}} stared hard at their bowl and muttered that it was nothing anyone else wouldn't have done. Everyone knew better.",
        outcome: "Gratitude made public; the debt is converted into standing, which weighs less.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+3 mood colony-wide; witnessing grace does that.",
        wikiUpdates: [
          { articleTitle: "{{bondA}}", updateSummary: "Publicly thanked {{bondB}} at evening mess." },
          { articleTitle: "{{bondB}}", updateSummary: "Honored before the colony for the day everything went wrong." }
        ]
      },
      {
        label: "Wave It Off",
        title: "Between Friends, No Ledger",
        summary:
          "{{bondB}} flatly refuses any repayment: friends do not keep accounts, and pretending otherwise cheapens the act.",
        sceneProse:
          "'Stop,' {{bondB}} said, the moment {{bondA}} tried to raise it again. 'You keep trying to owe me. Friends don't owe.' The word landed heavier than intended — friends, said aloud, in a place where the dead had been friends too. After that neither mentioned it. Neither forgot it either.",
        outcome: "The debt is dissolved by decree; what replaces it has no name yet.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+1 mood; a friendship formally acknowledged without ceremony.",
        wikiUpdates: [
          { articleTitle: "{{bondB}}", updateSummary: "Refused repayment, naming the bond friendship outright." }
        ]
      }
    ]
  },
  {
    id: "preset-leadership-challenge",
    title: "Leadership Challenge",
    summary:
      "In the aftermath of {{lastEvent}}, murmurs move from bunks to the mess hall: is {{lead}}'s judgment still fit to steer {{colony}}?",
    triggerConditions: "Follows any Major or controversial canonical event; needs three or more living colonists.",
    storyHook: "What holds a colony together — trust in one voice, or many voices learning to share?",
    requirements: { minCharacters: 3 },
    resolutions: [
      {
        label: "Face the Room",
        title: "Answering for It",
        summary:
          "{{lead}} calls an assembly and answers every question asked — no spin, no deflection, just the truth as they know it.",
        sceneProse:
          "{{lead}} stood where everyone could see the hands tremble slightly, and took the first question. Then the tenth. Some answers were strong. Some admitted not knowing. By the end the room had not been won back so much as shown the man inside the decisions — sweating, certain only about trying.",
        outcome: "Authority survives on honesty; skeptics become watchful allies rather than believers.",
        category: "event-social",
        threatLevel: "Moderate",
        moodImpact: "+1 net mood; doubt aired beats doubt fermented.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Faced open questioning after {{lastEvent}} and answered honestly." },
          { articleTitle: "{{colony}}", updateSummary: "Assembly held to examine leadership after the recent crisis." }
        ]
      },
      {
        label: "Share the Weight",
        title: "The Council of Three",
        summary:
          "Instead of defending sole command, {{lead}} formalizes a small council — major calls now need more signatures.",
        sceneProse:
          "{{lead}} drew three chairs to the head table and sat in none of them at first. 'One voice got us here,' they said. 'More voices get us further.' The council was sworn in over cold coffee — {{second}} among them — and the colony watched its leader voluntarily shrink their own shadow.",
        outcome: "Decision-making slows but broadens; blame now has multiple addresses.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+2 mood from inclusion; a few miss the speed of one mind deciding.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Founded the council of three, sharing command authority." },
          { articleTitle: "{{colony}}", updateSummary: "Governance restructured after dissent following {{lastEvent}}." }
        ]
      },
      {
        label: "Double Down",
        title: "The Iron Week",
        summary:
          "{{lead}} tightens discipline, doubles watches, and dares anyone to say aloud what they've been muttering.",
        sceneProse:
          "Rules went up on the wall, lettered in charcoal. Watches doubled. Complaints were invited — once, formally, in writing — and answered point by point in public. {{lead}} did not apologize for {{lastEvent}} and did not blink. Order held. So did the resentment, coiled and patient, beneath it.",
        outcome: "Unity through pressure; the colony functions flawlessly and feels it doing so.",
        category: "event-social",
        threatLevel: "Moderate",
        moodImpact: "-2 mood under the surface; output up, warmth down.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Imposed stricter order after challenges to command." }
        ]
      }
    ]
  },
  {
    id: "preset-secret-cache",
    title: "The Secret Ration Cache",
    summary:
      "A hidden stash turns up under a bunk — meals, luxuries, medicine — hoarded quietly while everyone tightened their belts together.",
    triggerConditions: "Best after scarcity events or strict rationing periods.",
    storyHook: "Is survival instinct forgivable when it breaks the promise of 'all of us, equally'?",
    requirements: { minCharacters: 2 },
    resolutions: [
      {
        label: "Public Reckoning",
        title: "Named At Assembly",
        summary:
          "{{lead}} reveals the cache at assembly and lets the owner be seen — shame administered publicly, lesson landing on everyone.",
        sceneProse:
          "The stash sat on the mess table like evidence at trial: foil-wrapped meals, a tin of luxury coffee, painkillers meant for worse days. '{{lead}}' didn't name the owner. The colony's silence did — heads turning, one by one, until they rested on a face going pale. Nobody shouted. That was somehow worse.",
        outcome: "Deterrence achieved; trust limps afterward, keeping one eye on every bunk frame.",
        category: "event-social",
        threatLevel: "Moderate",
        moodImpact: "-2 mood immediately; -1 lingering suspicion for weeks.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Presided over the cache reckoning at assembly." },
          { articleTitle: "{{colony}}", updateSummary: "First hoarding scandal exposed and adjudicated." }
        ]
      },
      {
        label: "Quiet Redistribution",
        title: "Back Without a Word",
        summary:
          "{{lead}} returns the goods to stores overnight and tells no one — except the owner, who finds a single note on their pillow: 'Next famine kills liars too.'",
        sceneProse:
          "By morning the cache was gone and nothing was different, except everything was. The owner found the note folded under their pillow and understood two things at once: they had been seen, and they had been spared. They worked twice as hard that week and could not have explained why to anyone.",
        outcome: "Mercy as leverage; dignity preserved, warning delivered, secret kept twice over.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "Neutral outwardly; +1 from one colonist's fierce, unexplained redemption arc.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Quietly reclaimed the hoarded cache and offered mercy instead of trial." }
        ]
      },
      {
        label: "Sanction Personal Stashes",
        title: "The One-Box Rule",
        summary:
          "{{lead}} legalizes modest personal caches — one box per colonist, declared openly — betting honesty beats policing.",
        sceneProse:
          "'One box each,' {{lead}} announced, tapping the confiscated stash. 'Fill it with whatever you can't bear to lose. Keep it visible. Keep it honest.' The colony traded glances — some saw freedom, some saw surveillance dressed as generosity. All of them, that night, packed a box.",
        outcome: "Hoarding becomes policy; anxiety drops, along with the warm fiction that everyone shares alike.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "+1 mood from autonomy; equality ideal officially retired.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Instituted the one-box rule permitting declared personal caches." }
        ]
      }
    ]
  },
  {
    id: "preset-letters-never-sent",
    title: "Letters Never Sent",
    summary:
      "While clearing storage, colonists uncover unsent letters in {{deceased}}'s trunk — final words addressed to people light-years away who will never read them.",
    triggerConditions: "Requires a deceased character whose belongings remain; fires during quiet stretches.",
    storyHook: "What do you owe the words of the dead — reading, silence, or ceremony?",
    requirements: { deceased: true },
    resolutions: [
      {
        label: "Read Them Together",
        title: "An Evening Circle",
        summary:
          "At nightfall the colony gathers and reads the letters aloud, one by one — grief shared until it weighs less.",
        sceneProse:
          "They sat close around the stove, passing pages hand to hand like something fragile. Each letter began with weather or small jokes — the dead lying to spare the living one last time. By the third letter someone was crying, by the sixth someone was laughing, and that was how {{deceased}} managed to comfort {{colony}} one final time.",
        outcome: "Grief processed communally; the letters enter the chronicle in full.",
        category: "event-mental-break",
        threatLevel: "Minor",
        moodImpact: "+2 mood after the tears dry; absence made present, then bearable.",
        wikiUpdates: [
          { articleTitle: "{{deceased}}", updateSummary: "Final unsent letters read aloud and preserved in the chronicle." },
          { articleTitle: "{{colony}}", updateSummary: "Held a letter-reading vigil for {{deceased}}." }
        ]
      },
      {
        label: "Seal & Archive",
        title: "Unread, Honored",
        summary:
          "{{lead}} seals the letters unread into the archive with a catalog entry — privacy defended past death.",
        sceneProse:
          "{{lead}} weighed the envelopes once, then wrapped them in oilcloth without opening a single flap. Some words belong to the person they were written to, even if that person is unreachable. The archive drawer closed soft as a prayer, and the colony walked away lighter for not knowing.",
        outcome: "The letters rest unread; mystery preserved, intimacy refused, peace chosen.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "Neutral; a few colonists wonder forever what was in them.",
        wikiUpdates: [
          { articleTitle: "{{deceased}}", updateSummary: "Unsent correspondence sealed into the colony archive, unread." }
        ]
      },
      {
        label: "Send Them Skyward",
        title: "The Skyward Post",
        summary:
          "The colony loads the letters into a salvage pod and launches it toward the old relay — a funeral rite of delivery.",
        sceneProse:
          "The pod wasn't rated for orbit anymore and the relay hadn't answered in years. None of that mattered. They stacked the letters inside with a transponder tag reading simply 'FROM {{colony}}', and {{lead}} counted down from ten for a launch nobody needed to witness but everybody came to. The fire trail hung in the dusk like handwriting.",
        outcome: "Ceremony complete; the letters are beyond reach now, which was always the address they carried.",
        category: "Miracle",
        threatLevel: "Minor",
        moodImpact: "+2 mood; ritual works even when physics doesn't.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Launched {{deceased}}'s letters skyward in the skyward-post rite." },
          { articleTitle: "{{deceased}}", updateSummary: "Final words dispatched toward the silent relay." }
        ]
      }
    ]
  },
  {
    id: "preset-mentors-doubt",
    title: "Mentor's Doubt",
    summary:
      "{{second}} volunteers for dangerous work again, and {{lead}} — who taught them most of what they know — wonders whether the lessons ended too soon.",
    triggerConditions: "Needs at least two living colonists; strongest after injuries or close calls.",
    storyHook: "When does protecting someone become refusing to let them grow?",
    requirements: { minCharacters: 2 },
    resolutions: [
      {
        label: "Test Under Watch",
        title: "One Trial, Supervised",
        summary:
          "{{lead}} permits the next dangerous task — but shadows every step, ready to take over at the first stumble.",
        sceneProse:
          "The terms were simple: go, but I go too. Through the whole task {{lead}} hovered half a step behind {{second}}, hands twitching with swallowed corrections. The job got done clean. Only at the end did {{lead}} realize they'd been holding their breath since the first hour — pride and terror wearing the same face.",
        outcome: "Competence proven under supervision; the mentor learns something about letting go, slowly.",
        category: "event-colony-life",
        threatLevel: "Moderate",
        moodImpact: "+1 mood; competence recognized, nerves frayed on one side only.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Supervised {{second}}'s trial under the mentor's-doubt arrangement." },
          { articleTitle: "{{second}}", updateSummary: "Passed supervised trial for hazardous duty." }
        ]
      },
      {
        label: "Forbid the Work",
        title: "The Hard No",
        summary:
          "{{lead}} bars {{second}} from the rotation entirely — protection now, explanation never quite sufficient.",
        sceneProse:
          "'Not this time.' Two words, delivered flat, ending the conversation before it started. {{second}} argued experience, skill, right. {{lead}} answered with one word each time: no. That night both stayed awake — one rehearsing arguments already lost, one rehearsing a phone call to nobody about how they'd kept their promise to somebody gone.",
        outcome: "Safety wins, resentment sows; the lesson deferred grows interest.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "-1 mood; friction between care and autonomy, felt colony-wide in the silence.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Barred {{second}} from hazardous rotations after repeated volunteering." }
        ]
      },
      {
        label: "Hand Over the Torch",
        title: "Your Call Now",
        summary:
          "{{lead}} transfers full responsibility for the task class to {{second}} — including the part where you decide when to abort.",
        sceneProse:
          "{{lead}} laid the duty roster on the table and turned it around. 'From today, this is yours. Not just the doing — the deciding, including telling yourself no.' {{second}} read the names on the list differently after that: not tasks to win, but people to bring home. Somewhere behind a steady face, {{lead}} finally exhaled.",
        outcome: "Authority transferred wholesale; growth achieved, mentor officially demoted to backup.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+2 mood; the colony gains a second decision-maker and loses an excuse.",
        wikiUpdates: [
          { articleTitle: "{{second}}", updateSummary: "Assumed full authority over hazardous work rotations." },
          { articleTitle: "{{lead}}", updateSummary: "Formally handed the torch to {{second}}." }
        ]
      }
    ]
  },
  {
    id: "preset-rec-room-cold-war",
    title: "Rec Room Cold War",
    summary:
      "{{grudgeA}} and {{grudgeB}} have divided the rec room into invisible territories — chess table theirs, card corner mine, and the colony tiptoes through the middle.",
    triggerConditions: "Requires a hostile bond; accumulates silently until it dominates colony downtime.",
    storyHook: "How much space should two grudges be allowed to occupy?",
    requirements: { hostileBond: true, minCharacters: 2 },
    resolutions: [
      {
        label: "Redecorate Together",
        title: "Fresh Paint Diplomacy",
        summary:
          "{{lead}} assigns both rivals one shared project: repaint and rearrange the entire rec room, supplies limited, timeline fixed.",
        sceneProse:
          "The paint cans arrived with a note: done by Friday or the room stays half-finished and everyone knows whose fault. {{grudgeA}} rolled walls left-handed while {{grudgeB}} cut in edges right-handed, communicating exclusively through grunts and pointed brushes. By Thursday they had a system. By Friday, accidentally, they had a room — and something adjacent to teamwork.",
        outcome: "Territory erased under fresh color; rivalry downgraded from war to grumbling détente.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+1 mood; everyone enjoys the new room, two people enjoy admitting it least.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Conscripted rival colonists into the rec-room repaint truce." },
          { articleTitle: "{{colony}}", updateSummary: "Rec room refurbished during the cold-war thaw." }
        ]
      },
      {
        label: "Tournament Rules",
        title: "Bracketed Hostility",
        summary:
          "{{lead}} institutionalizes the feud: weekly tournament brackets where the rivals must meet at the board, not the fists.",
        sceneProse:
          "The bracket went up laminated — best of three, alternating seats, referee mandatory. {{grudgeA}} versus {{grudgeB}} became the colony's Friday theatre. Games ran long and vicious and utterly absorbing; spectators bet dessert portions. Losing still tasted awful. But losing at cards, publicly and by rules, turned out to taste better than losing at everything else.",
        outcome: "Feud channeled into ritual competition; the room fills again with neutral parties.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+2 mood colony-wide; spectacle value exceeds tension cost.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Founded the weekly rec-room tournaments to channel old feuds." }
        ]
      },
      {
        label: "Rotate the Space",
        title: "Room With No Memory",
        summary:
          "The rec room is converted to a second mess hall; furniture redistributed colony-wide until no territory remains.",
        sceneProse:
          "Overnight, {{lead}} had the furniture carried off to four different buildings — the chess set to the greenhouse bench, cards to the storeroom shelf. The old room became overflow dining, all long neutral tables. {{grudgeA}} and {{grudgeB}} now eat at random assigned seats like everyone else, glaring across soup at whoever happens to be there.",
        outcome: "The map that fed the feud is destroyed; conflict persists, but homeless.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "-1 mood from lost traditions; +1 from the absurd democracy of assigned seating.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Converted the rec room to overflow dining, dissolving its territories." }
        ]
      }
    ]
  },
  {
    id: "preset-feast-or-fast",
    title: "Feast or Fast",
    summary:
      "Stores are steady and spirits are not. The colony debates spending surplus on one lavish feast — or banking every meal against a winter that always comes.",
    triggerConditions: "Any stable-food period; sharper after hardship stretches.",
    storyHook: "Is morale a resource worth spending food on?",
    requirements: { minCharacters: 2 },
    resolutions: [
      {
        label: "Feast Tonight",
        title: "The Lavish Interlude",
        summary:
          "{{lead}} authorizes the feast: real cooking, the good chocolate broken out, music until the generator complains.",
        sceneProse:
          "For one evening the ration scale lied generously. Someone played music that wasn't entirely on key, {{second}} told the story everyone had heard before and everyone demanded again, and for a few hours {{colony}} was less a survival outpost than a strange little village that happened to be on the wrong planet. The stores dipped. Nobody regretted it out loud.",
        outcome: "Morale spikes sharply; a measurable dent in reserves and a memory worth more.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+4 mood for days after; the ledger weeps quietly.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Authorized the feast over fiscal objections." },
          { articleTitle: "{{colony}}", updateSummary: "Held the lavish interlude feast during the lean-season debate." }
        ]
      },
      {
        label: "Bank It All",
        title: "The Long Arithmetic",
        summary:
          "{{lead}} sides with the freezer: every surplus meal sealed, labeled, and dated for a day with no name yet.",
        sceneProse:
          "{{lead}} walked the freezer rows with a chalk stub, dating each crate like planting seeds in reverse. 'Winter isn't a season here,' they said, sealing the last lid. 'It's a schedule.' The feast proposal died without a vote. That night dinner was nutrient paste again — dependable, joyless, and enough.",
        outcome: "Security maximized; the colony eats well in a future it believes in slightly less each day.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "-2 mood now, priceless later; hope deferred is hope preserved, allegedly.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Chose the long arithmetic — banked all surplus against winter." }
        ]
      },
      {
        label: "Half Measure",
        title: "The Modest Table",
        summary:
          "A compromise feast: one good dish each, strict limits, celebration with a governor attached.",
        sceneProse:
          "Each cook produced exactly one fine thing and the meal was, technically, a feast — seven dishes spread thin across forty appetites. It worked the way compromises do: nobody was fully happy, nobody was wronged, and {{second}}'s spiced rice was universally declared the reason compromise exists at all.",
        outcome: "Small morale lift, small store dent; everyone practices the art of enough.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "+1 mood; satisfaction rationed proportionally.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Held the modest-table feast — celebration under a governor." }
        ]
      }
    ]
  },
  {
    id: "preset-vow-of-the-convalescent",
    title: "Vow of the Convalescent",
    summary:
      "{{second}} is recovering ahead of every projection and wants back on full duty now — while the scars say otherwise to anyone who looks closely.",
    triggerConditions: "After any significant injury or illness beat; requires two or more living colonists.",
    storyHook: "Whose call is recovery — the body's, the doctor's, or the person living in it?",
    requirements: { minCharacters: 2 },
    resolutions: [
      {
        label: "Light Duty Compromise",
        title: "The Half Rota",
        summary:
          "{{lead}} drafts {{second}} onto a reduced schedule — real work, gentle hours, dignity intact.",
        sceneProse:
          "The half-rota went up with {{second}}'s name in careful small print: mornings only, no lifting past twenty kilos, mandatory sit-down breaks. {{second}} called it a participation trophy for healing. Then took it, because half of the work you love beats all of watching someone else do it.",
        outcome: "Recovery continues under load; pride salvaged through partial purpose.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "+1 mood; usefulness is the best medicine with actual medicine second.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Designed the half-rota for {{second}}'s staged return." },
          { articleTitle: "{{second}}", updateSummary: "Returned to limited duty while convalescing." }
        ]
      },
      {
        label: "Bed Rest Order",
        title: "Doctor's Privilege Invoked",
        summary:
          "{{lead}} invokes absolute authority: {{second}} stays horizontal until cleared, non-negotiable, visitors encouraged.",
        sceneProse:
          "The order was delivered with soup and zero sympathy for appeals. {{second}} protested in increasingly creative ways for two days, then surrendered to a stack of salvaged paperbacks and the discovery that the colony kept functioning — which was either humbling or liberating depending on the hour.",
        outcome: "Full recovery guaranteed at the price of a fortnight's frustration.",
        category: "event-mental-break",
        threatLevel: "Minor",
        moodImpact: "-1 mood for the patient; +1 relief for everyone who feared the alternative.",
        wikiUpdates: [
          { articleTitle: "{{second}}", updateSummary: "Confined to bed rest against their will and eventually grateful." }
        ]
      },
      {
        label: "Full Return, Watched",
        title: "Cleared With an Asterisk",
        summary:
          "{{second}} returns to full duty immediately — with the colony quietly, collectively keeping an eye out.",
        sceneProse:
          "Nobody said 'we'll be watching you.' Everybody did. {{second}} hauled the first load slow, out of wisdom or performance, and the colony pretended not to count repetitions. The wink of it — being cared for by an entire settlement pretending not to — was almost worth the injury.",
        outcome: "Autonomy honored; safety outsourced to everyone's peripheral vision.",
        category: "event-social",
        threatLevel: "Moderate",
        moodImpact: "+2 mood from the conspiracy of care; risk accepted knowingly.",
        wikiUpdates: [
          { articleTitle: "{{second}}", updateSummary: "Returned to unrestricted duty under the colony's quiet watch." }
        ]
      }
    ]
  },
  {
    id: "preset-confidants-burden",
    title: "The Confidant's Burden",
    summary:
      "{{bondB}} confessed a reckless scheme to {{bondA}} weeks ago — swore secrecy — and {{bondA}} has been carrying it alone ever since.",
    triggerConditions: "Requires a warm bond; fires when secrets have had time to ferment.",
    storyHook: "What do you owe a friend — their trust, or their safety from themselves?",
    requirements: { positiveBond: true, minCharacters: 2 },
    resolutions: [
      {
        label: "Keep the Secret",
        title: "The Weight Carried",
        summary:
          "{{bondA}} honors the vow absolutely — and wears the strain in ways the whole colony notices except {{bondB}}.",
        sceneProse:
          "{{bondA}} got good at changing the subject. Got better at smiling around it. Nights were harder — the scheme replaying in permutations, each one ending badly. Loyalty, it turned out, was less a shield than a stone carried in one pocket, checked constantly, never put down.",
        outcome: "Trust preserved; the burden integrates into {{bondA}}'s posture, sleep, and patience.",
        category: "event-mental-break",
        threatLevel: "Minor",
        moodImpact: "-1 mood localized to {{bondA}}; integrity intact, rest not.",
        wikiUpdates: [
          { articleTitle: "{{bondA}}", updateSummary: "Kept a dangerous confidence at personal cost." }
        ]
      },
      {
        label: "Talk Them Down",
        title: "One Friend, Off the Ledge",
        summary:
          "Without breaking confidence to anyone else, {{bondA}} confronts {{bondB}} privately and dismantles the scheme piece by piece.",
        sceneProse:
          "They walked the perimeter twice before {{bondA}} finally said the plan's name out loud — just the two of them, wind covering the worst of it. {{bondB}} defended each step; {{bondA}} had spent weeks finding every hole. It ended not with surrender but revision: smaller, saner, survivable. And still secret. That part mattered to both.",
        outcome: "Scheme defused inside the circle of trust; friendship stress-tested and holding.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+1 mood; the colony never knows how close it came.",
        wikiUpdates: [
          { articleTitle: "{{bondB}}", updateSummary: "Revised a reckless plan after a private reckoning with {{bondA}}." }
        ]
      },
      {
        label: "Break Confidence",
        title: "Telling {{lead}}",
        summary:
          "{{bondA}} reports the scheme to {{lead}} — betraying the vow in letter, honoring it in spirit, and bracing for the fallout.",
        sceneProse:
          "The confession to {{lead}} took ninety seconds and cost years. {{lead}} listened without interrupting, then asked only: 'And you're telling me because?' — 'Because if it goes wrong, I bury them too.' Later, {{bondB}} looked at {{bondA}} across the mess and knew instantly. Some debts are paid in friendship. This one was paid with it.",
        outcome: "Danger averted through betrayal; the bond survives or doesn't based on one conversation neither wants.",
        category: "event-social",
        threatLevel: "Moderate",
        moodImpact: "-2 mood from the rupture; safety purchased at visible cost.",
        wikiUpdates: [
          { articleTitle: "{{bondA}}", updateSummary: "Broke a confidence to prevent disaster — and paid for it." },
          { articleTitle: "{{lead}}", updateSummary: "Received warning of a dangerous internal scheme." }
        ]
      }
    ]
  },
  {
    id: "preset-watchfire-assembly",
    title: "Watchfire Assembly",
    summary:
      "{{colony}} gathers around the night fire for a formal airing of grievances — the old frontier ritual where everything may be said, and nothing may be punished for saying it.",
    triggerConditions: "Ideal when tensions accumulate across factions of opinion within the colony; needs three or more colonists.",
    storyHook: "Can a colony speak its anger aloud without setting itself on fire?",
    requirements: { minCharacters: 3 },
    resolutions: [
      {
        label: "Open Floor",
        title: "Everything Said",
        summary:
          "The fire burns and the floor belongs to anyone: grievances named, faces attached, no gavel and no mercy.",
        sceneProse:
          "The rule was spoken once — say it here or bury it forever. Then the floodgates: noise complaints curdling into old betrayals, chore rotas into accusations nobody had dared voice. {{lead}} held the line and the silence between outbursts. By midnight the air was scorched clean, and someone was laughing at something that would have started a fistfight a month ago.",
        outcome: "Catharsis with bruises; truths surfaced that can never be re-packed.",
        category: "event-social",
        threatLevel: "Moderate",
        moodImpact: "-2 during, +3 after; pressure released beats pressure stored.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Held the watchfire assembly — grievances aired under the old rules." }
        ]
      },
      {
        label: "Written & Anonymous",
        title: "Slips in the Fire Bowl",
        summary:
          "Every grievance written anonymously, read aloud by {{lead}} to the flames — honesty with faces spared.",
        sceneProse:
          "The slips fluttered into the bowl one at a time, {{lead}} reading each in the same level voice: 'Someone feels the watch rotation is unfair.' 'Someone misses food that isn't paste.' Anonymity made some confessions brave and some cowardly, which is anonymous speech generally. Still — the colony heard itself clearly for the first time in months.",
        outcome: "Truth extracted at lower temperature; a few authors identified by phrasing anyway.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+2 mood; issues named, nobody lynched.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Read the anonymous grievance slips at the watchfire." }
        ]
      },
      {
        label: "Leader's Summation",
        title: "Spoken For",
        summary:
          "No airing at all — {{lead}} stands and names every tension in the colony personally, taking ownership of each.",
        sceneProse:
          "{{lead}} rose before the fire and did the unexpected: spoke first, listing the colony's tensions like inventory — 'the rota resentment, the bunk jealousy, whatever it is nobody will say about {{lastEvent}}' — and claimed responsibility for resolving each. It wasn't democracy. It was leadership with the mask off, and it landed heavy in the dark.",
        outcome: "Speed over process; tensions acknowledged centrally, resolution promised on one name.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+1 mood from being seen; +1 skepticism about follow-through, refundable later.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Named and claimed every colonial tension at the watchfire." }
        ]
      }
    ]
  },
  {
    id: "preset-quiet-anniversary",
    title: "The Quiet Anniversary",
    summary:
      "Another year on the rim marks itself without fanfare — and {{colony}} finds itself remembering how far it has come, and exactly what the distance cost.",
    triggerConditions: "Fires naturally around founding anniversaries or after long peaceful stretches.",
    storyHook: "Should remembrance be a monument or a motion?",
    resolutions: [
      {
        label: "Names Read Aloud",
        title: "Roll of the Settled",
        summary:
          "At dusk the colony reads its roll — every settler past and present, with {{deceased}} receiving the longest silence.",
        sceneProse:
          "They faced the ridge where the sun went down and read the names like coordinates. Living settlers got smiles and shoulder-claps. Then the older names — and when the reader reached {{deceased}}, nobody hurried. The silence stretched full rather than empty, which is the trick grief learns late.",
        outcome: "Memory given form and volume; newcomers learn the colony's true roster includes ghosts.",
        category: "event-social",
        threatLevel: "Minor",
        moodImpact: "+2 mood; sorrow shared at fixed dosage.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Observed the anniversary roll of settlers past and present." },
          { articleTitle: "{{deceased}}", updateSummary: "Honored in the anniversary reading." }
        ]
      },
      {
        label: "Work as Memorial",
        title: "Built In Their Honor",
        summary:
          "No ceremony — instead the colony spends the day building something lasting, dedicating labor itself to those gone.",
        sceneProse:
          "{{lead}} announced no speeches, just a workday with a difference: every task dedicated aloud to a name. The greenhouse roof got finished in record time under two dozen quiet dedications. Sweat as sacrament. By dusk the colony stood back from something repaired, expanded, permanent — the only kind of memorial that can't crumble into sentiment.",
        outcome: "Legacy expressed structurally; the dead commemorated in timber, steel, and sore muscles.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "+2 mood; purpose is grief's best interpreter.",
        wikiUpdates: [
          { articleTitle: "{{colony}}", updateSummary: "Marked its anniversary with a memorial workday and finished build." }
        ]
      },
      {
        label: "Forward Only",
        title: "Eyes On the Horizon",
        summary:
          "No rituals, no names — {{lead}} declares the best tribute is the colony's forward motion, and some quietly disagree.",
        sceneProse:
          "'We honor them by living forward,' {{lead}} said, and put the whole colony on tomorrow's tasks. Most agreed. A few walked the perimeter fence that evening anyway, taking their own private attendance of the absent. Both things were true at once: the future mattered, and so did the ones who weren't in it.",
        outcome: "Tradition skipped; grief privatized, momentum preserved.",
        category: "event-colony-life",
        threatLevel: "Minor",
        moodImpact: "Neutral headline; ±1 depending on who needed the ceremony and didn't get it.",
        wikiUpdates: [
          { articleTitle: "{{lead}}", updateSummary: "Declared the forward-only anniversary doctrine." }
        ]
      }
    ]
  }
];

/**
 * Does a preset's requirement flags pass for this project's current state?
 * Presets lacking requirements are always eligible.
 */
function meetsRequirements(
  preset: LocalCrossroadPreset,
  project: StoryProject
): boolean {
  const req = preset.requirements;
  if (!req) return true;

  const living = project.characters.filter((c) => c.status !== "Deceased");
  if ((req.minCharacters ?? 0) > living.length) return false;
  if (req.deceased && !project.characters.some((c) => c.status === "Deceased")) return false;

  const nameSet = new Set<string>();
  project.characters.forEach((c) => {
    nameSet.add(c.name.trim().toLowerCase());
    if (c.nickname) nameSet.add(c.nickname.trim().toLowerCase());
  });

  const matched = project.relationships.filter((r) =>
    nameSet.has(r.source.trim().toLowerCase()) && nameSet.has(r.target.trim().toLowerCase())
  );

  if (req.hostileBond && !matched.some((r) => r.opinion <= -50)) return false;
  if (req.positiveBond && !matched.some((r) => r.opinion >= 60)) return false;

  return true;
}

/**
 * Pick N distinct presets at random for the offline scenario chooser.
 * Built-in presets are merged with the user's custom library; presets whose
 * requirement flags fail for this project are deprioritized (moved to the
 * backfill tail) so canon-appropriate scenarios surface first.
 */
export function pickLocalPresets(
  count: number,
  project: StoryProject,
  extraPresets?: LocalCrossroadPreset[]
): LocalCrossroadPreset[] {
  const merged = [...(extraPresets ?? []), ...LOCAL_CROSSROAD_PRESETS];
  const eligible: LocalCrossroadPreset[] = [];
  const ineligible: LocalCrossroadPreset[] = [];
  merged.forEach((p) =>
    meetsRequirements(p, project) ? eligible.push(p) : ineligible.push(p)
  );
  return [...shuffle(eligible), ...shuffle(ineligible)].slice(0, Math.max(1, count));
}

export interface LocalDraftContext {
  project: StoryProject;
  preset: LocalCrossroadPreset;
  resolution: LocalCrossroadResolution;
  anchorTimestamp: string;
}

/**
 * Build a fully editable Crossroad-style draft from a preset resolution,
 * inserting real characters/locations from the player's own project.
 */
export function buildLocalCrossroadDraft(
  ctx: LocalDraftContext
): {
  openingSceneMarkdown: string;
  dialoguePrompts: string[];
  suggestedWikiUpdates: { articleTitle: string; updateSummary: string }[];
  timelineEvent: {
    title: string;
    timestamp: string;
    category: string; // EventCategory id — customizable via project taxonomy
    threatLevel: ThreatLevel;
    participants: string[];
    location: string;
    description: string;
    narrativeImpact: string;
    intensityScore: number;
  };
  scenarioId: string;
} {
  const { project, preset, resolution } = ctx;

  const namedChars = project.characters.filter((c) => c.status !== "Deceased");
  const lead = namedChars[0]?.name || "the colony leader";
  const second = namedChars[1]?.name;
  const third = namedChars[2]?.name || second || lead;
  const colonyName = project.locations.find((l) => isColonyLocationType(l.type))?.name || project.title;

  // Canon-derived pairs: strongest grudge and warmest bond among known characters.
  const grudgeBond = findExtremeBond(project, "lowest");
  const bondPair = findExtremeBond(project, "highest");
  const grudgeA = grudgeBond?.source || lead;
  const grudgeB = grudgeBond?.target || second || lead;
  const bondA = bondPair?.source || lead;
  const bondB = bondPair?.target || second || lead;

  const canonicalEvents = (project.timelineEvents || []).filter((e) => !e.isDowntimeFiller);
  const lastEventTitle =
    canonicalEvents[canonicalEvents.length - 1]?.title || "the last recorded event";
  const deceasedName =
    project.characters.find((c) => c.status === "Deceased")?.name || "the fallen";

  const fillTemplate = (text: string) =>
    text
      .replace(/\{\{lead\}\}/g, lead)
      .replace(/\{\{second\}\}/g, second || lead)
      .replace(/\{\{third\}\}/g, third)
      .replace(/\{\{colony\}\}/g, colonyName)
      .replace(/\{\{grudgeA\}\}/g, grudgeA)
      .replace(/\{\{grudgeB\}\}/g, grudgeB)
      .replace(/\{\{bondA\}\}/g, bondA)
      .replace(/\{\{bondB\}\}/g, bondB)
      .replace(/\{\{lastEvent\}\}/g, lastEventTitle)
      .replace(/\{\{deceased\}\}/g, deceasedName);

  const keyParticipants = namedChars.slice(0, 3).map((c) => c.name);

  const dialoguePrompts = keyParticipants.map(
    (p) => `${p}: "${fillTemplate(resolution.outcome.split(".")[0])} — what do we do now?"`
  );
  dialoguePrompts.push(`Narrator: "How does ${colonyName} remember this day?"`);

  const suggestedWikiUpdates = resolution.wikiUpdates.map((u) => ({
    articleTitle: fillTemplate(u.articleTitle),
    updateSummary: fillTemplate(u.updateSummary)
  }));

  const timelineEvent = {
    title: fillTemplate(resolution.title),
    timestamp: ctx.anchorTimestamp,
    category: resolution.category,
    threatLevel: resolution.threatLevel,
    participants: keyParticipants.length > 0 ? keyParticipants : ["Colonists"],
    location: colonyName,
    description: fillTemplate(`${resolution.summary} ${resolution.outcome}`),
    narrativeImpact: fillTemplate(resolution.moodImpact),
    intensityScore:
      resolution.threatLevel === "Major" || resolution.threatLevel === "Catastrophic" ? 8 : 6
  };

  const sceneMarkdown = fillTemplate(
    `## ${resolution.title}\n\n${resolution.sceneProse}\n\n**Outcome:** ${resolution.outcome}\n`
  );

  return {
    scenarioId: `${preset.id}:${resolution.label}`,
    openingSceneMarkdown: sceneMarkdown,
    dialoguePrompts,
    suggestedWikiUpdates,
    timelineEvent
  };
}

/** Convert a local preset into displayable scenario cards. */
export function presetToScenario(
  preset: LocalCrossroadPreset,
  idx: number
): CrossroadScenario {
  return {
    id: preset.id,
    pathLabel: ["Scenario A", "Scenario B", "Scenario C"][idx] || `Scenario ${idx + 1}`,
    title: preset.title,
    summary: preset.summary,
    triggerConditions: preset.triggerConditions,
    keyParticipants: [],
    threatLevel: "Moderate",
    category: "event-colony-life",
    moodImpact: "",
    storyHook: preset.storyHook
  };
}

/**
 * Deterministic colony snapshot derived purely from recorded events —
 * replaces the AI-generated snapshot when running offline.
 */
export function buildLocalColonySnapshot(project: StoryProject): {
  moodAverage: string;
  foodSupply: string;
  majorThreats: string[];
  recentTension: string;
} {
  const canonicalEvents = project.timelineEvents.filter((e) => !e.isDowntimeFiller);
  const recent = canonicalEvents.slice(-6);

  const heavyHits = recent.filter(
    (e) => e.threatLevel === "Major" || e.threatLevel === "Catastrophic"
  ).length;
  const tax = getTaxonomy(project);
  const socialBeats = recent.filter((e) =>
    hasFlag(entryByLabel(tax.eventCategories, e.category), "social-mood")
  ).length;

  const moodAverage =
    heavyHits >= 3
      ? "Strained (repeated blows)"
      : heavyHits >= 1
      ? "Cautious"
      : socialBeats >= 2
      ? "Steadfast"
      : recent.length === 0
      ? "Unknown"
      : "Content";

  const foodMentions = recent.filter((e) =>
    /(food|meal|harvest|crop|hunger|famine)/i.test(e.description + " " + e.title)
  ).length;
  const foodSupply =
    foodMentions >= 2
      ? "Pressured — recent events touch on food"
      : "Untracked (manual log required)";

  const majorThreats = Array.from(
    new Set(
      recent
        .filter((e) => e.threatLevel === "Major" || e.threatLevel === "Catastrophic")
        .map((e) => e.title)
    )
  ).slice(0, 4);

  const latest = canonicalEvents[canonicalEvents.length - 1];
  const recentTension = latest
    ? `${latest.timestamp}: ${latest.title} — ${latest.narrativeImpact}`
    : "No canonical beats recorded yet.";

  return { moodAverage, foodSupply, majorThreats, recentTension };
}

/* ------------------------------------------------------------------ */
/* Novelization coaching — craft tip pool                              */
/* ------------------------------------------------------------------ */

/**
 * General novelization craft advice. A rotating, deterministically-seeded
 * selection is blended with gap-driven tips on every scan so healthy
 * projects still receive useful coaching.
 */
const NOVELIZATION_TIP_POOL: string[] = [
  "Alternate Major beats with quiet Colony Life interludes — readers need valleys to feel the peaks.",
  "Anchor each chapter in one point-of-view and let its voice color every description.",
  "End chapters mid-decision, not after consequences; motion pulls pages.",
  "Plant a small detail two chapters before it pays off; foreshadowing is a loan against trust.",
  "Vary dialogue attribution — action beats carry conversation better than said-bookisms.",
  "Render mental breaks through behavior first, diagnosis second: show the binge, name the break later.",
  "Give secondary colonists one sensory signature each (a limp, a whistle, burnt cooking) for instant recognition.",
  "Let important arguments happen over work — hands busy, stakes personal.",
  "Silence is dialogue: the beat where someone doesn't answer often outweighs any reply.",
  "Escalate threats in steps of kind, not just degree — raiders, then siege, then betrayal.",
  "Use salvaged letters and logs as epigraphs to widen world texture without exposition dumps.",
  "Weather may set tone freely, but never let narration promise a storm the timeline never recorded.",
  "Rotate ensemble focus so no colonist vanishes from the reader's memory for more than three chapters.",
  "Reserve flashbacks for wounds the present cannot explain; otherwise keep the river flowing forward.",
  "Keep naming consistent — pick nickname or full name per character per scene and hold it.",
  "Bind one location to one recurring sensory anchor so places feel revisited, not described twice.",
  "Even hostile factions deserve one sympathetic voice; antagonists are protagonists elsewhere.",
  "Let every story arc pose one thematic question; answer it in action, never in narration.",
  "Open chapters in motion — weather arriving, alarms fading, someone already halfway through deciding.",
  "When intensity spikes, shorten sentences; when characters rest, let sentences breathe.",
  "Close acts on an image rather than a summary — a lit window, a packed bag, an empty chair.",
  "Track who witnesses each Major event: witnesses become your connective tissue between arcs."
];

/** FNV-1a style string hash → unsigned 32-bit int. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Tiny deterministic LCG PRNG seeded from an integer. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Blend gap-driven tips (existing behavior) with a stable-but-varying
 * selection from the craft pool, seeded by project identity + scan state.
 */
/* ------------------------------------------------------------------ */
/* Hazard Unprepared check (deterministic, AI-free)                    */
/* ------------------------------------------------------------------ */

const HAZARD_PATTERN =
  /\b(venom\w*|poison\w*|toxic\w*|plague\w*|miasma|cursed?|acid\w*|infest\w*|diseases?\b|blight\w*|haunted\w*)\b/i;

const HEALING_PATTERN =
  /\b(heal\w*|cure\w*|potion\w*|medkit\w*|medic\w*|serum\w*|regenerat\w*|salve\w*|elixir\w*|penoxcyline|glitterworld medicine)\b/i;

function eventHazardEvidence(project: StoryProject, event: TimelineEvent): string | null {
  const tagText = (event.tags || []).join(" ");
  if (HAZARD_PATTERN.test(tagText)) {
    return `tagged "${(event.tags || [])
      .filter((t) => HAZARD_PATTERN.test(t))
      .join('", "')}"`;
  }

  const prose = `${event.title} ${event.description}`.toLowerCase();
  if (HAZARD_PATTERN.test(prose)) {
    return "hazardous wording in the event record";
  }

  const location = project.locations.find(
    (l) => l.name.trim().toLowerCase() === event.location.trim().toLowerCase()
  );
  if (location) {
    const hazardBiome = taxonomyLabel(getTaxonomy(project).biomes, location.biome || "");
    const hazardType = taxonomyLabel(getTaxonomy(project).locationTypes, location.type);
    if (location.dangerLevel === "Extreme Hazard") {
      return `"${location.name}" is flagged Extreme Hazard`;
    }
    if (HAZARD_PATTERN.test(`${hazardBiome} ${hazardType} ${location.description}`)) {
      return `located in hazardous "${hazardBiome || hazardType}" terrain`;
    }
  }
  return null;
}

function characterCanHeal(character: Character): boolean {
  const corpus = [
    ...(character.traits || []),
    ...Object.values(character.slotEntries || {}).flat(),
  ]
    .join(" ")
    .toLowerCase();
  return HEALING_PATTERN.test(corpus);
}

/**
 * Deterministic Plot Doctor check: flags living heroes who walk into a
 * tagged hazard zone with no healing capability in any attribute slot
 * (e.g. no healing spells, potions, or medkits), plus a party-level gap
 * when nobody in the roster can heal at all.
 */
export function buildHazardUnpreparedGaps(project: StoryProject): PlotGap[] {
  const events = project.timelineEvents || [];
  const slots = project.attributeSlots || [];
  const inventoryLabel =
    slots.find((s) => /inventory|equipment|attuned/i.test(s.label))?.label ||
    slots.find((s) => /spell/i.test(s.label))?.label ||
    "attribute slots";

  const charByName = new Map<string, Character>();
  project.characters.forEach((c) => {
    charByName.set(c.name.trim().toLowerCase(), c);
    if (c.nickname) charByName.set(c.nickname.trim().toLowerCase(), c);
  });

  // Latest hazard beat per character so repeat entries don't spam the report.
  const latestHazardByChar = new Map<string, { event: TimelineEvent; evidence: string }>();
  events.forEach((event) => {
    if (event.isDowntimeFiller) return;
    const evidence = eventHazardEvidence(project, event);
    if (!evidence) return;
    (event.participants || []).forEach((name) => {
      const key = name.trim().toLowerCase();
      if (!charByName.has(key)) return;
      const existing = latestHazardByChar.get(key);
      const parsedNew = parseRimWorldTimestamp(event.timestamp);
      const parsedOld = existing ? parseRimWorldTimestamp(existing.event.timestamp) : null;
      if (!existing || (parsedNew && (!parsedOld || parsedNew >= parsedOld))) {
        latestHazardByChar.set(key, { event, evidence });
      }
    });
  });

  const gaps: PlotGap[] = [];
  const unhealingParty = new Set<string>();

  latestHazardByChar.forEach(({ event, evidence }, charKey) => {
    const character = charByName.get(charKey)!;
    if (character.status === "Deceased") return;

    if (characterCanHeal(character)) return;
    unhealingParty.add(charKey);

    gaps.push({
      id: `gap-hazard-${character.id}`,
      type: "Hazard Unprepared" as PlotGapType,
      severity: "Warning",
      title: `${character.name} enters "${event.title}" without healing`,
      affectedEntities: [character.name, event.location],
      explanation: `${character.name} has no healing spells or potions in any attribute slot, yet is about to enter a hazardous zone — ${evidence}. One bad poison save away from an unwinnable scene.`,
      suggestedBridge: `Stock ${character.name}'s "${inventoryLabel}" slot with healing supplies (Potion of Healing, antivenom, a healer's kit), assign a companion who can heal, or lean into the danger deliberately and foreshadow the cost.`,
      status: "open"
    });
  });

  if (unhealingParty.size >= 2) {
    const names = [...unhealingParty].map((k) => charByName.get(k)!.name);
    gaps.push({
      id: "gap-hazard-party-no-healer",
      type: "Hazard Unprepared" as PlotGapType,
      severity: "Warning",
      title: `No Healer In Party: ${names.join(", ")}`,
      affectedEntities: names,
      explanation: `${names.length} heroes are heading into hazardous territory (${[...unhealingParty]
        .map((k) => latestHazardByChar.get(k)!.evidence)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 2)
        .join("; ")}) and not one of them carries healing capability.`,
      suggestedBridge: `Introduce a healer NPC, discover a cache of potions, or let the party hire support before the expedition departs.`,
      status: "open"
    });
  }

  return gaps;
}

function buildNovelizationTips(
  project: StoryProject,
  counts: Record<string, number>,
  totalGaps: number
): string[] {
  const tips: string[] = [];

  if ((counts["Dead Link"] || 0) > 0)
    tips.push("Fix dead links before drafting chapters — broken references signal to readers that the world isn't real.");
  if ((counts["Orphaned Article"] || 0) > 0)
    tips.push("Weave orphaned articles into the web with WikiLinks; isolation on the page mirrors isolation in prose.");
  if ((counts["Loner Character"] || 0) > 0)
    tips.push("Give loners one bond minimum — even antagonism makes a character legible in scenes.");
  if ((counts["Missing Appearance"] || 0) > 0)
    tips.push("Characters absent from the timeline can't carry scenes. Feature them in a downtime beat or minor incident.");
  if ((counts["Pending Draft"] || 0) > 0)
    tips.push("Finish placeholder stubs; thin articles become thin chapters unless enriched first.");
  if ((counts["Unlinked Article"] || 0) > 0)
    tips.push("Long articles with no outgoing links read as dead ends in reverse — link outward to pull readers deeper.");
  if ((counts["Ghost Event"] || 0) > 0)
    tips.push("Events without participants read like news reports; attach names to make history feel witnessed.");
  if ((counts["Duplicate Article"] || 0) > 0)
    tips.push("Merge duplicate articles — split canons quietly destroy a novel's authority.");
  if ((counts["Broken Faction Ref"] || 0) > 0)
    tips.push("Reconcile character faction labels with real faction records; allegiance only matters when it's trackable.");
  if ((counts["Timeline Stagnation"] || 0) > 0)
    tips.push("Bridge long silences explicitly — even one line acknowledging the quiet turns dead air into dread or peace.");
  if ((counts["Hazard Unprepared"] || 0) > 0)
    tips.push("Unhealed heroes entering hazard tags is a Chekhov's pharmacy — stock the inventory slot or foreshadow the wound.");

  const canonicalCount = (project.timelineEvents || []).filter(
    (e) => !e.isDowntimeFiller
  ).length;
  const rand = seededRandom(hashString(`${project.id}:${totalGaps}:${canonicalCount}`));
  const poolStart = Math.floor(rand() * NOVELIZATION_TIP_POOL.length);
  const picks = 3 + Math.floor(rand() * 2); // 3–4 rotating tips

  for (let i = 0; i < picks; i++) {
    const candidate = NOVELIZATION_TIP_POOL[(poolStart + i * 7) % NOVELIZATION_TIP_POOL.length];
    if (!tips.includes(candidate)) tips.push(candidate);
  }

  return tips.slice(0, 9);
}

/* ------------------------------------------------------------------ */
/* Static Narrative Analyzer (Plot Gap Doctor, offline)                */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_MARKERS = [
  "*entity referenced in chronicle records*",
  "*(awaiting chronicle detail)*",
  "add background lore",
  "*mention key dates or colony exploits.*",
  "(no recorded traits yet.)",
  "trait record pending archivist review",
  "*entity referenced in chronicle records.*"
];

function looksLikePlaceholder(article: WikiArticle): boolean {
  const content = (article.markdownContent || "").toLowerCase();

  if (PLACEHOLDER_MARKERS.some((m) => content.includes(m))) return true;

  // Very thin articles with almost no prose are drafts in disguise.
  const words = content.split(/\s+/).filter(Boolean).length;
  return words < 25;
}

const SEVERITY_WEIGHTS: Record<PlotGapSeverity, number> = {
  Critical: 10,
  Warning: 5,
  Opportunity: 2
};

/**
 * Deterministic, fully-local narrative health scan:
 *  1. Dead wiki links ([[Article]] pointing nowhere)
 *  2. Orphaned articles (zero backlinks)
 *  3. Loner characters (no relationship bonds)
 *  4. Missing timeline appearances (never a participant)
 *  5. Pending drafts (placeholder-text stubs)
 *  6. Unlinked articles (long, but zero outgoing links)
 *  7. Ghost events (canonical beats with no participants)
 *  8. Duplicate article titles
 *  9. Broken faction references
 * 10. Timeline stagnation (>30-day gaps between canonical events)
 */
export function runStaticNarrativeScan(project: StoryProject): PlotGapAnalysisReport {
  const gaps: PlotGapAnalysisReport["plotGaps"] = [];
  let seq = 0;
  const nextId = () => `gap-static-${++seq}`;

  const lookup = buildEntityLookup(project);
  const articles = project.wikiArticles || [];
  const chars = project.characters || [];
  const rels = project.relationships || [];
  const events = project.timelineEvents || [];

  /* --- 1. Dead links --------------------------------------------- */
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const deadLinkTargets = new Map<string, number>();

  articles.forEach((art) => {
    let match: RegExpExecArray | null;
    const content = art.markdownContent || "";
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const raw = match[1].split("|")[0].trim();
      if (!raw) continue;
      const q = raw.toLowerCase();
      const resolved =
        lookup.articles.has(q) ||
        lookup.characters.has(q) ||
        lookup.factions.has(q) ||
        lookup.locations.has(q) ||
        lookup.relics.has(q);
      if (!resolved) {
        deadLinkTargets.set(raw, (deadLinkTargets.get(raw) || 0) + 1);
      }
    }
  });

  deadLinkTargets.forEach((occurrences, target) => {
    gaps.push({
      id: nextId(),
      type: "Dead Link" as PlotGapType,
      severity: occurrences > 1 ? "Warning" : "Opportunity",
      title: `Dead Link: [[${target}]]`,
      affectedEntities: [target],
      explanation: `${occurrences} reference${occurrences > 1 ? "s" : ""} point to "[[${target}]]" but no wiki article, character, faction, location, or relic carries that name. Readers following the link hit a dead end.`,
      suggestedBridge: `Create the missing article for [[${target}]], or correct the link text in the referencing entries.`,
      status: "open"
    });
  });

  /* --- 2. Orphaned articles --------------------------------------- */
  const backlinksMap = computeArticleBacklinks(articles);
  articles.forEach((art) => {
    const inbound = backlinksMap.get(art.title.toLowerCase()) || [];
    if (inbound.length === 0) {
      gaps.push({
        id: nextId(),
        type: "Orphaned Article" as PlotGapType,
        severity: "Opportunity",
        title: `Orphaned Article: "${art.title}"`,
        affectedEntities: [art.title],
        explanation: `"${art.title}" (${art.category}) has no incoming [[WikiLinks]] from any other article. Orphans break the cross-referenced feel of the wiki and stay invisible to readers.`,
        suggestedBridge: `Link to [[${art.title}]] from related character, faction, or chronicle pages — or fold its content elsewhere.`,
        status: "open"
      });
    }
  });

  /* --- 3. Loner characters ---------------------------------------- */
  chars.forEach((c) => {
    const nameL = c.name.toLowerCase();
    const nickL = (c.nickname || "").toLowerCase();
    const hasBonds = rels.some(
      (r) =>
        r.source.toLowerCase() === nameL ||
        r.target.toLowerCase() === nameL ||
        (nickL !== "" && (r.source.toLowerCase() === nickL || r.target.toLowerCase() === nickL))
    );
    if (!hasBonds && c.status !== "Deceased") {
      gaps.push({
        id: nextId(),
        type: "Loner Character" as PlotGapType,
        severity: "Opportunity",
        title: `Loner Character: ${c.name}`,
        affectedEntities: [c.name],
        explanation: `${c.name} (${c.role}) floats through the story without a single recorded bond — no romance, feud, kinship, or mentorship ties them to the ensemble.`,
        suggestedBridge: `Add at least one relationship for ${c.name} in the Social Web, even a rivalry or grudge — friction is story fuel.`,
        status: "open"
      });
    }
  });

  /* --- 4. Missing timeline appearances ---------------------------- */
  const participantIndex = new Set<string>();
  events.forEach((e) => {
    (e.participants || []).forEach((p) => participantIndex.add(p.trim().toLowerCase()));
  });

  chars.forEach((c) => {
    const nameHit = participantIndex.has(c.name.toLowerCase());
    const nickHit =
      (c.nickname || "") !== "" && participantIndex.has(c.nickname.toLowerCase());
    if (!nameHit && !nickHit && c.status !== "Deceased") {
      gaps.push({
        id: nextId(),
        type: "Missing Appearance" as PlotGapType,
        severity: "Warning",
        title: `Missing From Timeline: ${c.name}`,
        affectedEntities: [c.name],
        explanation: `${c.name} never appears in a single chronicle event. A character absent from the timeline cannot carry weight in the novelization — they exist only as a dossier.`,
        suggestedBridge: `Record an event featuring ${c.name}, or use Downtime Dice to weave them into off-screen beats.`,
        status: "open"
      });
    }
  });

  /* --- 5. Pending drafts ------------------------------------------ */
  articles.forEach((art) => {
    if (looksLikePlaceholder(art)) {
      gaps.push({
        id: nextId(),
        type: "Pending Draft" as PlotGapType,
        severity: "Warning",
        title: `Pending Draft: "${art.title}"`,
        affectedEntities: [art.title],
        explanation: `"${art.title}" still contains placeholder scaffolding or barely any prose (${art.wordCount ?? art.markdownContent.split(/\s+/).filter(Boolean).length} words). Publishing thin stubs undermines the wiki's authority.`,
        suggestedBridge: `Expand "${art.title}" manually — add an overview, history, and cross-links to the entities it touches.`,
        status: "open"
      });
    }
  });

  /* --- 6. Unlinked articles (no outgoing WikiLinks) ---------------- */
  articles.forEach((art) => {
    const content = art.markdownContent || "";
    const words = content.split(/\s+/).filter(Boolean).length;
    if (words > 60 && !/\[\[/.test(content)) {
      gaps.push({
        id: nextId(),
        type: "Unlinked Article" as PlotGapType,
        severity: "Opportunity",
        title: `Unlinked Article: "${art.title}"`,
        affectedEntities: [art.title],
        explanation: `"${art.title}" carries ${words} words but links to nothing. Articles that never point outward strand the reader at the end of every trail.`,
        suggestedBridge: `Add [[WikiLinks]] from "${art.title}" to the characters, factions, and events it mentions.`,
        status: "open"
      });
    }
  });

  /* --- 7. Ghost events (canonical beats with no witnesses) --------- */
  events.forEach((e) => {
    if (e.isDowntimeFiller) return;
    const participants = (e.participants || []).map((p) => p.trim()).filter(Boolean);
    if (participants.length === 0) {
      gaps.push({
        id: nextId(),
        type: "Ghost Event" as PlotGapType,
        severity: "Warning",
        title: `Ghost Event: "${e.title}"`,
        affectedEntities: [e.title],
        explanation: `The canonical event "${e.title}" (${e.timestamp}) lists no participants. Unwitnessed history reads like a report, not a story — no one can carry its consequences forward.`,
        suggestedBridge: `Edit "${e.title}" to record who was there, or reclassify it as downtime filler.`,
        status: "open"
      });
    }
  });

  /* --- 8. Duplicate article titles --------------------------------- */
  const byTitle = new Map<string, WikiArticle[]>();
  articles.forEach((art) => {
    const key = art.title.trim().toLowerCase();
    byTitle.set(key, [...(byTitle.get(key) || []), art]);
  });
  byTitle.forEach((group) => {
    if (group.length > 1) {
      gaps.push({
        id: nextId(),
        type: "Duplicate Article" as PlotGapType,
        severity: "Critical",
        title: `Duplicate Article Title: "${group[0].title}"`,
        affectedEntities: group.map((a) => a.title),
        explanation: `${group.length} articles share the title "${group[0].title}". WikiLinks cannot disambiguate them, so references resolve unpredictably and the canon splits silently.`,
        suggestedBridge: `Merge the duplicates into one article, or rename each with distinguishing subtitles.`,
        status: "open"
      });
    }
  });

  /* --- 9. Broken faction references --------------------------------- */
  chars.forEach((c) => {
    const faction = (c.faction || "").trim();
    if (!faction) return;
    const known = (project.factions || []).some(
      (f) => f.name.trim().toLowerCase() === faction.toLowerCase()
    );
    if (!known) {
      gaps.push({
        id: nextId(),
        type: "Broken Faction Ref" as PlotGapType,
        severity: "Opportunity",
        title: `Broken Faction Ref: ${c.name} → "${faction}"`,
        affectedEntities: [c.name, faction],
        explanation: `${c.name} is labeled with faction "${faction}", but no such faction exists in this project's records. Allegiance only matters when readers can trace it.`,
        suggestedBridge: `Create the "${faction}" faction entry, or correct ${c.name}'s affiliation in the dossier.`,
        status: "open"
      });
    }
  });

  /* --- 10. Timeline stagnation (>30 days of dead air) --------------- */
  {
    const absDay = (ts: string): number | null => {
      const d = parseRimWorldTimestamp(ts);
      return d ? d.year * 60 + d.quadrumIndex * 15 + d.day : null;
    };
    const canonical = events.filter((e) => !e.isDowntimeFiller);
    for (let i = 1; i < canonical.length; i++) {
      const prev = absDay(canonical[i - 1].timestamp);
      const curr = absDay(canonical[i].timestamp);
      if (prev === null || curr === null) continue;
      const span = curr - prev;
      if (span > 30) {
        gaps.push({
          id: nextId(),
          type: "Timeline Stagnation" as PlotGapType,
          severity: "Warning",
          title: `Timeline Stagnation: ${span} days unaccounted`,
          affectedEntities: [canonical[i - 1].title, canonical[i].title],
          explanation: `${span} days pass between "${canonical[i - 1].title}" and "${canonical[i].title}" with nothing recorded. Long silences read as either dread or neglect — the novel needs to know which.`,
          suggestedBridge: `Record at least one beat inside the gap (Downtime Dice works well), or acknowledge the quiet deliberately in prose.`,
          status: "open"
        });
      }
    }
  }

  /* --- 11. Cultural friction (precept matrix clashes) ---------------- */
  gaps.push(...buildCulturalFrictionGaps(project));

  /* --- 12. Hazard Unprepared (healing vs. tagged danger zones) ------ */
  gaps.push(...buildHazardUnpreparedGaps(project));

  /* --- Cohesion score --------------------------------------------- */
  const penalty = gaps.reduce((sum, g) => sum + SEVERITY_WEIGHTS[g.severity], 0);
  const overallConsistencyScore = gaps.length === 0 ? 100 : Math.max(10, 100 - penalty);

  /* --- Tone assessment & tips (deterministic) --------------------- */
  const counts: Record<string, number> = {};
  gaps.forEach((g) => {
    counts[g.type] = (counts[g.type] || 0) + 1;
  });

  let literaryToneAssessment: string;
  if (gaps.length === 0) {
    literaryToneAssessment =
      "Every link resolves, every character breathes on the page, and no draft remains unfinished. This chronicle reads like a finished novel awaiting only its final polish.";
  } else {
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    literaryToneAssessment = `The skeleton is strong, but ${gaps.length} loose thread${gaps.length === 1 ? "" : "s"} remain. Dominant issue: ${dominant}. Resolve the structural findings first, then layer dramatic connective tissue between events.`;
  }

  const novelizationTips = buildNovelizationTips(project, counts, gaps.length);

  return {
    overallConsistencyScore,
    literaryToneAssessment,
    plotGaps: gaps,
    novelizationTips,
    analyzedAt: new Date().toISOString()
  };
}
