import React, { useState } from "react";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { ProjectTaxonomy, StoryProject, TaxonomyEntry, ThemeMode } from "../../types";
import {
  addTaxonomyEntry,
  flagsForList,
  flagLabel,
  renameTaxonomyEntry,
  removeTaxonomyEntry,
  setTaxonomyEntryColor,
  setTaxonomyEntryFlag,
  TAXONOMY_LIST_KEYS,
  TAXONOMY_LIST_LABELS,
} from "../../lib/taxonomy";

interface TaxonomyManagerModalProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  onClose: () => void;
}

const DEFAULT_COLORS = [
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#64748b", // slate
];

const COLOR_DEFAULTS: Record<keyof ProjectTaxonomy, string> = {
  articleCategories: "#8b5cf6",
  eventCategories: "#06b6d4",
  biomes: "#10b981",
  locationTypes: "#f59e0b",
};

export const TaxonomyManagerModal: React.FC<TaxonomyManagerModalProps> = ({
  project,
  setProject,
  theme,
  onClose,
}) => {
  const tax = project.taxonomy || ({} as ProjectTaxonomy);
  const [newLabels, setNewLabels] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ list: keyof ProjectTaxonomy; id: string } | null>(null);
  const [editText, setEditText] = useState("");
  const [openColor, setOpenColor] = useState<{ list: keyof ProjectTaxonomy; id: string } | null>(null);
  const [message, setMessage] = useState("");

  const panelBg =
    theme === "dark"
      ? "bg-[#17171d] border-[#26262f]"
      : theme === "parchment"
      ? "bg-amber-50 border-amber-300"
      : "bg-slate-900 border-cyan-800";
  const inputCls =
    theme === "parchment"
      ? "bg-white/70 border-amber-300"
      : "bg-black/40 border-white/10";

  const commitRename = (list: keyof ProjectTaxonomy, id: string) => {
    if (editText.trim()) {
      setProject(renameTaxonomyEntry({ ...project }, list, id, editText));
    }
    setEditing(null);
    setEditText("");
  };

  const handleAdd = (list: keyof ProjectTaxonomy) => {
    const label = (newLabels[list] || "").trim();
    if (!label) return;
    setProject(addTaxonomyEntry({ ...project }, list, label));
    setNewLabels((p) => ({ ...p, [list]: "" }));
  };

  const handleRemove = (list: keyof ProjectTaxonomy, entry: TaxonomyEntry) => {
    const res = removeTaxonomyEntry({ ...project }, list, entry.id);
    if (!res.ok) {
      setMessage(
        `Cannot delete "${entry.label}" — still used by: ${res.usage.slice(0, 3).join(", ")}${
          res.usage.length > 3 ? ` +${res.usage.length - 3} more` : ""
        }.`
      );
      return;
    }
    setProject(res.project);
    setMessage("");
  };

  const sectionCls = `rounded-2xl border p-4 space-y-3 ${
    theme === "dark"
      ? "bg-[#121216] border-[#23232b]"
      : theme === "parchment"
      ? "bg-amber-100/60 border-amber-200"
      : "bg-slate-950/60 border-cyan-900"
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 space-y-5 ${panelBg}`}>
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="font-serif font-bold text-lg">Worldbuilding & Categories</h3>
            <p className="text-[11px] opacity-60 leading-snug mt-1 max-w-xl">
              Create custom categories, biomes, and types — or rename any built-in to match your setting.
              Articles, events & locations reference each entry's stable id, so renaming a label never
              breaks existing data. Assign a color to customize how entries appear across the wiki,
              timeline, and world map.
            </p>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {message && (
          <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            {message}
          </p>
        )}

        {TAXONOMY_LIST_KEYS.map((listKey) => {
          const list = (project.taxonomy ? project.taxonomy[listKey] : []) || [];
          const defaultColor = COLOR_DEFAULTS[listKey];
          const flags = flagsForList(listKey);
          return (
            <section key={listKey} className={sectionCls}>
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-sm">{TAXONOMY_LIST_LABELS[listKey]}</h4>
                <span className="text-[10px] font-mono opacity-50">{list.length} entries</span>
              </div>

              <div className="space-y-1.5">
                {list.map((entry) => {
                  const isEditing = editing?.list === listKey && editing.id === entry.id;
                  const color = entry.color || defaultColor;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 p-2 rounded-xl bg-black/20 border border-white/5 flex-wrap"
                    >
                      {/* Color swatch + picker */}
                      <div className="relative shrink-0">
                        <button
                          onClick={() =>
                            setOpenColor((c) =>
                              c && c.list === listKey && c.id === entry.id ? null : { list: listKey, id: entry.id }
                            )
                          }
                          className="w-5 h-5 rounded-full border border-white/30"
                          style={{ backgroundColor: color }}
                          title="Set accent color"
                        />
                        {openColor && openColor.list === listKey && openColor.id === entry.id && (
                          <div
                            className={`absolute left-0 top-7 z-20 p-2 rounded-lg border shadow-xl grid grid-cols-4 gap-1.5 ${
                              theme === "dark" ? "bg-[#202028] border-[#2f2f3a]" : "bg-white border-stone-300"
                            }`}
                          >
                            {DEFAULT_COLORS.map((c) => (
                              <button
                                key={c}
                                onClick={() => {
                                  setProject(setTaxonomyEntryColor({ ...project }, listKey, entry.id, c));
                                  setOpenColor(null);
                                }}
                                className="w-5 h-5 rounded-full border border-black/20"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <input
                          autoFocus
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitRename(listKey, entry.id)}
                          onBlur={() => commitRename(listKey, entry.id)}
                          className={`flex-1 min-w-[140px] px-2 py-1 rounded-lg text-xs outline-none border ${inputCls}`}
                        />
                      ) : (
                        <span className="flex-1 min-w-[140px] text-xs font-semibold truncate">
                          {entry.label}
                          {entry.builtin && (
                            <span className="ml-1.5 text-[8px] font-mono uppercase px-1 py-px rounded bg-white/10 opacity-60 align-middle">
                              built-in
                            </span>
                          )}
                        </span>
                      )}

                      <button
                        onClick={() => {
                          setEditing({ list: listKey, id: entry.id });
                          setEditText(entry.label);
                        }}
                        className="p-1 opacity-50 hover:opacity-100"
                        title="Rename"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleRemove(listKey, entry)}
                        className="p-1 opacity-50 hover:opacity-100 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Semantic flags (opt-in behavior) */}
              {flags.length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-[9px] font-mono uppercase opacity-50 block">Behavior flags</span>
                  {list.map((entry) => (
                    <div key={entry.id} className="flex items-center flex-wrap gap-2 px-1">
                      <span className="w-24 truncate text-[10px] opacity-60">{entry.label}</span>
                      {flags.map((f) => {
                        const on = !!entry.flags?.includes(f.key);
                        return (
                          <button
                            key={f.key}
                            onClick={() =>
                              setProject(setTaxonomyEntryFlag({ ...project }, listKey, entry.id, f.key, !on))
                            }
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                              on
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                : "border-white/10 opacity-50 hover:opacity-100"
                            }`}
                            title={flagLabel(f.key)}
                          >
                            {on && <Check className="w-2.5 h-2.5" />}
                            {flagLabel(f.key)}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  value={newLabels[listKey] || ""}
                  onChange={(e) => setNewLabels((p) => ({ ...p, [listKey]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd(listKey)}
                  placeholder={`Add new ${TAXONOMY_LIST_LABELS[listKey].toLowerCase()}...`}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none border ${inputCls}`}
                />
                <button
                  onClick={() => handleAdd(listKey)}
                  disabled={!newLabels[listKey]?.trim()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-transform active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </section>
          );
        })}

        <div className="flex justify-end pt-1 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
