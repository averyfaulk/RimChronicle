import React, { useMemo, useState } from "react";
import { X, Save, Plus, ScrollText, Lightbulb } from "lucide-react";
import {
  PreceptCategory,
  PreceptStance,
  PreceptTenet,
  StoryProject,
  ThemeMode,
} from "../../types";
import { BUILTIN_TENETS } from "../../lib/preceptEngine";

interface PreceptMatrixModalProps {
  project: StoryProject;
  factionId: string;
  theme: ThemeMode;
  onClose: () => void;
  onSave: (tenets: PreceptTenet[]) => void;
}

const STANCES: PreceptStance[] = ["Mandatory", "Respected", "Allowed", "Disliked", "Abhorred"];

const CATEGORIES: PreceptCategory[] = [
  "Body & Enhancement",
  "Consumption & Cannibalism",
  "Social Hierarchy",
  "Nature & Ecology",
  "Violence & War",
  "Technology & AI",
  "Death & Burial",
  "Custom",
];

export const stancePillClasses = (stance: PreceptStance, active: boolean): string => {
  if (!active) return "bg-white/5 border-white/10 opacity-60 hover:opacity-100";
  switch (stance) {
    case "Mandatory":
      return "bg-emerald-500/25 border-emerald-400/70 text-emerald-300 font-bold";
    case "Respected":
      return "bg-cyan-500/25 border-cyan-400/70 text-cyan-300 font-bold";
    case "Allowed":
      return "bg-zinc-500/20 border-zinc-400/60 text-zinc-200 font-bold";
    case "Disliked":
      return "bg-amber-500/25 border-amber-400/70 text-amber-300 font-bold";
    case "Abhorred":
      return "bg-red-500/25 border-red-400/70 text-red-300 font-bold";
  }
};

const stanceHint: Record<PreceptStance, string> = {
  Mandatory: "+2 — required by doctrine",
  Respected: "+1 — praised when practiced",
  Allowed: "0 — no doctrinal weight",
  Disliked: "-1 — frowned upon",
  Abhorred: "-2 — unforgivable transgression",
};

function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || `custom-${Date.now().toString(36)}`;
}

export const PreceptMatrixModal: React.FC<PreceptMatrixModalProps> = ({
  project,
  factionId,
  theme,
  onClose,
  onSave,
}) => {
  const faction = project.factions.find((f) => f.id === factionId);
  const existing = project.preceptMatrices.find((m) => m.factionId === factionId);

  const [stances, setStances] = useState<Record<string, PreceptStance>>(() => {
    const map: Record<string, PreceptStance> = {};
    for (const tenet of existing?.tenets || []) {
      map[tenet.key] = tenet.stance;
    }
    return map;
  });
  const [customs, setCustoms] = useState<PreceptTenet[]>(
    () => (existing?.tenets || []).filter((t) => t.custom)
  );
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newCustomCategory, setNewCustomCategory] = useState<PreceptCategory>("Custom");

  const rows = useMemo(() => {
    const customDefs = customs.map((c) => ({ key: c.key, label: c.label, category: c.category }));
    const all = [
      ...BUILTIN_TENETS.map((t) => ({ key: t.key, label: t.label, category: t.category })),
      ...customDefs,
    ];
    return CATEGORIES.map((category) => ({
      category,
      tenets: all.filter((t) => t.category === category),
    })).filter((group) => group.tenets.length > 0);
  }, [customs]);

  if (!faction) return null;

  const definedCount =
    BUILTIN_TENETS.filter((t) => (stances[t.key] || "Allowed") !== "Allowed").length +
    customs.length;

  const handleAddCustom = () => {
    const label = newCustomLabel.trim();
    if (!label) return;
    const key = slugify(label);
    if (customs.some((c) => c.key === key)) return;
    setCustoms([...customs, { id: `${faction.id}-custom-${key}`, key, label, category: newCustomCategory, stance: "Respected", custom: true }]);
    setStances((prev) => ({ ...prev, [key]: "Respected" }));
    setNewCustomLabel("");
  };

  const handleRemoveCustom = (key: string) => {
    setCustoms(customs.filter((c) => c.key !== key));
    setStances((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = () => {
    const tenets: PreceptTenet[] = [];
    for (const def of BUILTIN_TENETS) {
      const stance = stances[def.key] || "Allowed";
      if (stance === "Allowed") continue;
      tenets.push({
        id: `${faction.id}-tenet-${def.key}`,
        key: def.key,
        label: def.label,
        description: stanceHint[stance],
        stance,
        category: def.category,
      });
    }
    for (const c of customs) {
      tenets.push({ ...c, stance: stances[c.key] || c.stance || "Allowed", custom: true });
    }
    onSave(tenets);
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
            <ScrollText className="w-4 h-4 text-amber-500" />
            <span>Precept Matrix — {faction.name}</span>
          </h3>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>

        <div
          className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-[11px] ${
            theme === "dark" ? "bg-black/20 border-[#1f1f26]" : "bg-amber-100/50 border-amber-200"
          }`}
        >
          <span className="flex items-center space-x-1.5 opacity-80 leading-relaxed">
            <Lightbulb className="w-3.5 h-3.5 shrink-0 text-purple-400" />
            <span>Define 5–10 non-negotiable tenets — anything left on Allowed carries no doctrinal weight and never triggers friction.</span>
          </span>
          <span className="font-mono font-bold text-amber-400 shrink-0">{definedCount}/10</span>
        </div>

        <div className="space-y-4">
          {rows.map((group) => (
            <div key={group.category}>
              <span className="text-[10px] font-mono uppercase opacity-50 block mb-1.5">
                {group.category}
              </span>
              <div className="space-y-1.5">
                {group.tenets.map((def) => {
                  const isCustom = customs.some((c) => c.key === def.key);
                  const current = stances[def.key] || "Allowed";
                  return (
                    <div
                      key={def.key}
                      className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                        theme === "dark" ? "bg-[#17171d] border-[#22222b]" : "bg-white/60 border-amber-200"
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="text-xs font-semibold truncate" title={def.label}>
                          {def.label}
                        </span>
                        {isCustom && (
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {isCustom && (
                          <button
                            onClick={() => handleRemoveCustom(def.key)}
                            className="text-[10px] opacity-40 hover:opacity-100 hover:text-red-400 px-1"
                            title="Delete custom tenet"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        <div className="flex items-center gap-1">
                          {STANCES.map((stance) => (
                            <button
                              key={stance}
                              type="button"
                              title={stanceHint[stance]}
                              onClick={() => setStances((prev) => ({ ...prev, [def.key]: stance }))}
                              className={`px-2 py-0.5 rounded-lg border text-[10px] transition-colors ${stancePillClasses(stance, current === stance)}`}
                            >
                              {stance}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={`pt-3 border-t border-white/10 space-y-2`}>
          <span className="text-[10px] font-mono uppercase opacity-50 block">Add a custom tenet</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newCustomLabel}
              onChange={(e) => setNewCustomLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
              placeholder='e.g. "Owl Worship" or "Never strike first"'
              className={`flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs ${
                theme === "dark" ? "border-[#25252e]" : "border-amber-300"
              }`}
            />
            <select
              value={newCustomCategory}
              onChange={(e) => setNewCustomCategory(e.target.value as PreceptCategory)}
              className="px-2 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddCustom}
              disabled={!newCustomLabel.trim()}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-transform active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 flex items-center space-x-1.5 ${
              theme === "dark"
                ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                : theme === "parchment"
                ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Precept Matrix</span>
          </button>
        </div>
      </div>
    </div>
  );
};
