import {
  CulturalFrictionPoint,
  Faction,
  PlotGap,
  PlotGapSeverity,
  PreceptAction,
  PreceptCategory,
  PreceptMatrix,
  PreceptStance,
  PreceptTenet,
  StoryProject,
  TimelineEvent,
} from "../types";

export const STANCE_WEIGHTS: Record<PreceptStance, number> = {
  Mandatory: 2,
  Respected: 1,
  Allowed: 0,
  Disliked: -1,
  Abhorred: -2,
};

export const DEFAULT_STANCE: PreceptStance = "Allowed";

export interface BuiltinTenetDef {
  key: string;
  label: string;
  category: PreceptCategory;
}

export const BUILTIN_TENETS: BuiltinTenetDef[] = [
  { key: "execution", label: "Execution of Prisoners", category: "Violence & War" },
  { key: "cannibalism", label: "Cannibalism", category: "Consumption & Cannibalism" },
  { key: "cannibalism-strangers", label: "Eating Enemy Dead", category: "Consumption & Cannibalism" },
  { key: "insect-meat", label: "Insect Meat", category: "Consumption & Cannibalism" },
  { key: "drug-use", label: "Social Drug Use", category: "Consumption & Cannibalism" },
  { key: "slavery", label: "Slavery", category: "Social Hierarchy" },
  { key: "charity", label: "Charity to Strangers", category: "Social Hierarchy" },
  { key: "skull-taking", label: "Skull Taking", category: "Violence & War" },
  { key: "melee-combat", label: "Melee Combat Worship", category: "Violence & War" },
  { key: "organ-harvesting", label: "Organ Harvesting", category: "Body & Enhancement" },
  { key: "body-modification", label: "Transhumanist Body Modification", category: "Body & Enhancement" },
  { key: "tree-worship", label: "Tree Worship & Nature Reverence", category: "Nature & Ecology" },
  { key: "ai-personhood", label: "AI & Mechanoid Personhood", category: "Technology & AI" },
  { key: "death-rites", label: "Death Rites & Burial", category: "Death & Burial" },
];

const STANCE_VERBS: Record<PreceptStance, string> = {
  Mandatory: "holds as a sacred duty",
  Respected: "respects",
  Allowed: "tolerates",
  Disliked: "frowns upon",
  Abhorred: "abhors",
};

const FALLOUT_PROMPTS: Record<CulturalFrictionPoint["severity"], string> = {
  Critical:
    "Write the fallout: a public denunciation, a severed pact, or blood vengeance sworn before witnesses.",
  Major:
    "Write the fallout: a tense standoff, a formal protest ritual, or covert retaliation between camps.",
  Minor:
    "Write the fallout: a tense dialogue, secret shunning, or public apology.",
};

/* ------------------------------------------------------------------ */
/* Lookup helpers                                                      */
/* ------------------------------------------------------------------ */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveFaction(project: StoryProject, idOrName: string): Faction | undefined {
  const q = normalize(idOrName);
  if (!q) return undefined;
  return project.factions.find(
    (f) => normalize(f.id) === q || normalize(f.name) === q
  );
}

export function getMatrixForFaction(
  project: StoryProject,
  factionIdOrName: string
): PreceptMatrix | null {
  const faction = resolveFaction(project, factionIdOrName);
  if (!faction) return null;
  const byId = project.preceptMatrices.find((m) => m.factionId === faction.id);
  return byId || null;
}

/** All custom tenets defined across every saved matrix (deduped by key). */
export function getCustomTenets(project: StoryProject): PreceptTenet[] {
  const seen = new Set<string>();
  const out: PreceptTenet[] = [];
  for (const matrix of project.preceptMatrices || []) {
    for (const tenet of matrix.tenets || []) {
      if (!tenet.custom) continue;
      const key = tenet.key.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tenet);
    }
  }
  return out;
}

export function findTenetByKey(project: StoryProject, tenetKey: string): BuiltinTenetDef | null {
  const key = normalize(tenetKey);
  if (!key) return null;
  const builtin = BUILTIN_TENETS.find((t) => t.key === key);
  if (builtin) return builtin;
  const custom = getCustomTenets(project).find((t) => normalize(t.key) === key);
  return custom
    ? { key: custom.key, label: custom.label, category: custom.category }
    : null;
}

export function getStanceForTenet(
  project: StoryProject,
  factionIdOrName: string,
  tenetKey: string
): PreceptStance {
  const matrix = getMatrixForFaction(project, factionIdOrName);
  if (!matrix) return DEFAULT_STANCE;
  const key = normalize(tenetKey);
  return (
    matrix.tenets.find((t) => normalize(t.key) === key)?.stance ?? DEFAULT_STANCE
  );
}

/* ------------------------------------------------------------------ */
/* Friction detection                                                  */
/* ------------------------------------------------------------------ */

function frictionDescription(
  primaryName: string,
  opposingName: string,
  actionLabel: string,
  primaryStance: PreceptStance,
  opposingStance: PreceptStance
): string {
  return `${primaryName} ${STANCE_VERBS[primaryStance]} "${actionLabel}" while ${opposingName} ${STANCE_VERBS[opposingStance]} it.`;
}

/**
 * Pairwise stance comparison over an event's tagged actions and involved
 * factions. A friction point fires only when two factions' stances actively
 * oppose each other in sign (one reveres what the other reviles):
 *   |Δ| = 4 → Critical · |Δ| = 3 → Major · |Δ| = 2 → Minor · else none.
 */
export function detectFrictionPoints(
  project: StoryProject,
  event: TimelineEvent
): CulturalFrictionPoint[] {
  const points: CulturalFrictionPoint[] = [];
  const actions = event.actions || [];
  const involvedIds = event.involvedFactionIds || [];
  if (actions.length === 0 || involvedIds.length < 2) return points;

  const factions = involvedIds
    .map((id) => resolveFaction(project, id))
    .filter((f): f is Faction => Boolean(f));
  if (factions.length < 2) return points;

  const now = new Date().toISOString();
  const emitted = new Set<string>();

  for (let i = 0; i < factions.length; i++) {
    for (let j = i + 1; j < factions.length; j++) {
      const fa = factions[i];
      const fb = factions[j];

      for (const action of actions) {
        const tenet = findTenetByKey(project, action.tenetKey);
        const actionLabel = action.label?.trim() || tenet?.label || action.tenetKey;

        const stanceA = getStanceForTenet(project, fa.id, action.tenetKey);
        const stanceB = getStanceForTenet(project, fb.id, action.tenetKey);
        const wa = STANCE_WEIGHTS[stanceA];
        const wb = STANCE_WEIGHTS[stanceB];
        const opposed = (wa > 0 && wb < 0) || (wa < 0 && wb > 0);
        if (!opposed) continue;

        const delta = Math.abs(wa - wb);
        if (delta < 2) continue;

        const dedupeKey = `${fa.id}|${fb.id}|${normalize(action.tenetKey)}`;
        if (emitted.has(dedupeKey)) continue;
        emitted.add(dedupeKey);

        const severity: CulturalFrictionPoint["severity"] =
          delta >= 4 ? "Critical" : delta === 3 ? "Major" : "Minor";

        const primary = wa < 0 ? fa : fb;
        const opposing = wa < 0 ? fb : fa;
        const primaryStance = wa < 0 ? stanceA : stanceB;
        const opposingStance = wa < 0 ? stanceB : stanceA;

        points.push({
          id: `fp-${event.id}-${primary.id}-${opposing.id}-${action.tenetKey}`,
          eventId: event.id,
          eventTitle: event.title,
          eventTimestamp: event.timestamp,
          actionKey: action.tenetKey,
          actionLabel,
          primaryFactionId: primary.id,
          primaryFactionStance: primaryStance,
          opposingFactionId: opposing.id,
          opposingFactionStance: opposingStance,
          severity,
          description: frictionDescription(
            primary.name,
            opposing.name,
            actionLabel,
            primaryStance,
            opposingStance
          ),
          suggestedFallout: FALLOUT_PROMPTS[severity],
          detectedAt: now,
          acknowledged: false,
        });
      }
    }
  }

  return points;
}

/* ------------------------------------------------------------------ */
/* Inference (best-effort enrichment for generated events)             */
/* ------------------------------------------------------------------ */

interface KeywordRule {
  tenetKey: string;
  patterns: RegExp[];
}

const KEYWORD_RULES: KeywordRule[] = [
  { tenetKey: "execution", patterns: [/\bexecut(?:e|es|ed|ing|ion|ions)\b/, /\bfiring squad\b/] },
  {
    tenetKey: "cannibalism",
    patterns: [/\bcannibals?\b/, /\bcannibalis\w*\b/, /\bhuman flesh\b/, /\bate the (?:dead|fallen)\b/],
  },
  { tenetKey: "insect-meat", patterns: [/\binsect(?:oid)? (?:meat|jelly)\b/] },
  {
    tenetKey: "drug-use",
    patterns: [/\bgo-?juice\b/, /\bpsychite\b/, /\bflake\b/, /\bluciferium\b/, /\bsmokeleaf\b/, /\bambrosia\b/, /\bpenoxycyline\b/],
  },
  { tenetKey: "slavery", patterns: [/\bslaves?\b/, /\bslav(?:ery|ing)\b/, /\benslav(?:e|es|ed|ing)\w*\b/] },
  {
    tenetKey: "charity",
    patterns: [/\bcharity\b/, /\bdonat(?:e|es|ed|ion)s?\b/, /\bgave (?:aid|shelter|food|rations)\b/, /\btook in (?:refugees|strangers|wanderers?)\b/],
  },
  { tenetKey: "skull-taking", patterns: [/\bskulls?\b/, /\bskullspikes?\b/, /\btrophies of war\b/] },
  { tenetKey: "melee-combat", patterns: [/\bmelee\b/, /\bduel(?:s|ed|ling)?\b/, /\bmono-?swords?\b/, /\blongswords?\b/, /\bswords?\b/] },
  { tenetKey: "tree-worship", patterns: [/\btrees?\b/, /\bpines?\b/, /\bforest\w*\b/, /\banima (?:tree|cave|grove)\b/] },
  {
    tenetKey: "body-modification",
    patterns: [/\bbionic\w*\b/, /\bprosthe\w+\b/, /\baugment\w*\b/, /\bcybernetic\w*\b/, /\barchotech (?:arm|eye|leg|jaw|heart|implant)s?\b/, /\bpsylinks?\b/, /\beltex\b/],
  },
  {
    tenetKey: "organ-harvesting",
    patterns: [/\borgan harvest\w*\b/, /\bharvest(?:ed|ing)? (?:organs?|kidneys?|lungs?|hearts?|livers?)\b/, /\bremoved (?:his|her|their) (?:kidney|lung|heart|liver)\b/],
  },
  { tenetKey: "ai-personhood", patterns: [/\bai\b/, /\barchotech minds?\b/, /\bpersona (?:core|weapon)s?\b/, /\bmechanoids?\b/] },
  { tenetKey: "death-rites", patterns: [/\bbur(?:ied|ials?)\b/, /\bgraves?\b/, /\btombs?\b/, /\bfuneral\w*\b/, /\bmourn(?:ed|ing|s)?\b/] },
];

/**
 * Best-effort enrichment for events created outside the manual flows:
 * involved factions come from participants' character.faction plus the event
 * location's controlling faction; actions come from a keyword dictionary
 * scanned against title + description. Never invents friction on its own —
 * missing data simply yields no tags.
 */
export function inferEventPrecepts(
  project: StoryProject,
  event: Pick<TimelineEvent, "title" | "description" | "participants" | "location">
): { actions: PreceptAction[]; involvedFactionIds: string[] } {
  const involvedFactionIds = new Set<string>();

  for (const raw of event.participants || []) {
    const name = normalize(raw);
    if (!name) continue;
    const character = project.characters.find(
      (c) => normalize(c.name) === name || normalize(c.nickname || "") === name
    );
    if (!character) continue;
    const faction = resolveFaction(project, character.faction || "");
    if (faction) involvedFactionIds.add(faction.id);
  }

  const locationQuery = normalize(event.location || "");
  if (locationQuery) {
    const loc = project.locations.find(
      (l) =>
        normalize(l.name) === locationQuery ||
        normalize(l.name).includes(locationQuery) ||
        locationQuery.includes(normalize(l.name))
    );
    if (loc?.controllingFaction) {
      const faction = resolveFaction(project, loc.controllingFaction);
      if (faction) involvedFactionIds.add(faction.id);
    }
  }

  let haystack = `${event.title || ""} ${event.description || ""}`.toLowerCase();
  const stripPhrases = new Set<string>();
  for (const faction of project.factions) {
    const fullName = faction.name.trim().toLowerCase();
    if (!fullName) continue;
    stripPhrases.add(fullName);
    for (const token of fullName.split(/\s+/)) {
      const clean = token.replace(/[^a-z0-9-]/g, "");
      if (clean.length >= 4) stripPhrases.add(clean);
    }
  }
  for (const phrase of stripPhrases) {
    haystack = haystack.split(phrase).join(" ");
  }

  const actions: PreceptAction[] = [];
  const seenKeys = new Set<string>();
  for (const rule of KEYWORD_RULES) {
    if (seenKeys.has(rule.tenetKey)) continue;
    const hit = rule.patterns.some((p) => p.test(haystack));
    if (!hit) continue;
    const tenet = findTenetByKey(project, rule.tenetKey);
    if (!tenet) continue;
    seenKeys.add(rule.tenetKey);
    actions.push({ label: tenet.label, tenetKey: tenet.key });
  }

  return { actions, involvedFactionIds: Array.from(involvedFactionIds) };
}

/** Compose inference + analysis in one step for generated events. */
export function applyInferredAnalysis(
  project: StoryProject,
  rawEvent: TimelineEvent
): { event: TimelineEvent; project: StoryProject } {
  const inferred = inferEventPrecepts(project, rawEvent);
  const enriched: TimelineEvent = {
    ...rawEvent,
    ...(inferred.actions.length > 0 ? { actions: inferred.actions } : {}),
    ...(inferred.involvedFactionIds.length > 0
      ? { involvedFactionIds: inferred.involvedFactionIds }
      : {}),
  };
  return applyPreceptAnalysis(project, enriched);
}

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */

/**
 * Embed freshly detected friction points onto the event and merge them into
 * project.culturalFrictionPoints, replacing any previous points for the same
 * event. Reused by every logging flow so storage stays consistent.
 */
export function applyPreceptAnalysis(
  project: StoryProject,
  event: TimelineEvent
): { event: TimelineEvent; project: StoryProject } {
  const freshPoints = detectFrictionPoints(project, event);

  const remaining = (project.culturalFrictionPoints || []).filter(
    (fp) => fp.eventId !== event.id
  );

  const nextEvent: TimelineEvent =
    freshPoints.length > 0 ? { ...event, frictionPoints: freshPoints } : { ...event };

  const nextProject: StoryProject = {
    ...project,
    culturalFrictionPoints: [...remaining, ...freshPoints],
  };

  return { event: nextEvent, project: nextProject };
}

export function toggleFrictionAcknowledgement(
  project: StoryProject,
  pointId: string
): StoryProject {
  return {
    ...project,
    culturalFrictionPoints: (project.culturalFrictionPoints || []).map((fp) =>
      fp.id === pointId ? { ...fp, acknowledged: !fp.acknowledged } : fp
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Plot Doctor integration                                             */
/* ------------------------------------------------------------------ */

const FRICTION_GAP_SEVERITY: Record<
  CulturalFrictionPoint["severity"],
  PlotGapSeverity
> = {
  Critical: "Critical",
  Major: "Warning",
  Minor: "Opportunity",
};

/** Deterministic PlotGap conversion for every known friction point. */
export function buildCulturalFrictionGaps(project: StoryProject): PlotGap[] {
  return (project.culturalFrictionPoints || []).map((fp, idx) => {
    const primary = resolveFaction(project, fp.primaryFactionId);
    const opposing = resolveFaction(project, fp.opposingFactionId);
    return {
      id: `gap-friction-${fp.id}-${idx}`,
      type: "Cultural Friction" as const,
      severity: FRICTION_GAP_SEVERITY[fp.severity],
      title: `Cultural Friction: "${fp.actionLabel}" (${primary?.name || fp.primaryFactionId} × ${opposing?.name || fp.opposingFactionId})`,
      affectedEntities: [
        primary?.name || fp.primaryFactionId,
        opposing?.name || fp.opposingFactionId,
      ],
      explanation: `${fp.description} Detected at "${fp.eventTitle}" (${fp.eventTimestamp}).`,
      suggestedBridge: fp.suggestedFallout,
      status: fp.acknowledged ? ("resolved" as const) : ("open" as const),
    };
  });
}
