import React from "react";
import { Settings2, Zap } from "lucide-react";
import { Character, StoryProject, ThemeMode } from "../../types";
import { getSlotEntries } from "../../lib/attributeSlots";
import { resolveSlotConfig } from "../../lib/wikiParser";
import { StatBlockRenderer } from "./StatBlockRenderer";

interface CharacterSheetPanelProps {
  character: Character;
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  /** Opens the slot rename/add/remove manager (Social Web only). */
  onManageSlots?: () => void;
  className?: string;
}

/**
 * Shared character sheet: personality trait chips, every configured dynamic
 * attribute slot with its entries, and the live Stat Block Renderer.
 * Rendered inside the Social Web dossier panel and on Characters wiki pages.
 */
export const CharacterSheetPanel: React.FC<CharacterSheetPanelProps> = ({
  character,
  project,
  setProject,
  theme,
  onManageSlots,
  className = "",
}) => {
  const slotConfig = resolveSlotConfig(project);
  const traits = character.traits || [];

  return (
    <div className={`space-y-3 ${className}`} data-testid="character-sheet-panel">
      {/* Personality Traits */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono opacity-60 uppercase">
            Personality Traits:
          </span>
          {onManageSlots && (
            <button
              onClick={onManageSlots}
              className="flex items-center gap-1 text-[10px] font-mono opacity-60 hover:opacity-100 underline decoration-dotted"
              title="Rename, add, or remove attribute slots for every character"
            >
              <Settings2 className="w-3 h-3" />
              Manage Slots
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {traits.length === 0 ? (
            <p className="text-[11px] italic opacity-40">*(no recorded traits)*</p>
          ) : (
            traits.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white/10 border border-white/5 font-semibold"
              >
                {t}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Dynamic Attribute Slots */}
      {slotConfig.length > 0 && (
        <div className="space-y-2">
          {slotConfig.map((slot) => {
            const entries = getSlotEntries(character, slot.id);
            return (
              <div key={slot.id}>
                <span className="text-[11px] font-mono opacity-60 uppercase block mb-1">
                  {slot.label}:
                </span>
                <div className="space-y-1">
                  {entries.length === 0 ? (
                    <p className="text-[11px] italic opacity-40">*(no entries)*</p>
                  ) : (
                    entries.map((h, i) => (
                      <div
                        key={i}
                        className="text-xs p-1.5 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between"
                      >
                        <span>{h}</span>
                        <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stat Block Renderer */}
      <StatBlockRenderer character={character} project={project} setProject={setProject} theme={theme} />
    </div>
  );
};
