# RimChronicle — Storyteller Wiki & Novel Studio

Transform RimWorld playthroughs — or any sci-fi/fantasy/TTRPG campaign — into an automated Markdown wiki, dynamic character relationship graph, timeline chronicle, AI plot-gap analysis, and novelization studio.

A local-first Electron desktop app. Everything you write is stored on your device; every feature also works fully offline with a rule-based storytelling engine, or is supercharged by AI through the OpenCode gateway.

---

## Feature Highlights

- **World Wiki** — nested, Obsidian-style Markdown articles with `[[WikiLinks]]`, hover previews, backlinks, drag-and-drop folders, and full-text search.
- **Social Web** — a draggable character relationship graph with romance, feuds, kinship, mentorship, and more.
- **World Map** — an interactive hex/custom map with travel routes, terrain difficulty, hazards, and multi-mode travel-time math.
- **Chronicle Timeline** — a living in-game calendar, event stencils, master clock, Downtime Dice filler vignettes, and branching Crossroads scenarios.
- **Ideology** — per-faction Precept Matrices that track doctrinal stances and surface cultural-friction drama automatically.
- **Plot Doctor & Gaps** — a narrative consistency audit that finds plot holes, contradictions, dead zones, and unresolved arcs, then bridges them.
- **Novel Studio** — a full Act → Chapter → Scene manuscript editor with AI chapter generation and canon enforcement.
- **Archivist AI** — an in-universe Chronicler chatbot with complete knowledge of your world.

---

## Core Workspaces

### World Wiki

- Nested, Obsidian-style article tree — any article can host sub-articles ("folders") while still rendering its own content.
- `[[WikiLinks]]` auto-resolve to hover cards with previews for characters, factions, locations, relics, and articles; clicking navigates to the linked page.
- Full-text search across titles, tags, and body content; category filter chips with per-category counts; breadcrumb navigation.
- Drag-and-drop article reparenting (cycle-guarded), backlinks bar, and safe deletion that lifts children to the top level instead of orphaning them.
- Markdown editor with quick-insert toolbar, live word counts, and **live canon-violation highlighting** that flags sentences breaking your world's laws.
- Character-category articles render a live dossier sheet (traits, attribute slots, stat block) with one-click editing.
- **Deepen with AI** expands any article with richer lore, psychological profiles, quotes, and combat/medical records — focus chips included.

### Social Web

- Interactive relationship graph on a ring layout — drag to rearrange, color-coded by bond type, opinion badges (+/-) on each edge, deceased markers, and per-type filters.
- Bond types: Spouse, Romance, Rival, Blood Feud, Kin, Bonded Beast, Savior, Betrayer, Grudge, Mentor — each with an opinion rating (−100 to +100) and notes.
- Character dossiers with dramatic arcs, dynamic attribute slots, stat blocks, and interpersonal bond lists.
- Add/edit colonists (auto-creates their wiki article) and a full faction manager (stance, ideology, leader, settlement).

### World Map

- Interactive SVG world or dungeon map with location nodes, danger rings, hex coordinates, and drag-to-position layout.
- Travel routes between locations with terrain-difficulty-weighted lines, hazard badges, and **auto-computed travel days** for On Foot, Muffalo, Drop Pods, and Mechanoid transport.
- Route hazards (severity-tagged) that feed the Travel event stencil and escalate threat levels.
- Location editor that syncs with linked wiki articles (infobox, tags, auto-created pages).

### Chronicle Timeline

- A vertical chronicle spine with category icons, threat-level badges, intensity scores, cultural-friction banners, and clickable participant wiki links.
- Filter by category, threat level, participant, free text, or toggle off-screen filler beats.
- **Master Clock** — the colony's in-game date (4 quadrums × 15 days), with quick-advance (+1d/+5d/+1 quadrum/+1 year) and explicit set.
- **Event Stencils** — pre-built macros (Raid, Trade, Surgery, Mental Break, Weather, Visitor, Travel) and custom ones that render full timeline events from a few dropdowns and sliders. Sliders can map to intensity (1–10) or derive threat level automatically.
- **Downtime Dice** — rolls off-screen vignettes for colonists not in the active scene, respecting each pawn's traits, health conditions, and bionics. Works via AI or a fully local template engine.
- **Crossroads** — reads the colony state (mood, food, threats, tension) and offers three genuinely distinct branching paths, each expandable into a drafted opening scene with dialogue prompts, wiki update suggestions, and a ready-to-insert timeline event.

### Ideology

- Per-faction **Precept Matrices**: 14 built-in tenets across 8 categories, each with a 5-stance toggle (Mandatory → Abhorred). Custom tenets supported.
- **Cultural Friction Ledger** — when two factions oppose each other on a tenet, friction points are auto-detected with severity, descriptions, and suggested fallout prompts; acknowledge or reopen each one.

### Plot Doctor & Gaps

- **Narrative consistency audit** with a 0–100% cohesion score, literary tone assessment, and novelization tips.
- **AI mode**: deep analysis of characters, events, relationships, and wiki. **Offline mode**: deterministic 12-check local scan (dead links, orphaned articles, loner characters, timeline stagnation, broken faction refs, hazard unpreparedness, and more) — zero network calls.
- Plot gap cards with severity (Critical / Warning / Opportunity), affected entities, recommended chapter placement, and plain-language explanations.
- **Auto-Bridge with AI** or hand-write a bridging scene, then commit it atomically as a new timeline event + "Vignette:" wiki article that marks the gap resolved.

### Novel Studio

- Full **Act → Chapter → Scene** manuscript hierarchy with chapter status tracking (Outline / Drafted / Polished) and per-chapter word counts.
- Markdown chapter editor with live preview and `[[WikiLinks]]` support.
- **Dramatize with AI** — literary style presets (Grimdark Sci-Fi, Frontier Space Western, Psychological Drama, Archotech Gothic), POV presets, target word counts, and custom focus notes.
- **Canon Constraint enforcement** — define absolute world laws (e.g. "No FTL", "Psionics require line-of-sight") that are scanned on-device and injected into AI drafts.
- Full-book manuscript view with reading time, per-chapter canon-violation summary, and **Download .md Book**.

### Archivist AI

- An in-universe Chronicler chatbot with full context of the colony's wiki, timeline, relationships, characters, and factions.
- Quick-prompt chips for dramatic arguments, twists, flash-fiction, and canon queries; responses render as Markdown with navigable wiki links.
- Save any response as a wiki article (auto-categorized as Lore) or copy it.

---

## AI & Offline Modes

- **Two runtime providers** switchable from the header — OpenCode Zen (pay-per-use) and OpenCode Go (flat-rate subscription) — with a live model catalog picker.
- **API key management** in Settings; key stored on-device. Get a key at [opencode.ai/auth](https://opencode.ai/auth).
- **AI Mode toggle** — every AI feature has a **100% offline fallback** via a rule-based local engine (downtime templates, storyteller crossroads presets, static narrative scan), so the app is fully usable without any network or API key.

---

## Worldbuilding Systems

- **Customizable Taxonomy** — rename, recolor, and extend the four fixed enums: article categories, event categories, biomes, and location types. Entries use stable IDs, so renaming never orphans existing data.
- **Dynamic Attribute Slots** — a project-wide, renameable slot layout per genre mode (RimWorld: Bionics / Health / Skills; Fantasy: Spells / Feats / Saving Throws / Inventory). Renaming repurposes slots without losing character data.
- **Native Lexicon** — a presentation-only terminology layer that restyles the entire UI between RimWorld and Fantasy/TTRPG flavor ("Colonist" → "Hero", "Quadrum" → "Tenday", "Mental Break" → "Madness") without touching your data.
- **Stat Block Renderer** — 5e SRD-style stat blocks for any character (ability scores, AC/HP/speed, saving throws, skills, inventory), paste-ready for a VTT or wiki.
- **Dice Roller** — animated polyhedral roller (D2–D100) available from anywhere in the app.

---

## Import & Export

- **AI Log Ingestion** — paste raw playthrough logs and auto-generate characters, timeline events, wiki articles, relationships, and story hierarchy suggestions, merged into your project.
- **Document Import** — import `.txt`, `.md`, and `.docx` files (or whole folders) and AI-classify them into character/location/faction/relic articles, mirroring your folder hierarchy as nested sub-articles.
- **Markdown Wiki Export** — one-click `.zip` with `README.md`, `wiki/` (category-nested articles), `characters/`, `novel/` (per-chapter + compiled `FULL_MANUSCRIPT.md`), `TIMELINE.md`, and `project-backup.json`.
- **Wiki Save Folder** — in the desktop app, pick a folder and the full rendered wiki file set auto-writes to disk as you work.
- **Multi-Wiki Library** — every chronicle is saved independently in local storage, with a welcome screen for starting fresh, opening samples, or loading saved wikis.

---

## Getting Started

### Prerequisites

- Node.js and npm (or Bun)
- An OpenCode API key for AI features (optional — offline mode works without one)

### Setup

Copy `.env.example` to `.env` and set your key:

```
OPENCODE_API_KEY="your-key"
OPENCODE_PROVIDER="zen"   # "zen" (pay-per-use) or "go" (subscription)
OPENCODE_MODEL="big-pickle"
```

### Scripts (run from `Desktop App/`)

```bash
npm install          # install dependencies

npm run dev          # start the Vite dev server in a browser
npm start            # build + launch the Electron desktop app
npm run build        # build the renderer + bundle the AI backend
npm run package      # build + produce installers (NSIS / DMG / AppImage)
npm run lint         # TypeScript type-check
npm run clean        # remove build artifacts
```

### Tech Stack

- **UI**: React 19, TypeScript, Vite 6, Tailwind CSS 4, `react-markdown`, `motion`, `lucide-react`
- **Desktop shell**: Electron (sandboxed renderer, IPC-only backend), `electron-builder` for packaging
- **AI backend**: Node bundled with esbuild into the Electron main process; speaks the OpenAI-compatible OpenCode Chat Completions protocol (no HTTP server in desktop mode)
- **Storage**: browser local storage (multi-wiki), optional disk export/autosave via native file dialogs

### Project Structure

```
Desktop App/
├── desktop/backend.ts      # AI backend (bundled to electron/backend.cjs)
├── electron/               # Electron main + preload + bundled backend
├── src/
│   ├── components/         # Feature views (Wiki, Timeline, Novel, ...)
│   ├── lib/                # Engines (taxonomy, precept, canon, routes, ...)
│   ├── data/               # Sample playthrough seed project
│   ├── App.tsx             # App shell, routing, project state
│   └── types.ts            # Shared data model
└── package.json
```