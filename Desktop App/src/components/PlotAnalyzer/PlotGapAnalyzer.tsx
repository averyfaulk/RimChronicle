import React, { useState } from "react";
import { aiFetch } from "../../lib/aiClient";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  BookOpen,
  Feather,
  Layers,
  Flame,
  ShieldAlert,
  Lightbulb,
  Check,
  PenLine,
  WifiOff,
  X
} from "lucide-react";
import {
  PlotGap,
  PlotGapSeverity,
  PlotGapType,
  ThemeMode,
  StoryProject,
  PlotGapAnalysisReport
} from "../../types";
import { runStaticNarrativeScan } from "../../lib/localEngine";
import { buildCulturalFrictionGaps } from "../../lib/preceptEngine";
import { formatRimWorldDate, getCurrentTimelineDate } from "../../lib/downtime";

interface PlotGapAnalyzerProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  isAiMode: boolean;
  onNavigateToArticle: (title: string) => void;
}

export const PlotGapAnalyzer: React.FC<PlotGapAnalyzerProps> = ({
  project,
  setProject,
  theme,
  isAiMode,
  onNavigateToArticle,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "open" | "resolved">("open");

  // Bridging generator state (AI Mode)
  const [bridgingGapId, setBridgingGapId] = useState<string | null>(null);
  const [generatedBridgeResult, setGeneratedBridgeResult] = useState<{
    gapId: string;
    vignetteTitle: string;
    markdownProse: string;
    timelineEvent: any;
  } | null>(null);

  // Manual bridge editor state (Offline Mode)
  const [manualBridgeGapId, setManualBridgeGapId] = useState<string | null>(null);
  const [manualBridgeTitle, setManualBridgeTitle] = useState("");
  const [manualBridgeProse, setManualBridgeProse] = useState("");

  const report = project.plotGapReport;

  const handleRunScan = async () => {
    setIsScanning(true);
    setScanError("");

    try {
      let data: PlotGapAnalysisReport;

      if (!isAiMode) {
        // Offline Mode: deterministic static analysis, no network calls.
        await new Promise((r) => setTimeout(r, 450)); // brief scan beat
        data = runStaticNarrativeScan(project);
      } else {
        const res = await aiFetch("/api/ai/analyze-plot-gaps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characters: project.characters,
            events: project.timelineEvents,
            relationships: project.relationships,
            hierarchy: project.storyHierarchy,
            wikiArticles: project.wikiArticles,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to scan narrative consistency");
        }

        data = await res.json();
        data.plotGaps = [...buildCulturalFrictionGaps(project), ...(data.plotGaps || [])];
      }

      data.analyzedAt = new Date().toISOString();

      setProject({
        ...project,
        plotGapReport: data,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err: any) {
      setScanError(err.message || "Failed to scan narrative");
    } finally {
      setIsScanning(false);
    }
  };

  /** Shared commit path for AI-generated and manually written bridges. */
  const insertBridgeIntoProject = (
    vignetteTitle: string,
    markdownProse: string,
    timelineEventMeta: {
      timestamp?: string;
      category?: string;
      participants?: string[];
      description?: string;
      narrativeImpact?: string;
    } | null,
    gapId: string
  ) => {
    const anchorDate = getCurrentTimelineDate(project);
    const timestamp = timelineEventMeta?.timestamp || (anchorDate ? formatRimWorldDate(anchorDate) : "5502 Interlude");
    const quadrumYear = anchorDate ? `Year ${anchorDate.year}` : "Year 5502";

    // 1. Insert timeline event
    const newEvent = {
      id: `evt-bridge-${Date.now()}`,
      title: vignetteTitle,
      timestamp,
      quadrumYear,
      category: timelineEventMeta?.category || "Social",
      threatLevel: "Moderate",
      participants: timelineEventMeta?.participants || [],
      location: "Colony Grounds",
      description: timelineEventMeta?.description || markdownProse.slice(0, 180) || "Bridging narrative moment.",
      narrativeImpact: timelineEventMeta?.narrativeImpact || "Restored narrative cohesion.",
      intensityScore: 6,
    };

    // 2. Insert or append wiki article / chronicle
    const newArticle = {
      id: `art-vignette-${Date.now()}`,
      title: `Vignette: ${vignetteTitle}`,
      category: "Chronicles" as const,
      tags: ["vignette", "bridge", "canon"],
      markdownContent: `# ${vignetteTitle}\n\n${markdownProse}`,
      createdAt: new Date().toISOString().split("T")[0],
      lastModified: new Date().toISOString().split("T")[0],
      wordCount: markdownProse.split(/\s+/).filter(Boolean).length,
    };

    // 3. Mark gap as resolved
    const updatedGaps = (project.plotGapReport?.plotGaps || []).map((g) =>
      g.id === gapId ? { ...g, status: "resolved" as const } : g
    );

    setProject({
      ...project,
      timelineEvents: [...project.timelineEvents, newEvent as any],
      wikiArticles: [newArticle, ...project.wikiArticles],
      plotGapReport: project.plotGapReport
        ? {
            ...project.plotGapReport,
            plotGaps: updatedGaps,
          }
        : undefined,
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleGenerateBridge = async (gap: PlotGap) => {
    setBridgingGapId(gap.id);
    setGeneratedBridgeResult(null);

    try {
      const res = await aiFetch("/api/ai/generate-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gapTitle: gap.title,
          explanation: gap.explanation,
          affectedEntities: gap.affectedEntities,
          context: {
            characters: project.characters,
            recentEvents: project.timelineEvents.slice(-5),
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate narrative bridge");
      }

      const data = await res.json();
      setGeneratedBridgeResult({
        gapId: gap.id,
        vignetteTitle: data.vignetteTitle,
        markdownProse: data.markdownProse,
        timelineEvent: data.timelineEvent,
      });
    } catch (err: any) {
      alert("Error generating bridge: " + err.message);
    } finally {
      setBridgingGapId(null);
    }
  };

  const handleApplyBridge = (gapId: string) => {
    if (!generatedBridgeResult) return;

    insertBridgeIntoProject(
      generatedBridgeResult.vignetteTitle,
      generatedBridgeResult.markdownProse,
      generatedBridgeResult.timelineEvent || null,
      gapId
    );

    setGeneratedBridgeResult(null);
  };

  const handleOpenManualBridge = (gap: PlotGap) => {
    setManualBridgeGapId(gap.id);
    setManualBridgeTitle(`Bridging Scene: ${gap.title}`);
    setManualBridgeProse("");
  };

  const handleCancelManualBridge = () => {
    setManualBridgeGapId(null);
    setManualBridgeTitle("");
    setManualBridgeProse("");
  };

  const handleCommitManualBridge = (gap: PlotGap) => {
    const prose = manualBridgeProse.trim();
    if (prose.length === 0) {
      return;
    }

    insertBridgeIntoProject(
      manualBridgeTitle.trim() || `Bridging Scene: ${gap.title}`,
      prose,
      null,
      gap.id
    );

    handleCancelManualBridge();
  };

  const toggleGapStatus = (gapId: string) => {
    if (!project.plotGapReport) return;
    const updatedGaps = project.plotGapReport.plotGaps.map((g) =>
      g.id === gapId
        ? { ...g, status: g.status === "open" ? ("resolved" as const) : ("open" as const) }
        : g
    );
    setProject({
      ...project,
      plotGapReport: {
        ...project.plotGapReport,
        plotGaps: updatedGaps,
      },
      lastUpdated: new Date().toISOString(),
    });
  };

  const filteredGaps = (report?.plotGaps || []).filter((g) => {
    if (activeTab === "all") return true;
    return g.status === activeTab;
  });

  const openCount = (report?.plotGaps || []).filter((g) => g.status === "open").length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Cohesion Meter */}
      <div
        id="plot-gap-banner"
        className={`rounded-2xl border p-6 sm:p-8 shadow-sm ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-100/70 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Diagnostic Info */}
          <div className="md:col-span-8 space-y-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="font-serif font-bold text-xl sm:text-2xl">
                Narrative Consistency & Plot Gap Doctor
              </h2>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed opacity-85">
              {isAiMode ? (
                <>
                  Audits character emotional trajectories, timeline paradoxes, and sudden
                  relationship flips across your RimWorld playthrough. Suggests seamless literary
                  bridge scenes to guarantee a page-turning novel.
                </>
              ) : (
                <>
                  Runs a deterministic local scan for dead wiki links, orphaned articles, loner
                  characters, missing timeline appearances, and pending drafts. Write your own
                  bridging scenes to patch any gaps — no AI required.
                </>
              )}
            </p>

            {!isAiMode && (
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-[11px] text-orange-200 flex items-start space-x-2">
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Offline Mode — findings are computed locally with rule-based checks (dead
                  links, orphans, loners, missing appearances, pending drafts, cultural
                  friction). Bridging is done by hand via the built-in editor.
                </span>
              </div>
            )}

            {report?.literaryToneAssessment && (
              <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 text-xs italic opacity-90">
                <span className="font-bold font-serif not-italic block mb-1 text-amber-400">
                  Literary Assessment:
                </span>
                "{report.literaryToneAssessment}"
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                id="btn-scan-plot-gaps"
                onClick={handleRunScan}
                disabled={isScanning}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-transform active:scale-95 ${
                  theme === "dark"
                    ? "bg-purple-600 hover:bg-purple-500 text-white"
                    : theme === "parchment"
                    ? "bg-purple-800 hover:bg-purple-700 text-purple-50"
                    : "bg-purple-600 hover:bg-purple-500 text-white"
                }`}
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Auditing World Canon...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Run Narrative Health Scan</span>
                  </>
                )}
              </button>

              {report?.analyzedAt && (
                <span className="text-[11px] font-mono opacity-50">
                  Last scan: {new Date(report.analyzedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {scanError && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                {scanError}
              </p>
            )}
          </div>

          {/* Score Gauge */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-black/30 border border-white/5 text-center">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-white/10"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="45"
                  stroke={
                    (report?.overallConsistencyScore || 85) > 80
                      ? "#10b981"
                      : (report?.overallConsistencyScore || 85) > 60
                      ? "#f59e0b"
                      : "#ef4444"
                  }
                  strokeWidth="8"
                  strokeDasharray={282}
                  strokeDashoffset={282 - (282 * (report?.overallConsistencyScore || 85)) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                  fill="transparent"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-bold font-mono">
                  {report?.overallConsistencyScore || 88}%
                </span>
                <span className="text-[9px] font-mono opacity-60 block uppercase tracking-wider">
                  Cohesion
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold mt-2">
              {openCount === 0 ? "Narrative Fully Cohesive" : `${openCount} Plot Gaps Detected`}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs & Gap List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab("open")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "open"
                  ? "bg-amber-500 text-slate-950"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              Open Gaps ({openCount})
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "resolved"
                  ? "bg-emerald-500 text-slate-950"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              Resolved ({ (report?.plotGaps || []).filter((g) => g.status === "resolved").length })
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "all"
                  ? "bg-slate-700 text-white"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              All ({report?.plotGaps.length || 0})
            </button>
          </div>
        </div>

        {/* Gaps Cards */}
        <div className="space-y-4">
          {filteredGaps.length === 0 ? (
            <div
              className={`text-center py-12 rounded-2xl border p-6 space-y-2 ${
                theme === "dark"
                  ? "bg-[#121215]/40 border-[#222228]"
                  : theme === "parchment"
                  ? "bg-amber-50/50 border-amber-200"
                  : "bg-slate-900/40 border-cyan-900"
              }`}
            >
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 opacity-60" />
              <h3 className="font-serif font-bold text-base">No {activeTab} plot gaps found</h3>
              <p className="text-xs opacity-60">
                Your chronicle timeline, characters, and wiki entries align smoothly.
              </p>
            </div>
          ) : (
            filteredGaps.map((gap) => {
              const isResolved = gap.status === "resolved";

              return (
                <div
                  key={gap.id}
                  id={`plot-gap-card-${gap.id}`}
                  className={`p-5 sm:p-6 rounded-2xl border transition-all space-y-4 ${
                    isResolved
                      ? "opacity-60 border-emerald-500/20 bg-emerald-950/10"
                      : gap.severity === "Critical"
                      ? "border-red-500/50 bg-red-950/20"
                      : gap.severity === "Warning"
                      ? "border-amber-500/40 bg-amber-950/20"
                      : theme === "dark"
                      ? "bg-[#121215] border-[#222228]"
                      : theme === "parchment"
                      ? "bg-amber-50/90 border-amber-200"
                      : "bg-slate-900/80 border-cyan-900"
                  }`}
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                            gap.severity === "Critical"
                              ? "bg-red-500/20 text-red-400"
                              : gap.severity === "Warning"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-purple-500/20 text-purple-400"
                          }`}
                        >
                          {gap.severity}
                        </span>
                        <span className="text-[10px] font-mono opacity-60 px-1.5 py-0.5 rounded bg-black/20">
                          {gap.type}
                        </span>
                        {gap.recommendedChapterPlacement && (
                          <span className="text-[10px] font-mono text-cyan-400">
                            • {gap.recommendedChapterPlacement}
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif font-bold text-base sm:text-lg">{gap.title}</h3>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleGapStatus(gap.id)}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                          isResolved
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "border-white/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isResolved ? "Resolved" : "Mark Resolved"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Explanation */}
                  <p className="text-xs sm:text-sm leading-relaxed opacity-90">
                    {gap.explanation}
                  </p>

                  {/* Affected Entities */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-mono text-[11px] opacity-60">Affected Entities:</span>
                    <div className="flex flex-wrap gap-1">
                      {gap.affectedEntities.map((ent) => (
                        <button
                          key={ent}
                          onClick={() => onNavigateToArticle(ent)}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 hover:bg-white/20 underline decoration-dotted"
                        >
                          [[{ent}]]
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Bridge Box */}
                  <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/30 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-[10px] uppercase font-bold text-purple-400 flex items-center space-x-1">
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>
                          {isAiMode ? "Suggested Dramatic Bridge:" : "Manual Bridging Scene:"}
                        </span>
                      </span>

                      {/* Bridge Generator Action */}
                      {isAiMode ? (
                        <button
                          id={`btn-bridge-gap-${gap.id}`}
                          onClick={() => handleGenerateBridge(gap)}
                          disabled={bridgingGapId === gap.id}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                            theme === "dark"
                              ? "bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
                              : theme === "parchment"
                              ? "bg-purple-800 hover:bg-purple-700 text-purple-50"
                              : "bg-purple-600 hover:bg-purple-500 text-white"
                          }`}
                        >
                          {bridgingGapId === gap.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Writing Vignette...</span>
                            </>
                          ) : (
                            <>
                              <Feather className="w-3 h-3" />
                              <span>Auto-Bridge with AI</span>
                            </>
                          )}
                        </button>
                      ) : manualBridgeGapId === gap.id ? null : (
                        <button
                          id={`btn-bridge-gap-${gap.id}`}
                          onClick={() => handleOpenManualBridge(gap)}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                            theme === "dark"
                              ? "bg-orange-600/90 hover:bg-orange-500 text-white shadow-sm"
                              : theme === "parchment"
                              ? "bg-orange-800 hover:bg-orange-700 text-orange-50"
                              : "bg-orange-600 hover:bg-orange-500 text-white"
                          }`}
                        >
                          <PenLine className="w-3 h-3" />
                          <span>Write Manual Bridge</span>
                        </button>
                      )}
                    </div>

                    <p className="italic opacity-85 leading-relaxed">
                      "{gap.suggestedBridge}"
                    </p>

                    {/* Manual Bridge Editor (Offline Mode) */}
                    {!isAiMode && manualBridgeGapId === gap.id && (
                      <div className="pt-2 space-y-2 animate-in fade-in">
                        <input
                          value={manualBridgeTitle}
                          onChange={(e) => setManualBridgeTitle(e.target.value)}
                          placeholder="Bridging scene title..."
                          className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                            theme === "dark"
                              ? "bg-black/40 border-white/10 focus:border-orange-500"
                              : theme === "parchment"
                              ? "bg-white/70 border-amber-300 focus:border-orange-600"
                              : "bg-slate-950/70 border-cyan-900 focus:border-orange-400"
                          } outline-none`}
                        />
                        <textarea
                          value={manualBridgeProse}
                          onChange={(e) => setManualBridgeProse(e.target.value)}
                          placeholder={
                            "Write the scene that patches this gap...\n\nIt becomes a Chronicle timeline event plus a 'Vignette:' wiki article."
                          }
                          rows={6}
                          className={`w-full px-3 py-2 rounded-lg text-xs leading-relaxed border resize-y ${
                            theme === "dark"
                              ? "bg-black/40 border-white/10 focus:border-orange-500"
                              : theme === "parchment"
                              ? "bg-white/70 border-amber-300 focus:border-orange-600"
                              : "bg-slate-950/70 border-cyan-900 focus:border-orange-400"
                          } outline-none font-mono`}
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={handleCancelManualBridge}
                            className="px-3 py-1 rounded-lg text-xs border border-white/10 opacity-70 hover:opacity-100"
                          >
                            Cancel
                          </button>
                          <button
                            id={`btn-commit-manual-bridge-${gap.id}`}
                            onClick={() => handleCommitManualBridge(gap)}
                            disabled={manualBridgeProse.trim().length === 0}
                            title={
                              manualBridgeProse.trim().length === 0
                                ? "Write at least a sentence of prose first"
                                : "Insert into Timeline & Wiki"
                            }
                            className="px-3.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95"
                          >
                            Insert Into Timeline & Wiki
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Generated Bridge Preview Modal/Box */}
                  {generatedBridgeResult && generatedBridgeResult.gapId === gap.id && (
                    <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-950/20 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif font-bold text-sm text-amber-300">
                          ✨ Canonical Bridge Scene Generated: "{generatedBridgeResult.vignetteTitle}"
                        </h4>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          Ready to Commit
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-black/40 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap opacity-90 leading-relaxed border border-white/10">
                        {generatedBridgeResult.markdownProse}
                      </div>

                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          onClick={() => setGeneratedBridgeResult(null)}
                          className="px-3 py-1 rounded-lg text-xs border border-white/10 opacity-70 hover:opacity-100"
                        >
                          Dismiss
                        </button>
                        <button
                          id={`btn-apply-bridge-${gap.id}`}
                          onClick={() => handleApplyBridge(gap.id)}
                          className="px-3.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
                        >
                          Insert Into Timeline & Wiki
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Novelization Tips Card */}
        {report?.novelizationTips && report.novelizationTips.length > 0 && (
          <div
            className={`p-6 rounded-2xl border space-y-3 ${
              theme === "dark"
                ? "bg-[#121215]/60 border-[#222228]"
                : theme === "parchment"
                ? "bg-amber-50/80 border-amber-200"
                : "bg-slate-900/60 border-cyan-900"
            }`}
          >
            <h4 className="font-serif font-bold text-sm flex items-center space-x-2 text-amber-400">
              <Feather className="w-4 h-4" />
              <span>Storyteller Novelization Advice</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {report.novelizationTips.map((tip, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1">
                  <span className="font-mono text-[10px] opacity-50 font-bold block">
                    COACHING #{idx + 1}
                  </span>
                  <p className="opacity-85 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
