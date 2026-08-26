import React, { useEffect, useState } from "react";
import { Clock, ChevronDown, Lock, FastForward } from "lucide-react";
import { StoryProject, ThemeMode } from "../../types";
import {
  QUADRUMS,
  DAYS_PER_QUADRUM,
  advanceMasterClock,
  formatRimWorldDate,
  getMasterClockDate,
  parseRimWorldTimestamp,
  setMasterClock,
} from "../../lib/downtime";

interface MasterClockWidgetProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
}

/**
 * The colony's master clock: the in-game date stencils auto-fill from.
 * When no explicit clock is set, the latest recorded event date is used
 * (marked "auto"). Click to open a quick set/advance popover.
 */
export const MasterClockWidget: React.FC<MasterClockWidgetProps> = ({
  project,
  setProject,
  theme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const effective = getMasterClockDate(project);
  const isExplicit = Boolean(project.masterClock);

  const [day, setDay] = useState(1);
  const [quadrum, setQuadrum] = useState(0);
  const [year, setYear] = useState(5504);

  useEffect(() => {
    if (isOpen) {
      setDay(effective?.day ?? 1);
      setQuadrum(effective?.quadrumIndex ?? 0);
      setYear(effective?.year ?? 5504);
    }
  }, [isOpen, effective]);

  const apply = () => {
    const safeYear = Number.isFinite(year) ? year : 5504;
    setProject(setMasterClock(project, { day, quadrumIndex: quadrum, year: safeYear }));
    setIsOpen(false);
  };

  const quickAdvance = (days: number) => {
    setProject(advanceMasterClock(project, days));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
          theme === "dark"
            ? "bg-black/20 border-[#2c2c36] text-amber-300 hover:bg-[#1c1c24]"
            : theme === "parchment"
            ? "bg-amber-100/60 border-amber-300 text-amber-900 hover:bg-amber-200"
            : "bg-slate-900/80 border-cyan-800 text-cyan-300 hover:bg-slate-800"
        }`}
        title={
          isExplicit
            ? `Master clock is set to ${effective ? formatRimWorldDate(effective) : "—"}`
            : "Master clock follows the latest recorded event (auto). Click to set it."
        }
      >
        {isExplicit ? (
          <Lock className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span className="font-mono">{effective ? formatRimWorldDate(effective) : "Set Colony Date"}</span>
        {!isExplicit && (
          <span className="text-[9px] uppercase font-mono opacity-50 px-1 py-0.2 rounded bg-white/10">
            auto
          </span>
        )}
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-2 z-40 w-64 p-3 rounded-xl border shadow-2xl space-y-2.5 ${
            theme === "dark"
              ? "bg-[#17171d] border-[#26262f] text-[#e2e8f0]"
              : theme === "parchment"
              ? "bg-amber-50 border-amber-300 text-stone-900"
              : "bg-slate-900 border-cyan-800 text-cyan-50"
          }`}
        >
          <span className="text-[10px] font-mono uppercase opacity-60 block">Colony Master Clock</span>

          <div className="grid grid-cols-[1fr_1fr_1fr] gap-1.5">
            <div>
              <label className="text-[9px] font-mono opacity-60 block mb-0.5">Day</label>
              <select
                value={day}
                onChange={(e) => setDay(parseInt(e.target.value))}
                className="w-full px-1.5 py-1 rounded border bg-black/20 outline-none text-xs"
              >
                {Array.from({ length: DAYS_PER_QUADRUM }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-mono opacity-60 block mb-0.5">Quadrum</label>
              <select
                value={quadrum}
                onChange={(e) => setQuadrum(parseInt(e.target.value))}
                className="w-full px-1.5 py-1 rounded border bg-black/20 outline-none text-xs"
              >
                {QUADRUMS.map((q, i) => (
                  <option key={q} value={i}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-mono opacity-60 block mb-0.5">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-1.5 py-1 rounded border bg-black/20 outline-none text-xs"
              />
            </div>
          </div>

          <button
            onClick={apply}
            className="w-full px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
          >
            Set Clock to This Date
          </button>

          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => quickAdvance(1)}
              className="px-1 py-1 rounded text-[10px] font-semibold border border-white/10 opacity-80 hover:opacity-100"
              title="Advance 1 day"
            >
              +1d
            </button>
            <button
              onClick={() => quickAdvance(5)}
              className="px-1 py-1 rounded text-[10px] font-semibold border border-white/10 opacity-80 hover:opacity-100"
              title="Advance 5 days"
            >
              +5d
            </button>
            <button
              onClick={() => quickAdvance(DAYS_PER_QUADRUM)}
              className="px-1 py-1 rounded text-[10px] font-semibold border border-white/10 opacity-80 hover:opacity-100"
              title="Advance one quadrum"
            >
              +1q
            </button>
            <button
              onClick={() => quickAdvance(60)}
              className="px-1 py-1 rounded text-[10px] font-semibold border border-white/10 opacity-80 hover:opacity-100"
              title="Advance one year"
            >
              +1y
            </button>
          </div>

          <div className="flex items-center space-x-1 text-[9px] font-mono opacity-50">
            <FastForward className="w-3 h-3" />
            <span>Quick advance applies immediately.</span>
          </div>

          {/* Kept small hint for backdating */}
          <p className="text-[10px] opacity-60 italic">
            {effective ? `Currently: ${formatRimWorldDate(effective)}` : "No date recorded yet."}
          </p>

          {parseRimWorldTimestamp(project.timelineEvents[project.timelineEvents.length - 1]?.timestamp || "") && (
            <p className="text-[9px] opacity-40">
              Latest event: {project.timelineEvents[project.timelineEvents.length - 1].timestamp}
            </p>
          )}
        </div>
      )}
    </div>
  );
};