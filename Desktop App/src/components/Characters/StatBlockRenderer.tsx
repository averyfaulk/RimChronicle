import React, { useEffect, useMemo, useState } from "react";
import { Copy, Check, Dices } from "lucide-react";
import { Character, StoryProject, ThemeMode } from "../../types";
import {
  ABILITY_KEYS,
  ABILITY_SHORT,
  AbilityKey,
  formatModifier,
  modifierFor,
  renderStatBlock,
} from "../../lib/statBlock";

interface StatBlockRendererProps {
  character: Character;
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
}

type TextStatKey = Extract<
  keyof Character["combatStats"] & string,
  "armorClass" | "hitPoints" | "speed" | "initiative" | "challengeRating" | "creatureType" | "senses" | "languages"
>;

const TEXT_STATS: { key: TextStatKey; label: string; placeholder: string }[] = [
  { key: "armorClass", label: "AC", placeholder: "16 (Studded Leather)" },
  { key: "hitPoints", label: "HP", placeholder: "78 (12d8 + 24)" },
  { key: "speed", label: "Speed", placeholder: "30 ft." },
  { key: "challengeRating", label: "Challenge", placeholder: "5 (1,800 XP)" },
  { key: "creatureType", label: "Type / Alignment", placeholder: "Medium humanoid (human), neutral good" },
  { key: "senses", label: "Senses", placeholder: "passive Perception 15" },
  { key: "languages", label: "Languages", placeholder: "Common, Deep Speech" },
];

const inputClasses = (theme: ThemeMode): string => {
  if (theme === "parchment") return "bg-white/70 border-amber-300 focus:border-orange-600";
  if (theme === "cyber") return "bg-slate-950/70 border-cyan-900 focus:border-cyan-400";
  return "bg-black/40 border-white/10 focus:border-amber-500";
};

export const StatBlockRenderer: React.FC<StatBlockRendererProps> = ({
  character,
  project,
  setProject,
  theme,
}) => {
  const [stats, setStats] = useState<NonNullable<Character["combatStats"]>>({});
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setStats(character.combatStats ? { ...character.combatStats } : {});
    setCopied(false);
    // Re-seed when switching between characters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  const markdown = useMemo(() => renderStatBlock({ ...character, combatStats: stats }, project), [
    character,
    stats,
    project,
  ]);

  const commit = (next: NonNullable<Character["combatStats"]>) => {
    setStats(next);
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );
    setProject({
      ...project,
      characters: project.characters.map((c) =>
        c.id === character.id
          ? { ...c, combatStats: Object.keys(cleaned).length > 0 ? (cleaned as Character["combatStats"]) : undefined }
          : c
      ),
      lastUpdated: new Date().toISOString(),
    });
  };

  const setAbility = (key: AbilityKey, raw: string) => {
    const value = parseInt(raw, 10);
    commit({
      ...stats,
      [key]: raw.trim() === "" || Number.isNaN(value) ? undefined : Math.min(30, Math.max(1, value)),
    });
  };

  const setText = (key: TextStatKey, value: string) => {
    commit({ ...stats, [key]: value.trim() === "" ? undefined : value });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div
      className={`rounded-xl border p-3 space-y-3 ${
        theme === "dark"
          ? "bg-black/20 border-white/10"
          : theme === "parchment"
          ? "bg-amber-50/60 border-amber-200"
          : "bg-slate-950/40 border-cyan-900"
      }`}
      data-testid="stat-block-renderer"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono opacity-60 uppercase flex items-center gap-1.5">
          <Dices className="w-3.5 h-3.5 text-emerald-400" />
          Stat Block Renderer
        </span>
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="text-[10px] font-mono opacity-60 hover:opacity-100 underline decoration-dotted"
        >
          {showPreview ? "hide preview" : "preview"}
        </button>
      </div>

      {/* Ability scores */}
      <div className="grid grid-cols-6 gap-1.5">
        {ABILITY_KEYS.map((key) => (
          <label key={key} className="space-y-0.5">
            <span className="block text-[9px] font-mono text-center opacity-50">
              {ABILITY_SHORT[key]}
            </span>
            <input
              type="number"
              min={1}
              max={30}
              inputMode="numeric"
              value={stats[key] ?? ""}
              onChange={(e) => setAbility(key, e.target.value)}
              placeholder="10"
              title={
                stats[key] !== undefined
                  ? `${formatModifier(modifierFor(stats[key]!))} modifier`
                  : "Ability score"
              }
              className={`w-full px-1 py-1 rounded-lg text-center text-xs font-mono outline-none border ${inputClasses(theme)}`}
            />
          </label>
        ))}
      </div>

      {/* Vitals & flavor */}
      <div className="grid grid-cols-2 gap-1.5">
        {TEXT_STATS.map(({ key, label, placeholder }) => (
          <label key={key} className={key === "creatureType" ? "col-span-2" : ""}>
            <span className="block text-[9px] font-mono opacity-50 mb-0.5">{label}</span>
            <input
              type="text"
              value={stats[key] ?? ""}
              onChange={(e) => setText(key, e.target.value)}
              placeholder={placeholder}
              className={`w-full px-2 py-1 rounded-lg text-xs outline-none border ${inputClasses(theme)}`}
            />
          </label>
        ))}
      </div>

      {/* Preview + actions */}
      {showPreview && (
        <pre className="p-2.5 rounded-lg bg-black/50 text-[10px] leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto max-h-56 overflow-y-auto border border-white/10 text-emerald-200/90">
          {markdown}
        </pre>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-transform active:scale-95 ${
            copied ? "bg-emerald-500 text-white" : theme === "parchment" ? "bg-amber-800 text-amber-50" : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy Markdown"}
        </button>
      </div>
    </div>
  );
};
