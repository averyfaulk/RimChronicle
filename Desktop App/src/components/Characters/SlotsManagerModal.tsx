import React, { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { StoryProject, ThemeMode } from "../../types";
import { addSlot, removeSlot, renameSlot, SLOT_PRESETS } from "../../lib/attributeSlots";
import { LexiconMode } from "../../lib/lexicon";

interface SlotsManagerModalProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  lexiconMode: LexiconMode;
  onClose: () => void;
}

export const SlotsManagerModal: React.FC<SlotsManagerModalProps> = ({
  project,
  setProject,
  theme,
  lexiconMode,
  onClose,
}) => {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const slots = project.attributeSlots || [];
  const presetLabels = new Set(SLOT_PRESETS[lexiconMode].map((s) => s.label));

  const commitRename = () => {
    if (editingId && editText.trim()) {
      setProject(renameSlot({ ...project }, editingId, editText));
    }
    setEditingId(null);
    setEditText("");
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    setProject(addSlot({ ...project }, newLabel));
    setNewLabel("");
  };

  const handleRemove = (id: string, label: string) => {
    if (
      !window.confirm(
        `Remove the "${label}" slot?\n\nEvery character's saved entries in this slot will be deleted. This cannot be undone.`
      )
    ) {
      return;
    }
    setProject(removeSlot({ ...project }, id));
  };

  const panelBg =
    theme === "dark"
      ? "bg-[#16161a] border-[#2b2b33]"
      : theme === "parchment"
      ? "bg-amber-50 border-amber-300"
      : "bg-slate-950 border-cyan-900";
  const inputCls =
    theme === "parchment"
      ? "bg-white/70 border-amber-300 focus:border-orange-600"
      : "bg-black/40 border-white/10 focus:border-emerald-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 ${panelBg}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif font-bold text-base">Attribute Slots</h3>
            <p className="text-[11px] opacity-60 leading-snug mt-0.5">
              Rename a slot to repurpose it for every {lexiconMode === "fantasy" ? "hero" : "colonist"} at
              once — entries survive renames and mode switches. Renamed slots are kept when you toggle
              lexicon modes.
            </p>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/20 border border-white/5"
            >
              {editingId === slot.id ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitRename()}
                  onBlur={commitRename}
                  placeholder={slot.label}
                  className={`flex-1 px-2 py-1 rounded-lg text-xs outline-none border ${inputCls}`}
                />
              ) : (
                <span className="text-xs font-semibold flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{slot.label}</span>
                  {!slot.customLabel && (
                    <span
                      className="text-[8px] font-mono uppercase px-1 py-px rounded bg-white/10 opacity-60 shrink-0"
                      title="Follows the current lexicon mode preset; rename to pin this label"
                    >
                      preset
                    </span>
                  )}
                  {presetLabels.has(slot.label) && slot.customLabel && (
                    <span className="text-[8px] font-mono uppercase px-1 py-px rounded bg-emerald-500/15 text-emerald-400 opacity-80 shrink-0">
                      pinned
                    </span>
                  )}
                </span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    setEditingId(slot.id);
                    setEditText(slot.label);
                  }}
                  className="p-1 opacity-50 hover:opacity-100"
                  title="Rename / repurpose slot"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleRemove(slot.id, slot.label)}
                  className="p-1 opacity-50 hover:opacity-100 hover:text-red-400"
                  title="Delete slot"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder='New slot, e.g. "Psi Powers"'
            className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none border ${inputCls}`}
          />
          <button
            onClick={handleAdd}
            disabled={!newLabel.trim()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-transform active:scale-95"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
