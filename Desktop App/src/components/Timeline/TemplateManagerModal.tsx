import React, { useRef, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Copy,
  Pencil,
  Download,
  Upload,
  Save,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import {
  EventCategory,
  EventTemplate,
  TemplateField,
  TemplateFieldType,
  ThreatLevel,
  ThemeMode,
} from "../../types";
import { BUILTIN_TEMPLATES } from "../../lib/templateEngine";
import {
  deleteCustomTemplate,
  loadCustomTemplates,
  makeTemplateExport,
  mergeImportedTemplates,
  saveCustomTemplates,
  upsertCustomTemplate,
} from "../../lib/templateStore";
import { downloadBlob } from "../../lib/zipExporter";
import { selectClasses } from "../../lib/uiTheme";
import { accentClasses, TEMPLATE_ICON_KEYS, TemplateIcon } from "./TemplateIcon";
import { useLexicon } from "../../lib/lexicon";

interface TemplateManagerModalProps {
  theme: ThemeMode;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES: EventCategory[] = [
  "Combat",
  "Social",
  "Mental Break",
  "Miracle",
  "Quest",
  "Tragedy",
  "Discovery",
  "Surgery",
  "Colony Life",
  "Travel",
];

const THREAT_LEVELS: ThreatLevel[] = ["Minor", "Moderate", "Major", "Catastrophic"];

const FIELD_TYPES: { value: TemplateFieldType; label: string }[] = [
  { value: "colonist", label: "Colonist (dropdown)" },
  { value: "colonist-multi", label: "Colonists (multi-select)" },
  { value: "faction", label: "Faction (dropdown)" },
  { value: "location", label: "Location (dropdown)" },
  { value: "route", label: "Route (dropdown)" },
  { value: "slider", label: "Severity slider" },
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
];

const ACCENTS = ["red", "emerald", "blue", "amber", "cyan", "violet"];

function freshTemplate(): EventTemplate {
  return {
    id: `tmpl-${Date.now().toString(36)}`,
    name: "New Stencil",
    icon: "swords",
    accent: "amber",
    category: "Colony Life",
    threatLevel: "Moderate",
    titleTemplate: "{{detail}} at {{location}}",
    descriptionTemplate: "{{detail}} occurred at {{location}} on {{date}}.",
    impactTemplate: "",
    fields: [
      { id: "location", label: "Location", type: "location", required: true },
      { id: "detail", label: "What Happened", type: "textarea", required: true },
    ],
    custom: true,
  };
}

function duplicateTemplate(src: EventTemplate): EventTemplate {
  return {
    ...src,
    id: `tmpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: `${src.name} (Copy)`,
    fields: src.fields.map((f) => ({ ...f })),
    custom: true,
  };
}

const inputCls =
  "w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none text-xs";
const labelCls = "text-[10px] font-mono opacity-60 uppercase block mb-1";

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  theme,
  onClose,
  onSaved,
}) => {
  const lex = useLexicon();
  const [templates, setTemplates] = useState<EventTemplate[]>(() => loadCustomTemplates());
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [draft, setDraft] = useState<EventTemplate | null>(null);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const persist = (list: EventTemplate[]) => {
    saveCustomTemplates(list);
    setTemplates(list);
    onSaved();
  };

  const startNew = () => {
    setDraft(freshTemplate());
    setExpandedFieldId(null);
    setError("");
    setMode("edit");
  };

  const startEdit = (tpl: EventTemplate) => {
    setDraft({ ...tpl, fields: tpl.fields.map((f) => ({ ...f })) });
    setExpandedFieldId(null);
    setError("");
    setMode("edit");
  };

  const handleDuplicate = (tpl: EventTemplate) => {
    const copy = duplicateTemplate(tpl);
    persist(upsertCustomTemplate(copy));
  };

  const handleDelete = (id: string) => {
    persist(deleteCustomTemplate(id));
  };

  const patchDraft = (patch: Partial<EventTemplate>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const updateField = (id: string, patch: Partial<TemplateField>) =>
    setDraft((prev) =>
      prev
        ? { ...prev, fields: prev.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
        : prev
    );

  const removeField = (id: string) =>
    setDraft((prev) =>
      prev ? { ...prev, fields: prev.fields.filter((f) => f.id !== id) } : prev
    );

  const addField = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const field: TemplateField = {
        id: `field-${prev.fields.length + 1}`,
        label: "New Field",
        type: "text",
      };
      return { ...prev, fields: [...prev.fields, field] };
    });
    setExpandedFieldId(`field-${(draft?.fields.length ?? 0) + 1}`);
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.titleTemplate.trim() || !draft.descriptionTemplate.trim()) {
      setError("Name, title template, and description template are required.");
      return;
    }
    if (draft.fields.length === 0) {
      setError("Add at least one field.");
      return;
    }
    for (const f of draft.fields) {
      if (!f.label.trim() || !f.id.trim()) {
        setError(`Field "${f.label || "(unnamed)"}" needs a label and an id.`);
        return;
      }
      if (f.type === "slider" && f.derivesThreat && !f.threatThresholds) {
        setError(`Slider "${f.label}" needs threat thresholds.`);
        return;
      }
    }
    persist(upsertCustomTemplate(draft));
    setMode("list");
  };

  const exportAll = () => {
    const blob = new Blob(
      [JSON.stringify(makeTemplateExport(templates), null, 2)],
      { type: "application/json" }
    );
    downloadBlob(blob, "rimchronicle-templates.json");
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = mergeImportedTemplates(templates, parsed);
      setTemplates(result.list);
      setImportMsg(`Imported: ${result.added} added, ${result.skipped} skipped, ${result.invalid} invalid.`);
      onSaved();
    } catch {
      setImportMsg("Import failed — invalid JSON file.");
    }
  };

  const renderFieldEditor = (field: TemplateField) => {
    const expanded = expandedFieldId === field.id;
    return (
      <div key={field.id} className={`rounded-lg border ${theme === "dark" ? "border-[#22222a] bg-black/10" : "border-amber-200 bg-amber-100/30"}`}>
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <button
            onClick={() => setExpandedFieldId(expanded ? null : field.id)}
            className="flex items-center space-x-1.5 text-left flex-1"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            )}
            <span className="text-xs font-semibold">{field.label}</span>
            <span className="text-[9px] font-mono opacity-50 bg-white/10 px-1.5 py-0.2 rounded">
              {field.type}
            </span>
            <span className="text-[9px] font-mono opacity-40">{"{{" + field.id + "}}"}</span>
          </button>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setExpandedFieldId(expanded ? null : field.id)}
              className="p-1 rounded opacity-50 hover:opacity-100 hover:text-amber-400"
              title="Edit field"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => removeField(field.id)}
              className="p-1 rounded opacity-50 hover:opacity-100 hover:text-red-400"
              title="Remove field"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="col-span-1">
              <label className={labelCls}>Field Id ({"{{id}}"})</label>
              <input value={field.id} onChange={(e) => updateField(field.id, { id: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Label</label>
              <input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={field.type}
                onChange={(e) => updateField(field.id, { type: e.target.value as TemplateFieldType })}
                className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value === "colonist"
                      ? `${lex.t("colonistSingular")} (dropdown)`
                      : t.value === "colonist-multi"
                      ? `${lex.t("colonistsPlural")} (multi-select)`
                      : t.value === "faction"
                      ? `${lex.t("factionSingular")} (dropdown)`
                      : t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(field.required)}
                  onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  className="accent-amber-500"
                />
                <span>Required</span>
              </label>
            </div>

            {(field.type === "text" || field.type === "textarea") && (
              <div className="col-span-2 sm:col-span-4">
                <label className={labelCls}>Placeholder</label>
                <input
                  value={field.placeholder || ""}
                  onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                  className={inputCls}
                />
              </div>
            )}

            {field.type === "slider" && (
              <>
                <div>
                  <label className={labelCls}>Min</label>
                  <input
                    type="number"
                    value={field.sliderMin ?? 0}
                    onChange={(e) => updateField(field.id, { sliderMin: parseInt(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Max</label>
                  <input
                    type="number"
                    value={field.sliderMax ?? 10}
                    onChange={(e) => updateField(field.id, { sliderMax: parseInt(e.target.value) || 10 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Step</label>
                  <input
                    type="number"
                    value={field.sliderStep ?? 1}
                    onChange={(e) => updateField(field.id, { sliderStep: parseInt(e.target.value) || 1 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Unit</label>
                  <input
                    value={field.sliderUnit || ""}
                    onChange={(e) => updateField(field.id, { sliderUnit: e.target.value })}
                    placeholder="pawns, %, /10..."
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2 flex items-center space-x-4 py-1">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(field.mapsToIntensity)}
                      onChange={(e) => updateField(field.id, { mapsToIntensity: e.target.checked })}
                      className="accent-amber-500"
                    />
                    <span>Scale to intensity (1–10)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(field.derivesThreat)}
                      onChange={(e) => updateField(field.id, { derivesThreat: e.target.checked })}
                      className="accent-amber-500"
                    />
                    <span>Derive threat level</span>
                  </label>
                </div>
                {field.derivesThreat && (
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls}>Minor ≤</label>
                      <input
                        type="number"
                        value={field.threatThresholds?.minor ?? 2}
                        onChange={(e) =>
                          updateField(field.id, {
                            threatThresholds: { ...field.threatThresholds, minor: parseInt(e.target.value) || 0 },
                          })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Moderate ≤</label>
                      <input
                        type="number"
                        value={field.threatThresholds?.moderate ?? 4}
                        onChange={(e) =>
                          updateField(field.id, {
                            threatThresholds: { ...field.threatThresholds, moderate: parseInt(e.target.value) || 0 },
                          })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Major ≤</label>
                      <input
                        type="number"
                        value={field.threatThresholds?.major ?? 7}
                        onChange={(e) =>
                          updateField(field.id, {
                            threatThresholds: { ...field.threatThresholds, major: parseInt(e.target.value) || 0 },
                          })
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTemplateRow = (tpl: EventTemplate, isBuiltIn: boolean) => {
    const accent = accentClasses(tpl.accent, theme);
    return (
      <div
        key={tpl.id}
        className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
          theme === "dark" ? "bg-black/10 border-[#22222a]" : "bg-amber-100/30 border-amber-200"
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <TemplateIcon icon={tpl.icon} className={`w-4 h-4 shrink-0 ${accent.text}`} />
          <div className="min-w-0">
            <span className="text-xs font-bold block truncate">
              {lex.tplName(tpl)}
              {isBuiltIn && (
                <span className="ml-1 text-[9px] uppercase font-mono opacity-40 bg-white/10 px-1 py-0.2 rounded">built-in</span>
              )}
            </span>
            <span className="text-[10px] font-mono opacity-50">
              {lex.evCat(tpl.category)} · {tpl.threatLevel} · {tpl.fields.length} fields
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => handleDuplicate(tpl)}
            className="p-1.5 rounded opacity-60 hover:opacity-100 hover:text-amber-400"
            title="Duplicate to customize"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {!isBuiltIn && (
            <>
              <button
                onClick={() => startEdit(tpl)}
                className="p-1.5 rounded opacity-60 hover:opacity-100 hover:text-amber-400"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(tpl.id)}
                className="p-1.5 rounded opacity-60 hover:opacity-100 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-4 ${
          theme === "dark"
            ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
            : theme === "parchment"
            ? "bg-amber-50 border-amber-300 text-stone-900"
            : "bg-slate-900 border-cyan-800 text-cyan-50"
        }`}
      >
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <h3 className="font-serif font-bold text-base flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span>{mode === "edit" ? "Edit Event Stencil" : "Event Stencil Library"}</span>
          </h3>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>

        {mode === "list" ? (
          <>
            <p className="text-[11px] opacity-70 leading-relaxed">
              Stencils turn a 5-minute typing session into 30 seconds of clicking: pick the event
              type, fill the dropdowns and sliders, and the system writes the Markdown with
              [[wiki-links]] and the master-clock date baked in.
            </p>

            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase opacity-50 block">Built-In Stencils</span>
              <div className="space-y-1.5">
                {BUILTIN_TEMPLATES.map((t) => renderTemplateRow(t, true))}
              </div>

              <span className="text-[10px] font-mono uppercase opacity-50 block pt-2">
                Your Stencils ({templates.length})
              </span>
              {templates.length === 0 ? (
                <p className="text-[11px] italic opacity-50">
                  No custom stencils yet. Duplicate a built-in or create one below.
                </p>
              ) : (
                <div className="space-y-1.5">{templates.map((t) => renderTemplateRow(t, false))}</div>
              )}
            </div>

            {importMsg && <p className="text-[11px] text-emerald-400">{importMsg}</p>}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-white/10">
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100 flex items-center space-x-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
              </button>
              <button
                onClick={exportAll}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100 flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export All</span>
              </button>
              <button
                onClick={startNew}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Stencil</span>
              </button>
            </div>
          </>
        ) : (
          draft && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelCls}>Name</label>
                  <input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Icon</label>
                  <select
                    value={draft.icon}
                    onChange={(e) => patchDraft({ icon: e.target.value })}
                    className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
                  >
                    {TEMPLATE_ICON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Accent</label>
                  <select
                    value={draft.accent}
                    onChange={(e) => patchDraft({ accent: e.target.value })}
                    className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
                  >
                    {ACCENTS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Category</label>
                  <select
                    value={draft.category}
                    onChange={(e) => patchDraft({ category: e.target.value as EventCategory })}
                    className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {lex.evCat(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Base Threat Level</label>
                  <select
                    value={draft.threatLevel}
                    onChange={(e) => patchDraft({ threatLevel: e.target.value as ThreatLevel })}
                    className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
                  >
                    {THREAT_LEVELS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Title Template</label>
                  <input
                    value={draft.titleTemplate}
                    onChange={(e) => patchDraft({ titleTemplate: e.target.value })}
                    placeholder="e.g. {{faction}} Raid on {{location}}"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Description Template (entity values auto-link as [[WikiLinks]])</label>
                  <textarea
                    rows={3}
                    value={draft.descriptionTemplate}
                    onChange={(e) => patchDraft({ descriptionTemplate: e.target.value })}
                    placeholder="e.g. Raiders from {{faction}} struck {{location}}..."
                    className={`${inputCls} resize-y`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Narrative Impact Template (optional)</label>
                  <input
                    value={draft.impactTemplate || ""}
                    onChange={(e) => patchDraft({ impactTemplate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Fields ({draft.fields.length})</label>
                <div className="space-y-1.5">
                  {draft.fields.map(renderFieldEditor)}
                  <button
                    onClick={addField}
                    className="w-full px-3 py-2 rounded-lg text-[11px] font-semibold border border-dashed border-white/15 opacity-70 hover:opacity-100 flex items-center justify-center space-x-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Field</span>
                  </button>
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border text-[10px] font-mono leading-relaxed ${
                theme === "dark" ? "bg-black/20 border-[#1f1f26]" : "bg-amber-100/50 border-amber-200"
              }`}>
                <span className="uppercase opacity-50 block mb-1">Placeholders</span>
                <span className="text-amber-400">{"{{date}}"} {"{{quadrumYear}}"}</span>{" "}
                {draft.fields.map((f) => (
                  <span key={f.id} className="text-amber-400">
                    {"{{" + f.id + "}}"}
                  </span>
                ))}
                <span className="block opacity-50 mt-1">
                  Colonist / Faction / Location values auto-link to their wiki pages. Sliders add
                  numeric severity.
                </span>
              </div>

              {error && <p className="text-red-400 text-[11px] italic">{error}</p>}

              <div className="flex justify-end space-x-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => setMode("list")}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDraft}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Stencil</span>
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};