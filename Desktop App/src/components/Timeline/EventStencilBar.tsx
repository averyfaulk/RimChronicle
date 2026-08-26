import React from "react";
import { Settings2, Layers } from "lucide-react";
import { EventTemplate, ThemeMode } from "../../types";
import { accentClasses, TemplateIcon } from "./TemplateIcon";
import { useLexicon } from "../../lib/lexicon";

interface EventStencilBarProps {
  templates: EventTemplate[];
  onSelect: (template: EventTemplate) => void;
  onManage: () => void;
  theme: ThemeMode;
}

/**
 * Quick-capture stencil row. Each chip opens the Event Macro modal pre-loaded
 * with that template; the trailing button opens the template manager.
 */
export const EventStencilBar: React.FC<EventStencilBarProps> = ({
  templates,
  onSelect,
  onManage,
  theme,
}) => {
  const lex = useLexicon();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center space-x-1 text-[10px] font-mono uppercase opacity-50 mr-1">
        <Layers className="w-3.5 h-3.5" />
        <span>Stencils</span>
      </span>

      {templates.map((tpl) => {
        const accent = accentClasses(tpl.accent, theme);
        return (
          <button
            key={tpl.id}
            onClick={() => onSelect(tpl)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all active:scale-95 ${accent.chip} ${accent.text}`}
            title={`Record a "${lex.tplName(tpl)}" event — ${tpl.descriptionTemplate.slice(0, 60)}…`}
          >
            <TemplateIcon icon={tpl.icon} />
            <span>{lex.tplName(tpl)}</span>
          </button>
        );
      })}

      <button
        onClick={onManage}
        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
          theme === "dark"
            ? "border-[#2c2c36] text-[#cbd5e1] hover:bg-[#1c1c24]"
            : theme === "parchment"
            ? "border-amber-300 text-stone-800 hover:bg-amber-200"
            : "border-cyan-800 text-cyan-300 hover:bg-slate-800"
        }`}
        title="Create, edit, duplicate, and import/export event stencils"
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span>Templates</span>
      </button>
    </div>
  );
};