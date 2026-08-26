import React, { useState } from "react";
import {
  Scale,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Power,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { CanonConstraint, StoryProject, ThemeMode } from "../../types";
import { CANON_CONSTRAINT_PRESETS } from "../../lib/canonEngine";

interface CanonConstraintManagerModalProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  isAiMode: boolean;
  onClose: () => void;
}

const inputCls =
  "w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none text-xs";
const labelCls = "text-[10px] font-mono opacity-60 uppercase block mb-1";

function freshConstraint(): CanonConstraint {
  return {
    id: `canon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    title: "",
    ruleStatement: "",
    reminderMessage: "",
    keywords: [],
    isEnabled: true,
  };
}

function parseKeywords(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    )
  );
}

export const CanonConstraintManagerModal: React.FC<CanonConstraintManagerModalProps> = ({
  project,
  setProject,
  theme,
  isAiMode,
  onClose,
}) => {
  const constraints = project.canonConstraints ?? [];
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [draft, setDraft] = useState<CanonConstraint | null>(null);
  const [keywordsText, setKeywordsText] = useState("");
  const [error, setError] = useState("");

  const panelClasses =
    theme === "dark"
      ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
      : theme === "parchment"
      ? "bg-amber-50 border-amber-300 text-stone-900"
      : "bg-slate-900 border-cyan-800 text-cyan-50";

  const innerCardClasses =
    theme === "dark"
      ? "border-[#22222a] bg-black/10"
      : "border-amber-200 bg-amber-100/30";

  const persist = (list: CanonConstraint[]) => {
    setProject({
      ...project,
      canonConstraints: list,
      lastUpdated: new Date().toISOString(),
    });
  };

  const startNew = () => {
    setDraft(freshConstraint());
    setKeywordsText("");
    setError("");
    setMode("edit");
  };

  const startEdit = (constraint: CanonConstraint) => {
    setDraft({ ...constraint, keywords: [...constraint.keywords] });
    setKeywordsText(constraint.keywords.join(", "));
    setError("");
    setMode("edit");
  };

  const handleDuplicate = (constraint: CanonConstraint) => {
    persist([
      ...constraints,
      {
        ...constraint,
        id: `canon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        title: `${constraint.title} (Copy)`,
      },
    ]);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this canon constraint?")) return;
    persist(constraints.filter((c) => c.id !== id));
  };

  const handleToggle = (id: string) => {
    persist(
      constraints.map((c) =>
        c.id === id ? { ...c, isEnabled: !c.isEnabled } : c
      )
    );
  };

  const addPreset = (presetIndex: number) => {
    const preset = CANON_CONSTRAINT_PRESETS[presetIndex];
    if (!preset) return;
    persist([
      ...constraints,
      {
        ...preset,
        id: `canon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        isEnabled: true,
      },
    ]);
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.ruleStatement.trim()) {
      setError("A title and rule statement are required.");
      return;
    }
    const keywords = parseKeywords(keywordsText);
    if (keywords.length === 0) {
      setError("Add at least one trigger keyword to scan for.");
      return;
    }
    const saved: CanonConstraint = {
      ...draft,
      title: draft.title.trim(),
      ruleStatement: draft.ruleStatement.trim(),
      reminderMessage:
        draft.reminderMessage.trim() || `Constraint violated: ${draft.title.trim()}.`,
      keywords,
    };
    const exists = constraints.some((c) => c.id === saved.id);
    persist(
      exists
        ? constraints.map((c) => (c.id === saved.id ? saved : c))
        : [...constraints, saved]
    );
    setMode("list");
  };

  const patchDraft = (patch: Partial<CanonConstraint>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const renderKeywordChips = (keywords: string[]) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {keywords.slice(0, 6).map((kw) => (
        <span
          key={kw}
          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20"
        >
          {kw}
        </span>
      ))}
      {keywords.length > 6 && (
        <span className="text-[9px] font-mono opacity-50 self-center">
          +{keywords.length - 6} more
        </span>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-4 ${panelClasses}`}
      >
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <h3 className="font-serif font-bold text-base flex items-center space-x-2">
            <Scale className="w-4 h-4 text-red-400" />
            <span>Canon Constraint Panel</span>
          </h3>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>

        <p className="text-xs opacity-70 leading-relaxed">
          Define absolute laws for your world. The studio scans every draft
          against them and flags violating sentences — it never rewrites your
          prose. Constraints push you toward grounded workarounds instead of
          lazy plot solutions.
        </p>

        {mode === "list" && (
          <div className="space-y-3">
            {/* Starter presets */}
            <div className={`p-3 rounded-xl border space-y-2 ${innerCardClasses}`}>
              <span className={labelCls}>Add From Example</span>
              <div className="flex flex-wrap gap-2">
                {CANON_CONSTRAINT_PRESETS.map((preset, i) => (
                  <button
                    key={preset.title}
                    id={`btn-canon-preset-${i}`}
                    onClick={() => addPreset(i)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title={preset.ruleStatement}
                  >
                    <ShieldAlert className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {preset.title}
                  </button>
                ))}
                <button
                  id="btn-canon-constraint-add"
                  onClick={startNew}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                >
                  <Plus className="w-3 h-3 inline mr-1 -mt-0.5" />
                  New Law
                </button>
              </div>
            </div>

            {/* Constraint list */}
            <div className="space-y-2">
              {constraints.length === 0 && (
                <p className="text-xs opacity-50 text-center py-6 font-mono">
                  No canon laws defined yet. Add one above.
                </p>
              )}
              {constraints.map((constraint) => (
                <div
                  key={constraint.id}
                  id={`canon-constraint-row-${constraint.id}`}
                  className={`p-3 rounded-xl border space-y-1 ${innerCardClasses} ${
                    constraint.isEnabled ? "" : "opacity-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-serif font-bold text-sm">
                          {constraint.title}
                        </h4>
                        <span
                          className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                            constraint.isEnabled
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {constraint.isEnabled ? "Enforced" : "Muted"}
                        </span>
                      </div>
                      <p className="text-xs opacity-75 mt-0.5">
                        {constraint.ruleStatement}
                      </p>
                      {renderKeywordChips(constraint.keywords)}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handleToggle(constraint.id)}
                        className={`p-1.5 rounded-lg hover:bg-white/10 ${
                          constraint.isEnabled ? "text-emerald-400" : "opacity-40"
                        }`}
                        title={
                          constraint.isEnabled
                            ? "Mute this law (scanner ignores it)"
                            : "Re-enable enforcement"
                        }
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => startEdit(constraint)}
                        className="p-1.5 rounded-lg hover:bg-white/10"
                        title="Edit law"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(constraint)}
                        className="p-1.5 rounded-lg hover:bg-white/10"
                        title="Duplicate law"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(constraint.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400"
                        title="Delete law"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className={`text-[11px] font-mono opacity-70 p-2.5 rounded-lg border ${
                isAiMode ? "border-purple-500/30 bg-purple-500/10" : innerCardClasses
              }`}
            >
              {isAiMode ? (
                <span className="flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    Scanner runs entirely on this device — every draft is checked
                    live as you write and save. Active laws are also injected into
                    AI-generated drafts so they comply from the first word.
                  </span>
                </span>
              ) : (
                <span>
                  Offline Mode — the scanner runs entirely on this device. Every
                  draft is checked live as you write, save, and read. Nothing is
                  sent anywhere.
                </span>
              )}
            </div>
          </div>
        )}

        {mode === "edit" && draft && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Law Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => patchDraft({ title: e.target.value })}
                placeholder='e.g. "FTL Prohibited"'
                className={`${inputCls} ${theme === "parchment" ? "border-amber-300 bg-amber-100/60" : "border-white/10"}`}
                autoFocus
              />
            </div>

            <div>
              <label className={labelCls}>Absolute Rule Statement</label>
              <textarea
                rows={2}
                value={draft.ruleStatement}
                onChange={(e) => patchDraft({ ruleStatement: e.target.value })}
                placeholder='e.g. "No faster-than-light travel exists within this system."'
                className={`${inputCls} ${theme === "parchment" ? "border-amber-300 bg-amber-100/60" : "border-white/10"}`}
              />
            </div>

            <div>
              <label className={labelCls}>
                Violation Reminder (shown when flagged)
              </label>
              <input
                type="text"
                value={draft.reminderMessage}
                onChange={(e) => patchDraft({ reminderMessage: e.target.value })}
                placeholder='e.g. "FTL is prohibited in your canon."'
                className={`${inputCls} ${theme === "parchment" ? "border-amber-300 bg-amber-100/60" : "border-white/10"}`}
              />
            </div>

            <div>
              <label className={labelCls}>
                Trigger Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="ftl, hyperdrive, warp jump, hyperspace"
                className={`${inputCls} ${theme === "parchment" ? "border-amber-300 bg-amber-100/60" : "border-white/10"}`}
              />
              {parseKeywords(keywordsText).length > 0 &&
                renderKeywordChips(parseKeywords(keywordsText))}
              <p className="text-[10px] opacity-50 mt-1 font-mono">
                Matching is case-insensitive, whole-word, and tolerates plurals &
                hyphens ("faster than light" ≡ "Faster-Than-Light").
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setMode("list")}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={saveDraft}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 bg-amber-500 text-slate-950 hover:bg-amber-400"
              >
                Save Law
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
