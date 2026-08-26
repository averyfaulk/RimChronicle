/**
 * RimChronicle — Event Macro (Stencil) Engine.
 *
 * Turns hand-authored event templates into complete timeline events in seconds.
 * A template declares its fields (colonist/faction/location dropdowns and
 * severity sliders) plus markdown title/description templates. When rendered:
 *   - {{fieldId}} placeholders are replaced with the chosen values
 *   - entity-typed values (faction/location/colonist) are auto-wrapped in
 *     [[WikiLinks]] so the generated markdown is instantly navigable
 *   - {{date}} / {{quadrumYear}} come from the colony's master clock
 *   - a deriving slider maps to ThreatLevel and intensityScore
 *
 * Saving also appends a dated line under the linked faction/location articles'
 * "## History" sections (see appendHistoryToArticles).
 */

import {
  EventCategory,
  EventTemplate,
  RimWorldDate,
  StoryProject,
  TemplateField,
  TemplateFieldType,
  ThreatLevel,
  TimelineEvent,
  WikiArticle,
} from "../types";
import { formatRimWorldDate } from "./downtime";

export type TemplateValues = Record<string, string | string[] | number | undefined>;

export interface StencilRenderContext {
  date: RimWorldDate;
  project: StoryProject;
}

export interface StencilWikiLink {
  type: "faction" | "location" | "colonist";
  title: string;
}

export interface RenderedStencil {
  event: TimelineEvent;
  wikiLinks: StencilWikiLink[];
}

const ENTITY_FIELD_TYPES: TemplateFieldType[] = [
  "colonist",
  "colonist-multi",
  "faction",
  "location",
];

/* ------------------------------------------------------------------ */
/* Built-in stencils                                                   */
/* ------------------------------------------------------------------ */

export const BUILTIN_TEMPLATES: EventTemplate[] = [
  {
    id: "stencil-raid",
    name: "Raid",
    icon: "swords",
    accent: "red",
    category: "Combat",
    threatLevel: "Major",
    titleTemplate: "{{faction}} Raid on {{location}}",
    descriptionTemplate:
      "Raiders from {{faction}} struck {{location}} on {{date}}. Casualties: {{casualties}} pawns. {{outcome}}",
    impactTemplate:
      "Colony defenses held at great cost — {{faction}} will remember this humiliation.",
    fields: [
      { id: "faction", label: "Enemy Faction", type: "faction", required: true },
      { id: "location", label: "Location", type: "location", required: true },
      { id: "defenders", label: "Defenders", type: "colonist-multi" },
      {
        id: "casualties",
        label: "Casualties",
        type: "slider",
        sliderMin: 0,
        sliderMax: 20,
        sliderUnit: "pawns",
        derivesThreat: true,
        mapsToIntensity: true,
        threatThresholds: { minor: 3, moderate: 7, major: 15 },
      },
      {
        id: "outcome",
        label: "How did it end?",
        type: "textarea",
        placeholder: "Repelled at the gate, breached the west wall, looted the storeroom...",
      },
    ],
  },
  {
    id: "stencil-trade",
    name: "Trade",
    icon: "handshake",
    accent: "emerald",
    category: "Social",
    threatLevel: "Minor",
    titleTemplate: "Trade Caravan at {{location}}",
    descriptionTemplate:
      "A trading caravan from {{faction}} arrived at {{location}} on {{date}}. {{goods}} exchanged for {{value}} silver.",
    impactTemplate: "Colony coffers and relations with {{faction}} shifted.",
    fields: [
      { id: "faction", label: "Trading Partner", type: "faction", required: true },
      { id: "location", label: "Location", type: "location", required: true },
      { id: "goods", label: "Goods Exchanged", type: "text", placeholder: "Components, medicine, textiles..." },
      {
        id: "value",
        label: "Value",
        type: "slider",
        sliderMin: 0,
        sliderMax: 1000,
        sliderStep: 50,
        sliderUnit: "silver",
        default: 250,
      },
      { id: "delegate", label: "Trade Delegates", type: "colonist-multi" },
    ],
  },
  {
    id: "stencil-surgery",
    name: "Surgery",
    icon: "heart-pulse",
    accent: "blue",
    category: "Surgery",
    threatLevel: "Moderate",
    titleTemplate: "Surgery on {{patient}}",
    descriptionTemplate:
      "{{surgeon}} performed {{procedure}} on {{patient}} at {{location}} on {{date}}. Complications: {{complications}}/10. {{notes}}",
    impactTemplate:
      "{{patient}}'s health hangs in the balance; the colony's medical stock runs thin.",
    fields: [
      { id: "patient", label: "Patient", type: "colonist", required: true },
      { id: "surgeon", label: "Surgeon", type: "colonist", required: true },
      { id: "procedure", label: "Procedure", type: "text", placeholder: "Bionic arm install, organ transplant..." },
      { id: "location", label: "Operating Room", type: "location" },
      {
        id: "complications",
        label: "Complications",
        type: "slider",
        sliderMin: 0,
        sliderMax: 10,
        sliderUnit: "/10",
        derivesThreat: true,
        threatThresholds: { minor: 2, moderate: 4, major: 7 },
      },
      { id: "notes", label: "Notes", type: "textarea", placeholder: "Patient vitals, anesthesia, outcome..." },
    ],
  },
  {
    id: "stencil-mental-break",
    name: "Mental Break",
    icon: "brain",
    accent: "amber",
    category: "Mental Break",
    threatLevel: "Moderate",
    titleTemplate: "{{breakType}} — {{colonist}}",
    descriptionTemplate:
      "{{colonist}} spiraled into {{breakType}} at {{location}} on {{date}}, pushed past their breaking point. Severity: {{severity}}/10.",
    impactTemplate: "Colony mood strains as {{colonist}} works through the aftermath.",
    fields: [
      { id: "colonist", label: "Breaking Colonist", type: "colonist", required: true },
      { id: "breakType", label: "Break Type", type: "text", placeholder: "Sad wandering, daze, binge, berserk..." },
      { id: "location", label: "Location", type: "location" },
      {
        id: "severity",
        label: "Severity",
        type: "slider",
        sliderMin: 0,
        sliderMax: 10,
        sliderUnit: "/10",
        derivesThreat: true,
        mapsToIntensity: true,
        threatThresholds: { minor: 2, moderate: 4, major: 7 },
      },
    ],
  },
  {
    id: "stencil-weather",
    name: "Weather",
    icon: "cloud-rain",
    accent: "cyan",
    category: "Colony Life",
    threatLevel: "Minor",
    titleTemplate: "{{weather}} Sweeps the Colony",
    descriptionTemplate:
      "{{weather}} descended on {{location}} on {{date}}, grounding the colony for {{duration}} days. Intensity: {{intensity}}/10.",
    impactTemplate: "The colony hunkers down; reserves drain as the skies stay hostile.",
    fields: [
      { id: "weather", label: "Weather Event", type: "text", placeholder: "Toxic fallout, volcanic winter, heat wave..." },
      { id: "location", label: "Affected Area", type: "location" },
      {
        id: "duration",
        label: "Duration",
        type: "slider",
        sliderMin: 0,
        sliderMax: 20,
        sliderUnit: "days",
        default: 3,
      },
      {
        id: "intensity",
        label: "Intensity",
        type: "slider",
        sliderMin: 0,
        sliderMax: 10,
        sliderUnit: "/10",
        derivesThreat: true,
        mapsToIntensity: true,
        threatThresholds: { minor: 2, moderate: 4, major: 7 },
      },
      { id: "affected", label: "Affected Colonists", type: "colonist-multi" },
    ],
  },
  {
    id: "stencil-visitor",
    name: "Visitor",
    icon: "user-plus",
    accent: "violet",
    category: "Social",
    threatLevel: "Minor",
    titleTemplate: "{{visitor}} Visits {{location}}",
    descriptionTemplate:
      "{{visitor}}, from {{faction}}, arrived at {{location}} on {{date}} and was greeted by {{recruiter}}. Welcome warmth: {{welcome}}/10.",
    impactTemplate: "New blood and new ties — or a new liability — for the colony.",
    fields: [
      { id: "visitor", label: "Visitor Name", type: "text", required: true },
      { id: "faction", label: "Origin Faction", type: "faction" },
      { id: "location", label: "Location", type: "location" },
      {
        id: "welcome",
        label: "Welcome Warmth",
        type: "slider",
        sliderMin: 0,
        sliderMax: 10,
        sliderUnit: "/10",
        default: 5,
      },
      { id: "recruiter", label: "Greeted By", type: "colonist" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Value resolution                                                    */
/* ------------------------------------------------------------------ */

function valueToString(v: string | string[] | number | undefined): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v === undefined || v === null) return "";
  return String(v);
}

/** Wiki-link variant: entity values become [[Name]]. */
function valueToWikiString(field: TemplateField, v: string | string[] | number | undefined): string {
  if (ENTITY_FIELD_TYPES.includes(field.type)) {
    if (Array.isArray(v)) {
      return v.map((x) => `[[${String(x).trim()}]]`).join(", ");
    }
    if (typeof v === "string" && v.trim()) return `[[${v.trim()}]]`;
  }
  return valueToString(v);
}

function fillPlaceholders(text: string, map: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const resolved = map[key.trim()];
    return resolved !== undefined ? resolved : "";
  });
}

/* ------------------------------------------------------------------ */
/* Threat / intensity derivation                                       */
/* ------------------------------------------------------------------ */

export function threatFromValue(
  value: number,
  t: { minor: number; moderate: number; major: number }
): ThreatLevel {
  if (value <= t.minor) return "Minor";
  if (value <= t.moderate) return "Moderate";
  if (value <= t.major) return "Major";
  return "Catastrophic";
}

export function threatIntensity(threat: ThreatLevel): number {
  switch (threat) {
    case "Minor":
      return 3;
    case "Moderate":
      return 5;
    case "Major":
      return 8;
    case "Catastrophic":
      return 10;
  }
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

/**
 * Render a stencil into a complete TimelineEvent payload, auto-injecting
 * [[WikiLinks]] for entity values and deriving threat/intensity from sliders.
 */
export function renderStencil(
  template: EventTemplate,
  values: TemplateValues,
  ctx: StencilRenderContext
): RenderedStencil {
  const { date, project } = ctx;
  const stamp = formatRimWorldDate(date);

  const plain: Record<string, string> = { date: stamp, quadrumYear: `Year ${date.year}` };
  const wiki: Record<string, string> = { date: stamp, quadrumYear: `Year ${date.year}` };

  const wikiLinks: StencilWikiLink[] = [];
  const participants: string[] = [];
  let location = "";

  template.fields.forEach((field) => {
    const raw = values[field.id];
    plain[field.id] = valueToString(raw);
    wiki[field.id] = valueToWikiString(field, raw);

    if (field.type === "colonist-multi" && Array.isArray(raw)) {
      raw.forEach((name) => {
        const clean = String(name).trim();
        if (clean && !participants.some((p) => p.toLowerCase() === clean.toLowerCase())) {
          participants.push(clean);
        }
        wikiLinks.push({ type: "colonist", title: clean });
      });
    } else if (field.type === "colonist") {
      const clean = typeof raw === "string" ? raw.trim() : "";
      if (clean && !participants.some((p) => p.toLowerCase() === clean.toLowerCase())) {
        participants.push(clean);
      }
      if (clean) wikiLinks.push({ type: "colonist", title: clean });
    } else if (field.type === "faction") {
      const clean = typeof raw === "string" ? raw.trim() : "";
      if (clean) wikiLinks.push({ type: "faction", title: clean });
    } else if (field.type === "location") {
      const clean = typeof raw === "string" ? raw.trim() : "";
      if (clean && !location) location = clean;
      if (clean) wikiLinks.push({ type: "location", title: clean });
    }
  });

  if (!location) {
    location = project.locations[0]?.name || "Colony";
  }

  // Threat level from the first deriving slider.
  let threat: ThreatLevel = template.threatLevel;
  for (const field of template.fields) {
    if (field.derivesThreat && field.type === "slider" && field.threatThresholds) {
      const v = values[field.id];
      if (typeof v === "number" && !Number.isNaN(v)) {
        threat = threatFromValue(v, field.threatThresholds);
        break;
      }
    }
  }

  // Intensity from the mapping slider, else derived from threat.
  let intensity: number;
  const intensitySlider = template.fields.find(
    (f) => f.mapsToIntensity && f.type === "slider"
  );
  if (intensitySlider && typeof values[intensitySlider.id] === "number") {
    const v = values[intensitySlider.id] as number;
    const min = intensitySlider.sliderMin ?? 0;
    const max = intensitySlider.sliderMax ?? 10;
    const span = max - min || 1;
    intensity = Math.round(1 + ((v - min) / span) * 9);
  } else {
    intensity = threatIntensity(threat);
  }
  intensity = Math.min(10, Math.max(1, intensity));

  const title = fillPlaceholders(template.titleTemplate, plain).trim();
  const description = fillPlaceholders(template.descriptionTemplate, wiki).trim();
  const narrativeImpact = fillPlaceholders(template.impactTemplate || "", wiki).trim();

  const event: TimelineEvent = {
    id: `evt-macro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: stamp,
    quadrumYear: `Year ${date.year}`,
    title:
      title ||
      `${template.name} recorded on ${stamp}`,
    category: template.category,
    threatLevel: threat,
    participants: participants.length > 0 ? participants : ["Colonists"],
    location,
    description: description || "A colony event recorded from a stencil.",
    narrativeImpact:
      narrativeImpact || "Shifts colonist morale and survival strategy.",
    intensityScore: intensity,
  };

  return { event, wikiLinks };
}

/* ------------------------------------------------------------------ */
/* Wiki article history appends                                        */
/* ------------------------------------------------------------------ */

function appendToHistorySection(markdown: string, line: string): string {
  const historyMatch = markdown.match(/^##\s+History/im);
  if (!historyMatch) {
    return `${markdown.trimEnd()}\n\n## History\n${line}\n`;
  }

  const idx = historyMatch.index!;
  const rest = markdown.slice(idx);
  const nextH2 = rest.search(/\n##\s+/);
  if (nextH2 === -1) {
    return `${markdown.trimEnd()}\n${line}\n`;
  }
  const insertAt = idx + nextH2;
  return `${markdown.slice(0, insertAt)}\n${line}\n${markdown.slice(insertAt + 1)}`;
}

/** Build the dated bullet appended to a linked article's History section. */
export function buildHistoryLine(date: RimWorldDate, event: TimelineEvent): string {
  const stamp = formatRimWorldDate(date);
  return `* **[${stamp}]** — ${event.title}: ${event.narrativeImpact}`;
}

/**
 * Append dated history lines to the linked faction/location articles. Returns
 * a new wikiArticles array; untouched articles are passed through unchanged.
 * Skips lines already present so re-saving a stencil never duplicates.
 */
export function appendHistoryToArticles(
  project: StoryProject,
  entries: { title: string; line: string }[]
): WikiArticle[] {
  if (entries.length === 0) return project.wikiArticles;

  return project.wikiArticles.map((article) => {
    const entry = entries.find(
      (e) => e.title.trim().toLowerCase() === article.title.trim().toLowerCase()
    );
    if (!entry) return article;
    if (article.markdownContent.includes(entry.line)) return article;
    return {
      ...article,
      markdownContent: appendToHistorySection(article.markdownContent, entry.line),
      lastModified: new Date().toISOString().split("T")[0],
    };
  });
}

/** Distinct faction/location links referenced by a rendered stencil. */
export function historyEntriesFromLinks(
  date: RimWorldDate,
  event: TimelineEvent,
  wikiLinks: StencilWikiLink[]
): { title: string; line: string }[] {
  const seen = new Set<string>();
  const line = buildHistoryLine(date, event);
  const entries: { title: string; line: string }[] = [];
  wikiLinks.forEach((link) => {
    if (link.type !== "faction" && link.type !== "location") return;
    const key = link.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ title: link.title, line });
  });
  return entries;
}