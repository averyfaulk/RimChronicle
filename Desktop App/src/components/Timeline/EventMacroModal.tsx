import React, { useMemo, useState } from "react";
import { X, Calendar, Flame, MapPin, Users, Save, Eye, Code2, Scale, AlertTriangle } from "lucide-react";
import {
  EventTemplate,
  PreceptAction,
  RimWorldDate,
  StoryProject,
  TemplateField,
  ThemeMode,
} from "../../types";
import { EntityLookup } from "../../lib/wikiParser";
import {
  QUADRUMS,
  formatRimWorldDate,
  parseRimWorldTimestamp,
} from "../../lib/downtime";
import {
  TemplateValues,
  appendHistoryToArticles,
  historyEntriesFromLinks,
  renderStencil,
} from "../../lib/templateEngine";
import { MarkdownRenderer } from "../Wiki/MarkdownRenderer";
import { accentClasses, TemplateIcon } from "./TemplateIcon";
import { BUILTIN_TENETS, applyPreceptAnalysis } from "../../lib/preceptEngine";

interface EventMacroModalProps {
  template: EventTemplate;
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  lookup: EntityLookup;
  onNavigateToArticle: (title: string) => void;
  masterDate: RimWorldDate | null;
  onClose: () => void;
}

function defaultValues(template: EventTemplate): TemplateValues {
  const v: TemplateValues = {};
  template.fields.forEach((f) => {
    if (f.type === "colonist-multi") {
      v[f.id] = Array.isArray(f.default) ? [...f.default] : [];
    } else {
      v[f.id] = f.default ?? (f.type === "slider" ? f.sliderMin ?? 0 : "");
    }
  });
  return v;
}

function isEmptyField(f: TemplateField, v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0;
  return v === undefined || v === null || String(v).trim() === "";
}

export const EventMacroModal: React.FC<EventMacroModalProps> = ({
  template,
  project,
  setProject,
  theme,
  lookup,
  onNavigateToArticle,
  masterDate,
  onClose,
}) => {
  const [values, setValues] = useState<TemplateValues>(() => defaultValues(template));
  const [dateInput, setDateInput] = useState<string>(
    masterDate ? formatRimWorldDate(masterDate) : ""
  );
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [macroActionLabel, setMacroActionLabel] = useState("");
  const [macroTenetKey, setMacroTenetKey] = useState("");

  const accent = accentClasses(template.accent, theme);

  const setField = (id: string, value: string | string[] | number) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  const toggleMulti = (id: string, name: string) => {
    const arr = Array.isArray(values[id]) ? [...(values[id] as string[])] : [];
    const idx = arr.findIndex((x) => x.toLowerCase() === name.toLowerCase());
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(name);
    setField(id, arr);
  };

  const parsedDate = parseRimWorldTimestamp(dateInput);
  const previewDate = parsedDate || masterDate;
  const preview = useMemo(() => {
    if (!previewDate) return null;
    return renderStencil(template, values, { date: previewDate, project });
  }, [template, values, previewDate, project]);

  const tenetOptions = useMemo(() => {
    const customTenets = project.preceptMatrices.flatMap((m) => m.tenets).filter((t) => t.custom);
    const seen = new Set<string>();
    return [...BUILTIN_TENETS, ...customTenets]
      .filter((t) => {
        if (seen.has(t.key)) return false;
        seen.add(t.key);
        return true;
      })
      .map((t) => ({ key: t.key, label: t.label, category: t.category }));
  }, [project.preceptMatrices]);

  const derivedInvolvedFactionIds = useMemo(() => {
    const ids = new Set<string>();
    template.fields.forEach((field) => {
      const raw = values[field.id];
      if (field.type === "faction" && typeof raw === "string" && raw.trim()) {
        const faction = project.factions.find(
          (f) => f.name.trim().toLowerCase() === raw.trim().toLowerCase()
        );
        if (faction) ids.add(faction.id);
      }
      if (field.type === "location" && typeof raw === "string" && raw.trim()) {
        const loc = project.locations.find(
          (l) => l.name.trim().toLowerCase() === raw.trim().toLowerCase()
        );
        const controllerName = loc?.controllingFaction?.trim().toLowerCase();
        if (controllerName) {
          const controller = project.factions.find(
            (f) => f.name.trim().toLowerCase() === controllerName
          );
          if (controller) ids.add(controller.id);
        }
      }
    });
    return Array.from(ids);
  }, [template, values, project]);

  const handleSave = () => {
    const date = parsedDate || masterDate;
    if (!date) {
      setError("Set a date first — enter one below or set the colony master clock.");
      return;
    }
    for (const field of template.fields) {
      if (field.required && isEmptyField(field, values[field.id])) {
        setError(`"${field.label}" is required.`);
        return;
      }
    }

    const { event, wikiLinks } = renderStencil(template, values, { date, project });

    const actions: PreceptAction[] = [];
    if (macroTenetKey) {
      const def = tenetOptions.find((t) => t.key === macroTenetKey);
      if (def) {
        actions.push({ label: macroActionLabel.trim() || def.label, tenetKey: def.key });
      }
    }

    const enrichedEvent: typeof event = {
      ...event,
      ...(derivedInvolvedFactionIds.length > 0
        ? { involvedFactionIds: [...derivedInvolvedFactionIds] }
        : {}),
      ...(actions.length > 0 ? { actions } : {}),
    };

    const analysis = applyPreceptAnalysis(project, enrichedEvent);

    const entries = historyEntriesFromLinks(date, analysis.event, wikiLinks);
    const wikiArticles = appendHistoryToArticles(analysis.project, entries);
    const logPrefix = `${date.year} ${QUADRUMS[date.quadrumIndex]} ${date.day}`;

    setProject({
      ...analysis.project,
      timelineEvents: [...analysis.project.timelineEvents, analysis.event],
      wikiArticles,
      chronicleLogHistory: [
        ...analysis.project.chronicleLogHistory,
        `${logPrefix}: [Stencil · ${template.name}] ${analysis.event.title} — ${analysis.event.description}`,
      ],
      lastUpdated: new Date().toISOString(),
    });
    onClose();
  };

  const renderField = (field: TemplateField) => {
    const value = values[field.id];

    if (field.type === "colonist") {
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setField(field.id, e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
        >
          <option value="">— Select Colonist —</option>
          {project.characters.map((c) => (
            <option key={c.id} value={c.name}>
              {c.nickname || c.name}
              {c.status === "Deceased" ? " (deceased)" : ""}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "colonist-multi") {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pt-0.5">
          {project.characters.length === 0 && (
            <span className="text-[10px] italic opacity-50">No colonists recorded yet.</span>
          )}
          {project.characters.map((c) => {
            const active = selected.some((s) => s.toLowerCase() === c.name.toLowerCase());
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleMulti(field.id, c.name)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                  active
                    ? "bg-amber-500/25 border-amber-500/50 text-amber-300"
                    : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                }`}
              >
                {c.nickname || c.name}
              </button>
            );
          })}
        </div>
      );
    }

    if (field.type === "faction") {
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setField(field.id, e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
        >
          <option value="">— Select Faction —</option>
          {project.factions.map((f) => (
            <option key={f.id} value={f.name}>
              {f.name} ({f.stance})
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "location") {
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setField(field.id, e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
        >
          <option value="">— Select Location —</option>
          {project.locations.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
              {l.biome ? ` (${l.biome})` : ""}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "slider") {
      const num = typeof value === "number" ? value : field.sliderMin ?? 0;
      const min = field.sliderMin ?? 0;
      const max = field.sliderMax ?? 10;
      const step = field.sliderStep ?? 1;
      return (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-mono opacity-60">
              {min} {field.sliderUnit || ""}
            </span>
            <span className="text-[11px] font-mono font-bold text-amber-400">
              {num} {field.sliderUnit || ""}
            </span>
            <span className="text-[10px] font-mono opacity-60">
              {max} {field.sliderUnit || ""}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={num}
            onChange={(e) => setField(field.id, parseInt(e.target.value))}
            className="w-full accent-amber-500"
          />
          {field.derivesThreat && field.threatThresholds && (
            <span className="text-[9px] font-mono opacity-50 block mt-0.5">
              ≤{field.threatThresholds.minor} Minor · ≤{field.threatThresholds.moderate} Moderate
              · ≤{field.threatThresholds.major} Major · above Catastrophic
            </span>
          )}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          rows={2}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setField(field.id, e.target.value)}
          placeholder={field.placeholder}
          className="w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none text-xs resize-y"
        />
      );
    }

    return (
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => setField(field.id, e.target.value)}
        placeholder={field.placeholder}
        className="w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-4 ${
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
            <TemplateIcon icon={template.icon} className="w-4 h-4" />
            <span className={accent.text}>Record: {template.name}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-xs opacity-60 hover:opacity-100"
            title="Discard without saving"
          >
            ✕
          </button>
        </div>

        {/* Date row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1 flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-amber-400" />
              <span>Event Date (auto-filled from clock)</span>
            </label>
            <input
              type="text"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              placeholder="e.g. 14 Jugust, 5504"
              className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs font-mono"
            />
          </div>
          <div className="self-end">
            <div className={`p-2.5 rounded-xl border text-[11px] ${
              theme === "dark" ? "bg-black/20 border-[#1f1f26]" : "bg-amber-100/50 border-amber-200"
            }`}>
              <span className="text-[9px] font-mono uppercase opacity-50 block">Master Clock</span>
              <span className="font-mono font-bold text-amber-400">
                {masterDate ? formatRimWorldDate(masterDate) : "Not set (enter date manually)"}
              </span>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs">
          {template.fields.map((field) => (
            <div key={field.id} className={field.type === "textarea" || field.type === "colonist-multi" ? "sm:col-span-2" : ""}>
              <label className="font-mono opacity-70 block mb-1">
                {field.label}
                {field.required && <span className="text-red-400"> *</span>}
                {field.type === "slider" && field.mapsToIntensity && (
                  <span className="ml-1 text-[9px] uppercase opacity-40">→ intensity</span>
                )}
              </label>
              {renderField(field)}
            </div>
          ))}
        </div>

        {/* Precept analysis: auto-derived factions + optional action */}
        <div className="space-y-2 pt-1">
          <div>
            <span className="text-[10px] font-mono opacity-60 uppercase block mb-1 flex items-center space-x-1">
              <Scale className="w-3 h-3 text-purple-400" />
              <span>Factions Involved (auto-derived from template)</span>
            </span>
            {derivedInvolvedFactionIds.length === 0 ? (
              <span className="text-[11px] italic opacity-50">
                No faction-typed or faction-controlled location fields filled yet.
              </span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {derivedInvolvedFactionIds.map((fid) => {
                  const faction = project.factions.find((f) => f.id === fid);
                  if (!faction) return null;
                  return (
                    <span
                      key={fid}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    >
                      ⚑ {faction.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <span className="text-[10px] font-mono opacity-60 uppercase block mb-1">
              Action (optional — free text, then pick the tenet)
            </span>
            <input
              type="text"
              value={macroActionLabel}
              onChange={(e) => setMacroActionLabel(e.target.value)}
              placeholder="e.g. Branded the captured raiders as property"
              className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
            />
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto mt-1.5">
              {tenetOptions.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMacroTenetKey(macroTenetKey === t.key ? "" : t.key)}
                  title={`${t.category} — ${t.label}`}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                    macroTenetKey === t.key
                      ? "bg-purple-500/25 border-purple-400/60 text-purple-200"
                      : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {macroTenetKey && derivedInvolvedFactionIds.length >= 2 && (
              <p className="text-[10px] italic mt-1.5 flex items-center space-x-1 text-purple-300">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>Saved with this action — opposing doctrines will surface a Cultural Friction Point.</span>
              </p>
            )}
          </div>
        </div>

        {/* Result chips */}
        {preview && (
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
              {preview.event.category}
            </span>
            <span
              className={`px-2 py-0.5 rounded border ${
                preview.event.threatLevel === "Catastrophic"
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : preview.event.threatLevel === "Major"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-blue-500/15 text-blue-300 border-blue-500/30"
              }`}
            >
              {preview.event.threatLevel}
            </span>
            <span className="flex items-center space-x-0.5 px-2 py-0.5 rounded bg-white/10 border border-white/10">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>{preview.event.intensityScore}/10</span>
            </span>
            <span className="flex items-center space-x-0.5 px-2 py-0.5 rounded bg-white/10 border border-white/10">
              <MapPin className="w-3 h-3 text-amber-400" />
              <span>{preview.event.location}</span>
            </span>
            <span className="flex items-center space-x-0.5 px-2 py-0.5 rounded bg-white/10 border border-white/10">
              <Users className="w-3 h-3 text-amber-400" />
              <span>{preview.event.participants.length} participant{preview.event.participants.length === 1 ? "" : "s"}</span>
            </span>
          </div>
        )}

        {/* Live preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-mono opacity-70 text-xs flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Generated Markdown (live)</span>
            </label>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setTab("preview")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  tab === "preview"
                    ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                    : "border-white/10 opacity-60 hover:opacity-100"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setTab("source")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  tab === "source"
                    ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                    : "border-white/10 opacity-60 hover:opacity-100"
                }`}
              >
                Source
              </button>
            </div>
          </div>

          {preview ? (
            tab === "preview" ? (
              <div className={`space-y-2 p-4 rounded-xl border max-h-64 overflow-y-auto ${
                theme === "dark" ? "bg-black/30 border-[#1f1f26]" : "bg-amber-100/60 border-amber-200"
              }`}>
                <h4 className="font-serif font-bold text-sm">{preview.event.title}</h4>
                <MarkdownRenderer
                  content={preview.event.description}
                  lookup={lookup}
                  theme={theme}
                  onNavigateToArticle={onNavigateToArticle}
                />
                {preview.event.narrativeImpact && (
                  <p className="text-[11px] italic opacity-80 border-t border-white/10 pt-2">
                    <span className="font-mono opacity-60 uppercase text-[9px] block">Fallout</span>
                    {preview.event.narrativeImpact}
                  </p>
                )}
              </div>
            ) : (
              <textarea
                readOnly
                value={`# ${preview.event.title}\n\n${preview.event.description}\n\n**Fallout:** ${preview.event.narrativeImpact}`}
                rows={9}
                className="w-full px-3 py-2.5 rounded-xl border bg-black/30 outline-none font-mono text-[12px] leading-relaxed resize-y"
              />
            )
          ) : (
            <p className="text-[11px] italic opacity-60 p-3 rounded-xl border border-dashed border-white/15">
              Enter a date to preview the generated event.
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-[11px] italic">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end space-x-2 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 flex items-center space-x-1.5 ${accent.solid}`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save &amp; Record Event</span>
          </button>
        </div>
      </div>
    </div>
  );
};