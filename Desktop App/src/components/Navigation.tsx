import React, { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  GitGraph,
  Clock,
  Sparkles,
  Feather,
  UploadCloud,
  Bot,
  Download,
  Moon,
  Sun,
  Palette,
  FileArchive,
  RefreshCw,
  MapPin,
  FolderOpen,
  WifiOff,
  ScrollText,
  Settings
} from "lucide-react";
import { ActiveTab, ThemeMode, StoryProject } from "../types";
import { AIModelPicker } from "./AI/AIModelPicker";
import { LexiconMode, LEXICON_OPTIONS, useLexicon } from "../lib/lexicon";
import { selectClasses } from "../lib/uiTheme";

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  project: StoryProject;
  isAiMode: boolean;
  setIsAiMode: (next: boolean) => void;
  lexiconMode: LexiconMode;
  setLexiconMode: (mode: LexiconMode) => void;
  onOpenIngestModal: () => void;
  onExportZip: () => void;
  onOpenLibrary: () => void;
  onResetToSample?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  theme,
  setTheme,
  project,
  isAiMode,
  setIsAiMode,
  lexiconMode,
  setLexiconMode,
  onOpenIngestModal,
  onExportZip,
  onOpenLibrary,
}) => {
  const lex = useLexicon();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  // Close the settings popover on outside click or Escape.
  useEffect(() => {
    if (!isSettingsOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSettingsOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSettingsOpen]);

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "wiki",
      label: "World Wiki",
      icon: <BookOpen className="w-4 h-4" />,
      badge: project.wikiArticles.length,
    },
    {
      id: "network",
      label: "Social Web",
      icon: <GitGraph className="w-4 h-4" />,
      badge: project.characters.length,
    },
    {
      id: "timeline",
      label: lex.t("chronicleTab"),
      icon: <Clock className="w-4 h-4" />,
      badge: project.timelineEvents.length,
    },
    {
      id: "ideology",
      label: "Ideology",
      icon: <ScrollText className="w-4 h-4" />,
      badge: project.preceptMatrices.length,
    },
    {
      id: "plotgap",
      label: "Plot Doctor & Gaps",
      icon: <Sparkles className="w-4 h-4" />,
      badge: project.plotGapReport?.plotGaps.filter((g) => g.status === "open").length,
    },
    {
      id: "novel",
      label: "Novel Studio",
      icon: <Feather className="w-4 h-4" />,
    },
    // Archivist AI chat requires AI Mode — hidden entirely when offline.
    ...(isAiMode
      ? [
          {
            id: "chronicler" as ActiveTab,
            label: "Archivist AI",
            icon: <Bot className="w-4 h-4" />,
          },
        ]
      : []),
  ];

  return (
    <header
      id="main-app-header"
      className={`border-b transition-colors duration-200 sticky top-0 z-40 backdrop-blur-md ${
        theme === "dark"
          ? "bg-[#0c0c0e]/95 border-[#222228] text-[#e2e8f0]"
          : theme === "parchment"
          ? "bg-[#fbf7ee]/95 border-amber-200 text-stone-900"
          : "bg-slate-900/90 border-cyan-900/50 text-cyan-50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-16 flex-wrap py-1.5 gap-x-4 gap-y-1">
          {/* Brand & Project Info */}
          <div className="flex items-center space-x-3 shrink-0">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm ${
                theme === "dark"
                  ? "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-[#0c0c0e] shadow-amber-500/10"
                  : theme === "parchment"
                  ? "bg-amber-700 text-amber-50 shadow-amber-900/20"
                  : "bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 shadow-cyan-500/20"
              }`}
            >
              <span className="tracking-tighter font-serif">RΨ</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base tracking-tight truncate max-w-[200px] sm:max-w-xs">
                  {project.title}
                </span>
                <span
                  className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border font-semibold ${
                    theme === "dark"
                      ? "bg-[#141418] text-amber-400 border-amber-500/30"
                      : theme === "parchment"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-cyan-950 text-cyan-300 border-cyan-500/30"
                  }`}
                >
                  RimWiki .md
                </span>
              </div>
              <p className="text-xs opacity-60 truncate max-w-[180px] sm:max-w-xs hidden sm:block">
                Storyteller World-Building & Novel Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center flex-wrap gap-x-1 gap-y-1 py-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                    isActive
                      ? theme === "dark"
                        ? "bg-[#18181d] text-amber-400 border border-[#2a2a34] shadow-inner font-semibold"
                        : theme === "parchment"
                        ? "bg-amber-200/80 text-amber-950 font-bold border border-amber-300"
                        : "bg-cyan-950/80 text-cyan-300 border border-cyan-700 shadow-inner"
                      : theme === "dark"
                      ? "text-zinc-400 hover:text-zinc-100 hover:bg-[#151519]"
                      : theme === "parchment"
                      ? "text-stone-600 hover:text-stone-900 hover:bg-amber-100/60"
                      : "text-cyan-400/70 hover:text-cyan-200 hover:bg-slate-800/50"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                        isActive
                          ? theme === "dark"
                            ? "bg-amber-500/20 text-amber-300"
                            : theme === "parchment"
                            ? "bg-amber-800 text-amber-100"
                            : "bg-cyan-500/30 text-cyan-200"
                          : theme === "dark"
                          ? "bg-[#1c1c22] text-zinc-400"
                          : theme === "parchment"
                          ? "bg-amber-100 text-stone-700"
                          : "bg-slate-800 text-cyan-400"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Action Buttons: Library, AI Provider, Ingest, Export, Theme, Presets */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Saved Wikis / Library */}
            <button
              id="btn-open-library"
              onClick={onOpenLibrary}
              className={`flex items-center space-x-1.5 p-2 rounded-lg text-xs font-medium border transition-colors ${
                theme === "dark"
                  ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e] hover:text-white"
                  : theme === "parchment"
                  ? "border-amber-300 text-stone-700 hover:bg-amber-200/50"
                  : "border-cyan-900 text-cyan-300 hover:bg-cyan-950/60"
              }`}
              title="Start a new wiki or switch between your saved playthroughs"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden lg:inline">Wikis</span>
            </button>

            {/* OpenCode Provider / Model Picker (AI Mode only) */}
            <div className="hidden md:block">
              {isAiMode ? (
                <AIModelPicker theme={theme} />
              ) : (
                <div
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold ${
                    theme === "dark"
                      ? "bg-[#141418] text-zinc-400 border-[#25252e]"
                      : theme === "parchment"
                      ? "bg-amber-100 text-stone-600 border-amber-300"
                      : "bg-slate-950 text-cyan-400/80 border-cyan-900"
                  }`}
                  title="AI features are disabled — the app runs fully offline as a local-first markdown wiki"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline Mode</span>
                </div>
              )}
            </div>

            {/* Ingest Logs Button */}
            <button
              id="btn-ingest-logs-header"
              onClick={onOpenIngestModal}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-transform active:scale-95 ${
                theme === "dark"
                  ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e] font-bold"
                  : theme === "parchment"
                  ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
              }`}
              title="Ingest raw text/playthrough logs to auto-extract wiki & characters"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Ingest Logs</span>
            </button>

            {/* Export Markdown Zip */}
            <button
              id="btn-export-markdown-zip"
              onClick={onExportZip}
              className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                theme === "dark"
                  ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e] hover:text-white"
                  : theme === "parchment"
                  ? "border-amber-300 text-stone-700 hover:bg-amber-200/50"
                  : "border-cyan-900 text-cyan-300 hover:bg-cyan-950/60"
              }`}
              title="Export Markdown Wiki (.zip, novel manuscript, JSON backup)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Settings Popover: Appearance, AI Mode, Native Lexicon */}
            <div className="relative" ref={settingsRef}>
              <button
                id="btn-open-settings"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                  isSettingsOpen
                    ? theme === "dark"
                      ? "border-amber-500/40 bg-[#18181e] text-amber-400"
                      : theme === "parchment"
                      ? "border-amber-400 bg-amber-200/60 text-stone-900"
                      : "border-cyan-600 bg-cyan-950/60 text-cyan-300"
                    : theme === "dark"
                    ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e] hover:text-white"
                    : theme === "parchment"
                    ? "border-amber-300 text-stone-700 hover:bg-amber-200/50"
                    : "border-cyan-900 text-cyan-300 hover:bg-cyan-950/60"
                }`}
                title="Appearance, AI Mode & Native Lexicon"
              >
                <Settings className={`w-4 h-4 transition-transform ${isSettingsOpen ? "rotate-90" : ""}`} />
              </button>

              {isSettingsOpen && (
                <div
                  id="settings-popover"
                  className={`absolute right-0 top-full mt-2 z-50 w-72 p-4 rounded-xl border shadow-2xl space-y-4 ${
                    theme === "dark"
                      ? "bg-[#17171d] border-[#26262f] text-[#e2e8f0]"
                      : theme === "parchment"
                      ? "bg-amber-50 border-amber-300 text-stone-900"
                      : "bg-slate-900 border-cyan-800 text-cyan-50"
                  }`}
                >
                  <span className="text-[10px] font-mono uppercase opacity-60 block">Settings</span>

                  {/* Appearance */}
                  <div>
                    <label className="text-[10px] font-mono uppercase opacity-60 block mb-1.5">Appearance</label>
                    <div
                      className={`flex items-center rounded-lg p-0.5 border ${
                        theme === "dark"
                          ? "bg-[#121216] border-[#222228]"
                          : theme === "parchment"
                          ? "bg-amber-100 border-amber-300"
                          : "bg-slate-900 border-cyan-900"
                      }`}
                    >
                      <button
                        id="btn-theme-dark"
                        onClick={() => setTheme("dark")}
                        className={`p-1.5 rounded text-xs transition-colors ${
                          theme === "dark"
                            ? "bg-[#1f1f26] text-amber-400 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                        title="Sophisticated Dark Mode"
                      >
                        <Moon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id="btn-theme-parchment"
                        onClick={() => setTheme("parchment")}
                        className={`p-1.5 rounded text-xs transition-colors ${
                          theme === "parchment"
                            ? "bg-amber-200 text-amber-950 shadow-sm font-bold"
                            : "text-stone-400 hover:text-stone-700"
                        }`}
                        title="Archival Parchment Light Mode"
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id="btn-theme-cyber"
                        onClick={() => setTheme("cyber")}
                        className={`p-1.5 rounded text-xs transition-colors ${
                          theme === "cyber"
                            ? "bg-cyan-950 text-cyan-300 shadow-sm"
                            : "text-cyan-700 hover:text-cyan-400"
                        }`}
                        title="Cryo Stasis Cyan Mode"
                      >
                        <Palette className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* AI Mode */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono uppercase opacity-60">AI Mode</span>
                    <button
                      id="btn-ai-mode-toggle"
                      onClick={() => setIsAiMode(!isAiMode)}
                      className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        isAiMode
                          ? theme === "dark"
                            ? "border-purple-500/40 bg-purple-950/40 text-purple-300 hover:bg-purple-900/50"
                            : theme === "parchment"
                            ? "border-purple-400 bg-purple-100 text-purple-900 hover:bg-purple-200"
                            : "border-purple-500/60 bg-purple-950/60 text-purple-300 hover:bg-purple-900"
                          : theme === "dark"
                          ? "border-[#25252e] bg-[#141418] text-zinc-500 hover:text-zinc-300"
                          : theme === "parchment"
                          ? "border-stone-300 bg-stone-100 text-stone-500 hover:text-stone-700"
                          : "border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300"
                      }`}
                      title={
                        isAiMode
                          ? "AI Mode is ON — click to disable AI and run fully offline (Archivist AI, log ingestion & AI drafting hidden)"
                          : "AI Mode is OFF — click to re-enable AI features (Archivist AI chat, log ingestion, AI novelization)"
                      }
                    >
                      <span
                        className={`relative inline-block w-7 h-3.5 rounded-full transition-colors ${
                          isAiMode ? "bg-purple-500" : "bg-current opacity-30"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${
                            isAiMode ? "left-[16px]" : "left-0.5 opacity-80"
                          }`}
                        />
                      </span>
                      <span>{isAiMode ? "AI Mode" : "Offline"}</span>
                    </button>
                  </div>

                  {/* Native Lexicon */}
                  <div>
                    <label
                      htmlFor="select-native-lexicon"
                      className="text-[10px] font-mono uppercase opacity-60 block mb-1"
                    >
                      Native Lexicon
                    </label>
                    <select
                      id="select-native-lexicon"
                      value={lexiconMode}
                      onChange={(e) => setLexiconMode(e.target.value as LexiconMode)}
                      className={`w-full px-2.5 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
                      title="Swap UI terminology between genre lexicons — data & functionality are untouched"
                    >
                      {LEXICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] opacity-50 italic mt-1.5 leading-snug">
                      Swaps UI wording — saves, links & timelines are untouched.
                      Attribute slots relabel to the genre preset (rename yours to pin them).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
