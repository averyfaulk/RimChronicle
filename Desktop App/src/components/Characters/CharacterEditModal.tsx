import React, { useState } from "react";
import { UserPlus } from "lucide-react";
import {
  Character,
  CharacterStatus,
  StoryProject,
  ThemeMode,
} from "../../types";
import { selectClasses } from "../../lib/uiTheme";
import { useLexicon } from "../../lib/lexicon";
import { applySlotInputs, getSlotEntries } from "../../lib/attributeSlots";
import { resolveSlotConfig, sanitizeCharacterArticleSections } from "../../lib/wikiParser";

const CHARACTER_STATUSES: CharacterStatus[] = [
  "Active",
  "Injured",
  "In Mental Break",
  "Missing",
  "Deceased",
  "Transhumanist Ascended",
];

interface CharacterFormState {
  name: string;
  nickname: string;
  role: string;
  faction: string;
  status: CharacterStatus;
  traitsText: string;
  /** Raw comma-separated text per attribute slot id. */
  slotInputs: Record<string, string>;
  dramaticArc: string;
  bio: string;
}

function parseListField(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface CharacterEditModalProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  mode: "add" | "edit";
  character?: Character | null;
  onClose: () => void;
  /** Fires after a successful save with the persisted character record. */
  onSaved?: (character: Character) => void;
  /** Opens the slot rename/add/remove manager (when available on the surface). */
  onManageSlots?: () => void;
}

/**
 * Shared add/edit character sheet form (identity, status, traits, dynamic
 * attribute slots, arc & bio). Mounted by the Social Web dossier panel and
 * by Characters wiki pages. Saves keep relationship bonds and the linked
 * Characters article in sync (renames propagate; stale static sections are
 * stripped so the live Dossier card stays the single source of truth).
 */
export const CharacterEditModal: React.FC<CharacterEditModalProps> = ({
  project,
  setProject,
  theme,
  mode,
  character,
  onClose,
  onSaved,
  onManageSlots,
}) => {
  const lex = useLexicon();
  const isEdit = mode === "edit" && !!character;

  const [form, setForm] = useState<CharacterFormState>(() => {
    const slotInputs: Record<string, string> = {};
    resolveSlotConfig(project).forEach((slot) => {
      if (isEdit && character) {
        slotInputs[slot.id] = getSlotEntries(character, slot.id).join(", ");
      }
    });
    return {
      name: character?.name || "",
      nickname: character?.nickname || "",
      role: character?.role || lex.t("defaultRole"),
      faction: character?.faction || project.factions[0]?.name || "",
      status: character?.status || "Active",
      traitsText: (character?.traits || []).join(", "),
      slotInputs,
      dramaticArc: character?.dramaticArc || "",
      bio: character?.bio || "",
    };
  });

  const patch = (p: Partial<CharacterFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) return;

    const nickname = form.nickname.trim() || name;
    const today = new Date().toISOString().split("T")[0];

    if (!isEdit) {
      // Create the character record...
      const newChar: Character = applySlotInputs(
        {
          id: `char-${Date.now()}`,
          name,
          nickname,
          role: form.role.trim() || lex.t("defaultRole"),
          faction: form.faction,
          status: form.status,
          traits: parseListField(form.traitsText),
          healthConditions: [],
          slotEntries: {},
          bio: form.bio.trim(),
          dramaticArc: form.dramaticArc.trim(),
        },
        form.slotInputs
      );

      // ...and automatically initialize a matching Characters wiki article.
      // Traits & attribute slots render live in the Dossier card, so the
      // article prose only carries narrative content.
      const articleContent = `# ${name}\n\n## Overview\n${
        newChar.bio || "*Entity referenced in chronicle records.*"
      }\n\n## Key Events\n* *(Awaiting chronicle detail)*`;

      const newArticle = {
        id: `art-${Date.now()}`,
        title: name,
        category: "Characters" as const,
        tags: ["characters", "colonist"],
        markdownContent: articleContent,
        createdAt: today,
        lastModified: today,
        wordCount: articleContent.split(/\s+/).filter(Boolean).length,
      };

      setProject({
        ...project,
        characters: [newChar, ...project.characters],
        wikiArticles: [newArticle, ...project.wikiArticles],
        lastUpdated: new Date().toISOString(),
      });
      onSaved?.(newChar);
      onClose();
      return;
    }

    const original = character!;
    const updatedChar: Character = applySlotInputs(
      {
        ...original,
        name,
        nickname,
        role: form.role.trim() || original.role,
        faction: form.faction,
        status: form.status,
        traits: parseListField(form.traitsText),
        bio: form.bio.trim(),
        dramaticArc: form.dramaticArc.trim(),
      },
      form.slotInputs
    );

    // If renamed, keep relationship references and wiki titles in sync.
    const oldNames = [original.name.toLowerCase(), (original.nickname || "").toLowerCase()].filter(
      Boolean
    );
    const renamed = original.name.toLowerCase() !== name.toLowerCase();

    let relationships = project.relationships;
    if (renamed) {
      relationships = relationships.map((rel) => ({
        ...rel,
        source: oldNames.includes(rel.source.toLowerCase()) ? name : rel.source,
        target: oldNames.includes(rel.target.toLowerCase()) ? name : rel.target,
      }));
    }

    let wikiArticles = project.wikiArticles;
    if (renamed) {
      wikiArticles = wikiArticles.map((a) =>
        a.title.toLowerCase() === original.name.toLowerCase() ? { ...a, title: name } : a
      );
    }
    // Traits & attribute slots live in the Dossier card — strip any stale
    // static copies from the linked article so they never drift.
    wikiArticles = wikiArticles.map((a) =>
      a.title.toLowerCase() === name.toLowerCase() && a.category === "Characters"
        ? {
            ...a,
            markdownContent: sanitizeCharacterArticleSections(
              a.markdownContent,
              resolveSlotConfig(project)
            ),
          }
        : a
    );

    setProject({
      ...project,
      characters: project.characters.map((c) => (c.id === updatedChar.id ? updatedChar : c)),
      relationships,
      wikiArticles,
      lastUpdated: new Date().toISOString(),
    });
    onSaved?.(updatedChar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-4 ${
          theme === "dark"
            ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
            : theme === "parchment"
            ? "bg-amber-50 border-amber-300 text-stone-900"
            : "bg-slate-900 border-cyan-800 text-cyan-50"
        }`}
      >
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <h3 className="font-serif font-bold text-base flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-amber-500" />
            <span>
              {!isEdit
                ? lex.t("addColonist")
                : `Edit ${lex.t("dossierWord")}: ${form.name || lex.t("colonistSingular")}`}
            </span>
          </h3>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>

        <p className="text-[11px] opacity-70 leading-relaxed">
          {isEdit
            ? "Changes apply everywhere immediately — Social Web, Dossier card and timeline references follow any rename automatically."
            : "Creates the character record and automatically initializes a matching Characters wiki article you can flesh out later."}
        </p>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono opacity-70 block mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Dr. Valerie Vance"
                className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-sm font-semibold"
                autoFocus
              />
            </div>
            <div>
              <label className="font-mono opacity-70 block mb-1">Nickname</label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => patch({ nickname: e.target.value })}
                placeholder="e.g. Vex"
                className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono opacity-70 block mb-1">Role / Title</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => patch({ role: e.target.value })}
                placeholder="e.g. Colony Surgeon"
                className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
              />
            </div>
            <div>
              <label className="font-mono opacity-70 block mb-1">{lex.t("factionSingular")}</label>
              <select
                value={form.faction}
                onChange={(e) => patch({ faction: e.target.value })}
                className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
              >
                <option value="">{lex.t("noFaction")}</option>
                {project.factions.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono opacity-70 block mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => patch({ status: e.target.value as CharacterStatus })}
                className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
              >
                {CHARACTER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {lex.status(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono opacity-70 block mb-1">Traits (comma separated)</label>
              <input
                type="text"
                value={form.traitsText}
                onChange={(e) => patch({ traitsText: e.target.value })}
                placeholder="Iron-willed, Bloodlust, Night Owl"
                className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
              />
            </div>
          </div>

          {resolveSlotConfig(project).map((slot) => (
            <div key={slot.id}>
              <label className="font-mono opacity-70 block mb-1">
                {slot.label} (comma separated)
              </label>
              <input
                type="text"
                value={form.slotInputs[slot.id] || ""}
                onChange={(e) =>
                  patch({
                    slotInputs: { ...form.slotInputs, [slot.id]: e.target.value },
                  })
                }
                placeholder={`e.g. ${
                  /bionic|health|vitality/i.test(slot.label)
                    ? lex.t("healthPlaceholder")
                    : "Entry one, Entry two"
                }`}
                className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
              />
            </div>
          ))}
          {onManageSlots && (
            <button
              type="button"
              onClick={onManageSlots}
              className="text-[10px] font-mono opacity-50 hover:opacity-100 underline decoration-dotted text-left"
              title="Rename, add, or remove attribute slots for every character"
            >
              + Rename or add attribute slots
            </button>
          )}

          <div>
            <label className="font-mono opacity-70 block mb-1">Dramatic Arc / Inner Conflict</label>
            <textarea
              rows={2}
              value={form.dramaticArc}
              onChange={(e) => patch({ dramaticArc: e.target.value })}
              placeholder="e.g. Fears losing control again; seeks redemption for Gorgon's broken ribs."
              className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
            />
          </div>

          <div>
            <label className="font-mono opacity-70 block mb-1">Bio / Background</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => patch({ bio: e.target.value })}
              placeholder="Where they came from, why they crashed here, what they left behind..."
              className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 disabled:opacity-40 ${
              theme === "dark"
                ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                : theme === "parchment"
                ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            }`}
          >
            {!isEdit ? lex.t("createColonist") : `Save ${lex.t("dossierWord")}`}
          </button>
        </div>
      </div>
    </div>
  );
};
