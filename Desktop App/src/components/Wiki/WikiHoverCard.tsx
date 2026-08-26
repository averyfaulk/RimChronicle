import React, { useState } from "react";
import {
  User,
  Shield,
  MapPin,
  Sparkles,
  ExternalLink,
  Heart,
  Skull,
  Zap,
  Tag
} from "lucide-react";
import { ThemeMode } from "../../types";
import { EntityLookup, findEntityByLinkText } from "../../lib/wikiParser";
import { useLexicon } from "../../lib/lexicon";

interface WikiHoverCardProps {
  linkText: string;
  lookup: EntityLookup;
  theme: ThemeMode;
  onNavigateToArticle: (title: string) => void;
  children: React.ReactNode;
}

export const WikiHoverCard: React.FC<WikiHoverCardProps> = ({
  linkText,
  lookup,
  theme,
  onNavigateToArticle,
  children,
}) => {
  const lex = useLexicon();
  const [isOpen, setIsOpen] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<any>(null);

  const entity = findEntityByLinkText(linkText, lookup);

  const handleMouseEnter = () => {
    const timeout = setTimeout(() => {
      setIsOpen(true);
    }, 200);
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setIsOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (entity.targetArticleTitle) {
      onNavigateToArticle(entity.targetArticleTitle);
    }
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        className={`font-semibold cursor-pointer underline decoration-dotted transition-colors ${
          theme === "dark"
            ? "text-amber-400 hover:text-amber-300 decoration-amber-500/50"
            : theme === "parchment"
            ? "text-amber-900 hover:text-amber-700 decoration-amber-700/60 font-bold"
            : "text-cyan-300 hover:text-cyan-100 decoration-cyan-500/50"
        }`}
      >
        {children}
      </button>

      {/* Floating Card */}
      {isOpen && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3.5 rounded-xl shadow-2xl border z-50 pointer-events-auto transition-all animate-in fade-in zoom-in-95 ${
            theme === "dark"
              ? "bg-[#141419]/95 border-[#282832] text-[#e2e8f0] backdrop-blur-md shadow-black/80"
              : theme === "parchment"
              ? "bg-amber-50/98 border-amber-300 text-stone-900 shadow-amber-900/10"
              : "bg-slate-900/95 border-cyan-700 text-cyan-50 shadow-cyan-950/40"
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                  entity.type === "character"
                    ? "bg-blue-600/20 text-blue-400"
                    : entity.type === "faction"
                    ? "bg-red-600/20 text-red-400"
                    : entity.type === "location"
                    ? "bg-emerald-600/20 text-emerald-400"
                    : entity.type === "relic"
                    ? "bg-amber-600/20 text-amber-400"
                    : "bg-purple-600/20 text-purple-400"
                }`}
              >
                {entity.type === "character" ? (
                  <User className="w-4 h-4" />
                ) : entity.type === "faction" ? (
                  <Shield className="w-4 h-4" />
                ) : entity.type === "location" ? (
                  <MapPin className="w-4 h-4" />
                ) : entity.type === "relic" ? (
                  <Sparkles className="w-4 h-4" />
                ) : (
                  <Tag className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-sm font-serif leading-tight">
                  {entity.data?.name || entity.data?.title || linkText}
                </h4>
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">
                  {entity.type.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={handleClick}
              className="text-xs p-1 rounded hover:bg-white/10 opacity-75 hover:opacity-100"
              title="Open full wiki article"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body preview */}
          {entity.type === "character" && entity.data && (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-[11px]">
                <span className="opacity-70">Role:</span>
                <span className="font-semibold text-right">{entity.data.role}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="opacity-70">Status:</span>
                <span
                  className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                    entity.data.status === "Active"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : entity.data.status === "Deceased"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {entity.data.status}
                </span>
              </div>
              {entity.data.traits && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {entity.data.traits.slice(0, 3).map((t: string) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {entity.data.bio && (
                <p className="text-[11px] opacity-80 line-clamp-2 pt-1 italic">
                  "{entity.data.bio}"
                </p>
              )}
            </div>
          )}

          {entity.type === "faction" && entity.data && (
            <div className="space-y-1 text-xs">
              <p className="text-[11px] opacity-75 font-mono">
                Stance: <span className="font-bold">{entity.data.stance}</span>
              </p>
              <p className="text-[11px] opacity-85 line-clamp-3">
                {entity.data.description}
              </p>
            </div>
          )}

          {entity.type === "location" && entity.data && (
            <div className="space-y-1 text-xs">
              <p className="text-[11px] opacity-75">
                Danger: <span className="font-bold text-amber-400">{entity.data.dangerLevel}</span>
              </p>
              <p className="text-[11px] opacity-85 line-clamp-3">
                {entity.data.description}
              </p>
            </div>
          )}

          {entity.type === "relic" && entity.data && (
            <div className="space-y-1 text-xs">
              <p className="text-[11px] opacity-75">
                Wielder: <span className="font-bold">{entity.data.wielder}</span>
              </p>
              <p className="text-[11px] opacity-85 line-clamp-3">
                {entity.data.description}
              </p>
            </div>
          )}

          {entity.type === "article" && entity.data && (
            <div className="space-y-1 text-xs">
              <p className="text-[11px] opacity-70">
                Category: <span className="font-semibold">{entity.data.category}</span>
              </p>
              <p className="text-[11px] opacity-85 line-clamp-3">
                {entity.data.markdownContent.slice(0, 150)}...
              </p>
            </div>
          )}

          {entity.type === "unknown" && (
            <p className="text-[11px] opacity-75 italic">
              Click to create or view the wiki article for "[[{linkText}]]".
            </p>
          )}

          {/* Quick jump banner */}
          <div className="mt-2 pt-2 border-t border-white/10 text-center">
            <button
              onClick={handleClick}
              className={`w-full py-1 rounded text-[11px] font-semibold transition-colors ${
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-300"
                  : theme === "parchment"
                  ? "bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold"
                  : "bg-cyan-950 hover:bg-cyan-900 text-cyan-300"
              }`}
            >
              Open Wiki {lex.t("dossierWord")} →
            </button>
          </div>
        </div>
      )}
    </span>
  );
};
