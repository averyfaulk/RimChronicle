import React, { useState, useMemo } from "react";
import { aiFetch } from "../../lib/aiClient";
import {
  Feather,
  BookOpen,
  Plus,
  Edit3,
  Sparkles,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Check,
  Clock,
  Eye,
  FileText,
  Layers,
  Flame,
  Bookmark,
  Scale,
  AlertTriangle
} from "lucide-react";
import {
  StoryAct,
  StoryChapter,
  StoryScene,
  ThemeMode,
  StoryProject
} from "../../types";
import { selectClasses } from "../../lib/uiTheme";
import { EntityLookup } from "../../lib/wikiParser";
import { MarkdownRenderer } from "../Wiki/MarkdownRenderer";
import { downloadBlob } from "../../lib/zipExporter";
import { extractCanonViolations, CanonViolation } from "../../lib/canonEngine";
import { CanonConstraintManagerModal } from "./CanonConstraintManagerModal";
import { getTaxonomy } from "../../lib/taxonomy";

interface NovelizationStudioProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  lookup: EntityLookup;
  isAiMode: boolean;
  onNavigateToArticle: (title: string) => void;
}

export const NovelizationStudio: React.FC<NovelizationStudioProps> = ({
  project,
  setProject,
  theme,
  lookup,
  isAiMode,
  onNavigateToArticle,
}) => {
  const [selectedActId, setSelectedActId] = useState<string>(
    project.storyHierarchy[0]?.id || ""
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    project.storyHierarchy[0]?.chapters[0]?.id || ""
  );
  const [viewFullManuscript, setViewFullManuscript] = useState(false);

  // Editor state
  const [isEditingChapter, setIsEditingChapter] = useState(false);
  const [draftContent, setDraftContent] = useState("");

  // AI Generator modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [stylePreset, setStylePreset] = useState("Grimdark Sci-Fi (Atmospheric, gritty, visceral survival)");
  const [customStyleNotes, setCustomStyleNotes] = useState("Emphasize psychological dread, sub-zero frostbite, and fierce loyalty under fire.");
  const [pointOfView, setPointOfView] = useState("Third Person Limited (focusing on Dr. Valerie Vance)");
  const [wordCountTarget, setWordCountTarget] = useState("1000-1500 words");
  const [isWritingChapter, setIsWritingChapter] = useState(false);
  const [writerError, setWriterError] = useState("");

  // Drag and drop / hierarchy edit modals
  const [isAddChapterModalOpen, setIsAddChapterModalOpen] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterSummary, setNewChapterSummary] = useState("");

  // Canon Constraint Panel state
  const [isCanonModalOpen, setIsCanonModalOpen] = useState(false);
  const [violationBanner, setViolationBanner] = useState<CanonViolation[] | null>(null);

  const currentAct = useMemo(() => {
    return project.storyHierarchy.find((a) => a.id === selectedActId) || project.storyHierarchy[0];
  }, [project.storyHierarchy, selectedActId]);

  const currentChapter = useMemo(() => {
    if (!currentAct) return null;
    return (
      currentAct.chapters.find((c) => c.id === selectedChapterId) ||
      currentAct.chapters[0] ||
      null
    );
  }, [currentAct, selectedChapterId]);

  const totalWords = useMemo(() => {
    let count = 0;
    project.storyHierarchy.forEach((a) => {
      a.chapters.forEach((c) => {
        if (c.fullChapterMarkdown) {
          count += c.fullChapterMarkdown.trim().split(/\s+/).filter(Boolean).length;
        }
      });
    });
    return count;
  }, [project.storyHierarchy]);

  const enabledConstraints = useMemo(
    () => (project.canonConstraints ?? []).filter((c) => c.isEnabled),
    [project.canonConstraints]
  );

  const chapterViolations = useMemo(() => {
    const map = new Map<string, CanonViolation[]>();
    project.storyHierarchy.forEach((act) =>
      act.chapters.forEach((chap) => {
        const text = chap.fullChapterMarkdown || "";
        if (!text.trim()) return;
        const hits = extractCanonViolations(text, enabledConstraints);
        if (hits.length > 0) map.set(chap.id, hits);
      })
    );
    return map;
  }, [project.storyHierarchy, enabledConstraints]);

  const totalViolations = useMemo(
    () =>
      Array.from(chapterViolations.values()).reduce(
        (sum, list) => sum + list.length,
        0
      ),
    [chapterViolations]
  );

  const draftViolations = useMemo(
    () =>
      isEditingChapter
        ? extractCanonViolations(draftContent, enabledConstraints)
        : [],
    [draftContent, enabledConstraints, isEditingChapter]
  );

  const handleSelectChapter = (actId: string, chapId: string) => {
    setSelectedActId(actId);
    setSelectedChapterId(chapId);
    setViewFullManuscript(false);
    setIsEditingChapter(false);
    setViolationBanner(null);
  };

  const handleStartEdit = () => {
    if (!currentChapter) return;
    setDraftContent(currentChapter.fullChapterMarkdown || `# ${currentChapter.title}\n\n_${currentChapter.summary}_\n\nBegin writing scene prose here...`);
    setIsEditingChapter(true);
  };

  const handleSaveChapter = () => {
    if (!currentAct || !currentChapter) return;

    const words = draftContent.trim().split(/\s+/).filter(Boolean).length;

    const updatedHierarchy = project.storyHierarchy.map((act) => {
      if (act.id === currentAct.id) {
        return {
          ...act,
          chapters: act.chapters.map((chap) => {
            if (chap.id === currentChapter.id) {
              return {
                ...chap,
                fullChapterMarkdown: draftContent,
                wordCount: words,
                isDrafted: true,
              };
            }
            return chap;
          }),
        };
      }
      return act;
    });

    setProject({
      ...project,
      storyHierarchy: updatedHierarchy,
      lastUpdated: new Date().toISOString(),
    });

    setViolationBanner(draftViolations.length > 0 ? draftViolations : null);
    setIsEditingChapter(false);
  };

  const handleAddChapter = () => {
    if (!currentAct || !newChapterTitle.trim()) return;

    const newChap: StoryChapter = {
      id: `chap-${Date.now()}`,
      title: newChapterTitle.trim(),
      summary: newChapterSummary.trim() || "Chronicle chapter draft.",
      scenes: [],
      isDrafted: false,
      wordCount: 0,
      fullChapterMarkdown: `# ${newChapterTitle.trim()}\n\n_${newChapterSummary.trim()}_\n\n*(Chapter awaiting draft)*`,
    };

    const updatedHierarchy = project.storyHierarchy.map((act) => {
      if (act.id === currentAct.id) {
        return {
          ...act,
          chapters: [...act.chapters, newChap],
        };
      }
      return act;
    });

    setProject({
      ...project,
      storyHierarchy: updatedHierarchy,
      lastUpdated: new Date().toISOString(),
    });

    setSelectedChapterId(newChap.id);
    setIsAddChapterModalOpen(false);
    setNewChapterTitle("");
    setNewChapterSummary("");
  };

  const handleMoveChapter = (actId: string, chapIndex: number, direction: "up" | "down") => {
    const updatedHierarchy = project.storyHierarchy.map((act) => {
      if (act.id === actId) {
        const chaps = [...act.chapters];
        const targetIndex = direction === "up" ? chapIndex - 1 : chapIndex + 1;
        if (targetIndex >= 0 && targetIndex < chaps.length) {
          const temp = chaps[chapIndex];
          chaps[chapIndex] = chaps[targetIndex];
          chaps[targetIndex] = temp;
        }
        return { ...act, chapters: chaps };
      }
      return act;
    });

    setProject({
      ...project,
      storyHierarchy: updatedHierarchy,
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleDeleteChapter = (actId: string, chapId: string) => {
    if (!window.confirm("Are you sure you want to delete this chapter?")) return;

    const updatedHierarchy = project.storyHierarchy.map((act) => {
      if (act.id === actId) {
        return {
          ...act,
          chapters: act.chapters.filter((c) => c.id !== chapId),
        };
      }
      return act;
    });

    setProject({
      ...project,
      storyHierarchy: updatedHierarchy,
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleAiNovelize = async () => {
    if (!currentAct || !currentChapter) return;
    setIsWritingChapter(true);
    setWriterError("");

    try {
      const res = await aiFetch("/api/ai/novelize-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterTitle: currentChapter.title,
          actTitle: currentAct.title,
          selectedEvents: project.timelineEvents.slice(0, 6),
          includedCharacters: project.characters,
          stylePreset,
          customStyleInstructions: customStyleNotes,
          pointOfView,
          wordCountTarget,
          ...(enabledConstraints.length > 0
            ? {
                canonConstraints: enabledConstraints.map((c) => ({
                  title: c.title,
                  ruleStatement: c.ruleStatement,
                })),
              }
            : {}),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to write chapter with AI");
      }

      const data = await res.json();
      if (data.novelContent) {
        const words = data.novelContent.trim().split(/\s+/).filter(Boolean).length;
        const updatedHierarchy = project.storyHierarchy.map((act) => {
          if (act.id === currentAct.id) {
            return {
              ...act,
              chapters: act.chapters.map((c) =>
                c.id === currentChapter.id
                  ? {
                      ...c,
                      fullChapterMarkdown: data.novelContent,
                      wordCount: words,
                      isDrafted: true,
                    }
                  : c
              ),
            };
          }
          return act;
        });

        setProject({
          ...project,
          storyHierarchy: updatedHierarchy,
          lastUpdated: new Date().toISOString(),
        });
        const generatedViolations = extractCanonViolations(
          data.novelContent,
          enabledConstraints
        );
        setViolationBanner(
          generatedViolations.length > 0 ? generatedViolations : null
        );
        setIsAiModalOpen(false);
      }
    } catch (err: any) {
      setWriterError(err.message || "Failed to generate novel chapter");
    } finally {
      setIsWritingChapter(false);
    }
  };

  const compiledFullManuscript = useMemo(() => {
    let full = `# ${project.title}\n_${project.subtitle}_\n\n---\n\n`;
    project.storyHierarchy.forEach((act, actIdx) => {
      full += `# ${act.title}\n*Theme: ${act.theme}*\n\n`;
      act.chapters.forEach((chap) => {
        full += `${chap.fullChapterMarkdown || `## ${chap.title}\n_${chap.summary}_\n`}\n\n---\n\n`;
      });
    });
    return full;
  }, [project]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Hierarchy Tree: Acts -> Chapters */}
      <aside
        id="story-hierarchy-sidebar"
        className={`lg:col-span-4 rounded-2xl border p-4 space-y-4 shadow-sm ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-100/70 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h3 className="font-serif font-bold text-sm sm:text-base flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Manuscript Hierarchy</span>
            </h3>
            <span className="text-[11px] font-mono opacity-60">
              {totalWords} total manuscript words
            </span>
          </div>

          <button
            onClick={() => setViewFullManuscript(!viewFullManuscript)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              viewFullManuscript
                ? "bg-amber-500 text-[#0c0c0e] font-bold"
                : "border-white/10 opacity-75 hover:opacity-100"
            }`}
          >
            {viewFullManuscript ? "Chapter View" : "Full Book"}
          </button>
        </div>

        {/* Canon Constraint Panel launcher */}
        <button
          id="btn-canon-constraints"
          onClick={() => setIsCanonModalOpen(true)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
            theme === "dark"
              ? "bg-[#17171d] border-[#22222b] hover:border-red-500/40"
              : theme === "parchment"
              ? "bg-amber-100/60 border-amber-200 hover:border-red-400/60"
              : "bg-slate-900/70 border-cyan-900 hover:border-red-400/50"
          }`}
          title="Define absolute world laws the scanner enforces on every draft"
        >
          <span className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-red-400" />
            <span>Canon Constraints</span>
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="opacity-60">
              {enabledConstraints.length} law{enabledConstraints.length === 1 ? "" : "s"}
            </span>
            {totalViolations > 0 ? (
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
                ⚠ {totalViolations}
              </span>
            ) : (
              <Check className="w-3 h-3 text-emerald-400" />
            )}
          </span>
        </button>

        {/* Acts & Chapters List with Drag / Reorder buttons */}
        <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
          {project.storyHierarchy.map((act, actIdx) => (
            <div key={act.id} className="space-y-2">
              {/* Act Header */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-400 block">
                    Act {actIdx + 1}
                  </span>
                  <h4 className="font-serif font-bold text-xs sm:text-sm">{act.title}</h4>
                </div>

                <button
                  onClick={() => {
                    setSelectedActId(act.id);
                    setIsAddChapterModalOpen(true);
                  }}
                  className="p-1 rounded-lg border border-white/10 hover:bg-white/10 text-xs"
                  title="Add Chapter to this Act"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chapters in this Act */}
              <div className="pl-2 space-y-1.5 border-l-2 border-white/10">
                {act.chapters.map((chap, chapIdx) => {
                  const isSelected =
                    !viewFullManuscript &&
                    selectedActId === act.id &&
                    selectedChapterId === chap.id;

                  return (
                    <div
                      key={chap.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all group ${
                        isSelected
                          ? theme === "dark"
                            ? "bg-[#1f1f28] border-amber-500/50 text-[#f1f5f9] shadow-sm"
                            : theme === "parchment"
                            ? "bg-amber-200/90 border-amber-400 text-stone-950 shadow-sm font-semibold"
                            : "bg-cyan-950 border-cyan-400 text-cyan-50 shadow-sm"
                          : theme === "dark"
                          ? "bg-[#0e0e12]/60 border-[#1f1f26] text-[#cbd5e1] hover:bg-[#181820]"
                          : theme === "parchment"
                          ? "bg-amber-50/70 border-amber-200 text-stone-800 hover:bg-amber-100"
                          : "bg-slate-950/40 border-cyan-950 text-cyan-300/80 hover:bg-slate-800/40"
                      }`}
                    >
                      <button
                        onClick={() => handleSelectChapter(act.id, chap.id)}
                        className="text-left flex-1 min-w-0 pr-2"
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] font-mono opacity-50">
                            Ch {chapIdx + 1}:
                          </span>
                          <h5 className="font-serif font-bold text-xs truncate">{chap.title}</h5>
                        </div>
                        <span className="text-[10px] opacity-60 font-mono block truncate mt-0.5">
                          {chap.isDrafted ? `${chap.wordCount || 0} words • Drafted` : "Outline only"}
                        </span>
                      </button>

                      {/* Hierarchy Controls (Up/Down/Delete) */}
                      <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMoveChapter(act.id, chapIdx, "up")}
                          disabled={chapIdx === 0}
                          className="p-1 rounded hover:bg-white/10 disabled:opacity-20"
                          title="Move chapter up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveChapter(act.id, chapIdx, "down")}
                          disabled={chapIdx === act.chapters.length - 1}
                          className="p-1 rounded hover:bg-white/10 disabled:opacity-20"
                          title="Move chapter down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteChapter(act.id, chap.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400"
                          title="Delete chapter"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right Manuscript Pane: Chapter Reader / Live Editor */}
      <main
        id="novel-manuscript-pane"
        className={`lg:col-span-8 rounded-2xl border p-6 sm:p-8 shadow-sm space-y-6 min-h-[620px] ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-50/90 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        {viewFullManuscript ? (
          /* Full Book Manuscript Viewer */
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="font-serif font-bold text-xl sm:text-2xl">Complete Novel Manuscript</h3>
                <span className="text-xs font-mono opacity-60">
                  {totalWords} words • ~{Math.ceil(totalWords / 250)} min reading time
                </span>
              </div>

              <button
                id="btn-download-manuscript-md"
                onClick={() => {
                  const blob = new Blob([compiledFullManuscript], { type: "text/markdown;charset=utf-8" });
                  downloadBlob(blob, `${project.title.replace(/[/\\?%*:|"<>]/g, "-")}_Manuscript.md`);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                  theme === "dark"
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                    : theme === "parchment"
                    ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                    : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md Book</span>
              </button>
            </div>

            {totalViolations > 0 && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 space-y-1.5">
                <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Canon scan: {totalViolations} constraint{" "}
                  {totalViolations === 1 ? "violation" : "violations"} across the
                  manuscript
                </p>
                <div className="space-y-1">
                  {project.storyHierarchy.map((act) =>
                    act.chapters
                      .filter((chap) => chapterViolations.has(chap.id))
                      .map((chap) => {
                        const hits = chapterViolations.get(chap.id)!;
                        const uniqueLaws = Array.from(
                          new Set(hits.map((h) => h.constraintTitle))
                        );
                        return (
                          <button
                            key={chap.id}
                            onClick={() => handleSelectChapter(act.id, chap.id)}
                            className="block w-full text-left text-[11px] text-red-300/90 hover:text-red-200 hover:bg-red-500/10 rounded px-1.5 py-0.5"
                          >
                            <span className="font-semibold">{chap.title}</span>
                            {" — "}
                            {hits.length} hit{hits.length === 1 ? "" : "s"} (
                            {uniqueLaws.join(", ")})
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            )}

            <div className="pt-2">
              <MarkdownRenderer
                content={compiledFullManuscript}
                lookup={lookup}
                theme={theme}
                taxonomy={getTaxonomy(project)}
                onNavigateToArticle={onNavigateToArticle}
                canonConstraints={enabledConstraints}
              />
            </div>
          </div>
        ) : currentChapter ? (
          /* Individual Chapter Pane */
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-amber-400 block">
                  {currentAct?.title}
                </span>
                <h2 className="font-serif font-bold text-xl sm:text-2xl">{currentChapter.title}</h2>
                <span className="text-xs opacity-50 font-mono">
                  {currentChapter.wordCount || 0} words
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {/* AI Novelize Chapter — hidden in Offline Mode */}
                {isAiMode && (
                  <button
                    id="btn-ai-novelize-chapter"
                    onClick={() => setIsAiModalOpen(true)}
                    className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      theme === "dark"
                        ? "bg-purple-950/60 border-purple-800/60 text-purple-300 hover:bg-purple-900/80"
                        : theme === "parchment"
                        ? "bg-purple-100 border-purple-300 text-purple-900 hover:bg-purple-200"
                        : "bg-purple-950/60 border-purple-700 text-purple-300 hover:bg-purple-900"
                    }`}
                    title="Generate or adapt this chapter with AI author"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Dramatize with AI</span>
                  </button>
                )}

                {/* Edit / Save Chapter Toggle */}
                {isEditingChapter ? (
                  <button
                    id="btn-save-chapter-draft"
                    onClick={handleSaveChapter}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                      theme === "dark"
                        ? "bg-emerald-600 hover:bg-emerald-500 text-slate-950"
                        : theme === "parchment"
                        ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                        : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Chapter</span>
                  </button>
                ) : (
                  <button
                    id="btn-edit-chapter-draft"
                    onClick={handleStartEdit}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      theme === "dark"
                        ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                        : theme === "parchment"
                        ? "border-amber-300 text-stone-800 hover:bg-amber-100"
                        : "border-cyan-800 text-cyan-300 hover:bg-slate-800"
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Prose</span>
                  </button>
                )}
              </div>
            </div>

            {/* Constraint Violation Reminder Banner */}
            {violationBanner && violationBanner.length > 0 && (
              <div
                id="canon-violation-banner"
                className="flex items-start justify-between gap-3 p-3 rounded-xl border border-red-500/40 bg-red-500/10"
              >
                <div className="space-y-1 min-w-0">
                  {Array.from(
                    new Set(violationBanner.map((v) => v.reminderMessage))
                  )
                    .slice(0, 3)
                    .map((msg) => (
                      <p
                        key={msg}
                        className="text-xs font-bold text-red-400 flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Constraint Violation: {msg}
                      </p>
                    ))}
                  {violationBanner.length > 1 && (
                    <p className="text-[11px] text-red-300/80 font-mono">
                      {violationBanner.length} flagged sentence
                      {violationBanner.length === 2 ? "" : "s"} in this chapter —{" "}
                      {isEditingChapter
                        ? "listed below the editor"
                        : "highlighted in red"}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setViolationBanner(null)}
                  className="text-xs opacity-60 hover:opacity-100 shrink-0"
                  title="Dismiss reminder"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Chapter Editor or Markdown View */}
            {isEditingChapter ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs opacity-75 font-mono">
                  <span>Markdown Syntax Active • Use [[WikiLinks]] for Cross-Referencing</span>
                </div>
                <textarea
                  id="chapter-prose-editor"
                  rows={22}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className={`w-full p-4 rounded-xl font-serif text-sm sm:text-base border outline-none leading-relaxed resize-y ${
                    theme === "dark"
                      ? "bg-[#0c0c0e] border-[#222228] text-[#f1f5f9]"
                      : theme === "parchment"
                      ? "bg-amber-50 border-amber-300 text-stone-900"
                      : "bg-slate-950 border-cyan-900 text-cyan-50"
                  }`}
                  placeholder="Write chapter manuscript in literary Markdown..."
                />
                {draftViolations.length > 0 && (
                  <div className="space-y-1.5 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                    <p className="text-xs font-bold text-red-400 flex items-center gap-1.5 font-mono uppercase tracking-wide">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {draftViolations.length} live canon{" "}
                      {draftViolations.length === 1 ? "violation" : "violations"}
                    </p>
                    {draftViolations.slice(0, 8).map((v, i) => (
                      <div
                        key={`${v.constraintId}-${v.start}-${i}`}
                        className="text-xs leading-relaxed"
                      >
                        <span className="inline-block px-1.5 py-0.5 mr-1.5 rounded bg-red-500/20 text-red-300 text-[9px] uppercase font-mono font-bold align-middle">
                          {v.constraintTitle}
                        </span>
                        <span className="text-red-300/90 italic">
                          "{v.sentence.trim().slice(0, 160)}
                          {v.sentence.trim().length > 160 ? "…" : ""}"
                        </span>
                        <span className="block pl-1 opacity-80">
                          ⚠️ {v.reminderMessage}
                        </span>
                      </div>
                    ))}
                    {draftViolations.length > 8 && (
                      <p className="text-[10px] opacity-60 font-mono">
                        +{draftViolations.length - 8} more…
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : currentChapter.fullChapterMarkdown ? (
              <div className="pt-2">
                <MarkdownRenderer
                  content={currentChapter.fullChapterMarkdown}
                  lookup={lookup}
                  theme={theme}
                  taxonomy={getTaxonomy(project)}
                  onNavigateToArticle={onNavigateToArticle}
                  canonConstraints={enabledConstraints}
                />
              </div>
            ) : (
              <div className="text-center py-20 opacity-60 space-y-3">
                <Feather className="w-12 h-12 mx-auto opacity-40" />
                <h3 className="font-serif text-lg font-bold">Chapter Not Yet Drafted</h3>
                <p className="text-xs max-w-sm mx-auto opacity-80">
                  {currentChapter.summary}
                </p>
                <div className="pt-3 flex justify-center gap-2">
                  <button
                    onClick={handleStartEdit}
                    className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-white/10"
                  >
                    {isAiMode ? "Write Manually" : "Write Chapter Manually"}
                  </button>
                  {isAiMode && (
                    <button
                      onClick={() => setIsAiModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-500"
                    >
                      ✨ Dramatize with AI
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 opacity-60">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <h3 className="font-serif font-bold text-base">Select a Chapter</h3>
          </div>
        )}
      </main>

      {/* AI Novelize Chapter Modal */}
      {isAiModalOpen && (
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
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>AI Novelization Engine: "{currentChapter?.title}"</span>
              </h3>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-mono opacity-70 block mb-1">Literary Style Preset</label>
                <select
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl outline-none cursor-pointer ${selectClasses(theme)}`}
                >
                  <option value="Grimdark Sci-Fi (Atmospheric, gritty, visceral survival)">
                    Grimdark Sci-Fi (Dan Abnett style - visceral, tactical grit, intense)
                  </option>
                  <option value="Frontier Space Western (Hard-boiled, stoic, dust and plasteel)">
                    Frontier Space Western (Hard-boiled, stark, firefly atmosphere)
                  </option>
                  <option value="Psychological Drama (Deep colonist interiority, PTSD, trauma)">
                    Psychological Drama (Deep colonist interiority, breaks, trauma)
                  </option>
                  <option value="Archotech Gothic (Mystical, eerie machine cult, transhumanism)">
                    Archotech Gothic (Mystical, eerie machine gods, esoteric)
                  </option>
                </select>
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Point of View (POV)</label>
                <select
                  value={pointOfView}
                  onChange={(e) => setPointOfView(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl outline-none cursor-pointer ${selectClasses(theme)}`}
                >
                  <option value="Third Person Limited (focusing on Dr. Valerie Vance)">
                    Third Person Limited (Vex's perspective)
                  </option>
                  <option value="Third Person Limited (focusing on Cole Briggs)">
                    Third Person Limited (Cole's perspective)
                  </option>
                  <option value="Omniscient Rim Storyteller (Dramatic, cinematic overview)">
                    Omniscient Rim Storyteller (Cinematic chronicle)
                  </option>
                  <option value="First Person Colonist Journal">
                    First Person Colonist Field Journal
                  </option>
                </select>
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Target Word Count</label>
                <select
                  value={wordCountTarget}
                  onChange={(e) => setWordCountTarget(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl outline-none cursor-pointer ${selectClasses(theme)}`}
                >
                  <option value="600-900 words (Crisp vignette)">600-900 words (Crisp vignette)</option>
                  <option value="1000-1500 words (Full chapter)">1000-1500 words (Standard full chapter)</option>
                  <option value="1800-2500 words (Epic climax chapter)">1800-2500 words (Epic battle chapter)</option>
                </select>
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Custom Atmosphere / Focus Notes</label>
                <textarea
                  rows={2}
                  value={customStyleNotes}
                  onChange={(e) => setCustomStyleNotes(e.target.value)}
                  placeholder="e.g. Highlight sensory contrast of burning chemfuel against -40C ice..."
                  className="w-full px-3 py-2 rounded-xl border bg-black/20 outline-none"
                />
              </div>
            </div>

            {writerError && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                {writerError}
              </p>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                disabled={isWritingChapter}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAiNovelize}
                disabled={isWritingChapter}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                  theme === "dark"
                    ? "bg-purple-600 text-white hover:bg-purple-500"
                    : theme === "parchment"
                    ? "bg-purple-800 text-purple-50 hover:bg-purple-700"
                    : "bg-purple-600 text-white hover:bg-purple-500"
                }`}
              >
                {isWritingChapter ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Writing Novel Chapter...</span>
                  </>
                ) : (
                  <>
                    <Feather className="w-3.5 h-3.5" />
                    <span>Generate Chapter</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Canon Constraint Panel */}
      {isCanonModalOpen && (
        <CanonConstraintManagerModal
          project={project}
          setProject={setProject}
          theme={theme}
          isAiMode={isAiMode}
          onClose={() => setIsCanonModalOpen(false)}
        />
      )}

      {/* Add Chapter Modal */}
      {isAddChapterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
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
                <span>Add Chapter to "{currentAct?.title}"</span>
              </h3>
              <button
                onClick={() => setIsAddChapterModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-mono opacity-70 block mb-1">Chapter Title</label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 6: The Archotech Warhead"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-black/20 outline-none text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Scene Summary & Objectives</label>
                <textarea
                  rows={3}
                  placeholder="e.g. The colonists arm the EMP detonation sequence while fighting back-to-back in the smoke..."
                  value={newChapterSummary}
                  onChange={(e) => setNewChapterSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-black/20 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsAddChapterModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddChapter}
                disabled={!newChapterTitle.trim()}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                  theme === "dark"
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                    : theme === "parchment"
                    ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                    : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                }`}
              >
                Add Chapter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
