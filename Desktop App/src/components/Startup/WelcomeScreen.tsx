import React, { useState } from "react";
import { BookOpen, Clock, FolderOpen, Plus, Sparkles, Trash2, X, FileText } from "lucide-react";
import { ThemeMode } from "../../types";
import { WikiSummary, SAMPLE_WIKI_ID } from "../../lib/projectStore";
import { SAMPLE_PROJECT } from "../../data/samplePlaythroughs";

interface WelcomeScreenProps {
  theme: ThemeMode;
  wikis: WikiSummary[];
  /** false = launch picker (no close button); true = in-app library modal */
  canClose: boolean;
  onClose: () => void;
  onStartFresh: (title: string) => void;
  onOpenSample: () => void;
  onOpenWiki: (id: string) => void;
  onDeleteWiki: (id: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  theme,
  wikis,
  canClose,
  onClose,
  onStartFresh,
  onOpenSample,
  onOpenWiki,
  onDeleteWiki,
}) => {
  const [newTitle, setNewTitle] = useState("");

  const isDark = theme === "dark";
  const isParchment = theme === "parchment";

  const cardCls = isDark
    ? "bg-[#101014] border-[#25252d]"
    : isParchment
    ? "bg-amber-50 border-amber-300"
    : "bg-slate-950/80 border-cyan-900";
  const subtleCls = isDark
    ? "bg-[#0c0c0e]/60 border-[#222228] hover:border-[#3a3a46]"
    : isParchment
    ? "bg-amber-100/50 border-amber-200 hover:border-amber-400"
    : "bg-slate-950/40 border-cyan-900/60 hover:border-cyan-700";
  const primaryBtn =
    "flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl font-semibold text-sm transition-transform active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none " +
    (isDark
      ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
      : isParchment
      ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
      : "bg-cyan-500 hover:bg-cyan-400 text-slate-950");
  const secondaryBtn =
    "flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors " +
    (isDark
      ? "border-[#2a2a34] bg-[#16161a] text-zinc-200 hover:bg-[#1d1d24]"
      : isParchment
      ? "border-amber-400 bg-amber-200/60 text-stone-800 hover:bg-amber-200"
      : "border-cyan-800 bg-cyan-950/60 text-cyan-100 hover:bg-cyan-950");
  const inputCls =
    "w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors " +
    (isDark
      ? "bg-[#0c0c0e] border-[#25252d] text-[#e2e8f0] focus:border-amber-500"
      : isParchment
      ? "bg-white border-amber-300 text-stone-900 focus:border-amber-700"
      : "bg-slate-950 border-cyan-900 text-cyan-50 focus:border-cyan-400");

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const sampleArticles = SAMPLE_PROJECT.wikiArticles.length;
  const sampleEvents = SAMPLE_PROJECT.timelineEvents.length;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`relative w-full max-w-3xl rounded-2xl border shadow-2xl p-6 sm:p-8 ${cardCls}`}>
          {canClose && (
            <button
              onClick={onClose}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${
                isDark
                  ? "text-zinc-500 hover:text-zinc-200 hover:bg-[#18181d]"
                  : isParchment
                  ? "text-stone-500 hover:text-stone-900 hover:bg-amber-100"
                  : "text-cyan-600 hover:text-cyan-200 hover:bg-cyan-950"
              }`}
              title="Back to current wiki"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Brand */}
          <div className="flex items-center gap-3 mb-1">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm ${
                isDark
                  ? "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-[#0c0c0e]"
                  : isParchment
                  ? "bg-amber-700 text-amber-50"
                  : "bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950"
              }`}
            >
              <span className="tracking-tighter font-serif">RΨ</span>
            </div>
            <div>
              <h1 className="font-serif font-bold text-xl sm:text-2xl tracking-tight">RimChronicle</h1>
              <p className="text-xs opacity-60 font-mono">
                Storyteller World-Building &amp; Novel Engine — stored locally on this device
              </p>
            </div>
          </div>

          {/* New / Sample */}
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className={`rounded-xl border p-4 flex flex-col ${subtleCls}`}>
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4 opacity-70" />
                <h2 className="font-semibold text-sm">Begin a New Chronicle</h2>
              </div>
              <p className="text-xs opacity-60 mb-3 flex-1">
                Start with a blank world wiki and name your colony's story.
              </p>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTitle.trim()) onStartFresh(newTitle);
                }}
                placeholder="Name your chronicle…"
                autoFocus={!canClose}
                className={`${inputCls} mb-3`}
              />
              <button
                onClick={() => onStartFresh(newTitle)}
                disabled={!newTitle.trim()}
                className={primaryBtn}
              >
                <BookOpen className="w-4 h-4" />
                Start Fresh Wiki
              </button>
            </div>

            <div className={`rounded-xl border p-4 flex flex-col ${subtleCls}`}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 opacity-70" />
                <h2 className="font-semibold text-sm">Sample Playthrough</h2>
              </div>
              <p className="text-xs opacity-60 mb-3 flex-1">
                “{SAMPLE_PROJECT.title}” — {sampleArticles} wiki articles,{" "}
                {sampleEvents} timeline events, characters, factions and a full story arc to explore.
              </p>
              <button onClick={onOpenSample} className={secondaryBtn}>
                <FileText className="w-4 h-4" />
                Open Sample Playthrough
              </button>
            </div>
          </div>

          {/* Saved wikis */}
          {wikis.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="w-4 h-4 opacity-70" />
                <h2 className="font-semibold text-sm">Your Saved Wikis</h2>
                <span className="text-[10px] uppercase font-mono opacity-50">
                  {wikis.length} saved
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {wikis.map((wiki) => (
                  <div
                    key={wiki.id}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${subtleCls}`}
                  >
                    <FileText className="w-4 h-4 shrink-0 opacity-50" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{wiki.title}</div>
                      <div className="text-[11px] opacity-55 truncate font-mono flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(wiki.lastUpdated)} • {wiki.articleCount} articles •{" "}
                        {wiki.eventCount} events • {wiki.characterCount} colonists
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenWiki(wiki.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isDark
                          ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/30"
                          : isParchment
                          ? "bg-amber-800/10 text-amber-900 hover:bg-amber-800/20"
                          : "bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/30"
                      }`}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => {
                        const label =
                          wiki.id === SAMPLE_WIKI_ID
                            ? `Delete your saved copy of "${wiki.title}"? The pristine sample remains available from this screen.`
                            : `Delete "${wiki.title}" permanently? This cannot be undone.`;
                        if (window.confirm(label)) onDeleteWiki(wiki.id);
                      }}
                      className={`shrink-0 p-1.5 rounded-lg opacity-40 group-hover:opacity-90 transition-all ${
                        isDark
                          ? "text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                          : isParchment
                          ? "text-stone-500 hover:text-red-700 hover:bg-red-500/10"
                          : "text-cyan-500 hover:text-red-400 hover:bg-red-500/10"
                      }`}
                      title="Delete this wiki"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
