import React, { useState, useMemo } from "react";
import { aiFetch } from "../../lib/aiClient";
import {
  Clock,
  Flame,
  Shield,
  User,
  MapPin,
  Plus,
  ChevronRight,
  Filter,
  Sparkles,
  Zap,
  Heart,
  Skull,
  Feather,
  AlertTriangle,
  Award,
  Dices,
  GitFork,
  MessageSquare,
  BookOpen,
  Moon,
  Eye,
  EyeOff,
  Loader2,
  Scale,
  X
} from "lucide-react";
import {
  TimelineEvent,
  EventCategory,
  EventTemplate,
  ThreatLevel,
  ThemeMode,
  StoryProject,
  DowntimeFrequency,
  DowntimeSnippet,
  CrossroadDraft,
  CrossroadResult,
  CrossroadScenario,
  PreceptAction,
  CulturalFrictionPoint
} from "../../types";
import { MarkdownRenderer } from "../Wiki/MarkdownRenderer";
import { EntityLookup, buildEntityLookup } from "../../lib/wikiParser";
import {
  DOWNTIME_FREQUENCIES,
  QUADRUMS,
  addDays,
  daysToCover,
  formatRimWorldDate,
  getActiveSceneEvent,
  getCurrentTimelineDate,
  getEligibleDowntimeColonists,
  getMasterClockDate,
  parseRimWorldTimestamp
} from "../../lib/downtime";
import { BUILTIN_TEMPLATES } from "../../lib/templateEngine";
import { loadCustomTemplates } from "../../lib/templateStore";
import { MasterClockWidget } from "./MasterClockWidget";
import { EventStencilBar } from "./EventStencilBar";
import { EventMacroModal } from "./EventMacroModal";
import { TemplateManagerModal } from "./TemplateManagerModal";
import {
  LocalCrossroadPreset,
  LocalCrossroadResolution,
  buildLocalColonySnapshot,
  buildLocalCrossroadDraft,
  pickLocalPresets,
  presetToScenario,
  rollLocalDowntimeSnippets
} from "../../lib/localEngine";
import { loadCustomScenarios } from "../../lib/scenarioStore";
import { ScenarioLibraryModal } from "./ScenarioLibraryModal";
import { WifiOff } from "lucide-react";
import { BUILTIN_TENETS, applyInferredAnalysis, applyPreceptAnalysis } from "../../lib/preceptEngine";
import { selectClasses } from "../../lib/uiTheme";
import { useLexicon } from "../../lib/lexicon";

interface ChronicleTimelineProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  isAiMode: boolean;
  onNavigateToNovelWithEvent?: (event: TimelineEvent) => void;
  onNavigateToArticle: (title: string) => void;
}

export const ChronicleTimeline: React.FC<ChronicleTimelineProps> = ({
  project,
  setProject,
  theme,
  isAiMode,
  onNavigateToNovelWithEvent,
  onNavigateToArticle,
}) => {
  const lex = useLexicon();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedThreat, setSelectedThreat] = useState<string>("All");
  const [selectedParticipant, setSelectedParticipant] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFiller, setShowFiller] = useState(true);

  // Downtime Dice state
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [diceFrequency, setDiceFrequency] = useState<DowntimeFrequency>(
    project.downtimeDiceSettings?.frequency || "daily"
  );
  const [diceCount, setDiceCount] = useState<number>(
    project.downtimeDiceSettings?.defaultCount || 4
  );
  const [isRolling, setIsRolling] = useState(false);
  const [diceError, setDiceError] = useState("");

  // Crossroads state
  type CrossroadsPhase = "generating" | "choosing" | "drafting" | "editing";
  const [isCrossroadsOpen, setIsCrossroadsOpen] = useState(false);
  const [crossroadsPhase, setCrossroadsPhase] = useState<CrossroadsPhase>("generating");
  const [crossroadsResult, setCrossroadsResult] = useState<CrossroadResult | null>(null);
  const [crossroadsDraft, setCrossroadsDraft] = useState<CrossroadDraft | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [crossroadsError, setCrossroadsError] = useState("");
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [draftParticipantsText, setDraftParticipantsText] = useState("");

  // Offline storyteller presets (rule-based Crossroads)
  const [activePresets, setActivePresets] = useState<LocalCrossroadPreset[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState<LocalCrossroadPreset[]>(() =>
    loadCustomScenarios()
  );

  // Add Event modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTimestamp, setNewTimestamp] = useState("1 Aprimay, 5504");
  const [newQuadrum, setNewQuadrum] = useState("Year 5504");
  const [newCategory, setNewCategory] = useState<EventCategory>("Combat");
  const [newThreat, setNewThreat] = useState<ThreatLevel>("Major");
  const [newLocation, setNewLocation] = useState("Mount Karas Caverns");
  const [newParticipants, setNewParticipants] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImpact, setNewImpact] = useState("");
  const [newEventTags, setNewEventTags] = useState("");
  const [newIntensity, setNewIntensity] = useState(7);
  const [newInvolvedFactionIds, setNewInvolvedFactionIds] = useState<string[]>([]);
  const [newActions, setNewActions] = useState<PreceptAction[]>([]);
  const [newActionLabel, setNewActionLabel] = useState("");

  // Event Macro (Stencil) state
  const [selectedStencil, setSelectedStencil] = useState<EventTemplate | null>(null);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<EventTemplate[]>(() =>
    loadCustomTemplates()
  );

  const categories: EventCategory[] = [
    "Combat",
    "Social",
    "Mental Break",
    "Miracle",
    "Quest",
    "Tragedy",
    "Discovery",
    "Surgery",
    "Colony Life",
  ];

  const filteredEvents = useMemo(() => {
    return project.timelineEvents.filter((e) => {
      if (!showFiller && e.isDowntimeFiller) return false;
      const matchCat = selectedCategory === "All" || e.category === selectedCategory;
      const matchThreat = selectedThreat === "All" || e.threatLevel === selectedThreat;
      const matchPart =
        selectedParticipant === "All" ||
        e.participants.some(
          (p) => p.toLowerCase() === selectedParticipant.toLowerCase()
        );
      const matchSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchThreat && matchPart && matchSearch;
    });
  }, [project.timelineEvents, selectedCategory, selectedThreat, selectedParticipant, searchQuery, showFiller]);

  // Downtime Dice derived context
  const activeSceneEvent = useMemo(() => getActiveSceneEvent(project), [project]);
  const currentTimelineDate = useMemo(() => getCurrentTimelineDate(project), [project]);
  const eligibleColonists = useMemo(() => getEligibleDowntimeColonists(project), [project]);
  const fillerCount = useMemo(
    () => project.timelineEvents.filter((e) => e.isDowntimeFiller).length,
    [project.timelineEvents]
  );

  const entityLookup = useMemo(() => buildEntityLookup(project), [project]);

  // Stencil row: built-ins always present, customs merged on top.
  const allTemplates = useMemo(
    () => [...BUILTIN_TEMPLATES, ...customTemplates],
    [customTemplates]
  );
  const masterDate = useMemo(() => getMasterClockDate(project), [project]);

  const tenetOptions = useMemo(() => {
    const customTenets = project.preceptMatrices
      .flatMap((m) => m.tenets)
      .filter((t) => t.custom);
    const seen = new Set<string>();
    return [...BUILTIN_TENETS, ...customTenets]
      .filter((t) => {
        if (seen.has(t.key)) return false;
        seen.add(t.key);
        return true;
      })
      .map((t) => ({ key: t.key, label: t.label, category: t.category }));
  }, [project.preceptMatrices]);

  const toggleEventFaction = (factionId: string) => {
    setNewInvolvedFactionIds((prev) =>
      prev.includes(factionId)
        ? prev.filter((id) => id !== factionId)
        : [...prev, factionId]
    );
  };

  const addEventAction = (tenetKey: string) => {
    const def = tenetOptions.find((t) => t.key === tenetKey);
    if (!def) return;
    setNewActions((prev) => {
      if (prev.some((a) => a.tenetKey === tenetKey)) return prev;
      return [...prev, { label: newActionLabel.trim() || def.label, tenetKey }];
    });
    setNewActionLabel("");
  };

  const removeEventAction = (tenetKey: string) => {
    setNewActions((prev) => prev.filter((a) => a.tenetKey !== tenetKey));
  };

  const handleRollDowntime = async () => {
    if (!currentTimelineDate) {
      setDiceError("No parseable timeline date found. Record a canonical event first.");
      return;
    }
    if (eligibleColonists.length === 0) {
      setDiceError("Every colonist is involved in the active scene — no one is off-screen.");
      return;
    }

    setIsRolling(true);
    setDiceError("");

    try {
      let snippets: DowntimeSnippet[];

      if (!isAiMode) {
        // Offline Mode: rule-based RimWorld-themed dice, zero network calls.
        await new Promise((r) => setTimeout(r, 350)); // brief "roll" beat
        snippets = rollLocalDowntimeSnippets({
          snippetCount: diceCount,
          daysCovered: daysToCover(diceFrequency, diceCount),
          eligibleColonists,
          locations: project.locations.map((l) => ({
            name: l.name,
            type: l.type,
            biome: l.biome,
          })),
        });
      } else {
        const res = await aiFetch("/api/ai/downtime-dice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anchorDate: formatRimWorldDate(currentTimelineDate),
            quadrumYear: `Year ${currentTimelineDate.year}`,
            snippetCount: diceCount,
            frequencyLabel: DOWNTIME_FREQUENCIES[diceFrequency]?.label,
            daysCovered: daysToCover(diceFrequency, diceCount),
            eligibleColonists,
            activeSceneEvent: activeSceneEvent
              ? { title: activeSceneEvent.title, timestamp: activeSceneEvent.timestamp, participants: activeSceneEvent.participants }
              : null,
            recentEvents: project.timelineEvents.slice(-6).map((e) => ({
              title: e.title,
              timestamp: e.timestamp,
              category: e.category,
            })),
            locations: project.locations.map((l) => ({ name: l.name, type: l.type, biome: l.biome })),
            colonyContext: {
              title: project.title,
              factions: project.factions.map((f) => ({ name: f.name, stance: f.stance })),
            },
          }),
        });

        if (!res.ok) {
          throw new Error("The dice clattered into the void. Try again.");
        }

        const data = await res.json();
        snippets = data.snippets || [];
      }

      if (snippets.length === 0) {
        throw new Error("The storyteller returned no snippets.");
      }

      const newEvents: TimelineEvent[] = snippets.slice(0, diceCount).map((s, idx) => {
        const eventDate = addDays(currentTimelineDate, Math.max(0, s.offsetDays || 0));
        return {
          id: `evt-dt-${Date.now()}-${idx}`,
          timestamp: formatRimWorldDate(eventDate),
          quadrumYear: `Year ${eventDate.year}`,
          title: s.title,
          category: s.category || "Colony Life",
          threatLevel: s.threatLevel || "Minor",
          participants: Array.isArray(s.participants) ? s.participants : [],
          location: s.location || "Mount Karas Caverns",
          description: s.description,
          narrativeImpact: s.narrativeImpact || "A quiet beat of colony life between storms.",
          intensityScore: Math.min(10, Math.max(1, s.intensityScore || 3)),
          isDowntimeFiller: true,
        };
      });

      let workingProject = project;
      const analyzedEvents: TimelineEvent[] = [];
      for (const rawEvt of newEvents) {
        const res = applyInferredAnalysis(workingProject, rawEvt);
        analyzedEvents.push(res.event);
        workingProject = res.project;
      }

      setProject({
        ...workingProject,
        timelineEvents: [...workingProject.timelineEvents, ...analyzedEvents],
        downtimeDiceSettings: { frequency: diceFrequency, defaultCount: diceCount },
        lastUpdated: new Date().toISOString(),
      });

      setIsDiceModalOpen(false);
    } catch (err: any) {
      setDiceError(err.message || "Failed to roll downtime dice");
    } finally {
      setIsRolling(false);
    }
  };

  const openCrossroads = () => {
    setIsCrossroadsOpen(true);
    setCrossroadsPhase("generating");
    setCrossroadsResult(null);
    setCrossroadsDraft(null);
    setSelectedScenarioId("");
    setCrossroadsError("");
    setShowDraftPreview(false);

    if (!isAiMode) {
      // Offline Mode: serve character-driven storyteller presets (built-ins
      // merged with the user's custom library) — no network, no AI.
      const presets = pickLocalPresets(3, project, customPresets);
      setActivePresets(presets);
      setCrossroadsResult({
        colonySnapshot: buildLocalColonySnapshot(project),
        scenarios: presets.map((p, idx) => presetToScenario(p, idx)),
        generatedAt: new Date().toISOString(),
      });
      setCrossroadsPhase("choosing");
      return;
    }

    setActivePresets([]);
    void (async () => {
      try {
        const res = await aiFetch("/api/ai/crossroads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectTitle: project.title,
            anchorDate: currentTimelineDate ? formatRimWorldDate(currentTimelineDate) : null,
            quadrumYear: currentTimelineDate ? `Year ${currentTimelineDate.year}` : null,
            characters: project.characters.map((c) => ({
              name: c.name,
              nickname: c.nickname,
              role: c.role,
              status: c.status,
              traits: c.traits,
              healthConditions: c.healthConditions,
              dramaticArc: c.dramaticArc,
            })),
            events: project.timelineEvents.slice(-10).map((e) => ({
              title: e.title,
              timestamp: e.timestamp,
              category: e.category,
              threatLevel: e.threatLevel,
              participants: e.participants,
              description: e.description,
            })),
            factions: project.factions.map((f) => ({
              name: f.name,
              stance: f.stance,
              ideology: f.ideology,
              leader: f.leader,
            })),
            locations: project.locations.map((l) => ({
              name: l.name,
              type: l.type,
              biome: l.biome,
              dangerLevel: l.dangerLevel,
              activeResources: l.activeResources,
            })),
            relationships: project.relationships,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "The crossroads vanished into the fog. Try again.");
        }

        const data = await res.json();
        const scenarios: CrossroadScenario[] = Array.isArray(data.scenarios)
          ? data.scenarios.slice(0, 3)
          : [];
        if (scenarios.length === 0) {
          throw new Error("The storyteller offered no paths forward.");
        }

        const normalized = scenarios.map((s, idx) => ({
          ...s,
          id: s.id || `scenario-${idx}`,
          pathLabel: s.pathLabel || ["Path A", "Path B", "Path C"][idx] || `Path ${idx + 1}`,
          keyParticipants: Array.isArray(s.keyParticipants) ? s.keyParticipants : [],
        }));

        setCrossroadsResult({
          colonySnapshot: data.colonySnapshot || {
            moodAverage: "Unknown",
            foodSupply: "Unknown",
            majorThreats: [],
            recentTension: "",
          },
          scenarios: normalized,
          generatedAt: data.generatedAt || new Date().toISOString(),
        });
        setCrossroadsPhase("choosing");
      } catch (err: any) {
        setCrossroadsError(err.message || "Failed to generate crossroad scenarios");
        setCrossroadsPhase("choosing");
      }
    })();
  };

  /**
   * Offline Mode: build a local draft event + wiki update suggestions from a
   * preset resolution, dropping straight into the editable draft phase.
   */
  const handleChooseLocalResolution = (
    preset: LocalCrossroadPreset,
    resolution: LocalCrossroadResolution
  ) => {
    setSelectedScenarioId(preset.id);
    setCrossroadsError("");

    const anchorTimestamp = currentTimelineDate
      ? formatRimWorldDate(currentTimelineDate)
      : "1 Aprimay, 5504";

    const localDraft = buildLocalCrossroadDraft({
      project,
      preset,
      resolution,
      anchorTimestamp,
    });

    setCrossroadsDraft({
      scenarioId: localDraft.scenarioId,
      openingSceneMarkdown: localDraft.openingSceneMarkdown,
      dialoguePrompts: localDraft.dialoguePrompts,
      suggestedWikiUpdates: localDraft.suggestedWikiUpdates,
      timelineEvent: { ...localDraft.timelineEvent },
    });
    setDraftParticipantsText(localDraft.timelineEvent.participants.join(", "));
    setShowDraftPreview(false);
    setCrossroadsPhase("editing");
  };

  const handleChooseScenario = async (scenario: CrossroadScenario) => {
    setSelectedScenarioId(scenario.id);
    setCrossroadsPhase("drafting");
    setCrossroadsError("");

    try {
      const res = await aiFetch("/api/ai/crossroads-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          colonySnapshot: crossroadsResult?.colonySnapshot || null,
          projectTitle: project.title,
          anchorDate: currentTimelineDate ? formatRimWorldDate(currentTimelineDate) : null,
          quadrumYear: currentTimelineDate ? `Year ${currentTimelineDate.year}` : null,
          characters: project.characters.map((c) => ({
            name: c.name,
            nickname: c.nickname,
            role: c.role,
            status: c.status,
            traits: c.traits,
            healthConditions: c.healthConditions,
            bio: c.bio,
            dramaticArc: c.dramaticArc,
          })),
          events: project.timelineEvents.slice(-8).map((e) => ({
            title: e.title,
            timestamp: e.timestamp,
            category: e.category,
            threatLevel: e.threatLevel,
            description: e.description,
          })),
          factions: project.factions.map((f) => ({ name: f.name, stance: f.stance })),
          locations: project.locations.map((l) => ({
            name: l.name,
            type: l.type,
            biome: l.biome,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "The quill snapped mid-sentence. Try again.");
      }

      const data = await res.json();
      const event = (data?.timelineEvent || {}) as Partial<CrossroadDraft["timelineEvent"]>;
      const participants = Array.isArray(event.participants) ? event.participants : scenario.keyParticipants;

      setCrossroadsDraft({
        scenarioId: data.scenarioId || scenario.id,
        openingSceneMarkdown: data.openingSceneMarkdown || "",
        dialoguePrompts: Array.isArray(data.dialoguePrompts) ? data.dialoguePrompts : [],
        suggestedWikiUpdates: Array.isArray(data.suggestedWikiUpdates) ? data.suggestedWikiUpdates : [],
        timelineEvent: {
          title: event.title || scenario.title,
          timestamp:
            event.timestamp ||
            (currentTimelineDate ? formatRimWorldDate(currentTimelineDate) : "1 Aprimay, 5504"),
          category: event.category || scenario.category || "Colony Life",
          threatLevel: event.threatLevel || scenario.threatLevel || "Moderate",
          participants,
          location: event.location || project.locations[0]?.name || "Colony",
          description: event.description || scenario.summary,
          narrativeImpact: event.narrativeImpact || scenario.moodImpact,
          intensityScore: Math.min(10, Math.max(1, event.intensityScore || 7)),
        },
      });
      setDraftParticipantsText(participants.join(", "));
      setShowDraftPreview(false);
      setCrossroadsPhase("editing");
    } catch (err: any) {
      setCrossroadsError(err.message || "Failed to draft the opening scene");
      setCrossroadsPhase("choosing");
    }
  };

  const patchDraftEvent = (patch: Partial<CrossroadDraft["timelineEvent"]>) => {
    setCrossroadsDraft((prev) =>
      prev ? { ...prev, timelineEvent: { ...prev.timelineEvent, ...patch } } : prev
    );
  };

  const handleAcceptCrossroads = () => {
    if (!crossroadsDraft) return;
    const evt = crossroadsDraft.timelineEvent;
    if (!evt.title.trim()) return;

    const chosen = crossroadsResult?.scenarios.find((s) => s.id === selectedScenarioId);
    const parts = draftParticipantsText
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const newEvt: TimelineEvent = {
      id: `evt-xr-${Date.now()}`,
      timestamp: evt.timestamp,
      quadrumYear: (() => {
        const parsedTs = parseRimWorldTimestamp(evt.timestamp);
        return parsedTs ? `Year ${parsedTs.year}` : currentTimelineDate ? `Year ${currentTimelineDate.year}` : "Unknown";
      })(),
      title: evt.title.trim(),
      category: evt.category,
      threatLevel: evt.threatLevel,
      participants: parts.length > 0 ? parts : ["Colonists"],
      location: evt.location || "Colony",
      description: evt.description,
      narrativeImpact: evt.narrativeImpact,
      intensityScore: Math.min(10, Math.max(1, evt.intensityScore || 7)),
    };

    const analysis = applyInferredAnalysis(project, newEvt);

    const logPrefix = (() => {
      const parsedTs = parseRimWorldTimestamp(evt.timestamp);
      return parsedTs
        ? `${parsedTs.year} ${QUADRUMS[parsedTs.quadrumIndex]} ${parsedTs.day}`
        : evt.timestamp;
    })();

    setProject({
      ...analysis.project,
      timelineEvents: [...analysis.project.timelineEvents, analysis.event],
      chronicleLogHistory: [
        ...analysis.project.chronicleLogHistory,
        `${logPrefix}: [Crossroads · ${chosen?.pathLabel || "Chosen Path"}] ${newEvt.title} — ${evt.description} ${evt.narrativeImpact}`,
      ],
      lastUpdated: new Date().toISOString(),
    });

    closeCrossroads();
  };

  const closeCrossroads = () => {
    setIsCrossroadsOpen(false);
    setCrossroadsResult(null);
    setCrossroadsDraft(null);
    setSelectedScenarioId("");
    setCrossroadsPhase("generating");
    setCrossroadsError("");
    setShowDraftPreview(false);
    setDraftParticipantsText("");
  };

  const handleAddEvent = () => {    if (!newTitle.trim()) return;

    const parts = newParticipants
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const newEvt: TimelineEvent = {
      id: `evt-${Date.now()}`,
      title: newTitle.trim(),
      timestamp: newTimestamp,
      quadrumYear: newQuadrum,
      category: newCategory,
      threatLevel: newThreat,
      location: newLocation,
      participants: parts.length > 0 ? parts : ["Colonists"],
      description: newDescription || "Dramatic colony event recorded in chronicle logs.",
      narrativeImpact: newImpact || "Shifts colonist morale and survival strategy.",
      intensityScore: newIntensity,
      ...(newInvolvedFactionIds.length > 0 ? { involvedFactionIds: [...newInvolvedFactionIds] } : {}),
      ...(newActions.length > 0 ? { actions: [...newActions] } : {}),
      ...(parseEventTags(newEventTags).length > 0 ? { tags: parseEventTags(newEventTags) } : {}),
    };

    const analysis = applyPreceptAnalysis(project, newEvt);

    setProject({
      ...analysis.project,
      timelineEvents: [...analysis.project.timelineEvents, analysis.event],
      lastUpdated: new Date().toISOString(),
    });

    setIsAddModalOpen(false);
    setNewTitle("");
    setNewDescription("");
    setNewImpact("");
    setNewEventTags("");
    setNewInvolvedFactionIds([]);
    setNewActions([]);
    setNewActionLabel("");
  };

  /** Comma-separated tag text → clean lowercase-free tag list. */
  const parseEventTags = (text: string): string[] =>
    text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const getCategoryIcon = (category: EventCategory) => {
    switch (category) {
      case "Combat":
        return <Flame className="w-4 h-4 text-red-500" />;
      case "Social":
        return <Heart className="w-4 h-4 text-rose-400" />;
      case "Mental Break":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "Miracle":
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case "Tragedy":
        return <Skull className="w-4 h-4 text-purple-400" />;
      case "Surgery":
        return <Zap className="w-4 h-4 text-blue-400" />;
      case "Discovery":
        return <Award className="w-4 h-4 text-emerald-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Filters */}
      <div
        className={`rounded-2xl border p-4 sm:p-6 shadow-sm space-y-4 ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-100/70 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <h3 className="font-serif font-bold text-lg">{lex.t("timelineHeader")}</h3>
              <span className="text-xs opacity-50 font-mono">
                ({project.timelineEvents.length} Recorded Beats)
              </span>
            </div>
            <p className="text-xs opacity-75 mt-0.5">
              {lex.t("timelineSubtitle")}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {/* Filler visibility toggle */}
            <button
              onClick={() => setShowFiller(!showFiller)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                showFiller
                  ? theme === "dark"
                    ? "border-[#2c2c36] text-[#cbd5e1] hover:bg-[#1c1c24]"
                    : theme === "parchment"
                    ? "border-amber-300 text-stone-800 hover:bg-amber-200"
                    : "border-cyan-800 text-cyan-300 hover:bg-slate-800"
                  : "opacity-50 border-white/10 line-through"
              }`}
              title={showFiller ? "Hide off-screen downtime beats" : "Show off-screen downtime beats"}
            >
              {showFiller ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Filler ({fillerCount})</span>
            </button>

            {/* Downtime Dice */}
            <button
              id="btn-downtime-dice"
              onClick={() => setIsDiceModalOpen(true)}
              disabled={!currentTimelineDate}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-purple-500/40 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-transform active:scale-95 disabled:opacity-40`}
              title={
                isAiMode
                  ? "Roll off-screen downtime beats for colonists outside the active scene"
                  : "Roll rule-based downtime beats from local RimWorld-themed templates (offline)"
              }
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Downtime Dice</span>
            </button>

            {/* Crossroads */}
            <button
              id="btn-crossroads"
              onClick={openCrossroads}
              disabled={!currentTimelineDate}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-500/40 bg-orange-600/20 text-orange-300 hover:bg-orange-600/30 transition-transform active:scale-95 disabled:opacity-40`}
              title={
                isAiMode
                  ? "Read the colony state and branch three AI-generated paths for the immediate future"
                  : "Pick a local storyteller preset (Wanderer Joins, Defoliator Crash...) with multi-choice resolutions"
              }
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Crossroads</span>
            </button>

            {/* Scenario Library — always available, works offline */}
            <button
              id="btn-scenario-library"
              onClick={() => setIsLibraryOpen(true)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                theme === "dark"
                  ? "border-[#2c2c36] text-[#cbd5e1] hover:bg-[#1c1c24]"
                  : theme === "parchment"
                  ? "border-amber-300 text-stone-800 hover:bg-amber-200"
                  : "border-cyan-800 text-cyan-300 hover:bg-slate-800"
              }`}
              title="Create and manage your own Crossroads scenarios — canon-safe social dilemmas that work fully offline"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Scenario Library</span>
            </button>

            {/* Add Event */}
            <button
              id="btn-add-timeline-event"
              onClick={() => setIsAddModalOpen(true)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                theme === "dark"
                  ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
                  : theme === "parchment"
                  ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Event</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/5 text-xs">
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {lex.evCat(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Threat Level</label>
            <select
              value={selectedThreat}
              onChange={(e) => setSelectedThreat(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
            >
              <option value="All">All Threat Levels</option>
              <option value="Minor">Minor</option>
              <option value="Moderate">Moderate</option>
              <option value="Major">Major</option>
              <option value="Catastrophic">Catastrophic</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">{lex.t("involvedCharacter")}</label>
            <select
              value={selectedParticipant}
              onChange={(e) => setSelectedParticipant(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
            >
              <option value="All">{lex.t("allCharacters")}</option>
              {project.characters.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.nickname || c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">{lex.t("searchChronicle")}</label>
            <input
              type="text"
              placeholder="Search title, description, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
            />
          </div>
        </div>

        {/* Master Clock + Quick-Capture Stencils */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/5">
          <MasterClockWidget project={project} setProject={setProject} theme={theme} />
          <div className="min-w-[220px] flex-1">
            <EventStencilBar
              templates={allTemplates}
              onSelect={(tpl) => setSelectedStencil(tpl)}
              onManage={() => setIsTemplateManagerOpen(true)}
              theme={theme}
            />
          </div>
        </div>
      </div>

      {/* Main Timeline Spine */}
      <div id="chronicle-timeline-list" className="relative pl-6 sm:pl-10 space-y-6 before:absolute before:left-3 sm:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-white/10">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16 opacity-60 text-xs italic">
            No events found for current filters.
          </div>
        ) : (
          filteredEvents.map((evt, idx) => {
            const isCritical = evt.threatLevel === "Catastrophic" || evt.threatLevel === "Major";

            return (
              <div
                key={evt.id}
                id={`timeline-event-${evt.id}`}
                className={`relative p-5 sm:p-6 rounded-2xl border transition-all hover:border-amber-500/50 group ${
                  theme === "dark"
                    ? "bg-[#121215] border-[#222228]"
                    : theme === "parchment"
                    ? "bg-amber-50/90 border-amber-200"
                    : "bg-slate-900/80 border-cyan-900"
                }`}
              >
                {/* Spine Node Marker */}
                <div
                  className={`absolute -left-[30px] sm:-left-[46px] top-6 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs shadow-md transition-transform group-hover:scale-110 ${
                    isCritical
                      ? "bg-red-600 border-red-400 text-white animate-pulse"
                      : evt.isDowntimeFiller
                      ? theme === "dark"
                        ? "bg-[#0c0c0e] border-purple-500 text-purple-400"
                        : "bg-slate-900 border-purple-500 text-purple-400"
                      : theme === "dark"
                      ? "bg-[#0c0c0e] border-amber-500 text-amber-400"
                      : "bg-slate-900 border-amber-500 text-amber-400"
                  }`}
                >
                  {evt.isDowntimeFiller ? <Moon className="w-3.5 h-3.5" /> : getCategoryIcon(evt.category)}
                </div>

                {/* Event Header */}
                <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-white/5">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {evt.timestamp}
                      </span>
                      {evt.isDowntimeFiller && (
                        <span
                          className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded border ${
                            theme === "dark"
                              ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                              : "bg-purple-500/10 text-purple-700 border-purple-500/30"
                          }`}
                          title="Generated by Downtime Dice — happened off-screen, away from the active scene"
                        >
                          Off-Screen
                        </span>
                      )}
                      <span
                        className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded ${
                          evt.threatLevel === "Catastrophic"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : evt.threatLevel === "Major"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {evt.threatLevel}
                      </span>
                      <span className="text-[10px] font-mono opacity-50 px-1.5 py-0.2 rounded bg-black/20">
                        {lex.evCat(evt.category)}
                      </span>
                    </div>
                    <h4 className="font-serif font-bold text-base sm:text-lg">{evt.title}</h4>
                  </div>

                  {/* Intensity Meter */}
                  <div className="flex items-center space-x-1 text-xs font-mono opacity-80" title="Dramatic Intensity (1-10)">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-bold">{evt.intensityScore || 7}/10</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm leading-relaxed my-3 opacity-90">
                  {evt.description}
                </p>

                {/* Cultural Friction banners */}
                {(evt.frictionPoints || []).length > 0 && (
                  <div className="space-y-2 my-3">
                    {(evt.frictionPoints as CulturalFrictionPoint[]).map((fp) => {
                      const primary = project.factions.find((f) => f.id === fp.primaryFactionId);
                      const opposing = project.factions.find((f) => f.id === fp.opposingFactionId);
                      const bannerClasses =
                        fp.severity === "Critical"
                          ? "border-red-500/60 bg-red-950/30"
                          : "border-amber-500/50 bg-amber-950/20";
                      return (
                        <div
                          key={fp.id}
                          className={`p-3 rounded-xl border space-y-2 ${bannerClasses} ${
                            fp.acknowledged ? "opacity-50" : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                            <span className="flex items-center space-x-1 font-bold uppercase">
                              <AlertTriangle
                                className={`w-3.5 h-3.5 ${
                                  fp.severity === "Critical" ? "text-red-400" : "text-amber-400"
                                }`}
                              />
                              <span>Cultural Friction Point</span>
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded uppercase font-bold ${
                                fp.severity === "Critical"
                                  ? "bg-red-500/20 text-red-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {fp.severity}
                            </span>
                            <span className="font-sans font-semibold text-xs">{fp.actionLabel}</span>
                          </div>

                          <p className="text-xs leading-relaxed opacity-90">{fp.description}</p>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                            <span className="px-2 py-0.5 rounded bg-black/30">
                              {primary?.name || fp.primaryFactionId}: <strong>{fp.primaryFactionStance}</strong>
                            </span>
                            <span className="opacity-40">×</span>
                            <span className="px-2 py-0.5 rounded bg-black/30">
                              {opposing?.name || fp.opposingFactionId}: <strong>{fp.opposingFactionStance}</strong>
                            </span>
                          </div>

                          <p className="text-[11px] italic opacity-85 border-t border-white/10 pt-2">
                            <Scale className="w-3 h-3 inline mr-1 -mt-0.5 text-purple-300" />
                            {fp.suggestedFallout}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Location & Logistical Distance from Colony */}
                {(() => {
                  const loc = project.locations.find(
                    (l) =>
                      l.name.toLowerCase().includes(evt.location.toLowerCase()) ||
                      evt.location.toLowerCase().includes(l.name.toLowerCase())
                  );
                  const mainColony =
                    project.locations.find((l) => l.type.toLowerCase().includes("colony")) ||
                    project.locations[0];

                  const isRemote =
                    loc &&
                    mainColony &&
                    loc.id !== mainColony.id &&
                    (loc.hexCoord?.q !== mainColony.hexCoord?.q ||
                      loc.hexCoord?.r !== mainColony.hexCoord?.r);

                  const hexDist =
                    loc && mainColony
                      ? (Math.abs((loc.hexCoord?.q || 0) - (mainColony.hexCoord?.q || 0)) +
                          Math.abs(
                            (loc.hexCoord?.q || 0) +
                              (loc.hexCoord?.r || 0) -
                              (mainColony.hexCoord?.q || 0) -
                              (mainColony.hexCoord?.r || 0)
                          ) +
                          Math.abs((loc.hexCoord?.r || 0) - (mainColony.hexCoord?.r || 0))) /
                        2
                      : 0;

                  const daysOnFoot = (hexDist * 0.85 * (loc?.terrainDifficulty || 1.2)).toFixed(1);

                  return (
                    <div
                      className={`my-3 p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                        theme === "dark"
                          ? "bg-[#0a0a0d] border-[#1f1f26]"
                          : "bg-amber-100/50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-semibold text-slate-200">
                          {evt.location}
                        </span>
                        {loc?.biome && (
                          <span className="text-[10px] opacity-60 font-mono">
                            • {loc.biome}
                          </span>
                        )}
                        {isRemote && (
                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                            ⚡ {daysOnFoot} days march from {mainColony.name}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onNavigateToArticle(evt.location)}
                        className="text-[11px] font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
                        title="View location wiki article"
                      >
                        <span>Location Wiki</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })()}

                {/* Narrative Fallout & Participants */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/5 text-xs">
                  <div>
                    <span className="text-[10px] font-mono opacity-60 uppercase block mb-1">
                      Involved Colonists & Factions:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {evt.participants.map((p) => (
                        <button
                          key={p}
                          onClick={() => onNavigateToArticle(p)}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 hover:bg-white/20 underline decoration-dotted"
                        >
                          [[{p}]]
                        </button>
                      ))}
                      {(evt.involvedFactionIds || []).map((fid) => {
                        const faction = project.factions.find((f) => f.id === fid);
                        if (!faction) return null;
                        return (
                          <span
                            key={fid}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                            title="Involved faction (precept analysis)"
                          >
                            ⚑ {faction.name}
                          </span>
                        );
                      })}
                      {(evt.actions || []).map((a) => (
                        <span
                          key={a.tenetKey}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30"
                          title={`Precept action — tenet: ${a.tenetKey}`}
                        >
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono opacity-60 uppercase block mb-1">
                      Narrative Fallout:
                    </span>
                    <p className="italic opacity-80 text-[11px]">
                      {evt.narrativeImpact}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Record Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl space-y-4 ${
              theme === "dark"
                ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
                : theme === "parchment"
                ? "bg-amber-50 border-amber-300 text-stone-900"
                : "bg-slate-900 border-cyan-800 text-cyan-50"
            }`}
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base flex items-center space-x-2">
                <Plus className="w-4 h-4 text-amber-500" />
                <span>Log Chronicle Timeline Beat</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Timestamp / Date</label>
                  <input
                    type="text"
                    value={newTimestamp}
                    onChange={(e) => setNewTimestamp(e.target.value)}
                    placeholder="e.g. 14 Jugust, 5503"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">{lex.t("quadrumEpoch")}</label>
                  <input
                    type="text"
                    value={newQuadrum}
                    onChange={(e) => setNewQuadrum(e.target.value)}
                    placeholder="Year 5503"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Event Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. The Mechanoid Breaching of the Southern Choke"
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as EventCategory)}
                    className={`w-full px-2 py-1.5 rounded-lg outline-none cursor-pointer ${selectClasses(theme)}`}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {lex.evCat(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">Threat Level</label>
                  <select
                    value={newThreat}
                    onChange={(e) => setNewThreat(e.target.value as ThreatLevel)}
                    className={`w-full px-2 py-1.5 rounded-lg outline-none cursor-pointer ${selectClasses(theme)}`}
                  >
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Major">Major</option>
                    <option value="Catastrophic">Catastrophic</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">Intensity ({newIntensity}/10)</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={newIntensity}
                    onChange={(e) => setNewIntensity(parseInt(e.target.value))}
                    className="w-full accent-amber-500 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Location</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Mount Karas Hydroponics Lab"
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Participants (comma separated)</label>
                <input
                  type="text"
                  value={newParticipants}
                  onChange={(e) => setNewParticipants(e.target.value)}
                  placeholder="Dr. Valerie Vance, Cole Briggs, Hive Kappa-7"
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">
                  Hazard / Context Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={newEventTags}
                  onChange={(e) => setNewEventTags(e.target.value)}
                  placeholder='e.g. "venomous", "haunted", "blizzard" — feeds the Plot Doctor'
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
                <p className="text-[10px] opacity-50 mt-1 italic">
                  Tag danger zones ("venomous", "toxic"...) and the offline Plot Doctor will warn about
                  heroes entering them without healing spells or potions.
                </p>
              </div>

              {project.factions.length > 0 && (
                <div>
                  <label className="font-mono opacity-70 block mb-1">
                    Factions Involved ({newInvolvedFactionIds.length})
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {project.factions.map((f) => {
                      const active = newInvolvedFactionIds.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleEventFaction(f.id)}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                            active
                              ? "bg-cyan-500/25 border-cyan-400/50 text-cyan-300"
                              : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                          }`}
                        >
                          ⚑ {f.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] opacity-50 mt-1 italic">
                    Tag 2+ factions with opposing doctrines to detect cultural friction.
                  </p>
                </div>
              )}

              <div>
                <label className="font-mono opacity-70 block mb-1">
                  Actions — what happened, then pick the tenet it violates or honors
                </label>
                <input
                  type="text"
                  value={newActionLabel}
                  onChange={(e) => setNewActionLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (newActions.length === 0 && tenetOptions.length > 0) {
                      addEventAction(tenetOptions[0].key);
                    }
                  }}
                  placeholder="e.g. Branded the captured raiders as property"
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto mt-1.5">
                  {tenetOptions.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => addEventAction(t.key)}
                      title={`${t.category} — ${t.label}`}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                        newActions.some((a) => a.tenetKey === t.key)
                          ? "bg-purple-500/25 border-purple-400/60 text-purple-200"
                          : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {newActions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newActions.map((a) => (
                      <span
                        key={a.tenetKey}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30"
                      >
                        <span>{a.label}</span>
                        <button
                          type="button"
                          onClick={() => removeEventAction(a.tenetKey)}
                          className="opacity-50 hover:opacity-100 hover:text-red-300"
                          title="Remove action"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Dramatic Description</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Recount the tactical moments, injuries, decisions, and immediate climax..."
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Narrative Fallout</label>
                <input
                  type="text"
                  value={newImpact}
                  onChange={(e) => setNewImpact(e.target.value)}
                  placeholder="e.g. Broken colony morale, permanent loss of defensive turret sector."
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                disabled={!newTitle.trim()}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                  theme === "dark"
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                    : theme === "parchment"
                    ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                    : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                }`}
              >
                Save Chronicle Beat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downtime Dice Modal */}
      {isDiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl space-y-4 ${
              theme === "dark"
                ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
                : theme === "parchment"
                ? "bg-amber-50 border-amber-300 text-stone-900"
                : "bg-slate-900 border-cyan-800 text-cyan-50"
            }`}
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base flex items-center space-x-2">
                <Dices className="w-4 h-4 text-purple-400" />
                <span>Downtime Dice — Off-Screen Beats</span>
              </h3>
              <button
                onClick={() => setIsDiceModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] opacity-70 leading-relaxed">
              {isAiMode ? (
                <>
                  Rolls 3–5 mundane or dramatic vignettes for colonists <em>not</em> in the active
                  scene, auto-populating the Chronicle with filler beats that respect each pawn's
                  traits, health, and bionics.
                </>
              ) : (
                <>
                  Rolls 3–5 vignettes for colonists <em>not</em> in the active scene using built-in,
                  rule-based RimWorld templates (Zzzt! fires, hunts, taming attempts, social chats)
                  — fully offline, starring your own colonists and locations.
                </>
              )}
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-2.5 rounded-xl border ${
                  theme === "dark" ? "bg-black/20 border-[#1f1f26]" : "bg-amber-100/50 border-amber-200"
                }`}>
                  <span className="text-[10px] font-mono opacity-60 uppercase block mb-0.5">Current Timeline Date</span>
                  <span className="font-mono font-bold text-amber-400">
                    {currentTimelineDate ? lex.date(currentTimelineDate) : "Unknown"}
                  </span>
                </div>
                <div className={`p-2.5 rounded-xl border ${
                  theme === "dark" ? "bg-black/20 border-[#1f1f26]" : "bg-amber-100/50 border-amber-200"
                }`}>
                  <span className="text-[10px] font-mono opacity-60 uppercase block mb-0.5">Active Scene</span>
                  <span className="font-semibold truncate block" title={activeSceneEvent?.title}>
                    {activeSceneEvent ? activeSceneEvent.title : "None recorded"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Frequency</label>
                  <select
                    value={diceFrequency}
                    onChange={(e) => setDiceFrequency(e.target.value as DowntimeFrequency)}
                    className={`w-full px-2 py-1.5 rounded-lg outline-none cursor-pointer ${selectClasses(theme)}`}
                  >
                    {Object.entries(DOWNTIME_FREQUENCIES).map(([key, freq]) => (
                      <option key={key} value={key}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">
                    Snippets per Roll ({diceCount}) • covers {daysToCover(diceFrequency, diceCount)}d
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="5"
                    value={diceCount}
                    onChange={(e) => setDiceCount(parseInt(e.target.value))}
                    className="w-full accent-purple-500 mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">
                  Eligible Off-Screen Colonists ({eligibleColonists.length})
                </label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {eligibleColonists.length === 0 ? (
                    <span className="italic opacity-60 text-[11px]">
                      Everyone is on-screen in the active scene.
                    </span>
                  ) : (
                    eligibleColonists.map((c) => (
                      <span
                        key={c.name}
                        title={`Traits: ${c.traits.join(", ") || "none"} | Health: ${c.healthConditions.join(", ") || "none"} | Bionics: ${c.bionics.join(", ") || "none"}`}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-help ${
                          c.status === "Injured" || c.status === "In Mental Break"
                            ? "bg-red-500/15 text-red-300 border border-red-500/30"
                            : "bg-white/10 underline decoration-dotted"
                        }`}
                      >
                        {c.nickname || c.name}
                        {c.bionics.length > 0 && " ⚙"}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {diceError && (
                <p className="text-red-400 text-[11px] italic">{diceError}</p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsDiceModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleRollDowntime}
                disabled={isRolling || !currentTimelineDate || eligibleColonists.length === 0}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-transform active:scale-95 disabled:opacity-40 flex items-center space-x-1.5"
              >
                {isRolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Dices className="w-3.5 h-3.5" />}
                <span>{isRolling ? "Rolling..." : "Roll the Dice"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crossroads Modal */}
      {isCrossroadsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-4 ${
              theme === "dark"
                ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
                : theme === "parchment"
                ? "bg-amber-50 border-amber-300 text-stone-900"
                : "bg-slate-900 border-cyan-800 text-cyan-50"
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base flex items-center space-x-2">
                <GitFork className="w-4 h-4 text-orange-400" />
                <span>
                  {isAiMode
                    ? "Crossroads — Branching Narratives"
                    : "Crossroads — Local Storyteller Presets"}
                </span>
              </h3>
              <button
                onClick={closeCrossroads}
                className="text-xs opacity-60 hover:opacity-100"
                title="Discard without changes"
              >
                ✕
              </button>
            </div>

            {!isAiMode && (
              <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-[11px] text-orange-300 flex items-center space-x-2">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-relaxed">
                  Offline Mode — scenarios come from built-in RimWorld-style presets. Pick a
                  scenario, then choose one of its resolutions; a fully editable draft event is
                  created locally.
                </span>
              </div>
            )}

            {/* Phase: Generating */}
            {crossroadsPhase === "generating" && (
              <div className="py-16 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                <p className="text-sm italic opacity-80">Reading the colony state — moods, food stores, threats...</p>
                <p className="text-[11px] opacity-50 font-mono">Consulting the crossroads oracle</p>
              </div>
            )}

            {/* Phase: Choosing */}
            {crossroadsPhase === "choosing" && (
              <div className="space-y-4">
                {crossroadsError && (
                  <p className="text-red-400 text-xs italic">{crossroadsError}</p>
                )}

                {crossroadsResult && (
                  <>
                    {/* Colony Snapshot */}
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        theme === "dark" ? "bg-black/20 border-[#1f1f26]" : "bg-amber-100/60 border-amber-200"
                      }`}
                    >
                      <span className="text-[10px] font-mono opacity-60 uppercase block mb-1.5">
                        Colony Snapshot @ {currentTimelineDate ? lex.date(currentTimelineDate) : "Unknown"}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                        <div>
                          <span className="opacity-60">Mood:</span>{" "}
                          <span className="font-semibold">{crossroadsResult.colonySnapshot.moodAverage}</span>
                        </div>
                        <div>
                          <span className="opacity-60">Food:</span>{" "}
                          <span className="font-semibold">{crossroadsResult.colonySnapshot.foodSupply}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="opacity-60">Threats:</span>{" "}
                          <span className="font-semibold">
                            {crossroadsResult.colonySnapshot.majorThreats.join(" • ") || "None detected"}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="opacity-60">Tension:</span>{" "}
                          <span className="italic">{crossroadsResult.colonySnapshot.recentTension}</span>
                        </div>
                      </div>
                    </div>

                    {/* Offline: Local Preset Cards with multi-choice resolutions */}
                    {!isAiMode && activePresets.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {activePresets.map((preset) => (
                          <div
                            key={preset.id}
                            className={`flex flex-col p-4 rounded-xl border space-y-2.5 transition-all hover:border-orange-500/60 ${
                              theme === "dark"
                                ? "bg-[#17171d] border-[#26262f]"
                                : theme === "parchment"
                                ? "bg-amber-100/80 border-amber-300"
                                : "bg-slate-950/70 border-cyan-900"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-mono font-bold uppercase">
                                Preset
                              </span>
                            </div>

                            <h4 className="font-serif font-bold text-sm leading-snug">
                              {preset.title}
                            </h4>
                            <p className="text-[11px] opacity-80 leading-relaxed">{preset.summary}</p>

                            <div className="space-y-1.5 text-[11px] pt-2 border-t border-white/5">
                              <div>
                                <span className="text-[9px] font-mono uppercase opacity-50 block">
                                  Story Hook
                                </span>
                                <span className="italic text-orange-300">{preset.storyHook}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-mono uppercase opacity-50 block mb-1">
                                  Resolutions
                                </span>
                                <div className="space-y-1.5">
                                  {preset.resolutions.map((resolution) => (
                                    <button
                                      key={resolution.label}
                                      onClick={() => handleChooseLocalResolution(preset, resolution)}
                                      title={resolution.outcome}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-transform active:scale-95 ${
                                        theme === "dark"
                                          ? "bg-orange-600/80 hover:bg-orange-500 text-white"
                                          : theme === "parchment"
                                          ? "bg-orange-800 hover:bg-orange-700 text-orange-50"
                                          : "bg-orange-600 hover:bg-orange-500 text-white"
                                      }`}
                                    >
                                      ▸ {resolution.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                    /* AI Mode: generated Scenario Cards */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {crossroadsResult.scenarios.map((scenario) => (
                        <div
                          key={scenario.id}
                          className={`flex flex-col p-4 rounded-xl border space-y-2.5 transition-all hover:border-orange-500/60 ${
                            theme === "dark"
                              ? "bg-[#17171d] border-[#26262f]"
                              : theme === "parchment"
                              ? "bg-amber-100/80 border-amber-300"
                              : "bg-slate-950/70 border-cyan-900"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-mono font-bold uppercase">
                              {scenario.pathLabel}
                            </span>
                            <span
                              className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded ${
                                scenario.threatLevel === "Catastrophic"
                                  ? "bg-red-500/20 text-red-400"
                                  : scenario.threatLevel === "Major"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-blue-500/20 text-blue-400"
                              }`}
                            >
                              {scenario.threatLevel}
                            </span>
                          </div>

                          <h4 className="font-serif font-bold text-sm leading-snug">{scenario.title}</h4>
                          <p className="text-[11px] opacity-80 leading-relaxed flex-1">{scenario.summary}</p>

                          <div className="space-y-1.5 text-[11px] pt-2 border-t border-white/5">
                            <div>
                              <span className="text-[9px] font-mono uppercase opacity-50 block">Trigger</span>
                              <span className="opacity-75">{scenario.triggerConditions}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-mono uppercase opacity-50 block">Key Participants</span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {scenario.keyParticipants.map((p) => (
                                  <span key={p} className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] font-semibold">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-[9px] font-mono uppercase opacity-50 block">Mood Impact</span>
                              <span className="opacity-75">{scenario.moodImpact}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-mono uppercase opacity-50 block">Story Hook</span>
                              <span className="italic text-orange-300">{scenario.storyHook}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleChooseScenario(scenario)}
                            className={`mt-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                              theme === "dark"
                                ? "bg-orange-600 hover:bg-orange-500 text-white"
                                : theme === "parchment"
                                ? "bg-orange-800 hover:bg-orange-700 text-orange-50"
                                : "bg-orange-600 hover:bg-orange-500 text-white"
                            }`}
                          >
                            Choose This Path
                          </button>
                        </div>
                      ))}
                    </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Phase: Drafting */}
            {crossroadsPhase === "drafting" && (
              <div className="py-16 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                <p className="text-sm italic opacity-80">Drafting the opening scene for your chosen path...</p>
                <p className="text-[11px] opacity-50 font-mono">The quill scratches across parchment</p>
              </div>
            )}

            {/* Phase: Editing */}
            {crossroadsPhase === "editing" && crossroadsDraft && (
              <div className="space-y-5 text-xs">
                {/* Opening Scene */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-mono opacity-70 flex items-center space-x-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                      <span>Opening Scene (Markdown)</span>
                    </label>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setShowDraftPreview(false)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          !showDraftPreview
                            ? "border-orange-500/60 bg-orange-500/20 text-orange-300"
                            : "border-white/10 opacity-60 hover:opacity-100"
                        }`}
                      >
                        Edit Source
                      </button>
                      <button
                        onClick={() => setShowDraftPreview(true)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          showDraftPreview
                            ? "border-orange-500/60 bg-orange-500/20 text-orange-300"
                            : "border-white/10 opacity-60 hover:opacity-100"
                        }`}
                      >
                        Live Preview
                      </button>
                    </div>
                  </div>

                  {showDraftPreview ? (
                    <MarkdownRenderer
                      content={crossroadsDraft.openingSceneMarkdown}
                      lookup={entityLookup}
                      theme={theme}
                      onNavigateToArticle={onNavigateToArticle}
                      className={`p-4 rounded-xl border min-h-[24rem] max-h-[32rem] overflow-y-auto ${
                        theme === "dark" ? "bg-black/30 border-[#1f1f26]" : "bg-amber-100/60 border-amber-200"
                      }`}
                    />
                  ) : (
                    <textarea
                      value={crossroadsDraft.openingSceneMarkdown}
                      onChange={(e) =>
                        setCrossroadsDraft({ ...crossroadsDraft, openingSceneMarkdown: e.target.value })
                      }
                      rows={14}
                      className={`w-full h-96 px-3 py-2.5 rounded-xl border bg-black/30 outline-none font-mono text-[12px] leading-relaxed resize-y focus:border-orange-500/60 ${
                        theme === "dark" ? "border-[#1f1f26]" : "border-amber-200"
                      }`}
                    />
                  )}
                </div>

                {/* Timeline Event Fields */}
                <div className="space-y-2.5">
                  <label className="font-mono opacity-70 flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
                    <span>Timeline Event (pre-filled from draft)</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-mono opacity-60 block mb-1">Title</span>
                      <input
                        type="text"
                        value={crossroadsDraft.timelineEvent.title}
                        onChange={(e) => patchDraftEvent({ title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] font-mono opacity-60 block mb-1">Timestamp / Date</span>
                      <input
                        type="text"
                        value={crossroadsDraft.timelineEvent.timestamp}
                        onChange={(e) => patchDraftEvent({ timestamp: e.target.value })}
                        placeholder="e.g. 10 Jugust, 5503"
                        className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] font-mono opacity-60 block mb-1">Location</span>
                      <input
                        type="text"
                        value={crossroadsDraft.timelineEvent.location}
                        onChange={(e) => patchDraftEvent({ location: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] font-mono opacity-60 block mb-1">Category</span>
                      <select
                        value={crossroadsDraft.timelineEvent.category}
                        onChange={(e) => patchDraftEvent({ category: e.target.value as EventCategory })}
                        className={`w-full px-2 py-1.5 rounded-lg outline-none cursor-pointer ${selectClasses(theme)}`}
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {lex.evCat(c)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono opacity-60 block mb-1">Threat Level</span>
                      <select
                        value={crossroadsDraft.timelineEvent.threatLevel}
                        onChange={(e) => patchDraftEvent({ threatLevel: e.target.value as ThreatLevel })}
                        className={`w-full px-2 py-1.5 rounded-lg outline-none cursor-pointer ${selectClasses(theme)}`}
                      >
                        <option value="Minor">Minor</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Major">Major</option>
                        <option value="Catastrophic">Catastrophic</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono opacity-60 block mb-1">
                        Intensity ({crossroadsDraft.timelineEvent.intensityScore}/10)
                      </span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={crossroadsDraft.timelineEvent.intensityScore}
                        onChange={(e) => patchDraftEvent({ intensityScore: parseInt(e.target.value) })}
                        className="w-full accent-orange-500 mt-1.5"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] font-mono opacity-60 block mb-1">Participants (comma separated)</span>
                      <input
                        type="text"
                        value={draftParticipantsText}
                        onChange={(e) => setDraftParticipantsText(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-mono opacity-60 block mb-1">Description</span>
                      <textarea
                        rows={3}
                        value={crossroadsDraft.timelineEvent.description}
                        onChange={(e) => patchDraftEvent({ description: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-mono opacity-60 block mb-1">Narrative Impact</span>
                      <input
                        type="text"
                        value={crossroadsDraft.timelineEvent.narrativeImpact}
                        onChange={(e) => patchDraftEvent({ narrativeImpact: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dialogue Prompts */}
                <div className="space-y-2">
                  <label className="font-mono opacity-70 flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
                    <span>Dialogue Prompts ({crossroadsDraft.dialoguePrompts.length})</span>
                  </label>
                  <div className="space-y-1.5">
                    {crossroadsDraft.dialoguePrompts.map((prompt, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5">
                        <span className="font-mono opacity-40 shrink-0">{idx + 1}.</span>
                        <input
                          type="text"
                          value={prompt}
                          onChange={(e) => {
                            const next = [...crossroadsDraft.dialoguePrompts];
                            next[idx] = e.target.value;
                            setCrossroadsDraft({ ...crossroadsDraft, dialoguePrompts: next });
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                        />
                        <button
                          onClick={() =>
                            setCrossroadsDraft({
                              ...crossroadsDraft,
                              dialoguePrompts: crossroadsDraft.dialoguePrompts.filter((_, i) => i !== idx),
                            })
                          }
                          className="p-1 rounded opacity-50 hover:opacity-100 hover:text-red-400"
                          title="Remove prompt"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      setCrossroadsDraft({
                        ...crossroadsDraft,
                        dialoguePrompts: [...crossroadsDraft.dialoguePrompts, ""],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/10 opacity-70 hover:opacity-100"
                  >
                    + Add Prompt
                  </button>
                </div>

                {/* Suggested Wiki Updates (read-only reference) */}
                {crossroadsDraft.suggestedWikiUpdates.length > 0 && (
                  <div className="space-y-2">
                    <label className="font-mono opacity-70 flex items-center space-x-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                      <span>Suggested Wiki Updates (reference)</span>
                    </label>
                    <div className="space-y-1.5">
                      {crossroadsDraft.suggestedWikiUpdates.map((u, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border text-[11px] ${
                            theme === "dark" ? "bg-black/20 border-[#1f1f26]" : "bg-amber-100/60 border-amber-200"
                          }`}
                        >
                          <span className="font-bold underline decoration-dotted">[[{u.articleTitle}]]</span>
                          <span className="block opacity-75 mt-0.5">{u.updateSummary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {crossroadsError && (
                  <p className="text-red-400 text-[11px] italic">{crossroadsError}</p>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-white/10">
                  <button
                    onClick={closeCrossroads}
                    className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleAcceptCrossroads}
                    disabled={!crossroadsDraft.timelineEvent.title.trim()}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 flex items-center space-x-1.5 disabled:opacity-40 ${
                      theme === "dark"
                        ? "bg-orange-600 hover:bg-orange-500 text-white"
                        : theme === "parchment"
                        ? "bg-orange-800 hover:bg-orange-700 text-orange-50"
                        : "bg-orange-600 hover:bg-orange-500 text-white"
                    }`}
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    <span>Accept &amp; Record Path</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scenario Library modal */}
      {isLibraryOpen && (
        <ScenarioLibraryModal
          theme={theme}
          onClose={() => setIsLibraryOpen(false)}
          onSaved={() => setCustomPresets(loadCustomScenarios())}
        />
      )}

      {/* Event Macro (Stencil) modal */}
      {selectedStencil && (
        <EventMacroModal
          key={selectedStencil.id}
          template={selectedStencil}
          project={project}
          setProject={setProject}
          theme={theme}
          lookup={entityLookup}
          onNavigateToArticle={onNavigateToArticle}
          masterDate={masterDate}
          onClose={() => setSelectedStencil(null)}
        />
      )}

      {/* Template Manager modal */}
      {isTemplateManagerOpen && (
        <TemplateManagerModal
          theme={theme}
          onClose={() => setIsTemplateManagerOpen(false)}
          onSaved={() => setCustomTemplates(loadCustomTemplates())}
        />
      )}
    </div>
  );
};
