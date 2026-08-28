import React, { useRef, useState } from "react";
import {
  BookOpen,
  Download,
  Edit3,
  Plus,
  Save,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { ThemeMode, ThreatLevel } from "../../types";
import { LocalCrossroadPreset } from "../../lib/localEngine";
import { selectClasses } from "../../lib/uiTheme";
import {
  deleteCustomScenario,
  loadCustomScenarios,
  makeScenarioExport,
  mergeImportedScenarios,
  upsertCustomScenario
} from "../../lib/scenarioStore";

interface ScenarioLibraryModalProps {
  theme: ThemeMode;
  categoryOptions: { id: string; label: string }[];
  onClose: () => void;
  /** Called after any library mutation so parents can refresh their deck. */
  onSaved: () => void;
}

interface ResolutionFormState {
  label: string;
  title: string;
  summary: string;
  sceneProse: string;
  outcome: string;
  category: string; // EventCategory id — customizable via project taxonomy
  threatLevel: ThreatLevel;
  moodImpact: string;
  wikiUpdates: { articleTitle: string; updateSummary: string }[];
}

interface ScenarioFormState {
  title: string;
  summary: string;
  triggerConditions: string;
  storyHook: string;
  resolutions: ResolutionFormState[];
}

/** Offline-safe design rule: scenario resolutions never claim game events. */
const THREAT_LEVELS: ThreatLevel[] = ["Minor", "Moderate"];

const EMPTY_RESOLUTION: ResolutionFormState = {
  label: "",
  title: "",
  summary: "",
  sceneProse: "",
  outcome: "",
  category: "event-social",
  threatLevel: "Minor",
  moodImpact: "",
  wikiUpdates: []
};

const EMPTY_FORM: ScenarioFormState = {
  title: "",
  summary: "",
  triggerConditions: "",
  storyHook: "",
  resolutions: [{ ...EMPTY_RESOLUTION }]
};

export const ScenarioLibraryModal: React.FC<ScenarioLibraryModalProps> = ({
  theme,
  categoryOptions,
  onClose,
  onSaved,
}) => {
  const [scenarios, setScenarios] = useState<LocalCrossroadPreset[]>(() =>
    loadCustomScenarios()
  );
  const [form, setForm] = useState<ScenarioFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- form helpers ---------------- */

  const updateField = (patch: Partial<ScenarioFormState>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  const updateResolution = (idx: number, patch: Partial<ResolutionFormState>) => {
    setForm((f) =>
      f
        ? {
            ...f,
            resolutions: f.resolutions.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
          }
        : f
    );
  };

  const addResolution = () => {
    setForm((f) =>
      f && f.resolutions.length < 4
        ? { ...f, resolutions: [...f.resolutions, { ...EMPTY_RESOLUTION }] }
        : f
    );
  };

  const removeResolution = (idx: number) => {
    setForm((f) =>
      f && f.resolutions.length > 1
        ? { ...f, resolutions: f.resolutions.filter((_, i) => i !== idx) }
        : f
    );
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, resolutions: [{ ...EMPTY_RESOLUTION }] });
    setError("");
    setImportMsg("");
  };

  const openEdit = (preset: LocalCrossroadPreset) => {
    setEditingId(preset.id);
    setForm({
      title: preset.title,
      summary: preset.summary || "",
      triggerConditions: preset.triggerConditions || "",
      storyHook: preset.storyHook || "",
      resolutions: preset.resolutions.map((r) => ({
        label: r.label,
        title: r.title,
        summary: r.summary || "",
        sceneProse: r.sceneProse || "",
        outcome: r.outcome || "",
        category: r.category,
        threatLevel: r.threatLevel,
        moodImpact: r.moodImpact || "",
        wikiUpdates: (r.wikiUpdates || []).map((u) => ({ ...u })),
      })),
    });
    setError("");
    setImportMsg("");
  };

  const handleSave = () => {
    if (!form) return;

    const title = form.title.trim();
    if (!title) {
      setError("The scenario needs a title.");
      return;
    }
    if (form.resolutions.length === 0) {
      setError("Add at least one resolution.");
      return;
    }
    for (let i = 0; i < form.resolutions.length; i++) {
      const r = form.resolutions[i];
      if (!r.label.trim() || !r.title.trim()) {
        setError(`Resolution ${i + 1} needs at least a choice label and a scene title.`);
        return;
      }
    }

    const preset: LocalCrossroadPreset = {
      id: editingId || `custom-preset-${Date.now()}`,
      title,
      summary: form.summary.trim(),
      triggerConditions: form.triggerConditions.trim(),
      storyHook: form.storyHook.trim(),
      resolutions: form.resolutions.map((r) => ({
        label: r.label.trim(),
        title: r.title.trim(),
        summary: r.summary.trim(),
        sceneProse: r.sceneProse.trim(),
        outcome: r.outcome.trim(),
        category: r.category,
        threatLevel: r.threatLevel,
        moodImpact: r.moodImpact.trim(),
        wikiUpdates: r.wikiUpdates
          .filter((u) => u.articleTitle.trim())
          .map((u) => ({ articleTitle: u.articleTitle.trim(), updateSummary: u.updateSummary.trim() })),
      })),
    };

    setScenarios(upsertCustomScenario(preset));
    onSaved();
    setForm(null);
    setEditingId(null);
    setError("");
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this custom scenario? Built-in presets are not affected.")) return;
    setScenarios(deleteCustomScenario(id));
    onSaved();
  };

  /* ---------------- import / export ---------------- */

  const handleExport = () => {
    const doc = makeScenarioExport(scenarios);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rimchronicle-scenarios.json";
    a.click();
    URL.revokeObjectURL(url);
    setImportMsg("");
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const result = mergeImportedScenarios(loadCustomScenarios(), parsed);
        setScenarios(result.list);
        onSaved();
        setImportMsg(
          `Imported ${result.added} scenario${result.added === 1 ? "" : "s"}` +
            (result.skipped > 0 ? `, skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : "") +
            (result.invalid > 0 ? `, ignored ${result.invalid} malformed entr${result.invalid === 1 ? "y" : "ies"}` : "") +
            "."
        );
        setError("");
      } catch {
        setError("That file isn't valid JSON — export a library first to see the expected shape.");
      }
    };
    reader.readAsText(file);
  };

  /* ---------------- theme classes ---------------- */

  const panelCls =
    theme === "dark"
      ? "bg-[#141419] border-[#26262f] text-zinc-200"
      : theme === "parchment"
      ? "bg-amber-50 border-amber-300 text-stone-900"
      : "bg-slate-950 border-cyan-900 text-cyan-50";

  const inputCls =
    theme === "dark"
      ? "bg-black/40 border-white/10 focus:border-amber-500"
      : theme === "parchment"
      ? "bg-white/70 border-amber-300 focus:border-orange-600"
      : "bg-slate-900/70 border-cyan-900 focus:border-orange-400";

  const subtleBtnCls =
    theme === "dark"
      ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e] hover:text-white"
      : theme === "parchment"
      ? "border-amber-300 text-stone-700 hover:bg-amber-200/50"
      : "border-cyan-900 text-cyan-300 hover:bg-cyan-950/60";

  const primaryBtnCls =
    theme === "dark"
      ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
      : theme === "parchment"
      ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
      : "bg-cyan-500 hover:bg-cyan-400 text-slate-950";

  const sectionLabel = "text-[10px] font-mono uppercase tracking-wider opacity-60 block mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-5 ${panelCls}`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h3 className="font-serif font-bold text-base flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Scenario Library — Custom Crossroads</span>
          </h3>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100" title="Close">
            ✕
          </button>
        </div>

        {!form ? (
          <>
            {/* List toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-new-custom-scenario"
                onClick={openNew}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${primaryBtnCls}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Scenario</span>
              </button>
              <button
                id="btn-export-scenarios"
                onClick={handleExport}
                disabled={scenarios.length === 0}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${subtleBtnCls}`}
                title="Download your custom scenarios as JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
              <button
                id="btn-import-scenarios"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${subtleBtnCls}`}
                title="Import scenarios from a JSON export"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>

            {importMsg && (
              <p className="text-xs px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                {importMsg}
              </p>
            )}

            {/* Scenario list */}
            {scenarios.length === 0 ? (
              <div className="text-center py-10 opacity-60 text-sm italic leading-relaxed">
                No custom scenarios yet.
                <br />
                Create canon-safe dilemmas for your colonists — conversations, disputes, and
                rituals that never claim an unspawned game event.
              </div>
            ) : (
              <div className="space-y-2">
                {scenarios.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${
                      theme === "dark"
                        ? "bg-black/30 border-white/10"
                        : theme === "parchment"
                        ? "bg-white/50 border-amber-200"
                        : "bg-slate-900/60 border-cyan-900"
                    }`}
                  >
                    <div className="min-w-0">
                      <h4 className="font-serif font-bold text-sm truncate">{s.title}</h4>
                      <p className="text-[11px] opacity-75 line-clamp-2 leading-relaxed mt-0.5">
                        {s.summary || "*No summary provided.*"}
                      </p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {s.resolutions.length} resolution{s.resolutions.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        id={`btn-edit-scenario-${s.id}`}
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded-lg border border-white/10 opacity-70 hover:opacity-100"
                        title="Edit scenario"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`btn-delete-scenario-${s.id}`}
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-lg border border-red-500/30 text-red-400 opacity-80 hover:opacity-100"
                        title="Delete scenario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Editor */}
            <div className="space-y-3">
              <div>
                <label className={sectionLabel}>Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => updateField({ title: e.target.value })}
                  placeholder="e.g. The Last Bunk"
                  className={`w-full px-3 py-2 rounded-lg text-sm border outline-none ${inputCls}`}
                />
              </div>
              <div>
                <label className={sectionLabel}>Summary</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => updateField({ summary: e.target.value })}
                  rows={2}
                  placeholder="One or two sentences describing the situation."
                  className={`w-full px-3 py-2 rounded-lg text-xs border outline-none resize-y ${inputCls}`}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={sectionLabel}>Trigger Conditions</label>
                  <input
                    value={form.triggerConditions}
                    onChange={(e) => updateField({ triggerConditions: e.target.value })}
                    placeholder="When should this fire?"
                    className={`w-full px-3 py-2 rounded-lg text-xs border outline-none ${inputCls}`}
                  />
                </div>
                <div>
                  <label className={sectionLabel}>Story Hook</label>
                  <input
                    value={form.storyHook}
                    onChange={(e) => updateField({ storyHook: e.target.value })}
                    placeholder="The question this dilemma asks."
                    className={`w-full px-3 py-2 rounded-lg text-xs border outline-none ${inputCls}`}
                  />
                </div>
              </div>

              {/* Placeholders help */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] leading-relaxed">
                <span className="font-bold block mb-1">Template placeholders</span>
                Resolved from real project data when the scenario fires:
                <span className="font-mono block mt-1 opacity-90 break-words">
                  {"{{lead}} {{second}} {{third}} {{colony}} {{grudgeA}} {{grudgeB}} {{bondA}} {{bondB}} {{lastEvent}} {{deceased}}"}
                </span>
                Keep resolutions social and internal — never imply unspawned game events (no new
                arrivals, weather, raids, or resource changes).
              </div>

              {/* Resolutions repeater */}
              <div className="space-y-3 pt-1">
                {form.resolutions.map((res, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border space-y-2.5 ${
                      theme === "dark"
                        ? "bg-black/30 border-white/10"
                        : theme === "parchment"
                        ? "bg-white/50 border-amber-200"
                        : "bg-slate-900/60 border-cyan-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold font-mono uppercase opacity-70">
                        Resolution {idx + 1} of {form.resolutions.length}
                      </span>
                      {form.resolutions.length > 1 && (
                        <button
                          onClick={() => removeResolution(idx)}
                          className="text-red-400 opacity-70 hover:opacity-100"
                          title="Remove this resolution"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        value={res.label}
                        onChange={(e) => updateResolution(idx, { label: e.target.value })}
                        placeholder="Choice label * (e.g. Welcome Them In)"
                        className={`px-3 py-1.5 rounded-lg text-xs border outline-none ${inputCls}`}
                      />
                      <input
                        value={res.title}
                        onChange={(e) => updateResolution(idx, { title: e.target.value })}
                        placeholder="Scene title *"
                        className={`px-3 py-1.5 rounded-lg text-xs border outline-none ${inputCls}`}
                      />
                    </div>

                    <textarea
                      value={res.summary}
                      onChange={(e) => updateResolution(idx, { summary: e.target.value })}
                      rows={2}
                      placeholder="What happens (summary)?"
                      className={`w-full px-3 py-2 rounded-lg text-xs border outline-none resize-y ${inputCls}`}
                    />

                    <textarea
                      value={res.sceneProse}
                      onChange={(e) => updateResolution(idx, { sceneProse: e.target.value })}
                      rows={4}
                      placeholder="Opening scene prose — present tense, placeholders allowed."
                      className={`w-full px-3 py-2 rounded-lg text-xs border outline-none resize-y font-mono leading-relaxed ${inputCls}`}
                    />

                    <textarea
                      value={res.outcome}
                      onChange={(e) => updateResolution(idx, { outcome: e.target.value })}
                      rows={2}
                      placeholder="Concrete narrative consequence of choosing this path."
                      className={`w-full px-3 py-2 rounded-lg text-xs border outline-none resize-y ${inputCls}`}
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <select
                        value={
                          categoryOptions.find((o) => o.label === res.category)?.id ||
                          res.category
                        }
                        onChange={(e) =>
                          updateResolution(idx, { category: e.target.value })
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer ${selectClasses(theme)}`}
                        title="Event category"
                      >
                        {categoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={res.threatLevel}
                        onChange={(e) =>
                          updateResolution(idx, { threatLevel: e.target.value as ThreatLevel })
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer ${selectClasses(theme)}`}
                        title="Threat level (Minor/Moderate recommended)"
                      >
                        {THREAT_LEVELS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        value={res.moodImpact}
                        onChange={(e) => updateResolution(idx, { moodImpact: e.target.value })}
                        placeholder="Mood impact"
                        className={`px-2.5 py-1.5 rounded-lg text-xs border outline-none col-span-2 sm:col-span-1 ${inputCls}`}
                      />
                    </div>

                    {/* Wiki updates */}
                    <div className="space-y-1.5 pt-1 border-t border-white/5">
                      <span className={sectionLabel}>
                        Wiki Update Suggestions (optional)
                      </span>
                      {res.wikiUpdates.map((u, uIdx) => (
                        <div key={uIdx} className="flex items-center gap-2">
                          <input
                            value={u.articleTitle}
                            onChange={(e) =>
                              updateResolution(idx, {
                                wikiUpdates: res.wikiUpdates.map((w, i) =>
                                  i === uIdx ? { ...w, articleTitle: e.target.value } : w
                                ),
                              })
                            }
                            placeholder='Article ({{lead}}, {{colony}}...)'
                            className={`flex-1 min-w-0 px-2.5 py-1 rounded-lg text-[11px] border outline-none ${inputCls}`}
                          />
                          <input
                            value={u.updateSummary}
                            onChange={(e) =>
                              updateResolution(idx, {
                                wikiUpdates: res.wikiUpdates.map((w, i) =>
                                  i === uIdx ? { ...w, updateSummary: e.target.value } : w
                                ),
                              })
                            }
                            placeholder="What to record"
                            className={`flex-[2] min-w-0 px-2.5 py-1 rounded-lg text-[11px] border outline-none ${inputCls}`}
                          />
                          <button
                            onClick={() =>
                              updateResolution(idx, {
                                wikiUpdates: res.wikiUpdates.filter((_, i) => i !== uIdx),
                              })
                            }
                            className="text-red-400 opacity-70 hover:opacity-100 shrink-0"
                            title="Remove wiki update"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {res.wikiUpdates.length < 3 && (
                        <button
                          onClick={() =>
                            updateResolution(idx, {
                              wikiUpdates: [
                                ...res.wikiUpdates,
                                { articleTitle: "", updateSummary: "" },
                              ],
                            })
                          }
                          className="text-[11px] font-semibold opacity-70 hover:opacity-100 flex items-center space-x-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add wiki update suggestion</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {form.resolutions.length < 4 && (
                  <button
                    id="btn-add-resolution"
                    onClick={addResolution}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${subtleBtnCls}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Resolution ({form.resolutions.length}/4)</span>
                  </button>
                )}
              </div>

              {error && (
                <p className="text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                  {error}
                </p>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  setForm(null);
                  setEditingId(null);
                  setError("");
                }}
                className={`px-4 py-1.5 rounded-lg text-xs border transition-colors ${subtleBtnCls}`}
              >
                Cancel
              </button>
              <button
                id="btn-save-custom-scenario"
                onClick={handleSave}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${primaryBtnCls}`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editingId ? "Save Changes" : "Save to Library"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
