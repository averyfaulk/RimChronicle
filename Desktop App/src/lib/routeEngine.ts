/**
 * RimChronicle — Route & Travel Hazard Engine.
 *
 * Shared logic for the World Map route editor and the Travel event stencil.
 * Provides route lookup, hazard resolution (merging legacy logisticalHazards
 * with structured TravelHazard entries), auto-calculation of travel days, and
 * hazard-to-event integration (threat escalation, tags, markdown).
 */

import { MapRoute, StoryProject, ThreatLevel, TravelHazard } from "../types";

/* ------------------------------------------------------------------ */
/* Route lookup                                                         */
/* ------------------------------------------------------------------ */

/** Find a route by id, or by matching source/target location names either direction. */
export function findRoute(
  project: StoryProject,
  fromNameOrId: string,
  toNameOrId: string
): MapRoute | null {
  const routes = project.mapRoutes || [];

  // Try exact id match first.
  const byId = routes.find(
    (r) => r.id === fromNameOrId || r.id === toNameOrId
  );
  if (byId) return byId;

  // Try name-based match against location names.
  const fromLower = fromNameOrId.trim().toLowerCase();
  const toLower = toNameOrId.trim().toLowerCase();

  return (
    routes.find((r) => {
      const srcLoc = project.locations.find((l) => l.id === r.sourceId);
      const tgtLoc = project.locations.find((l) => l.id === r.targetId);
      if (!srcLoc || !tgtLoc) return false;
      const sN = srcLoc.name.trim().toLowerCase();
      const tN = tgtLoc.name.trim().toLowerCase();
      return (
        (sN === fromLower && tN === toLower) ||
        (sN === toLower && tN === fromLower)
      );
    }) || null
  );
}

/** Find a route by its id directly. */
export function findRouteById(
  project: StoryProject,
  routeId: string
): MapRoute | null {
  return (project.mapRoutes || []).find((r) => r.id === routeId) || null;
}

/* ------------------------------------------------------------------ */
/* Travel-day auto-calculation                                          */
/* ------------------------------------------------------------------ */

/**
 * Compute suggested travel days from distance and terrain difficulty.
 *
 * Base formula: distance × terrainDifficulty × 0.85 days on foot.
 * Multipliers for transport modes derived from sample data ratios.
 */
export function autoTravelDays(
  distanceHexes: number,
  terrainDifficultyAvg: number
): {
  onFoot: number;
  muffalo: number;
  dropPods: number;
  mechanoid: number;
} {
  const onFoot = Math.round(distanceHexes * terrainDifficultyAvg * 0.85 * 10) / 10;
  const muffalo = Math.round(onFoot * 0.72 * 10) / 10;
  const mechanoid = Math.round(onFoot * 0.45 * 10) / 10;
  const dropPods = Math.round((0.25 + distanceHexes * 0.01) * 10) / 10;
  return { onFoot, muffalo, dropPods, mechanoid };
}

/* ------------------------------------------------------------------ */
/* Hazard resolution                                                    */
/* ------------------------------------------------------------------ */

/**
 * Merge legacy logisticalHazards strings with structured TravelHazard
 * entries into a single TravelHazard array. Legacy strings get severity
 * "Moderate" by default since they predate the structured system.
 */
export function resolveHazards(route: MapRoute): TravelHazard[] {
  const structured: TravelHazard[] = (route.hazards || []).map((h) => ({
    id: h.id,
    label: h.label,
    severity: h.severity,
    description: h.description,
  }));

  // Convert legacy string-only hazards that aren't already covered.
  const existingLabels = new Set(
    structured.map((h) => h.label.trim().toLowerCase())
  );

  (route.logisticalHazards || []).forEach((str) => {
    const label = str.split(":")[0].trim() || str.trim();
    if (!existingLabels.has(label.toLowerCase())) {
      structured.push({
        id: `haz-legacy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        label: label.slice(0, 120),
        severity: "Moderate",
        description: str,
      });
    }
  });

  return structured;
}

/* ------------------------------------------------------------------ */
/* Threat escalation                                                    */
/* ------------------------------------------------------------------ */

const SEVERITY_ORDER: Record<ThreatLevel, number> = {
  Minor: 0,
  Moderate: 1,
  Major: 2,
  Catastrophic: 3,
};

/** Return the highest threat level among a set of hazards. */
export function maxHazardThreat(hazards: TravelHazard[]): ThreatLevel {
  let worst: ThreatLevel = "Minor";
  for (const h of hazards) {
    if (SEVERITY_ORDER[h.severity] > SEVERITY_ORDER[worst]) {
      worst = h.severity;
    }
  }
  return worst;
}

/** Escalate a base threat level based on route hazards. */
export function applyRouteHazards(
  baseThreat: ThreatLevel,
  route: MapRoute
): ThreatLevel {
  const hazards = resolveHazards(route);
  if (hazards.length === 0) return baseThreat;
  const hazardThreat = maxHazardThreat(hazards);
  return SEVERITY_ORDER[hazardThreat] > SEVERITY_ORDER[baseThreat]
    ? hazardThreat
    : baseThreat;
}

/* ------------------------------------------------------------------ */
/* Output formatters                                                    */
/* ------------------------------------------------------------------ */

/** Render hazards as a markdown bullet list for injection into event descriptions. */
export function hazardsToMarkdown(hazards: TravelHazard[]): string {
  if (hazards.length === 0) return "None identified.";
  return hazards
    .map(
      (h) =>
        `* **${h.label}** [${h.severity}]${h.description ? ` — ${h.description}` : ""}`
    )
    .join("\n");
}

/** Extract hazard labels for injection into event.tags (feeds Plot Doctor). */
export function hazardsToTags(hazards: TravelHazard[]): string[] {
  return hazards.map((h) => h.label);
}

/* ------------------------------------------------------------------ */
/* Template placeholders                                                */
/* ------------------------------------------------------------------ */

/** Build placeholder values from a resolved route for stencil rendering. */
export function routePlaceholders(
  route: MapRoute,
  originName: string,
  destinationName: string
): Record<string, string> {
  const days = autoTravelDays(route.distanceHexes, route.terrainDifficultyAvg);
  const hazards = resolveHazards(route);

  return {
    routeName: route.name,
    origin: originName,
    destination: destinationName,
    routeDistance: `${route.distanceHexes}`,
    routeDifficulty: `${route.terrainDifficultyAvg}`,
    travelDays: `${days.onFoot}`,
    travelDaysMuffalo: `${days.muffalo}`,
    travelDaysDropPods: `${days.dropPods}`,
    travelDaysMechanoid: `${days.mechanoid}`,
    hazards: hazardsToMarkdown(hazards),
    hazardCount: `${hazards.length}`,
  };
}
