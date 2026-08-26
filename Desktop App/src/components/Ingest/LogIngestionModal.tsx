import React, { useState } from "react";
import {
  Sparkles,
  FileText,
  Upload,
  Layers,
  Flame,
  UserPlus,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  WifiOff
} from "lucide-react";
import { ThemeMode, StoryProject, TimelineEvent } from "../../types";
import { aiFetch } from "../../lib/aiClient";
import { applyInferredAnalysis } from "../../lib/preceptEngine";

interface LogIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  isAiMode: boolean;
}

const SAMPLE_RAW_LOGS = [
  {
    title: "Toxic Fallout & Cold Snap (Year 5503)",
    text: `Day 42, Decembary 5503:
- A toxic fallout cloud blankets Mount Karas (-52°C).
- Valerie Vance suffers severe hypothermia while fixing the geothermal conduit. Left index finger frostbitten.
- Cole Briggs experiences a Major Mental Break: Sadistic Rage after his bonded timber wolf 'Fang' died from toxic buildup.
- Cole attacks captured pirate prisoner 'Gorgon' (Ashen Skulls faction), breaking Gorgon's ribs before being subdued by Valerie.
- Food reserves dropped to 14 simple meals. Hydroponics solar flare knocks out power for 18 hours.
- A psychic soothe drone (female) passes over, saving Valerie from breaking.`,
  },
  {
    title: "Mechanoid Drop Pod Raid on Hospital (Year 5504)",
    text: `Day 12, Aprimay 5504:
- 3 Mechanoid Drop Pods crash through the roof of the hospital ward!
- 2 Scythers and 1 Centipede with Heavy Charge Blaster emerge.
- Valerie Vance grabs her Plasteel Longsword and shields the wounded pawn Hanz.
- Cole Briggs activates the emergency Firefoam popper and fires an EMP grenade into the doorway, stunning the Centipede.
- Valerie is slashed across the torso (scar: Mangled Torso), but decapitates the leading Scyther.
- Faction Ashen Skulls sends an opportunistic 8-man raid from the South gate at the exact same moment.
- Cole rigs the chemfuel tanks to explode, routing the pirates while Valerie finishes the disabled Centipede.`,
  },
];

export const LogIngestionModal: React.FC<LogIngestionModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  theme,
  isAiMode,
}) => {
  const [rawText, setRawText] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState("");
  const [ingestionSummary, setIngestionSummary] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleIngest = async () => {
    if (!rawText.trim()) return;
    setIsIngesting(true);
    setError("");
    setIngestionSummary(null);

    try {
      const res = await aiFetch("/api/ai/ingest-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          existingContext: {
            characters: project.characters,
            factions: project.factions,
            timelineEvents: project.timelineEvents,
            wikiArticles: project.wikiArticles,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to process colony logs with AI");
      }

      const data = await res.json();

      // Merge newly extracted entities into project
      const newChars = [...project.characters];
      if (Array.isArray(data.characters)) {
        data.characters.forEach((c: any) => {
          const idx = newChars.findIndex(
            (nc) => nc.name.toLowerCase() === c.name.toLowerCase()
          );
          if (idx >= 0) {
            newChars[idx] = { ...newChars[idx], ...c };
          } else {
            newChars.push({
              ...c,
              id: c.id || `char-${Date.now()}-${Math.random()}`,
            });
          }
        });
      }

      const mergedEvents = [...project.timelineEvents];
      const freshEvents: TimelineEvent[] = [];
      if (Array.isArray(data.events)) {
        data.events.forEach((e: any) => {
          const withId: TimelineEvent = {
            ...e,
            id: e.id || `evt-${Date.now()}-${Math.random()}`,
          };
          freshEvents.push(withId);
          mergedEvents.push(withId);
        });
      }

      let workingProject: StoryProject = {
        ...project,
        characters: newChars,
        timelineEvents: mergedEvents,
      };
      if (freshEvents.length > 0) {
        const freshIds = new Set(freshEvents.map((e) => e.id));
        const analyzedEvents: TimelineEvent[] = [];
        for (const evt of workingProject.timelineEvents) {
          if (!freshIds.has(evt.id)) {
            analyzedEvents.push(evt);
            continue;
          }
          const res = applyInferredAnalysis(workingProject, evt);
          analyzedEvents.push(res.event);
          workingProject = res.project;
        }
        workingProject = { ...workingProject, timelineEvents: analyzedEvents };
      }

      const newArticles = [...project.wikiArticles];
      if (Array.isArray(data.wikiArticles)) {
        data.wikiArticles.forEach((art: any) => {
          const idx = newArticles.findIndex(
            (a) => a.title.toLowerCase() === art.title.toLowerCase()
          );
          if (idx >= 0) {
            newArticles[idx] = { ...newArticles[idx], ...art };
          } else {
            newArticles.push({
              ...art,
              id: art.id || `art-${Date.now()}-${Math.random()}`,
            });
          }
        });
      }

      const newRels = [...project.relationships];
      if (Array.isArray(data.relationships)) {
        data.relationships.forEach((r: any) => {
          newRels.push({
            ...r,
            id: r.id || `rel-${Date.now()}-${Math.random()}`,
          });
        });
      }

      setProject({
        ...workingProject,
        wikiArticles: newArticles,
        relationships: newRels,
        lastUpdated: new Date().toISOString(),
      });

      setIngestionSummary(
        data.summary ||
          `Successfully synthesized ${data.events?.length || 0} events, ${
            data.characters?.length || 0
          } characters, and ${data.wikiArticles?.length || 0} markdown wiki entries.`
      );
      setRawText("");
    } catch (err: any) {
      setError(err.message || "Failed to process raw logs");
    } finally {
      setIsIngesting(false);
    }
  };

  return (    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl p-6 sm:p-8 rounded-2xl border shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${
          theme === "dark"
            ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
            : theme === "parchment"
            ? "bg-amber-50 border-amber-300 text-stone-900"
            : "bg-slate-900 border-cyan-800 text-cyan-50"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="font-serif font-bold text-lg sm:text-xl flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Ingest Raw RimWorld Logs & Game Events</span>
            </h3>
            <p className="text-xs opacity-75 mt-0.5">
              Paste raw combat logs, letters, notes, or gameplay summaries. OpenCode AI will auto-generate Markdown wiki articles, update character arcs, and add timeline beats.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs opacity-60 hover:opacity-100 p-1 font-mono text-sm"
          >
            ✕
          </button>
        </div>

        {/* Offline Mode Notice */}
        {!isAiMode && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs space-y-1">
            <div className="flex items-center space-x-2 font-bold font-serif text-sm">
              <WifiOff className="w-4 h-4" />
              <span>AI Mode is disabled</span>
            </div>
            <p className="opacity-90 leading-relaxed">
              Automatic log ingestion parses raw text with AI and requires AI Mode to run.
              Re-enable AI Mode from the header toggle to synthesize wiki articles, characters,
              and timeline beats from logs — or build your world manually with the World Wiki
              editor and the Social Web's colonist tools.
            </p>
          </div>
        )}

        {/* Sample Log Presets */}
        <div>
          <span className="text-[11px] font-mono opacity-60 block mb-1.5 uppercase">
            Quick Load Sample Scenarios:
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_RAW_LOGS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!isAiMode}
                onClick={() => setRawText(sample.text)}
                className="text-xs px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 font-mono text-[11px] text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                + {sample.title}
              </button>
            ))}
          </div>
        </div>

        {/* Text Area */}
        <div className="space-y-2">
          <label className="text-xs font-mono opacity-70 block">
            Raw Combat Logs / Playthrough Notes
          </label>
          <textarea
            id="raw-log-input-textarea"
            rows={8}
            value={rawText}
            disabled={!isAiMode}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste colony messages here... (e.g. 'Day 5: Manhunter megasloth breached outer wall; Cole shot it in the eye but lost his left ear...')"
            className={`w-full p-4 rounded-xl font-mono text-xs sm:text-sm border outline-none leading-relaxed resize-y disabled:opacity-50 ${
              theme === "dark"
                ? "bg-[#0c0c0e] border-[#222228] text-[#f1f5f9]"
                : theme === "parchment"
                ? "bg-amber-50 border-amber-300 text-stone-900"
                : "bg-slate-950 border-cyan-900 text-cyan-50"
            }`}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success summary */}
        {ingestionSummary && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1 animate-in fade-in">
            <div className="flex items-center space-x-2 font-bold font-serif text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Colony Lore & Wiki Updated!</span>
            </div>
            <p className="opacity-90">{ingestionSummary}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs border border-white/10 opacity-70 hover:opacity-100"
          >
            Close
          </button>

          <button
            id="btn-process-raw-logs"
            onClick={handleIngest}
            disabled={!isAiMode || isIngesting || !rawText.trim()}
            title={isAiMode ? undefined : "Log ingestion requires AI Mode"}
            className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
              theme === "dark"
                ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e] font-bold"
                : theme === "parchment"
                ? "bg-amber-800 hover:bg-amber-700 text-amber-50 font-bold"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
            }`}
          >
            {isIngesting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Synthesizing World & Wiki...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Generate Wiki & Chronicle</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
