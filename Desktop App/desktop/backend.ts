/**
 * RimChronicle — local AI backend.
 *
 * This module replaces the old Express server: it is bundled by esbuild into
 * electron/backend.cjs and invoked directly from the Electron main process over
 * IPC. No HTTP listener exists in desktop mode — everything stays on-device
 * except calls to the OpenCode gateway itself.
 *
 * Public surface:
 *   initBackend({ envPath?, settingsPath? })
 *   handleAiRequest(method, path, { query?, body? }) -> { status, data }
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// ---------------------------------------------------------------------------
// OpenCode provider configuration ("zen" pay-per-use gateway or "go"
// subscription tier). Both expose the same OpenAI-compatible Chat Completions
// protocol and can be switched at runtime.
// ---------------------------------------------------------------------------

type AIProviderId = "zen" | "go";

const PROVIDER_META: Record<
  AIProviderId,
  { label: string; baseUrl: string; defaultModel: string; description: string }
> = {
  zen: {
    label: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    defaultModel: "big-pickle",
    description: "Pay-per-use gateway (includes free models)",
  },
  go: {
    label: "OpenCode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    defaultModel: "deepseek-v4-flash",
    description: "Flat-rate subscription tier",
  },
};

let OPENCODE_API_KEY = "";

// Runtime-switchable AI configuration. Initial values come from .env /
// environment, then POST /api/ai/config can change them without a restart.
const aiRuntime: {
  initialized: boolean;
  provider: AIProviderId;
  selectedModels: Record<AIProviderId, string>;
} = {
  initialized: false,
  provider: "zen",
  selectedModels: { zen: "", go: "" },
};

let settingsFile = "";

function resolveProvider(value: any): AIProviderId {
  return String(value || "").toLowerCase().trim() === "go" ? "go" : "zen";
}

function resolveModel(provider: AIProviderId): string {
  return aiRuntime.selectedModels[provider] || PROVIDER_META[provider].defaultModel;
}

function loadSettings() {
  if (!settingsFile) return;
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    const provider = resolveProvider(raw?.provider);
    aiRuntime.provider = provider;
    for (const id of ["zen", "go"] as AIProviderId[]) {
      const model = raw?.selectedModels?.[id];
      if (typeof model === "string" && model.trim()) aiRuntime.selectedModels[id] = model.trim();
    }
  } catch {
    /* Missing or corrupt settings file — keep defaults */
  }
}

function saveSettings() {
  if (!settingsFile) return;
  try {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(
      settingsFile,
      JSON.stringify(
        { provider: aiRuntime.provider, selectedModels: aiRuntime.selectedModels },
        null,
        2
      )
    );
  } catch (err) {
    console.error("Failed to persist AI settings:", err);
  }
}

export function initBackend(options: { envPath?: string; settingsPath?: string } = {}) {
  settingsFile = options.settingsPath || "";
  aiRuntime.initialized = true;

  // Load .env without clobbering variables already set in the environment.
  const envPath = options.envPath || path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

  OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || "";

  const envProvider = (process.env.OPENCODE_PROVIDER || "zen").toLowerCase().trim();
  aiRuntime.provider = envProvider === "go" ? "go" : "zen";
  const envModel = (process.env.OPENCODE_MODEL || "").trim();
  aiRuntime.selectedModels = {
    zen: aiRuntime.provider === "zen" ? envModel : "",
    go: aiRuntime.provider === "go" ? envModel : "",
  };

  // User's runtime choice (made in the UI) survives restarts.
  loadSettings();
}

// ---------------------------------------------------------------------------
// OpenCode Chat Completions plumbing
// ---------------------------------------------------------------------------

interface ChatMessageParam {
  role: "system" | "user";
  content: string;
}

async function requestChatCompletion(
  messages: ChatMessageParam[],
  responseJson: boolean,
  includeJsonFormat: boolean
) {
  const provider = aiRuntime.provider;
  const meta = PROVIDER_META[provider];
  const model = resolveModel(provider);

  const body: Record<string, any> = {
    model,
    temperature: 0.7,
    stream: false,
    messages,
  };

  if (responseJson && includeJsonFormat) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${meta.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENCODE_API_KEY}`,
      "User-Agent": "RimChronicle-Storytelling-Engine",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(
      new Error(
        `OpenCode ${meta.label} (${model}) request failed (${response.status} ${response.statusText}): ${detail.slice(0, 300)}`
      ),
      { status: response.status }
    );
  }

  const data: any = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callModel(prompt: string, systemInstruction?: string, responseJson?: boolean) {
  if (!OPENCODE_API_KEY) {
    throw new Error("OPENCODE_API_KEY is not set. Add it to your .env file (see .env.example).");
  }

  try {
    const messages: ChatMessageParam[] = [
      ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
      { role: "user", content: prompt },
    ];

    // Some Zen/Go models reject response_format — retry once without it on client errors.
    try {
      return await requestChatCompletion(messages, !!responseJson, true);
    } catch (err: any) {
      if (responseJson && err?.status >= 400 && err?.status < 500) {
        return await requestChatCompletion(messages, !!responseJson, false);
      }
      throw err;
    }
  } catch (error: any) {
    console.error("OpenCode call error:", error);
    throw new Error(error?.message || "Failed to generate AI response");
  }
}

function parseModelJson<T = any>(raw: string): T {
  let text = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Model returned no parsable JSON object");
  }
}

// ---------------------------------------------------------------------------
// Request dispatch
// ---------------------------------------------------------------------------

interface AiRequestOptions {
  query?: Record<string, string>;
  body?: any;
}

interface AiResponse {
  status: number;
  data: any;
}

const ok = (data: any): AiResponse => ({ status: 200, data });
const fail = (status: number, data: any): AiResponse => ({ status, data });

async function handleConfigGet(): Promise<AiResponse> {
  return ok({
    provider: aiRuntime.provider,
    model: resolveModel(aiRuntime.provider),
    providers: (Object.keys(PROVIDER_META) as AIProviderId[]).map((id) => ({
      id,
      label: PROVIDER_META[id].label,
      description: PROVIDER_META[id].description,
      defaultModel: PROVIDER_META[id].defaultModel,
    })),
  });
}

async function handleConfigPost(body: any): Promise<AiResponse> {
  const { provider, model } = body || {};

  if (typeof provider !== "string" || !(provider.toLowerCase() in PROVIDER_META)) {
    return fail(400, { error: "Unknown provider. Use 'zen' or 'go'." });
  }

  if (model !== undefined && model !== null && typeof model !== "string") {
    return fail(400, { error: "'model' must be a string model ID." });
  }

  aiRuntime.provider = provider.toLowerCase() as AIProviderId;
  if (typeof model === "string" && model.trim()) {
    aiRuntime.selectedModels[aiRuntime.provider] = model.trim();
  }

  saveSettings();
  console.log(
    `AI provider switched to ${PROVIDER_META[aiRuntime.provider].label} (model: ${resolveModel(aiRuntime.provider)})`
  );

  return ok({
    provider: aiRuntime.provider,
    model: resolveModel(aiRuntime.provider),
  });
}

async function handleModels(query: Record<string, string> | undefined): Promise<AiResponse> {
  if (!OPENCODE_API_KEY) {
    return fail(400, { error: "OPENCODE_API_KEY is not set. Add it to your .env file." });
  }

  const provider = resolveProvider(query?.provider);
  const meta = PROVIDER_META[provider];

  const response = await fetch(`${meta.baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${OPENCODE_API_KEY}`,
      "User-Agent": "RimChronicle-Storytelling-Engine",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return fail(response.status, {
      error: `Failed to list ${meta.label} models (${response.status}): ${detail.slice(0, 200)}`,
    });
  }

  const data: any = await response.json();
  const rawList: any[] = Array.isArray(data?.data) ? data.data : [];

  const models = rawList
    .filter((m) => m && typeof m.id === "string")
    .map((m) => ({ id: m.id, ownedBy: m.owned_by || undefined }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return ok({ provider, models });
}

// 1. Ingest logs & generate structured wiki, entities, relationships, timeline
async function handleIngestLogs(body: any): Promise<AiResponse> {
  // The UI historically sent rawText/existingContext; accept the older
  // rawLogs/existingData spelling as well.
  const rawLogs = body?.rawLogs ?? body?.rawText;
  const existingData = body?.existingData ?? body?.existingContext;
  const playthroughTitle = body?.playthroughTitle;

  if (!rawLogs || typeof rawLogs !== "string" || !rawLogs.trim()) {
    return fail(400, { error: "No log text provided" });
  }

  const prompt = `
You are analyzing playthrough logs, gameplay events, or world-building chronicle notes (such as RimWorld colony stories, sci-fi/fantasy RPG campaigns, or dramatic narratives).
The chronicle title is: "${playthroughTitle || "Colony Chronicle"}".

Raw Input Text:
"""
${rawLogs}
"""

Current Existing Context (if any):
${JSON.stringify(existingData || {}, null, 2)}

Your task is to analyze these events, extract deep dramatic lore, character arcs, factions, locations, relics, timeline events, character relationships, and generate comprehensive Markdown Wiki Articles.

Respond with a strictly valid JSON object matching this schema:
{
  "summary": "High-level dramatic summary of this log batch",
  "extractedEvents": [
    {
      "id": "evt-uuid-or-slug",
      "timestamp": "e.g. 5 Aprimay, 5501 or Day 42, Quadrum 2",
      "quadrumYear": "Year 5501",
      "title": "Dramatic Title of Event",
      "category": "Combat" | "Social" | "Mental Break" | "Miracle" | "Quest" | "Tragedy" | "Discovery" | "Surgery" | "Colony Life",
      "threatLevel": "Minor" | "Moderate" | "Major" | "Catastrophic",
      "participants": ["Character Name 1", "Character Name 2"],
      "location": "Colony Medical Bay or Location Name",
      "description": "2-3 sentences of dramatic narrative recounting what happened and its immediate fallout.",
      "narrativeImpact": "How this shifts the story arc or colonist psyche"
    }
  ],
  "characters": [
    {
      "id": "char-slug",
      "name": "Full Name",
      "nickname": "Nickname (e.g. 'Vex')",
      "role": "e.g. Chief Surgeon & Sniper",
      "faction": "Colony Name or Faction",
      "status": "Active" | "Injured" | "In Mental Break" | "Missing" | "Deceased" | "Transhumanist Ascended",
      "traits": ["Bloodlust", "Tough", "Kind", "Fast Walker"],
      "healthConditions": ["Bionic Eye (Left)", "Scarred Torso", "Luciferium Addiction"],
      "bio": "Comprehensive 3-4 sentence background and current psychological state.",
      "dramaticArc": "Current internal struggle, motivation, and character growth arc.",
      "quote": "Memorable colonist quote or log entry"
    }
  ],
  "factions": [
    {
      "id": "faction-slug",
      "name": "Faction Name",
      "type": "Outlander" | "Rough Tribe" | "Mechanoid Hive" | "Fallen Empire" | "Pirate Syndicate" | "Colony",
      "stance": "Allied" | "Hostile" | "Neutral" | "Player Colony",
      "ideology": "Core beliefs or meme (e.g. Transhumanist / Collectivist / Cannibal / Nature Primacy)",
      "leader": "Leader name or unknown",
      "description": "Background lore and historical interactions."
    }
  ],
  "locations": [
    {
      "id": "loc-slug",
      "name": "Location Name",
      "type": "Colony Sector" | "Ancient Danger" | "Mountain Pass" | "Ruined Facility" | "Outpost",
      "dangerLevel": "Safe" | "Dangerous" | "Extreme Hazard",
      "description": "Atmospheric description and notable historical events that transpired here."
    }
  ],
  "relics": [
    {
      "id": "relic-slug",
      "name": "Item or Relic Name",
      "category": "Persona Weapon" | "Archotech Artifact" | "Colony Heirloom" | "Masterwork Tech",
      "wielder": "Character Name or Stored in Vault",
      "description": "Lore, origins, and combat/psychic properties."
    }
  ],
  "relationships": [
    {
      "id": "rel-slug",
      "source": "Character Name",
      "target": "Character Name",
      "type": "Spouse" | "Romance" | "Rival" | "Blood Feud" | "Kin" | "Bonded Beast" | "Savior" | "Betrayer" | "Grudge" | "Mentor",
      "opinion": 75,
      "notes": "Context for why they feel this way (e.g. 'Saved Vex from mechanoid scyther during the Great Cold Snap')."
    }
  ],
  "wikiArticles": [
    {
      "id": "article-slug",
      "title": "Article Title (e.g. Character Name, Event Name, Location)",
      "category": "Characters" | "Factions" | "Locations" | "Relics" | "Chronicles" | "Lore",
      "tags": ["colonist", "combat", "archotech"],
      "markdownContent": "# Title\\n\\nUse [[WikiLinks]] to reference other characters, factions, and locations generously throughout the text! Include markdown infobox quotes, headers (## Origins, ## Chronicle History, ## Key Relationships, ## Notable Exploits), and rich literary storytelling prose.\\n\\nAlways use [[Exact Name]] syntax for cross-referencing."
    }
  ],
  "storyHierarchySuggestions": [
    {
      "actTitle": "Act I: The Crash & The Frost",
      "chapters": [
        {
          "chapterTitle": "Chapter 1: Metal Falling from the Sky",
          "scenes": ["Drop Pods Impact", "Scavenging the Ruins", "First Night in the Cold"]
        }
      ]
    }
  ]
}
Ensure the markdown uses [[Entity Name]] wiki link syntax liberally for automatic cross-referencing!
MANDATORY for every "Characters" category article: include a "## Traits" section listing the character's personality traits and a "## Bionics & Health" section cataloguing all prosthetics, augmentations, implants, scars, and medical conditions (e.g. Bionic Eye, Archotech Arm, Peg Leg, Luciferium Addiction). Never omit these two sections from a character entry.
`;

  const rawJson = await callModel(
    prompt,
    "You are a master sci-fi/fantasy chronicler and RimWorld narrative designer. Return ONLY clean JSON without markdown code fences if possible, or standard JSON object.",
    true
  );

  try {
    return ok(parseModelJson(rawJson));
  } catch (parseErr) {
    console.error("JSON parse failure on ingest:", rawJson);
    return fail(500, { error: "Failed to parse structured narrative data from AI", raw: rawJson });
  }
}

// 2. AI Plot Gap & Narrative Consistency Analyzer
async function handleAnalyzePlotGaps(body: any): Promise<AiResponse> {
  const { wikiArticles, events, characters, relationships, hierarchy } = body || {};

  const prompt = `
You are an expert narrative editor, story doctor, and plot consistency auditor specializing in procedural storytelling and serialized novel writing.

Review the following world-building wiki and chronicle data:

Characters:
${JSON.stringify(characters || [], null, 2)}

Timeline Events:
${JSON.stringify(events || [], null, 2)}

Relationships:
${JSON.stringify(relationships || [], null, 2)}

Storyline Hierarchy & Chapters:
${JSON.stringify(hierarchy || [], null, 2)}

Wiki Article Titles & Excerpts:
${JSON.stringify(
    (wikiArticles || []).map((a: any) => ({
      title: a.title,
      category: a.category,
      preview: a.markdownContent ? a.markdownContent.slice(0, 300) : "",
    })),
    null,
    2
  )}

Perform a deep narrative consistency and plot gap analysis. Look for:
1. **Plot Holes & Contradictions**: Temporal paradoxes, injuries that disappear without surgery, dead characters performing actions, faction status discrepancies.
2. **Missing Narrative Bridges**: Abrupt emotional or relationship swings without intermediate scenes (e.g., mortal enemies becoming lovers with no turning point, colonist breaking down with no preceding stressor).
3. **Pacing Gaps & Dead Zones**: Long stretches of time with no documented developments, abrupt transitions between story arcs.
4. **Unresolved Character Tensions**: Unfinished revenge quests, unaddressed trauma from mental breaks or lost bonded animals.
5. **Novelization Recommendations**: Structural advice for pacing, theme, and dialogue focus to transform this playthrough into a cohesive book.

Respond with a strictly valid JSON object:
{
  "overallConsistencyScore": 85,
  "literaryToneAssessment": "A 2-3 sentence overview of the current story's thematic resonance and novel potential.",
  "plotGaps": [
    {
      "id": "gap-1",
      "type": "Contradiction" | "Missing Bridge" | "Unresolved Arc" | "Pacing Warning" | "Lore Mystery",
      "severity": "Critical" | "Warning" | "Opportunity",
      "title": "Concise summary of the gap",
      "affectedEntities": ["Character A", "Faction B"],
      "explanation": "Detailed explanation of the issue and why it breaks immersion or leaves reader confused.",
      "suggestedBridge": "A detailed 1-2 paragraph proposed dramatic bridge scene or event that resolves this gap perfectly and adds rich emotion.",
      "recommendedChapterPlacement": "e.g. Between Chapter 2 and Chapter 3"
    }
  ],
  "novelizationTips": [
    "Tip 1 for improving pacing and emotional stakes",
    "Tip 2 for character dialogue and sensory description"
  ]
}
`;

  const rawJson = await callModel(
    prompt,
    "You are a professional book editor and narrative architect. Output ONLY valid JSON.",
    true
  );

  try {
    return ok(parseModelJson(rawJson));
  } catch (e) {
    return fail(500, { error: "Failed to parse plot gap analysis JSON", raw: rawJson });
  }
}

// 3. AI Bridge Generator (Generates canonical vignette to fill a plot gap)
async function handleGenerateBridge(body: any): Promise<AiResponse> {
  const { gapTitle, explanation, affectedEntities, context } = body || {};

  const prompt = `
Create a compelling, canon-consistent literary vignette/scene that bridges this narrative gap in the chronicle:

Gap: ${gapTitle}
Explanation: ${explanation}
Affected Characters/Factions: ${(affectedEntities || []).join(", ")}

Relevant Story Context:
${JSON.stringify(context || {})}

Write a dramatic, emotionally resonant Markdown vignette (approx 400-700 words) with dialogue, sensory details (smell of burning plasteel, freezing mountain air, sound of the comms console), inner thoughts, and use [[WikiLinks]] for characters and locations.
Also include a short structured event object that can be inserted into the chronicle timeline.

Respond with JSON:
{
  "vignetteTitle": "Title of the Scene",
  "markdownProse": "The full Markdown story scene with [[WikiLinks]]...",
  "timelineEvent": {
    "title": "Event Title",
    "timestamp": "e.g. 11 Jugust, 5502",
    "category": "Social" | "Tragedy" | "Miracle" | "Combat" | "Discovery",
    "threatLevel": "Moderate",
    "participants": affectedEntities,
    "description": "2-sentence summary of this bridging moment.",
    "narrativeImpact": "Resolves the tension and provides smooth transition."
  }
}
`;

  const rawJson = await callModel(prompt, "You are a master science fiction novelist.", true);
  return ok(parseModelJson(rawJson));
}

// 4. Novelize Chapter / Scene
async function handleNovelizeChapter(body: any): Promise<AiResponse> {
  const {
    chapterTitle,
    actTitle,
    selectedEvents,
    includedCharacters,
    stylePreset,
    customStyleInstructions,
    pointOfView,
    wordCountTarget,
  } = body || {};

  const prompt = `
You are a bestselling novelist adapting procedural gameplay logs into a literary masterpiece.

Write a full, immersive chapter titled "${chapterTitle}" (part of "${actTitle || "Act I"}").

Target Style Preset: ${stylePreset || "Grimdark Sci-Fi (Atmospheric, gritty, intense)"}
Custom Style Notes: ${customStyleInstructions || "Emphasize psychological dread, harsh survival, tactical grit, and warm moments of humanity."}
Point of View: ${pointOfView || "Third Person Limited (focusing on key colonist)"}
Target Word Count: ${wordCountTarget || "800-1500 words"}

Key Events to dramatize in this chapter:
${JSON.stringify(selectedEvents || [], null, 2)}

Key Characters & Their Arcs:
${JSON.stringify(includedCharacters || [], null, 2)}

Guidelines:
- Write in rich, expressive Markdown format.
- Use sensory storytelling (tactile descriptions of weapons, weather, wounds, food, smoke, psychic hums).
- Build natural dialogue reflecting character traits (e.g. abrasiveness, bloodlust, kind reassurance, nervous stammer).
- Retain high-stakes dramatic pacing.
- Include [[Character Name]] and [[Location Name]] wiki-links where appropriate so the novel manuscript remains linked to the world wiki.
- Provide a chapter epigraph or opening colony log timestamp quote.

Begin writing the chapter now.
`;

  const novelText = await callModel(
    prompt,
    "You are an acclaimed science fiction author known for deep character studies and gripping prose."
  );

  return ok({ chapterTitle, novelContent: novelText });
}

// 5. Expand / Refine Wiki Article
async function handleExpandWiki(body: any): Promise<AiResponse> {
  const { articleTitle, category, currentContent, promptInstruction, context } = body || {};

  const prompt = `
You are expanding or refining a world-building Wiki article titled "${articleTitle}" (Category: ${category}).

Current Content:
"""
${currentContent || "(New article)"}
"""

User Instruction: "${promptInstruction || "Expand with deep historical lore, psychological nuances, relationships, and chronological records."}"

World Context:
${JSON.stringify(context || {})}

Write the complete updated Markdown article.
- Use structured markdown with headers (## Biography, ## Psychological Profile, ## Key Relationships, ## Combat & Medical Record, ## Colony Legacy).
${category === "Characters" ? "- MANDATORY: include a \"## Traits\" section listing personality traits and a \"## Bionics & Health\" section listing all prosthetics, augmentations, implants, and medical conditions.\n" : ""}- Generously use [[Entity Name]] wiki-link syntax for cross-referencing.
- Add an infobox quote or colony log snippet if fitting.
- Keep the tone atmospheric and evocative.
`;

  const expandedMarkdown = await callModel(
    prompt,
    "You are a senior world-building archivist and wiki creator."
  );

  return ok({ markdownContent: expandedMarkdown });
}

// 6. Ask Chronicler / Loremaster AI
async function handleAskChronicler(body: any): Promise<AiResponse> {
  // The UI sends query/context; the original server used question/persona/fullContext.
  const question = body?.question ?? body?.query;
  const persona = body?.persona;
  const fullContext = body?.fullContext ?? body?.context;

  const systemPrompt = `
You are the Colony Chronicler and World Archivist (Persona: ${persona || "The Ancient Archotech Storyteller"}).
You possess comprehensive knowledge of the playthrough events, character psychological records, relationship webs, and world lore.
Answer the user's creative writing or world-building inquiry thoughtfully with literary depth, narrative ideas, and lore consistency checks.
Use [[WikiLinks]] when referencing entities.
`;

  const answer = await callModel(
    `Context:\n${JSON.stringify(fullContext || {}, null, 2)}\n\nQuestion / Writing Prompt:\n${question}`,
    systemPrompt
  );

  return ok({ answer });
}

// 7. AI Frontier Travel & Logistics Estimator
async function handleEstimateTravelLogistics(body: any): Promise<AiResponse> {
  const {
    sourceLocation,
    targetLocation,
    distanceHexes,
    distanceKm,
    caravanMode,
    caravanMembers,
    projectContext,
  } = body || {};

  const prompt = `
You are a master sci-fi narrative logistician and RimWorld storyteller.
Analyze an expedition or caravan travel route across the frontier:

Departure: "${sourceLocation?.name}" (Biome: ${sourceLocation?.biome || "Frontier Wilderness"}, Danger: ${sourceLocation?.dangerLevel})
Destination: "${targetLocation?.name}" (Biome: ${targetLocation?.biome || "Unknown"}, Danger: ${targetLocation?.dangerLevel})
Calculated Distance: ${distanceHexes} hexes (~${distanceKm} km)
Caravan Mode: ${caravanMode || "On Foot Forced March"}
Caravan Roster: ${JSON.stringify(caravanMembers || ["3 Colonists, Pack Animal"])}
World Story Context: ${JSON.stringify(projectContext || {})}

Provide a comprehensive narrative logistics assessment with potential procedural crises, terrain challenges, and dramatic story hooks.

Respond in JSON format:
{
  "estimatedDurationText": "e.g. 4.2 Days (38 hours active marching)",
  "forageAndRationsSummary": "Pemmican and survival meal breakdown, hunting prospects along the biome.",
  "weatherAndEnvironmentalHazard": "Sensory and mechanical hazards (e.g. -42°C night frost, freezing sleet, toxic fallout pockets, solar flares).",
  "tacticalAmbushRisks": [
    "Specific choke-point hazard or pirate raider patrol pattern along this path",
    "Mechanoid scouting probe detection risk"
  ],
  "logisticalEventHooks": [
    {
      "title": "Dramatic Logistical Event Title",
      "description": "2-3 sentences outlining a high-stakes choice or dilemma during the march.",
      "narrativeTension": "High" | "Moderate"
    }
  ],
  "authorAdvice": "A tip for novelizing this journey with sensory contrast and character tension."
}
`;

  const rawJson = await callModel(
    prompt,
    "You are an expert RimWorld storyteller and military logistician.",
    true
  );

  return ok(parseModelJson(rawJson));
}

// 8. AI Desperate Relief March Generator
async function handleGenerateReliefMarch(body: any): Promise<AiResponse> {
  const {
    sourceColony,
    targetOutpost,
    crisisTrigger,
    travelDays,
    defendingColonists,
    reliefColonists,
    projectContext,
  } = body || {};

  const prompt = `
You are a novelist dramatizing a desperate, high-stakes military relief march across a brutal sci-fi frontier.

Situation:
- Remote Outpost Under Threat: "${targetOutpost?.name}" (Biome: ${targetOutpost?.biome}, Danger: ${targetOutpost?.dangerLevel})
- Immediate Crisis / Threat: "${crisisTrigger || "Enemy mortar siege & mechanoid assault breach"}"
- Outpost Defenders: ${JSON.stringify(defendingColonists || ["Isolated mining crew"])}
- Main Colony: "${sourceColony?.name}" (${travelDays || "4"} Days travel away on foot)
- Dispatched Relief Team: ${JSON.stringify(reliefColonists || ["Colony Vanguard"])}
- Story Context: ${JSON.stringify(projectContext || {})}

Task:
Write a gripping, multi-phase dramatic relief march narrative that weaves together the countdown at the burning outpost with the brutal forced march across freezing/hostile terrain.
Include a structured Timeline Event object that can be added to the project's Chronicle Timeline!

Respond in JSON format:
{
  "operationTitle": "Operation Frozen Dawn: The Relief of Outpost Alpha",
  "dramaticVignetteMarkdown": "# Title\\n\\nSensory, urgent prose with [[WikiLinks]] for characters and locations...",
  "timelineEvent": {
    "title": "Title of the Relief March / Climax Battle",
    "timestamp": "e.g. 14 Septober, 5503",
    "category": "Combat" | "Tragedy" | "Miracle" | "Quest",
    "threatLevel": "Catastrophic" | "Major",
    "location": "${targetOutpost?.name || "Remote Outpost"}",
    "participants": ${(reliefColonists && reliefColonists.length > 0) ? JSON.stringify(reliefColonists) : '["Cole Briggs", "Dr. Valerie Vance"]'},
    "description": "2-3 sentences summarizing the relief force's arrival and the outcome of the siege.",
    "narrativeImpact": "Outpost saved at heavy cost, establishing a secure defensive perimeter across the sector."
  },
  "tacticalOptions": [
    {
      "choice": "Option A: Forced Night March (Risk Hypothermia & Exhaustion for 24h speedup)",
      "consequence": "Arrive in time to save heavy turrets, but colonists enter combat with -15 mood and frostbite."
    },
    {
      "choice": "Option B: Drop Pod Orbital Ammo Resupply first",
      "consequence": "Buys defenders 48 hours but expends irreplaceable chemfuel reserves."
    }
  ]
}
`;

  const rawJson = await callModel(
    prompt,
    "You are a bestselling sci-fi author specializing in tactical military desperation and RimWorld frontier sagas.",
    true
  );

  return ok(parseModelJson(rawJson));
}

// 9. AI Location Lore & Hazards Generator
async function handleGenerateLocationLore(body: any): Promise<AiResponse> {
  const { name, type, biome, dangerLevel, surroundingHexes, projectContext } = body || {};

  const prompt = `
You are generating deep world-building lore, historical background, environmental hazards, and tactical value for a location on the frontier map:

Location Name: "${name}"
Type: "${type}"
Biome: "${biome}"
Threat Rating: "${dangerLevel}"
Context: ${JSON.stringify(projectContext || {})}

Respond in JSON format:
{
  "extendedDescription": "Atmospheric 3-4 sentence description of the geography, ruins, and visual characteristics.",
  "strategicValue": "Why factions fight over this hex (e.g. plasteel reserves, natural thermal choke point, ancient archotech emitter).",
  "tacticalHazards": [
    "Hazard 1 (e.g. Zero cover across open frozen lake bed)",
    "Hazard 2 (e.g. Volatile steam geysers liable to ignite propellant)"
  ],
  "suggestedResources": ["Plasteel Vein", "Geothermal Vent", "Ancient Cryptosleep Pods"],
  "wikiArticleDraft": "# ${name}\\n\\n## Geography & Climate\\n...\\n\\n## Strategic Significance\\n...\\n\\n## Notable Engagements\\n..."
}
`;

  const rawJson = await callModel(prompt, "You are a master world-building archivist.", true);
  return ok(parseModelJson(rawJson));
}

// 10. Downtime Dice: off-screen "filler" beats for colonists outside the active scene
async function handleDowntimeDice(body: any): Promise<AiResponse> {
  const {
    anchorDate,
    quadrumYear,
    snippetCount,
    frequencyLabel,
    daysCovered,
    eligibleColonists,
    activeSceneEvent,
    recentEvents,
    locations,
    colonyContext,
  } = body || {};

  const count = Math.min(5, Math.max(3, parseInt(snippetCount, 10) || 4));

  const prompt = `
You are the Downtime Dice engine of a RimWorld chronicle: a procedural storyteller that fills the quiet hours between dramatic scenes so the colony feels alive 24/7.

CURRENT TIMELINE DATE (anchor): ${anchorDate || "unknown"} (${quadrumYear || "unknown year"})
DOWNTIME FREQUENCY SETTING: ${frequencyLabel || "1 Event per Day"} — snippets must spread across roughly ${daysCovered || 1} in-game day(s) starting AT the anchor date.
SNIPPETS TO GENERATE: exactly ${count}.

THE ACTIVE SCENE (colonists here are busy ON-SCREEN — do NOT feature them):
${JSON.stringify(activeSceneEvent || {}, null, 2)}

ELIGIBLE OFF-SCREEN COLONISTS (feature ONLY these; every snippet must use 1-2 of them and align tightly with each pawn's traits, current health conditions, and bionics/augmentations):
${JSON.stringify(eligibleColonists || [], null, 2)}

RECENT CANON EVENTS (avoid contradicting or repeating these):
${JSON.stringify((recentEvents || []).slice(-5), null, 2)}

KNOWN LOCATIONS (use realistic colony locations from this list when fitting):
${JSON.stringify(locations || [], null, 2)}

COLONY CONTEXT:
${JSON.stringify(colonyContext || {}, null, 2)}

Rules:
- Mix mundane slice-of-life beats (cooking disasters, workshop tinkering, animal handling, letters home) with occasional low-key drama (mood spirals, minor injuries, tense arguments) — roughly 60% mundane / 40% dramatic.
- A pawn's bionics MUST influence their behavior where relevant (e.g. an archotech arm arm-wrestling, a bionic eye reading fine print, a peg leg aching before a storm).
- Health conditions matter: injured or recovering pawns get downtime consistent with their condition.
- Respect personality traits in dialogue and choices (pyromaniacs near flame, kind colonists comforting others, greedy ones hoarding).
- Keep threat levels Minor or Moderate; intensity between 1 and 5.
- These are off-screen vignettes: they happen away from the main action but must feel canon-consistent.

Respond with a strictly valid JSON object:
{
  "snippets": [
    {
      "title": "Evocative small-scale title",
      "offsetDays": 0,
      "category": "Colony Life" | "Social" | "Discovery" | "Surgery" | "Mental Break" | "Miracle" | "Tragedy",
      "threatLevel": "Minor" | "Moderate",
      "location": "Location name",
      "participants": ["Eligible Colonist Name"],
      "description": "2-3 sentences of vivid off-screen narrative referencing traits/health/bionics.",
      "narrativeImpact": "One sentence on how this quietly shapes morale, health, or relationships.",
      "intensityScore": 3
    }
  ]
}
`;

  const rawJson = await callModel(
    prompt,
    "You are a master of slice-of-life procedural storytelling inside harsh sci-fi survival colonies. Output ONLY valid JSON.",
    true
  );

  try {
    return ok(parseModelJson(rawJson));
  } catch (e) {
    return fail(500, { error: "Failed to parse downtime dice JSON", raw: rawJson });
  }
}

// 11. Crossroads: read colony state and branch 3 distinct future scenarios
async function handleCrossroads(body: any): Promise<AiResponse> {
  const {
    characters,
    events,
    factions,
    locations,
    relationships,
    anchorDate,
    quadrumYear,
    projectTitle,
  } = body || {};

  if (!Array.isArray(events) || events.length === 0) {
    return fail(400, { error: "No timeline events recorded yet — record a canonical event first." });
  }

  const prompt = `
You are the Crossroads oracle of a RimWorld chronicle: a narrative engine that reads the current colony state and projects three genuinely distinct branching paths for the immediate future.

CHRONICLE TITLE: "${projectTitle || "Colony Chronicle"}"
CURRENT TIMELINE DATE (the branching point): ${anchorDate || "unknown"} (${quadrumYear || "unknown year"})

COLONISTS (statuses, traits, health conditions and dramatic arcs drive mood analysis):
${JSON.stringify(characters || [], null, 2)}

RECENT CANONICAL EVENTS (the living history that creates tension):
${JSON.stringify((events || []).slice(-8), null, 2)}

FACTIONS (stances and ideologies define external threats):
${JSON.stringify(factions || [], null, 2)}

KNOWN LOCATIONS (food production, resources and hazards live here):
${JSON.stringify(locations || [], null, 2)}

CHARACTER RELATIONSHIPS (grudges, romances and rivalries are tinder):
${JSON.stringify(relationships || [], null, 2)}

Your task:
1. First build a "colonySnapshot": analyze the colonists' statuses/traits/health to estimate an overall mood average; use location resources plus recent event context to assess food supply; derive major active threats from hostile factions and recent events; and summarize the most charged interpersonal or situational tension right now.
2. Then propose EXACTLY THREE branching scenarios for what happens next. The three paths MUST be genuinely distinct in tone and stakes — e.g. one internal/social crisis, one external threat or opportunity, one wildcard discovery or miracle. Each must be plausible given the snapshot, escalate the drama, and reference real characters from the roster.

Respond with a strictly valid JSON object:
{
  "colonySnapshot": {
    "moodAverage": "e.g. 'Tense but stable (~55%) — two colonists near a break threshold'",
    "foodSupply": "e.g. 'Tight: 6 days of simple meals left, no visible hunts'",
    "majorThreats": ["Ashen Skulls raid season", "Mechanoid hive 3 hexes south"],
    "recentTension": "One sentence naming the hottest unresolved interpersonal or situational tension"
  },
  "scenarios": [
    {
      "id": "scenario-a",
      "pathLabel": "Path A",
      "title": "Evocative Dramatic Title",
      "summary": "2-3 sentence overview of how this path unfolds from the current state.",
      "triggerConditions": "What colony state makes this plausible right now (reference mood, food, threats).",
      "keyParticipants": ["Character Name", "Character Name"],
      "threatLevel": "Minor" | "Moderate" | "Major" | "Catastrophic",
      "category": "Combat" | "Social" | "Mental Break" | "Miracle" | "Quest" | "Tragedy" | "Discovery" | "Surgery" | "Colony Life",
      "moodImpact": "How this shifts colony morale (direction + magnitude + who it hits hardest).",
      "storyHook": "The single dramatic question this path raises."
    }
  ]
}
`;

  const rawJson = await callModel(
    prompt,
    "You are a master RimWorld storyteller and dramatic tension analyst. Output ONLY valid JSON.",
    true
  );

  try {
    return ok(parseModelJson(rawJson));
  } catch (e) {
    return fail(500, { error: "Failed to parse crossroads scenarios JSON", raw: rawJson });
  }
}

// 12. Crossroads draft: opening scene + insertable event for the chosen path
async function handleCrossroadsDraft(body: any): Promise<AiResponse> {
  const {
    scenario,
    colonySnapshot,
    characters,
    events,
    factions,
    locations,
    anchorDate,
    quadrumYear,
    projectTitle,
  } = body || {};

  if (!scenario) {
    return fail(400, { error: "No crossroads scenario selected" });
  }

  const prompt = `
You are the opening-scene dramatist of a RimWorld chronicle. The player has chosen a branching path at the crossroads; write the canonical opening scene where this path ignites, ready to be committed to the timeline.

CHRONICLE TITLE: "${projectTitle || "Colony Chronicle"}"
CURRENT TIMELINE DATE (scene starts here): ${anchorDate || "unknown"} (${quadrumYear || "unknown year"})

CHOSEN PATH:
${JSON.stringify(scenario, null, 2)}

CURRENT COLONY SNAPSHOT:
${JSON.stringify(colonySnapshot || {}, null, 2)}

COLONISTS (mirror each speaker's traits, health conditions and dramatic arc in their dialogue):
${JSON.stringify(characters || [], null, 2)}

RECENT CANONICAL EVENTS (do not contradict these):
${JSON.stringify((events || []).slice(-6), null, 2)}

FACTIONS:
${JSON.stringify(factions || [], null, 2)}

LOCATIONS (ground the scene in a real named place):
${JSON.stringify(locations || [], null, 2)}

Your task — produce:
1. "openingSceneMarkdown": a gripping Markdown scene (approx 400-650 words) that opens exactly at the chosen date and dramatizes the first beat of this path. Include sensory detail, rising tension, and at least one moment of live dialogue between key participants. Use [[Character Name]] and [[Location Name]] wiki-link syntax generously.
2. "dialoguePrompts": exactly 4 short roleplay prompts (one per key participant where possible) telling the writer how that character would react next, phrased as directives (e.g. "Vex justifies rationing with cold triage logic...").
3. "suggestedWikiUpdates": 2-3 wiki article updates (existing titles when possible) this scene will make necessary.
4. "timelineEvent": a ready-to-insert structured event summarizing this opening beat.

Respond with a strictly valid JSON object:
{
  "openingSceneMarkdown": "# Scene Title\\n\\nFull markdown prose with [[WikiLinks]]...",
  "dialoguePrompts": [
    "[Character]: directive describing how they speak/act next"
  ],
  "suggestedWikiUpdates": [
    { "articleTitle": "Article Title", "updateSummary": "What must be added or changed and why" }
  ],
  "timelineEvent": {
    "title": "Event Title",
    "timestamp": "${anchorDate || "e.g. 10 Jugust, 5503"}",
    "category": "Combat" | "Social" | "Mental Break" | "Miracle" | "Quest" | "Tragedy" | "Discovery" | "Surgery" | "Colony Life",
    "threatLevel": "Minor" | "Moderate" | "Major" | "Catastrophic",
    "participants": ["Character Name"],
    "location": "Named location from the roster",
    "description": "2-3 sentence summary of the opening beat.",
    "narrativeImpact": "How committing to this path shifts the story arc.",
    "intensityScore": 7
  }
}
`;

  const rawJson = await callModel(
    prompt,
    "You are an acclaimed science fiction novelist specializing in interactive fiction openings. Output ONLY valid JSON.",
    true
  );

  try {
    return ok(parseModelJson(rawJson));
  } catch (e) {
    return fail(500, { error: "Failed to parse crossroads draft JSON", raw: rawJson });
  }
}

export async function handleAiRequest(
  method: string,
  pathname: string,
  options: AiRequestOptions = {}
): Promise<AiResponse> {
  if (!aiRuntime.initialized) initBackend();

  const verb = String(method || "GET").toUpperCase();
  const route = `${verb} ${pathname}`;
  const body = options.body;

  try {
    switch (route) {
      case "GET /api/ai/config":
        return await handleConfigGet();
      case "POST /api/ai/config":
        return await handleConfigPost(body);
      case "GET /api/ai/models":
        return await handleModels(options.query);
      case "POST /api/ai/ingest-logs":
        return await handleIngestLogs(body);
      case "POST /api/ai/analyze-plot-gaps":
        return await handleAnalyzePlotGaps(body);
      case "POST /api/ai/generate-bridge":
        return await handleGenerateBridge(body);
      case "POST /api/ai/novelize-chapter":
        return await handleNovelizeChapter(body);
      case "POST /api/ai/expand-wiki":
        return await handleExpandWiki(body);
      case "POST /api/ai/ask-chronicler":
        return await handleAskChronicler(body);
      case "POST /api/ai/estimate-travel-logistics":
        return await handleEstimateTravelLogistics(body);
      case "POST /api/ai/generate-relief-march":
        return await handleGenerateReliefMarch(body);
      case "POST /api/ai/generate-location-lore":
        return await handleGenerateLocationLore(body);
      case "POST /api/ai/downtime-dice":
        return await handleDowntimeDice(body);
      case "POST /api/ai/crossroads":
        return await handleCrossroads(body);
      case "POST /api/ai/crossroads-draft":
        return await handleCrossroadsDraft(body);
      default:
        return fail(404, { error: `Unknown API route: ${route}` });
    }
  } catch (err: any) {
    console.error(`AI route error (${route}):`, err);
    return fail(500, { error: err?.message || "Internal AI backend error" });
  }
}
