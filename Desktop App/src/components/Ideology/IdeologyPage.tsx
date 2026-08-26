import React, { useMemo, useState } from "react";
import { ScrollText, Pencil, Scale, Check, RotateCcw, Users, Crown } from "lucide-react";
import {
  PreceptCategory,
  PreceptStance,
  PreceptTenet,
  StoryProject,
  ThemeMode,
} from "../../types";
import { getMatrixForFaction, toggleFrictionAcknowledgement } from "../../lib/preceptEngine";
import { PreceptMatrixModal, stancePillClasses } from "./PreceptMatrixModal";

interface IdeologyPageProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
}

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

const severityBadge = (severity: string): string => {
  switch (severity) {
    case "Critical":
      return "bg-red-500/20 text-red-400 border border-red-500/30";
    case "Major":
      return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    default:
      return "bg-blue-500/15 text-blue-300 border border-blue-500/30";
  }
};

export const IdeologyPage: React.FC<IdeologyPageProps> = ({ project, setProject, theme }) => {
  const playerFaction = project.factions.find((f) => f.stance === "Player Colony");
  const [selectedFactionId, setSelectedFactionId] = useState<string>(
    () => playerFaction?.id || project.factions[0]?.id || ""
  );
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);

  const selectedFaction =
    project.factions.find((f) => f.id === selectedFactionId) || project.factions[0] || null;

  const matrix = useMemo(
    () => (selectedFaction ? getMatrixForFaction(project, selectedFaction.id) : null),
    [project, selectedFaction]
  );

  const groupedTenets = useMemo(() => {
    if (!matrix) return [];
    return CATEGORIES.map((category) => ({
      category,
      tenets: matrix.tenets.filter((t) => t.category === category),
    })).filter((group) => group.tenets.length > 0);
  }, [matrix]);

  const definedCountFor = (factionId: string): number => {
    const m = getMatrixForFaction(project, factionId);
    return m ? m.tenets.length : 0;
  };

  const handleSaveMatrix = (tenets: PreceptTenet[]) => {
    if (!selectedFaction) return;
    const nextMatrix = {
      factionId: selectedFaction.id,
      factionName: selectedFaction.name,
      tenets,
      updatedAt: new Date().toISOString(),
    };
    const exists = project.preceptMatrices.some((m) => m.factionId === selectedFaction.id);
    setProject({
      ...project,
      preceptMatrices: exists
        ? project.preceptMatrices.map((m) =>
            m.factionId === selectedFaction.id ? nextMatrix : m
          )
        : [...project.preceptMatrices, nextMatrix],
      lastUpdated: new Date().toISOString(),
    });
    setIsMatrixModalOpen(false);
  };

  const handleToggleAcknowledged = (pointId: string) => {
    setProject({
      ...toggleFrictionAcknowledgement(project, pointId),
      lastUpdated: new Date().toISOString(),
    });
  };

  const cardClasses =
    theme === "dark"
      ? "bg-[#121215] border-[#222228]"
      : theme === "parchment"
      ? "bg-amber-100/70 border-amber-200"
      : "bg-slate-900/80 border-cyan-900";

  const innerCardClasses =
    theme === "dark"
      ? "bg-[#17171d] border-[#22222b]"
      : theme === "parchment"
      ? "bg-white/60 border-amber-200"
      : "bg-slate-950/60 border-cyan-900";

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-4 sm:p-6 shadow-sm ${cardClasses}`}>
        <div className="flex items-center space-x-2">
          <ScrollText className="w-5 h-5 text-amber-400" />
          <h3 className="font-serif font-bold text-lg">Ideology & Precept Matrix</h3>
          <span className="text-xs opacity-50 font-mono">
            ({project.preceptMatrices.length} of {project.factions.length} doctrines defined)
          </span>
        </div>
        <p className="text-xs opacity-75 mt-0.5">
          Each faction's non-negotiable tenets. When two factions' stances collide over an
          event action, a Cultural Friction Point is written into the chronicle.
        </p>
      </div>

      {project.factions.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border space-y-2 ${innerCardClasses}`}>
          <Users className="w-10 h-10 mx-auto opacity-40" />
          <h3 className="font-serif font-bold text-base">No factions recorded yet</h3>
          <p className="text-xs opacity-60">
            Create factions in the World Wiki to define their ideologies.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          <div className={`lg:col-span-1 rounded-2xl border p-2 space-y-1 ${cardClasses}`}>
            {project.factions.map((faction) => {
              const isActive = selectedFaction?.id === faction.id;
              const defined = definedCountFor(faction.id);
              return (
                <button
                  key={faction.id}
                  onClick={() => setSelectedFactionId(faction.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors space-y-0.5 ${
                    isActive
                      ? theme === "dark"
                        ? "bg-[#18181d] border border-amber-500/30"
                        : theme === "parchment"
                        ? "bg-amber-200/80 border border-amber-300"
                        : "bg-cyan-950/80 border border-cyan-700"
                      : theme === "dark"
                      ? "hover:bg-[#151519] border border-transparent"
                      : theme === "parchment"
                      ? "hover:bg-amber-100/60 border border-transparent"
                      : "hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold truncate">{faction.name}</span>
                    {defined > 0 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                        {defined}
                      </span>
                    )}
                  </span>
                  <span className="block text-[10px] opacity-60 truncate">
                    {faction.stance} · {faction.type}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedFaction && (
            <div className="lg:col-span-3 space-y-4">
              <div className={`rounded-2xl border p-5 sm:p-6 space-y-3 ${cardClasses}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-serif font-bold text-xl">{selectedFaction.name}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                      <span className="px-1.5 py-0.2 rounded bg-black/20 uppercase">{selectedFaction.stance}</span>
                      <span className="px-1.5 py-0.2 rounded bg-black/20">{selectedFaction.type}</span>
                    </div>
                  </div>
                  <button
                    id="btn-edit-precept-matrix"
                    onClick={() => setIsMatrixModalOpen(true)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                      theme === "dark"
                        ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
                        : theme === "parchment"
                        ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
                        : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Precept Matrix</span>
                  </button>
                </div>

                {selectedFaction.leader && (
                  <p className="text-xs flex items-center space-x-1.5 opacity-85">
                    <Crown className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>
                      Leader: <strong>{selectedFaction.leader}</strong>
                    </span>
                  </p>
                )}

                <div className={`p-3 rounded-xl border text-xs italic ${innerCardClasses}`}>
                  <span className="font-mono text-[9px] uppercase not-italic opacity-50 block mb-1">
                    Core Ideology
                  </span>
                  "{selectedFaction.ideology}"
                </div>

                <p className="text-xs leading-relaxed opacity-90">{selectedFaction.description}</p>
              </div>

              <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${cardClasses}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-serif font-bold text-base">Precept Matrix</h4>
                  <span className="text-[11px] font-mono opacity-50">
                    {matrix ? `${matrix.tenets.length} tenets defined` : "No doctrine recorded"}
                  </span>
                </div>

                {!matrix || matrix.tenets.length === 0 ? (
                  <p className="text-xs italic opacity-60 py-6 text-center border border-dashed border-white/10 rounded-xl">
                    No precepts defined for this faction yet — open the editor and pick 5–10
                    non-negotiable tenets.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                    {groupedTenets.map((group) => (
                      <div key={group.category}>
                        <span className="text-[10px] font-mono uppercase opacity-50 block mb-1.5">
                          {group.category}
                        </span>
                        <div className="space-y-1.5">
                          {group.tenets.map((tenet) => (
                            <div
                              key={tenet.key}
                              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${innerCardClasses}`}
                            >
                              <span className="text-xs font-semibold truncate" title={tenet.label}>
                                {tenet.label}
                                {tenet.custom && (
                                  <span className="ml-1.5 text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 align-middle">
                                    Custom
                                  </span>
                                )}
                              </span>
                              <span
                                title={tenet.stance}
                                className={`shrink-0 px-2 py-0.2 rounded-lg border text-[10px] ${stancePillClasses(
                                  tenet.stance as PreceptStance,
                                  true
                                )}`}
                              >
                                {tenet.stance}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${cardClasses}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-serif font-bold text-base flex items-center space-x-2">
            <Scale className="w-4 h-4 text-red-400" />
            <span>Cultural Friction Ledger</span>
          </h4>
          <span className="text-[11px] font-mono opacity-50">
            {(project.culturalFrictionPoints || []).filter((fp) => !fp.acknowledged).length} unacknowledged
          </span>
        </div>

        {(project.culturalFrictionPoints || []).length === 0 ? (
          <p className="text-xs italic opacity-60 py-6 text-center border border-dashed border-white/10 rounded-xl">
            No friction detected yet — log an event with actions involving two or more factions.
          </p>
        ) : (
          <div className="space-y-3">
            {project.culturalFrictionPoints.map((fp) => {
              const primary = project.factions.find((f) => f.id === fp.primaryFactionId);
              const opposing = project.factions.find((f) => f.id === fp.opposingFactionId);
              return (
                <div
                  key={fp.id}
                  className={`p-4 rounded-xl border space-y-2 ${
                    fp.severity === "Critical"
                      ? "border-red-500/50 bg-red-950/20"
                      : fp.severity === "Major"
                      ? "border-amber-500/40 bg-amber-950/20"
                      : "border-blue-500/30 bg-blue-950/10"
                  } ${fp.acknowledged ? "opacity-55" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    <span className={`px-2 py-0.2 rounded uppercase font-bold ${severityBadge(fp.severity)}`}>
                      {fp.severity}
                    </span>
                    <span className="font-sans font-semibold text-xs">{fp.actionLabel}</span>
                    <span className="opacity-50">·</span>
                    <span className="opacity-70">{fp.eventTitle}</span>
                    <span className="opacity-50">·</span>
                    <span className="opacity-70">{fp.eventTimestamp}</span>
                  </div>

                  <p className="text-xs leading-relaxed opacity-90">{fp.description}</p>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-white/10">
                      {primary?.name || fp.primaryFactionId}: <strong>{fp.primaryFactionStance}</strong>
                    </span>
                    <span className="opacity-40">×</span>
                    <span className="px-2 py-0.5 rounded bg-white/10">
                      {opposing?.name || fp.opposingFactionId}: <strong>{fp.opposingFactionStance}</strong>
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-lg border text-[11px] italic ${
                    theme === "dark" ? "bg-black/25 border-white/5" : "bg-black/5 border-black/10"
                  }`}>
                    <span className="not-italic font-mono text-[9px] uppercase opacity-50 block mb-0.5">
                      Suggested Fallout — write it:
                    </span>
                    {fp.suggestedFallout}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleToggleAcknowledged(fp.id)}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        fp.acknowledged
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "border-white/10 opacity-70 hover:opacity-100"
                      }`}
                    >
                      {fp.acknowledged ? (
                        <>
                          <RotateCcw className="w-3 h-3" />
                          <span>Reopen</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Acknowledge</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isMatrixModalOpen && selectedFaction && (
        <PreceptMatrixModal
          project={project}
          factionId={selectedFaction.id}
          theme={theme}
          onClose={() => setIsMatrixModalOpen(false)}
          onSave={handleSaveMatrix}
        />
      )}
    </div>
  );
};
