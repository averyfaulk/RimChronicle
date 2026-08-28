import React, { useMemo, useState } from "react";
import {
  Sparkles,
  FileText,
  Upload,
  Layers,
  Flame,
  UserPlus,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  Files,
  FolderOpen,
  FileUp,
  FileWarning,
  ChevronDown,
  ChevronRight,
  Loader2
} from "lucide-react";
import { ThemeMode, StoryProject, TimelineEvent, WikiArticle, Character, Faction, LocationItem, RelicItem } from "../../types";
import { aiFetch } from "../../lib/aiClient";
import { applyInferredAnalysis } from "../../lib/preceptEngine";
import { getTaxonomy, entryByLabel, hasFlag, taxonomyLabel } from "../../lib/taxonomy";
import {
  prepareDocuments,
  ImportDocument,
  pickFolder,
  filenameToTitle,
} from "../../lib/documentImport";

interface LogIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  isAiMode: boolean;
}

const SAMPLE_RAW_LOGS = [
  {
    title: "Toxic Fallout & Cold Snap (Year 5503)",
    text: `Day 42, Decembary 5503:
- A toxic fallout cloud blankets Mount Karas (-52°C).
- Valerie Vance suffers severe hypothermia while fixing the geothermal conduit. Left index finger frostbitten.
- Cole Briggs experiences a Major Mental Break: Sadistic Rage after his bonded timber wolf 'Fang' died from toxic buildup.
- Cole attacks captured pirate prisoner 'Gorgon' (Ashen Skulls faction), breaking Gorgon's ribs before being subdued by Valerie.
- Food reserves dropped to 14 simple meals. Hydroponics solar flare knocks out power for 18 hours.
- A psychic soothe drone (female) passes over, saving Valerie from breaking.`,
  },
  {
    title: "Mechanoid Drop Pod Raid on Hospital (Year 5504)",
    text: `Day 12, Aprimay 5504:
- 3 Mechanoid Drop Pods crash through the roof of the hospital ward!
- 2 Scythers and 1 Centipede with Heavy Charge Blaster emerge.
- Valerie Vance grabs her Plasteel Longsword and shields the wounded pawn Hanz.
- Cole Briggs activates the emergency Firefoam popper and fires an EMP grenade into the doorway, stunning the Centipede.
- Valerie is slashed across the torso (scar: Mangled Torso), but decapitates the leading Scyther.
- Faction Ashen Skulls sends an opportunistic 8-man raid from the South gate at the exact same moment.
- Cole rigs the chemfuel tanks to explode, routing the pirates while Valerie finishes the disabled Centipede.`,
  },
];

export const LogIngestionModal: React.FC<LogIngestionModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  theme,
  isAiMode,
}) => {
  const [rawText, setRawText] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState("");
  const [ingestionSummary, setIngestionSummary] = useState<string | null>(null);

  // Document import state
  const [documents, setDocuments] = useState<ImportDocument[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [docImportSummary, setDocImportSummary] = useState<string | null>(null);
  const [docsExpanded, setDocsExpanded] = useState(true);

  const tax = useMemo(() => getTaxonomy(project), [project]);

  const charCategoryId =
    tax.articleCategories.find((c) => hasFlag(c, "is-character"))?.id || "category-characters";
  const locCategoryId =
    tax.articleCategories.find((c) => hasFlag(c, "is-location"))?.id || "category-locations";
  const factionCategoryId =
    entryByLabel(tax.articleCategories, "category-factions")?.id || "category-factions";
  const relicCategoryId =
    entryByLabel(tax.articleCategories, "category-relics")?.id || "category-relics";

  const usableDocuments = documents.filter((d) => !d.warning);

  if (!isOpen) return null;

  const handleIngest = async () => {
    if (!rawText.trim()) return;
    setIsIngesting(true);
    setError("");
    setIngestionSummary(null);

    try {
      const res = await aiFetch("/api/ai/ingest-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          taxonomy: project.taxonomy,
          existingContext: {
            characters: project.characters,
            factions: project.factions,
            timelineEvents: project.timelineEvents,
            wikiArticles: project.wikiArticles,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to process colony logs with AI");
      }

      const data = await res.json();

      // Merge newly extracted entities into project
      const newChars = [...project.characters];
      if (Array.isArray(data.characters)) {
        data.characters.forEach((c: any) => {
          const idx = newChars.findIndex(
            (nc) => nc.name.toLowerCase() === c.name.toLowerCase()
          );
          if (idx >= 0) {
            newChars[idx] = { ...newChars[idx], ...c };
          } else {
            newChars.push({
              ...c,
              id: c.id || `char-${Date.now()}-${Math.random()}`,
            });
          }
        });
      }

      const mergedEvents = [...project.timelineEvents];
      const freshEvents: TimelineEvent[] = [];
      if (Array.isArray(data.events)) {
        data.events.forEach((e: any) => {
          const withId: TimelineEvent = {
            ...e,
            id: e.id || `evt-${Date.now()}-${Math.random()}`,
          };
          freshEvents.push(withId);
          mergedEvents.push(withId);
        });
      }

      let workingProject: StoryProject = {
        ...project,
        characters: newChars,
        timelineEvents: mergedEvents,
      };
      if (freshEvents.length > 0) {
        const freshIds = new Set(freshEvents.map((e) => e.id));
        const analyzedEvents: TimelineEvent[] = [];
        for (const evt of workingProject.timelineEvents) {
          if (!freshIds.has(evt.id)) {
            analyzedEvents.push(evt);
            continue;
          }
          const res = applyInferredAnalysis(workingProject, evt);
          analyzedEvents.push(res.event);
          workingProject = res.project;
        }
        workingProject = { ...workingProject, timelineEvents: analyzedEvents };
      }

      const newArticles = [...project.wikiArticles];
      if (Array.isArray(data.wikiArticles)) {
        data.wikiArticles.forEach((art: any) => {
          const idx = newArticles.findIndex(
            (a) => a.title.toLowerCase() === art.title.toLowerCase()
          );
          if (idx >= 0) {
            newArticles[idx] = { ...newArticles[idx], ...art };
          } else {
            newArticles.push({
              ...art,
              id: art.id || `art-${Date.now()}-${Math.random()}`,
            });
          }
        });
      }

      const newRels = [...project.relationships];
      if (Array.isArray(data.relationships)) {
        data.relationships.forEach((r: any) => {
          newRels.push({
            ...r,
            id: r.id || `rel-${Date.now()}-${Math.random()}`,
          });
        });
      }

      setProject({
        ...workingProject,
        wikiArticles: newArticles,
        relationships: newRels,
        lastUpdated: new Date().toISOString(),
      });

      setIngestionSummary(
        data.summary ||
          `Successfully synthesized ${data.events?.length || 0} events, ${
            data.characters?.length || 0
          } characters, and ${data.wikiArticles?.length || 0} markdown wiki entries.`
      );
      setRawText("");
    } catch (err: any) {
      setError(err.message || "Failed to process raw logs");
    } finally {
      setIsIngesting(false);
    }
  };

  // ----------------- Document Import -----------------

  const handleSelectFolder = () => {
    setDocImportSummary(null);
    setError("");
    pickFolder(async (files) => {
      const prepared = await prepareDocuments(files);
      setDocuments(prepared);
    });
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocImportSummary(null);
    setError("");
    const files = Array.from(e.target.files || []);
    prepareDocuments(files).then((prepared) => {
      setDocuments(prepared);
    });
    e.target.value = "";
  };

  /** Resolve an AI-provided category label to a stable taxonomy id. */
  const resolveCategoryId = (label: string | undefined): string => {
    if (!label) return charCategoryId;
    const entry = entryByLabel(tax.articleCategories, label);
    return entry ? entry.id : label;
  };

  /** Build a Markdown article for a classified document. */
  const buildArticleForClassification = (
    docTitle: string,
    folderPath: string,
    entity: any,
    classification: any
  ): WikiArticle => {
    const category = resolveCategoryId(classification?.categoryLabel || classification?.category);
    const matchedEntity = entity && entity.name ? entity.name : docTitle;
    const title = matchedEntity || docTitle;

    let content = `# ${title}\n\n${classification?.markdownContent || ""}`.trim();
    if (!content.includes("\n\n")) {
      const bodySource = classification?.markdownContent || "";
      content = bodySource ? `# ${title}\n\n${bodySource}` : `# ${title}\n\n_Imported document._`;
    }

    const tagArray = Array.isArray(classification?.tags)
      ? (classification.tags as string[])
      : [];
    if (!tagArray.includes("imported")) tagArray.push("imported");

    const now = new Date().toISOString().split("T")[0];
    const article: WikiArticle = {
      id: `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      category,
      tags: tagArray,
      markdownContent: content,
      createdAt: now,
      lastModified: now,
      wordCount: content.trim().split(/\s+/).filter(Boolean).length,
    };

    // Mirror the folder hierarchy as a parent chain (folder articles carry the
    // same category so sub-articles nest naturally under them).
    if (folderPath) {
      const pathParts = folderPath.split("/").filter(Boolean);
      const categoryEntry = entryByLabel(tax.articleCategories, category) || tax.articleCategories[0];
      const isFolder = !!classification?.isFolderArticle;
      article.parentId = folderToParentId(project.wikiArticles, pathParts, categoryEntry.label);
      if (isFolder) article.tags = [...article.tags.filter((t) => t !== "imported"), "folder"];
    }

    return article;
  };

  const folderToParentId = (
    existing: WikiArticle[],
    pathParts: string[],
    categoryLabel: string
  ): string | undefined => {
    if (!pathParts || pathParts.length === 0) return undefined;
    let parentId: string | undefined;
    let cursorTitle: string | undefined;
    for (const part of pathParts) {
      const title = filenameToTitle(part);
      const existingFolder = cursorTitle
        ? existing.find((a) => a.title === title && a.parentId === cursorTitle)
        : existing.find((a) => a.title === title && !a.parentId);
      if (existingFolder) {
        parentId = existingFolder.id;
        cursorTitle = existingFolder.id;
        continue;
      }
      const now = new Date().toISOString().split("T")[0];
      const folderArticle: WikiArticle = {
        id: `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        category: resolveCategoryId(categoryLabel),
        parentId,
        tags: ["folder", "imported"],
        markdownContent: `# ${title}\n\n_Imported folder — sub-articles are nested below._`,
        createdAt: now,
        lastModified: now,
        wordCount: 8,
      };
      existing.push(folderArticle);
      parentId = folderArticle.id;
      cursorTitle = folderArticle.id;
    }
    return parentId;
  };

  /** Merge a classification into the project's various entity lists. */
  const mergeEntities = (
    working: StoryProject,
    classification: any,
    linkedArticleId: string
  ): StoryProject => {
    const out: StoryProject = { ...working };

    // Character
    if (classification?.character && classification.character.name) {
      const c: Character = {
        id: `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: classification.character.name,
        nickname: classification.character.nickname || "",
        role: classification.character.role || "",
        faction: classification.character.faction || "",
        status: classification.character.status || "Active",
        traits: Array.isArray(classification.character.traits) ? classification.character.traits : [],
        healthConditions: Array.isArray(classification.character.healthConditions)
          ? classification.character.healthConditions
          : [],
        bio: classification.character.bio || "",
        dramaticArc: classification.character.dramaticArc || "",
        quote: classification.character.quote,
      };
      const idx = out.characters.findIndex(
        (x) => x.name.toLowerCase() === c.name.toLowerCase()
      );
      if (idx >= 0) out.characters[idx] = { ...out.characters[idx], ...c };
      else out.characters.push(c);
    }

    // Location (+ link the created wiki article)
    if (classification?.location && classification.location.name) {
      const l: LocationItem = {
        id: `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: classification.location.name,
        type: classification.location.type || "Colony Settlement",
        dangerLevel: classification.location.dangerLevel || "Safe",
        description: classification.location.description || "",
        biome: classification.location.biome,
        linkedArticleId,
      };
      const idx = out.locations.findIndex((x) => x.name.toLowerCase() === l.name.toLowerCase());
      if (idx >= 0) out.locations[idx] = { ...out.locations[idx], ...l, linkedArticleId };
      else out.locations.push(l);
    }

    // Faction
    if (classification?.faction && classification.faction.name) {
      const f: Faction = {
        id: `fac-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: classification.faction.name,
        type: classification.faction.type || "",
        stance: classification.faction.stance || "Neutral",
        ideology: classification.faction.ideology || "",
        leader: classification.faction.leader,
        description: classification.faction.description || "",
      };
      const idx = out.factions.findIndex((x) => x.name.toLowerCase() === f.name.toLowerCase());
      if (idx >= 0) out.factions[idx] = { ...out.factions[idx], ...f };
      else out.factions.push(f);
    }

    // Relic
    if (classification?.relic && classification.relic.name) {
      const r: RelicItem = {
        id: `rel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: classification.relic.name,
        category: classification.relic.category || "",
        wielder: classification.relic.wielder || "",
        description: classification.relic.description || "",
      };
      const idx = out.relics.findIndex((x) => x.name.toLowerCase() === r.name.toLowerCase());
      if (idx >= 0) out.relics[idx] = { ...out.relics[idx], ...r };
      else out.relics.push(r);
    }

    // Generate [[WikiLinks]] to related existing entities.
    if (Array.isArray(classification?.relatedEntities) && linkedArticleId) {
      const related = classification.relatedEntities.filter(
        (n: any) => typeof n === "string" && n.trim()
      ) as string[];
      if (related.length > 0) {
        out.wikiArticles = out.wikiArticles.map((a) => {
          if (a.id !== linkedArticleId) return a;
          const linked = related
            .map((name) => `\n- See also: [[${name.trim()}]]`)
            .join("");
          const augmented = a.markdownContent.endsWith("\n")
            ? a.markdownContent + linked.trim() + "\n"
            : a.markdownContent + "\n" + linked.trim() + "\n";
          return { ...a, markdownContent: augmented };
        });
      }
    }

    return out;
  };

  const handleClassifyDocuments = async () => {
    if (usableDocuments.length === 0) return;
    setIsClassifying(true);
    setError("");
    setDocImportSummary(null);

    try {
      const payload = usableDocuments.map((d) => ({
        title: d.title,
        folderPath: d.folderPath,
        markdownText: d.text,
      }));

      const res = await aiFetch("/api/ai/classify-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: payload,
          playthroughTitle: project.title,
          taxonomy: project.taxonomy,
          existingContext: {
            characters: project.characters,
            factions: project.factions,
            locations: project.locations,
            relics: project.relics,
            wikiArticles: project.wikiArticles,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to classify documents with AI");
      }

      const data = await res.json();
      const classification = Array.isArray(data.classification) ? data.classification : [];

      // Dedupe existing articles by title so we merge instead of stack duplicates.
      const articleMap = new Map<string, WikiArticle>();
      project.wikiArticles.forEach((a) => articleMap.set(a.title.toLowerCase(), a));

      let working: StoryProject = {
        ...project,
        wikiArticles: [...articleMap.values()],
      };

      let createdCount = 0;
      let updatedCount = 0;

      classification.forEach((item: any, index: number) => {
        const srcDoc = usableDocuments[index];
        const docTitle = srcDoc?.title || item?.title || `Document ${index + 1}`;

        const buildable = {
          ...item,
          markdownContent: srcDoc?.text
            ? `# ${item?.title || docTitle}\n\n${srcDoc.text}`
            : undefined,
        };

        const article = buildArticleForClassification(
          docTitle,
          srcDoc?.folderPath || item?.folderPath || "",
          buildable,
          buildable
        );

        const key = article.title.toLowerCase();
        const existing = articleMap.get(key);
        if (existing) {
          articleMap.set(key, { ...existing, ...article, id: existing.id });
          updatedCount++;
        } else {
          articleMap.set(key, article);
          createdCount++;
        }
      });

      const mergedArticles = [...articleMap.values()];
      working = { ...working, wikiArticles: mergedArticles };

      // Merge entities back (needs the article ids already in the map).
      classification.forEach((item: any) => {
        const targetTitle = item?.title || "";
        const key = targetTitle.toLowerCase();
        const article = articleMap.get(key);
        if (!article) return;
        working = mergeEntities(working, item, article.id);
      });

      setProject({
        ...working,
        lastUpdated: new Date().toISOString(),
      });

      setDocImportSummary(
        data.summary ||
          `Imported ${createdCount} new article${createdCount === 1 ? "" : "s"}, updated ${updatedCount} existing. Characters, locations, factions and relics linked automatically.`
      );
      setDocuments([]);
      setDocsExpanded(true);
    } catch (err: any) {
      setError(err.message || "Failed to classify documents");
    } finally {
      setIsClassifying(false);
    }
  };

  return (    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl p-6 sm:p-8 rounded-2xl border shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${
          theme === "dark"
            ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
            : theme === "parchment"
            ? "bg-amber-50 border-amber-300 text-stone-900"
            : "bg-slate-900 border-cyan-800 text-cyan-50"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="font-serif font-bold text-lg sm:text-xl flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Ingest Raw RimWorld Logs & Game Events</span>
            </h3>
            <p className="text-xs opacity-75 mt-0.5">
              Paste raw combat logs, letters, notes, or gameplay summaries. OpenCode AI will auto-generate Markdown wiki articles, update character arcs, and add timeline beats.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs opacity-60 hover:opacity-100 p-1 font-mono text-sm"
          >
            ✕
          </button>
        </div>

        {/* Offline Mode Notice */}
        {!isAiMode && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs space-y-1">
            <div className="flex items-center space-x-2 font-bold font-serif text-sm">
              <WifiOff className="w-4 h-4" />
              <span>AI Mode is disabled</span>
            </div>
            <p className="opacity-90 leading-relaxed">
              Automatic log ingestion parses raw text with AI and requires AI Mode to run.
              Re-enable AI Mode from the header toggle to synthesize wiki articles, characters,
              and timeline beats from logs — or build your world manually with the World Wiki
              editor and the Social Web's colonist tools.
            </p>
          </div>
        )}

        {/* Document Import */}
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            theme === "dark"
              ? "bg-[#0c0c0e] border-[#25252e]"
              : theme === "parchment"
              ? "bg-amber-100/70 border-amber-300"
              : "bg-slate-950/70 border-cyan-900"
          }`}
        >
          <button
            type="button"
            onClick={() => setDocsExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="font-serif font-bold text-sm flex items-center space-x-2">
              <Files className="w-4 h-4 text-sky-400" />
              <span>Import Existing Documents → Create Articles</span>
            </span>
            {docsExpanded ? (
              <ChevronDown className="w-4 h-4 opacity-60" />
            ) : (
              <ChevronRight className="w-4 h-4 opacity-60" />
            )}
          </button>

          {docsExpanded && (
            <div className="space-y-3">
              <p className="text-[11px] opacity-75 leading-relaxed">
                Select <strong>.txt</strong>, <strong>.md</strong> or <strong>.docx</strong>{" "}
                documents (or a whole folder) and AI will classify each into Characters,
                Locations, Factions, Relics or Lore — while mirroring your folder structure as
                sub-articles. Legacy <strong>.doc</strong> files are skipped (please re-save as
                .docx/.txt).
              </p>

              <div className="flex flex-wrap gap-2">
                <label
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs border font-semibold cursor-pointer transition-transform active:scale-95 ${
                    theme === "dark"
                      ? "bg-sky-600/20 border-sky-600/40 text-sky-300 hover:bg-sky-600/30"
                      : theme === "parchment"
                      ? "bg-sky-100 border-sky-300 text-sky-900 hover:bg-sky-200"
                      : "bg-sky-950/60 border-sky-700 text-sky-300 hover:bg-sky-900"
                  }`}
                >
                  <FileUp className="w-4 h-4" />
                  <span>Choose Files</span>
                  <input
                    type="file"
                    multiple
                    accept=".txt,.md,.markdown,.docx,.doc"
                    onChange={handleSelectFiles}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs border font-semibold transition-transform active:scale-95 ${
                    theme === "dark"
                      ? "bg-purple-950/40 border-purple-800/50 text-purple-300 hover:bg-purple-900/60"
                      : theme === "parchment"
                      ? "bg-purple-100 border-purple-300 text-purple-900 hover:bg-purple-200"
                      : "bg-purple-950/60 border-purple-700 text-purple-300 hover:bg-purple-900"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Choose Folder</span>
                </button>
              </div>

              {/* Document preview list */}
              {documents.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase opacity-60 block">
                    {documents.length} document{documents.length === 1 ? "" : "s"} selected —{" "}
                    {usableDocuments.length} ready
                  </span>
                  <div className="max-h-44 overflow-y-auto pr-1 space-y-1">
                    {documents.map((d, idx) => (
                      <div
                        key={`${d.title}-${idx}`}
                        className={`flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] ${
                          d.warning
                            ? "border-amber-500/30 text-amber-400 bg-amber-500/5"
                            : "border-white/10 text-zinc-300 bg-black/20"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            {d.warning ? (
                              <FileWarning className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                            )}
                            <span className="font-semibold truncate">{d.title}</span>
                            <span className="opacity-50 uppercase font-mono text-[9px] shrink-0">
                              .{d.ext}
                            </span>
                          </div>
                          {d.folderPath && (
                            <div className="text-[10px] font-mono opacity-50 truncate mt-0.5">
                              📁 {d.folderPath}
                            </div>
                          )}
                          {d.warning && (
                            <div className="text-[10px] opacity-80 mt-0.5">{d.warning}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleClassifyDocuments}
                    disabled={!isAiMode || isClassifying || usableDocuments.length === 0}
                    title={
                      isAiMode
                        ? "Classify & create articles with AI"
                        : "Document import requires AI Mode"
                    }
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                      theme === "dark"
                        ? "bg-sky-500 hover:bg-sky-400 text-[#0c0c0e]"
                        : theme === "parchment"
                        ? "bg-sky-700 hover:bg-sky-600 text-sky-50"
                        : "bg-sky-500 hover:bg-sky-400 text-slate-950"
                    }`}
                  >
                    {isClassifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Classifying & Creating Articles…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Classify & Create Articles</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sample Log Presets */}
        <div>
          <span className="text-[11px] font-mono opacity-60 block mb-1.5 uppercase">
            Quick Load Sample Scenarios:
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_RAW_LOGS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!isAiMode}
                onClick={() => setRawText(sample.text)}
                className="text-xs px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 font-mono text-[11px] text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                + {sample.title}
              </button>
            ))}
          </div>
        </div>

        {/* Text Area */}
        <div className="space-y-2">
          <label className="text-xs font-mono opacity-70 block">
            Raw Combat Logs / Playthrough Notes
          </label>
          <textarea
            id="raw-log-input-textarea"
            rows={8}
            value={rawText}
            disabled={!isAiMode}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste colony messages here... (e.g. 'Day 5: Manhunter megasloth breached outer wall; Cole shot it in the eye but lost his left ear...')"
            className={`w-full p-4 rounded-xl font-mono text-xs sm:text-sm border outline-none leading-relaxed resize-y disabled:opacity-50 ${
              theme === "dark"
                ? "bg-[#0c0c0e] border-[#222228] text-[#f1f5f9]"
                : theme === "parchment"
                ? "bg-amber-50 border-amber-300 text-stone-900"
                : "bg-slate-950 border-cyan-900 text-cyan-50"
            }`}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success summary */}
        {ingestionSummary && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1 animate-in fade-in">
            <div className="flex items-center space-x-2 font-bold font-serif text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Colony Lore & Wiki Updated!</span>
            </div>
            <p className="opacity-90">{ingestionSummary}</p>
          </div>
        )}

        {/* Document import success summary */}
        {docImportSummary && (
          <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs space-y-1 animate-in fade-in">
            <div className="flex items-center space-x-2 font-bold font-serif text-sm">
              <Files className="w-4 h-4" />
              <span>Documents Imported Into Your Wiki!</span>
            </div>
            <p className="opacity-90">{docImportSummary}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs border border-white/10 opacity-70 hover:opacity-100"
          >
            Close
          </button>

          <button
            id="btn-process-raw-logs"
            onClick={handleIngest}
            disabled={!isAiMode || isIngesting || !rawText.trim()}
            title={isAiMode ? undefined : "Log ingestion requires AI Mode"}
            className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
              theme === "dark"
                ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e] font-bold"
                : theme === "parchment"
                ? "bg-amber-800 hover:bg-amber-700 text-amber-50 font-bold"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
            }`}
          >
            {isIngesting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Synthesizing World & Wiki...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Generate Wiki & Chronicle</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
