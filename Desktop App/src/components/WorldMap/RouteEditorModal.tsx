import React, { useState } from "react";
import { X, Plus, Trash2, AlertTriangle, Save } from "lucide-react";
import { MapRoute, StoryProject, ThreatLevel, ThemeMode, TravelHazard } from "../../types";
import { selectClasses } from "../../lib/uiTheme";
import { autoTravelDays } from "../../lib/routeEngine";

interface RouteEditorModalProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  route: MapRoute | null;
  initSourceId?: string;
  initTargetId?: string;
  onClose: () => void;
  onSaved: (route: MapRoute) => void;
}

function freshHazard(): TravelHazard {
  return {
    id: `haz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    label: "",
    severity: "Moderate",
    description: "",
  };
}

export const RouteEditorModal: React.FC<RouteEditorModalProps> = ({
  project,
  setProject,
  theme,
  route,
  initSourceId,
  initTargetId,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(route?.name || "");
  const [sourceId, setSourceId] = useState(route?.sourceId || initSourceId || "");
  const [targetId, setTargetId] = useState(route?.targetId || initTargetId || "");
  const [distanceHexes, setDistanceHexes] = useState(route?.distanceHexes || 3);
  const [terrainDiff, setTerrainDiff] = useState(route?.terrainDifficultyAvg || 1.0);
  const [notes, setNotes] = useState(route?.notes || "");
  const [hazards, setHazards] = useState<TravelHazard[]>(route?.hazards || []);
  const [error, setError] = useState("");

  const locked = !!(initSourceId && initTargetId && !route);
  const days = autoTravelDays(distanceHexes, terrainDiff);

  const addHazard = () => setHazards([...hazards, freshHazard()]);
  const removeHazard = (id: string) => setHazards(hazards.filter((h) => h.id !== id));
  const updateHazard = (id: string, patch: Partial<TravelHazard>) =>
    setHazards(hazards.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const handleSave = () => {
    if (!name.trim()) { setError("Route name is required."); return; }
    if (!sourceId || !targetId) { setError("Select both endpoints."); return; }
    if (sourceId === targetId) { setError("Endpoints must be different."); return; }

    const base: MapRoute = {
      id: route?.id || `route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: name.trim(),
      sourceId,
      targetId,
      distanceHexes,
      terrainDifficultyAvg: terrainDiff,
      travelDaysOnFoot: days.onFoot,
      travelDaysMuffalo: days.muffalo,
      travelDaysDropPods: days.dropPods,
      travelDaysMechanoid: days.mechanoid,
      logisticalHazards: route?.logisticalHazards || [],
      hazards: hazards.filter((h) => h.label.trim()),
      notes: notes.trim() || undefined,
    };

    const existing = project.mapRoutes || [];
    const nextRoutes = route
      ? existing.map((r) => (r.id === route.id ? base : r))
      : [...existing, base];

    setProject({
      ...project,
      mapRoutes: nextRoutes,
      lastUpdated: new Date().toISOString(),
    });
    onSaved(base);
  };

  const locLabel = (id: string) => project.locations.find((l) => l.id === id)?.name || "?";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-4 ${
          theme === "dark"
            ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
            : theme === "parchment"
            ? "bg-amber-50 border-amber-300 text-stone-900"
            : "bg-slate-900 border-cyan-800 text-cyan-50"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <h3 className="font-serif font-bold text-base flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{route ? "Edit Route" : "New Route"}</span>
          </h3>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Route Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Iron Pass Ore Highway"
            className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
          />
        </div>

        {/* Endpoints */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Origin *</label>
            {locked ? (
              <div className="px-3 py-1.5 rounded-lg border bg-black/30 text-xs font-semibold">{locLabel(sourceId)}</div>
            ) : (
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
              >
                <option value="">— Origin —</option>
                {project.locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Destination *</label>
            {locked ? (
              <div className="px-3 py-1.5 rounded-lg border bg-black/30 text-xs font-semibold">{locLabel(targetId)}</div>
            ) : (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
              >
                <option value="">— Destination —</option>
                {project.locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Distance + Terrain */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Distance (hexes)</label>
            <input
              type="number" min="1" step="1"
              value={distanceHexes}
              onChange={(e) => setDistanceHexes(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">
              Terrain Difficulty ({terrainDiff}×)
            </label>
            <input
              type="range" min="0.5" max="3.0" step="0.1"
              value={terrainDiff}
              onChange={(e) => setTerrainDiff(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        {/* Auto-computed travel days */}
        <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
          <div className="p-2 rounded-lg border border-white/10 bg-black/20 text-center">
            <span className="opacity-50 block">On Foot</span>
            <span className="font-bold text-amber-400 text-sm">{days.onFoot}d</span>
          </div>
          <div className="p-2 rounded-lg border border-white/10 bg-black/20 text-center">
            <span className="opacity-50 block">Muffalo</span>
            <span className="font-bold text-emerald-400 text-sm">{days.muffalo}d</span>
          </div>
          <div className="p-2 rounded-lg border border-white/10 bg-black/20 text-center">
            <span className="opacity-50 block">Drop Pods</span>
            <span className="font-bold text-blue-400 text-sm">{days.dropPods}d</span>
          </div>
          <div className="p-2 rounded-lg border border-white/10 bg-black/20 text-center">
            <span className="opacity-50 block">Mechanoid</span>
            <span className="font-bold text-purple-400 text-sm">{days.mechanoid}d</span>
          </div>
        </div>

        {/* Hazards */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-serif font-bold text-xs flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Travel Hazards</span>
            </h4>
            <button
              onClick={addHazard}
              className="flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
            >
              <Plus className="w-3 h-3" /> <span>Add Hazard</span>
            </button>
          </div>

          {hazards.length === 0 && (
            <p className="text-[11px] italic opacity-50">No hazards defined — routes with hazards escalate Travel event threat levels.</p>
          )}

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {hazards.map((h) => (
              <div key={h.id} className="p-2.5 rounded-xl border border-white/10 bg-black/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={h.label}
                    onChange={(e) => updateHazard(h.id, { label: e.target.value })}
                    placeholder="Hazard label..."
                    className="flex-1 px-2 py-1 rounded border bg-black/20 outline-none text-[11px]"
                  />
                  <select
                    value={h.severity}
                    onChange={(e) => updateHazard(h.id, { severity: e.target.value as ThreatLevel })}
                    className={`px-2 py-1 rounded text-[10px] outline-none cursor-pointer ${selectClasses(theme)}`}
                  >
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Major">Major</option>
                    <option value="Catastrophic">Catastrophic</option>
                  </select>
                  <button
                    onClick={() => removeHazard(h.id)}
                    className="p-1 text-red-400 opacity-60 hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="text"
                  value={h.description || ""}
                  onChange={(e) => updateHazard(h.id, { description: e.target.value })}
                  placeholder="Optional description..."
                  className="w-full px-2 py-1 rounded border bg-black/20 outline-none text-[10px] opacity-80"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Strategic importance, lore, discovered resources..."
            className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs resize-y"
          />
        </div>

        {error && <p className="text-red-400 text-[11px] italic">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end space-x-2 pt-2 border-t border-white/10">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 flex items-center space-x-1.5 ${
              theme === "dark"
                ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                : theme === "parchment"
                ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Route</span>
          </button>
        </div>
      </div>
    </div>
  );
};
