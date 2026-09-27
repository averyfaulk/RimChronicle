/**
 * RimChronicle — token-frugal AI context builders.
 *
 * Everything the renderer hands to the AI backend is shaped here so the
 * model only ever receives context that matters: keyword-retrieved wiki
 * articles (full body — the condensed canon source), compact entity
 * dossiers, and a stable "canonical world record" block that is byte-
 * identical across every Archivist call in a session. That byte-identity is
 * what lets the OpenCode gateway's x-opencode-session prompt cache reuse the
 * expensive prefix across a long chat instead of re-billing it each message.
 */

import { Character, CharacterRelationship, StoryProject, TimelineEvent } from "../types";

/* ------------------------------------------------------------------ */
/* Small projection helpers (mirror the backend's for consistency)     */
/* ------------------------------------------------------------------ */

export function trim(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export function cap<T>(arr: T[] | undefined | null, n: number): T[] {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

export function compactCharacter(c: Character, maxBio = 140) {
  return {
    name: c.name,
    nickname: c.nickname,
    role: c.role,
    faction: c.faction,
    status: c.status,
    traits: cap(c.traits, 8),
    healthConditions: cap(c.healthConditions, 10),
    bio: trim(c.bio, maxBio),
    dramaticArc: trim(c.dramaticArc, 140),
    quote: c.quote ? trim(c.quote, 120) : undefined,
  };
}

export function compactEvent(e: TimelineEvent) {
  return {
    timestamp: e.timestamp,
    title: e.title,
    category: e.category,
    threatLevel: e.threatLevel,
    participants: cap(e.participants, 6),
    location: e.location,
    description: trim(e.description, 200),
    narrativeImpact: trim(e.narrativeImpact, 120),
  };
}

export function compactFaction(f: StoryProject["factions"][number]) {
  return {
    name: f.name,
    type: f.type,
    stance: f.stance,
    ideology: f.ideology,
    leader: f.leader,
    description: trim(f.description, 160),
  };
}

export function compactRelationship(r: CharacterRelationship) {
  return { source: r.source, target: r.target, type: r.type, opinion: r.opinion };
}

export function articleExcerpt(a: { title: string; category: string; markdownContent: string }, n = 80) {
  return {
    title: a.title,
    category: a.category,
    preview: a.markdownContent ? a.markdownContent.replace(/\s+/g, " ").trim().slice(0, n) : "",
  };
}

/* ------------------------------------------------------------------ */
/* Canonical world record — stable, deterministic, cached per project  */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with",
  "about", "between", "what", "who", "when", "where", "why", "how", "is", "are", "was",
  "were", "be", "been", "has", "have", "had", "do", "does", "did", "will", "would",
  "can", "could", "should", "shall", "may", "might", "must", "this", "that", "these",
  "those", "i", "me", "my", "you", "your", "we", "us", "our", "they", "them", "their",
  "he", "him", "his", "she", "her", "its", "it", "from", "by", "as", "into", "over",
  "tell", "write", "draft", "give", "make", "create", "suggest", "please", "need",
  "like", "about", "some", "any", "all", "more", "most", "up", "out", "so", "if",
  "then", "than", "too", "very", "just", "also", "not", "no", "yes",
]);

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Deterministic, compact digest of the whole world — reused across messages. */
export function buildCanonBlock(project: StoryProject): string {
  const chars = [...project.characters]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (c) =>
        `- ${c.name}${c.nickname ? ` ("${c.nickname}")` : ""}${c.role ? `, ${c.role}` : ""}` +
        ` [${c.status}]${c.faction ? ` (${c.faction})` : ""}` +
        `${c.traits?.length ? `\n    traits: ${cap(c.traits, 6).join(", ")}` : ""}` +
        `${c.healthConditions?.length ? `\n    health/bionics: ${cap(c.healthConditions, 6).join(", ")}` : ""}`
    );

  const factions = [...project.factions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => `- ${f.name} [${f.stance}]${f.ideology ? ` — ${f.ideology}` : ""}${f.leader ? ` (leader: ${f.leader})` : ""}`);

  const locations = [...project.locations]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((l) => `- ${l.name} [${l.type || "?"}${l.dangerLevel ? `, ${l.dangerLevel}` : ""}]${l.biome ? ` (${l.biome})` : ""}`);

  const rels = cap(project.relationships, 40)
    .map((r) => `- ${r.source} — ${r.type} (${r.opinion >= 0 ? "+" : ""}${r.opinion}) → ${r.target}`);

  const recentEvents = cap([...project.timelineEvents].reverse(), 12).map(
    (e) => `- ${e.timestamp}: ${e.title} [${e.category}${e.threatLevel ? `, ${e.threatLevel}` : ""}]`
  );

  return [
    `Chronicle: ${project.title}`,
    "",
    "Characters:",
    ...chars,
    "",
    "Factions:",
    ...factions,
    "",
    "Locations:",
    ...locations,
    "",
    "Relationships:",
    ...rels,
    "",
    "Recent Timeline:",
    ...recentEvents,
  ].join("\n");
}

const canonCache = new Map<string, string>();

export function getCachedCanonBlock(project: StoryProject): string {
  const key = `${project.id}:${project.lastUpdated}`;
  const hit = canonCache.get(key);
  if (hit) return hit;
  const block = buildCanonBlock(project);
  if (canonCache.size > 12) canonCache.clear();
  canonCache.set(key, block);
  return block;
}

/* ------------------------------------------------------------------ */
/* Keyword retrieval                                                   */
/* ------------------------------------------------------------------ */

function scoreArticle(tokens: string[], title: string, tags: string[], body: string): number {
  if (tokens.length === 0) return 0;
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  const tag = (tags || []).join(" ").toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    if (t.includes(tok)) score += 3;
    if (tag.includes(tok)) score += 2;
    if (b.includes(tok)) score += 1;
  }
  return score;
}

/** Top-ranked wiki articles for a question. Falls back to recent edits. */
export function retrieveMatchedArticles(
  query: string,
  project: StoryProject,
  max = 4
): { title: string; category: string; markdownContent: string }[] {
  const tokens = tokenize(query);
  const scored = project.wikiArticles
    .map((a) => ({
      a,
      score: tokens.length > 0 ? scoreArticle(tokens, a.title, a.tags, a.markdownContent) : 0,
    }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, max);

  if (scored.length === 0) {
    // Nothing matched — fall back to the most recently edited articles so the
    // Chronicler still has some canon to ground new lore in.
    return [...project.wikiArticles]
      .sort((a, b) => String(b.lastModified || "").localeCompare(String(a.lastModified || "")))
      .slice(0, Math.min(2, max))
      .map((a) => ({ title: a.title, category: a.category, markdownContent: trim(a.markdownContent, 6000) }));
  }

  return scored.map(({ a }) => ({
    title: a.title,
    category: a.category,
    markdownContent: trim(a.markdownContent, 6000),
  }));
}

function namesInText(names: string[], text: string): Set<string> {
  const found = new Set<string>();
  const lower = (text || "").toLowerCase();
  for (const n of names) {
    if (n && lower.includes(n.toLowerCase())) found.add(n.toLowerCase());
  }
  return found;
}

/**
 * Entity dossiers relevant to the question: characters/factions/locations
 * whose name appears in the query or in the retrieved article bodies.
 */
export function retrieveMatchedEntities(
  query: string,
  matchedArticles: { title: string; markdownContent: string }[],
  project: StoryProject
) {
  const articleText = matchedArticles
    .map((a) => `${a.title}\n${a.markdownContent}`)
    .join("\n")
    .toLowerCase();

  const charNames = project.characters.map((c) => c.name);
  const charHit = namesInText(charNames, query);
  const articleHit = namesInText(charNames, articleText);

  const characters = project.characters
    .filter((c) => charHit.has(c.name.toLowerCase()) || articleHit.has(c.name.toLowerCase()))
    .slice(0, 6)
    .map((c) => compactCharacter(c, 140));

  const factions = project.factions
    .filter((f) => namesInText([f.name], query).size || namesInText([f.name], articleText).size)
    .slice(0, 4)
    .map(compactFaction);

  const locations = project.locations
    .filter((l) => namesInText([l.name], query).size || namesInText([l.name], articleText).size)
    .slice(0, 4)
    .map((l) => ({ name: l.name, type: l.type, dangerLevel: l.dangerLevel, description: trim(l.description, 120) }));

  return { characters, factions, locations };
}

export function retrieveRecentEvents(project: StoryProject, n = 4): ReturnType<typeof compactEvent>[] {
  return cap([...project.timelineEvents].reverse(), n).map(compactEvent);
}

/** Relationships limited to the matched character names (keeps the web tight). */
export function filterRelationships(
  project: StoryProject,
  entities: { characters: { name?: string }[] }
): ReturnType<typeof compactRelationship>[] {
  const names = new Set(
    (entities.characters || []).map((c) => String(c?.name || "").toLowerCase()).filter(Boolean)
  );
  if (names.size === 0) return cap(project.relationships, 12).map(compactRelationship);
  return cap(
    project.relationships.filter(
      (r) => names.has(String(r.source).toLowerCase()) || names.has(String(r.target).toLowerCase())
    ),
    12
  ).map(compactRelationship);
}

/** Last few exchanges, capped — enough for the Chronicler to reference prior turns. */
export function buildChatTail(
  messages: { sender: "user" | "chronicler"; text: string }[],
  n = 3
): { role: "user" | "chronicler"; text: string }[] {
  return messages.slice(-n).map((m) => ({
    role: m.sender === "user" ? "user" : "chronicler",
    text: trim(m.text, 500),
  }));
}