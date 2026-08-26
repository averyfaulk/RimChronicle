import {
  DowntimeColonistProfile,
  RimWorldDate,
  StoryProject,
  TimelineEvent,
} from "../types";
import { extractBionics } from "./wikiParser";

export type { RimWorldDate };

// RimWorld calendar: 4 quadrum x 15 days = 60 day year
export const QUADRUMS = ["Aprimay", "Jugust", "Septober", "Decembary"] as const;
export const DAYS_PER_QUADRUM = 15;

/**
 * Parse a RimWorld chronicle timestamp such as "14 Jugust, 5501" or
 * "1 Aprimay 5501". Returns null when unparseable.
 */
export function parseRimWorldTimestamp(timestamp: string): RimWorldDate | null {
  if (!timestamp) return null;

  const match = timestamp.match(/(\d+)\s*([A-Za-z]+)\s*,?\s*(\d+)/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const quadrumName = match[2].toLowerCase();
  const year = parseInt(match[3], 10);

  const quadrumIndex = QUADRUMS.findIndex((q) => q.toLowerCase() === quadrumName);
  if (quadrumIndex === -1 || day < 1 || day > DAYS_PER_QUADRUM || isNaN(year)) return null;

  return { day, quadrumIndex, year };
}

export function formatRimWorldDate(date: RimWorldDate): string {
  return `${date.day} ${QUADRUMS[date.quadrumIndex]}, ${date.year}`;
}

/** Convert a date into a flat absolute day count for arithmetic. */
export function toAbsoluteDay(date: RimWorldDate): number {
  return date.year * 60 + date.quadrumIndex * DAYS_PER_QUADRUM + (date.day - 1);
}

export function fromAbsoluteDay(absoluteDay: number): RimWorldDate {
  const year = Math.floor(absoluteDay / 60);
  const withinYear = absoluteDay - year * 60;
  const quadrumIndex = Math.min(3, Math.floor(withinYear / DAYS_PER_QUADRUM));
  const day = withinYear - quadrumIndex * DAYS_PER_QUADRUM + 1;
  return { day, quadrumIndex, year };
}

export function addDays(date: RimWorldDate, days: number): RimWorldDate {
  return fromAbsoluteDay(toAbsoluteDay(date) + days);
}

/**
 * The "active scene" is the most recently recorded canonical timeline beat.
 * Its participants are considered on-screen and excluded from downtime rolls.
 */
export function getActiveSceneEvent(project: StoryProject): TimelineEvent | null {
  const canonicalEvents = project.timelineEvents.filter((e) => !e.isDowntimeFiller);
  if (canonicalEvents.length === 0) return null;

  let latest: TimelineEvent | null = null;
  let latestAbs: number = Number.NEGATIVE_INFINITY;

  canonicalEvents.forEach((evt) => {
    const parsed = parseRimWorldTimestamp(evt.timestamp);
    const abs = parsed ? toAbsoluteDay(parsed) : 0;
    if (!latest || abs >= latestAbs) {
      latest = evt;
      latestAbs = abs;
    }
  });

  return latest;
}

export function getCurrentTimelineDate(project: StoryProject): RimWorldDate | null {
  const allEvents = project.timelineEvents;
  if (allEvents.length === 0) return null;

  // Prefer the anchor of the active scene so filler never runs ahead of canon.
  const sceneEvent = getActiveSceneEvent(project);
  const candidates = sceneEvent ? [sceneEvent] : allEvents;

  let best: RimWorldDate | null = null;
  let bestAbs: number = Number.NEGATIVE_INFINITY;

  candidates.forEach((evt) => {
    const parsed = parseRimWorldTimestamp(evt.timestamp);
    if (!parsed) return;
    const abs = toAbsoluteDay(parsed);
    if (abs >= bestAbs) {
      best = parsed;
      bestAbs = abs;
    }
  });

  return best;
}

/**
 * The master clock: the colony's explicit "current" date, used by the Event
 * Macro stencils to auto-fill new events. When the user has not set one
 * explicitly, fall back to the latest recorded event date so the stencils
 * still have a sensible anchor.
 */
export function getMasterClockDate(project: StoryProject): RimWorldDate | null {
  if (project.masterClock) return project.masterClock;
  return getCurrentTimelineDate(project);
}

/** Explicitly set the colony's master clock date (returns a new project). */
export function setMasterClock(project: StoryProject, date: RimWorldDate): StoryProject {
  return {
    ...project,
    masterClock: { day: date.day, quadrumIndex: date.quadrumIndex, year: date.year },
    lastUpdated: new Date().toISOString(),
  };
}

/** Advance the master clock by `days` in-game days (returns a new project). */
export function advanceMasterClock(project: StoryProject, days: number): StoryProject {
  const current = getMasterClockDate(project);
  if (!current) return project;
  return setMasterClock(project, addDays(current, days));
}

/** Colonists who are alive/on-map and NOT part of the active scene. */
export function getEligibleDowntimeColonists(project: StoryProject): DowntimeColonistProfile[] {
  const sceneEvent = getActiveSceneEvent(project);
  const busyNames = new Set(
    (sceneEvent?.participants || []).map((p) => p.trim().toLowerCase())
  );

  const offMapStatuses = new Set(["Deceased", "Missing"]);

  return project.characters
    .filter((c) => {
      if (offMapStatuses.has(c.status)) return false;
      const nameHit = busyNames.has(c.name.toLowerCase());
      const nickHit = c.nickname && busyNames.has(c.nickname.toLowerCase());
      return !nameHit && !nickHit;
    })
    .map((c) => ({
      name: c.name,
      nickname: c.nickname,
      role: c.role,
      status: c.status,
      traits: c.traits || [],
      healthConditions: c.healthConditions || [],
      bionics: extractBionics(c, project),
    }));
}

export interface FrequencyDescriptor {
  label: string;
  eventsPerDay: number;
}

export const DOWNTIME_FREQUENCIES: Record<string, FrequencyDescriptor> = {
  "every-other-day": { label: "Every Other Day (0.5/day)", eventsPerDay: 0.5 },
  daily: { label: "1 Event per Day", eventsPerDay: 1 },
  "twice-daily": { label: "2 Events per Day", eventsPerDay: 2 },
  "thrice-daily": { label: "3 Events per Day", eventsPerDay: 3 },
};

/**
 * Given the frequency and number of snippets requested, compute how many
 * in-game days of downtime the roll should cover.
 */
export function daysToCover(frequency: string, snippetCount: number): number {
  const eventsPerDay = DOWNTIME_FREQUENCIES[frequency]?.eventsPerDay ?? 1;
  return Math.max(1, Math.ceil(snippetCount / eventsPerDay));
}
