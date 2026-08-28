import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Map as MapIcon,
  Plus,
  Route,
  Tag,
  AlertTriangle,
  Trash2,
  Edit3,
  ExternalLink,
  Landmark,
  Mountain,
  Swords,
  Skull,
  Gem,
  Brain,
  Rocket,
  Store,
  Tent,
  Shield,
  Castle,
  Crown,
  Scroll,
  Eye,
  EyeOff,
  Info,
  Compass,
} from "lucide-react";
import {
  LocationItem,
  MapRoute,
  StoryProject,
  ThemeMode,
  ThreatLevel,
} from "../../types";
import { selectClasses } from "../../lib/uiTheme";
import { useLexicon } from "../../lib/lexicon";
import { getTaxonomy, taxonomyLabel } from "../../lib/taxonomy";
import { resolveHazards, autoTravelDays } from "../../lib/routeEngine";
import { RouteEditorModal } from "./RouteEditorModal";
import { LocationEditorModal } from "./LocationEditorModal";

interface WorldMapViewProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  onNavigateToArticle: (title: string) => void;
}

/* ------------------------------------------------------------------ */
/* Icon mapping                                                          */
/* ------------------------------------------------------------------ */

const WORLD_ICON_BY_ID: Record<string, React.ReactNode> = {
  "loc-colony": <Landmark className="w-4 h-4" />,
  "loc-mining": <Mountain className="w-4 h-4" />,
  "loc-battlefield": <Swords className="w-4 h-4" />,
  "loc-cryptosleep": <Skull className="w-4 h-4" />,
  "loc-resource": <Gem className="w-4 h-4" />,
  "loc-psychic": <Brain className="w-4 h-4" />,
  "loc-ship": <Rocket className="w-4 h-4" />,
  "loc-trade": <Store className="w-4 h-4" />,
  "loc-tribal": <Tent className="w-4 h-4" />,
  "loc-raider": <Shield className="w-4 h-4" />,
};

const DUNGEON_ICON_BY_ID: Record<string, React.ReactNode> = {
  "loc-colony": <Castle className="w-4 h-4" />,
  "loc-mining": <Mountain className="w-4 h-4" />,
  "loc-battlefield": <Swords className="w-4 h-4" />,
  "loc-cryptosleep": <Skull className="w-4 h-4" />,
  "loc-resource": <Gem className="w-4 h-4" />,
  "loc-psychic": <Scroll className="w-4 h-4" />,
  "loc-ship": <Skull className="w-4 h-4" />,
  "loc-trade": <Store className="w-4 h-4" />,
  "loc-tribal": <Tent className="w-4 h-4" />,
  "loc-raider": <Castle className="w-4 h-4" />,
};

// Legacy label aliases so pre-migration in-memory projects still resolve.
const LEGACY_TYPE_ALIASES: Record<string, string> = {
  "Colony Settlement": "loc-colony",
  "Mining Outpost": "loc-mining",
  "Battlefield & War Zone": "loc-battlefield",
  "Ancient Cryptosleep Ruins": "loc-cryptosleep",
  "Resource Deposit": "loc-resource",
  "Psychic Hotspot": "loc-psychic",
  "Crashed Ship Hull": "loc-ship",
  "Trading Hub": "loc-trade",
  "Tribal Camp": "loc-tribal",
  "Raider Fortress": "loc-raider",
};

function nodeIcon(type: string, skin: "world" | "dungeon") {
  const id = LEGACY_TYPE_ALIASES[type] || type;
  const map = skin === "dungeon" ? DUNGEON_ICON_BY_ID : WORLD_ICON_BY_ID;
  return map[id] || <Landmark className="w-4 h-4" />;
}

const DANGER_COLORS: Record<string, string> = {
  Safe: "#10b981",
  Dangerous: "#f59e0b",
  "Extreme Hazard": "#ef4444",
};

const HAZARD_THREAT_COLORS: Record<ThreatLevel, string> = {
  Minor: "#64748b",
  Moderate: "#f59e0b",
  Major: "#ef4444",
  Catastrophic: "#991b1b",
};

function fracPosition(
  loc: LocationItem,
  idx: number,
  total: number,
  width: number,
  height: number
): { x: number; y: number } {
  if (loc.position) {
    return {
      x: (loc.position.x / 100) * width,
      y: (loc.position.y / 100) * height,
    };
  }
  if (loc.hexCoord) {
    const cx = width / 2 + loc.hexCoord.q * 45;
    const cy = height / 2 + loc.hexCoord.r * 45;
    return { x: cx, y: cy };
  }
  const angle = (idx / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
  const r = Math.min(width, height) * 0.35;
  return {
    x: width / 2 + r * Math.cos(angle),
    y: height / 2 + r * Math.sin(angle),
  };
}

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  project,
  setProject,
  theme,
  onNavigateToArticle,
}) => {
  const lex = useLexicon();
  const tax = getTaxonomy(project);
  const typeLabel = (v: string) => taxonomyLabel(tax.locationTypes, v);
  const biomeLabel = (v: string) => taxonomyLabel(tax.biomes, v);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ width: 700, height: 500 });

  /* --- display toggles --- */
  const [showLabels, setShowLabels] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [skin, setSkin] = useState<"world" | "dungeon">(
    project.mapSettings?.mapSkin || "world"
  );

  /* --- selection --- */
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  /* --- draw-route mode --- */
  const [drawMode, setDrawMode] = useState(false);
  const [drawSourceId, setDrawSourceId] = useState<string | null>(null);
  const [drawMouse, setDrawMouse] = useState<{ x: number; y: number } | null>(null);

  /* --- modals --- */
  const [routeEditorOpen, setRouteEditorOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<MapRoute | null>(null);
  const [routeEditorInit, setRouteEditorInit] = useState<{
    sourceId?: string;
    targetId?: string;
  }>({});
  const [locationEditorOpen, setLocationEditorOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);

  /* --- drag state --- */
  const [dragOverrides, setDragOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const dragRef = useRef<{
    id: string;
    ox: number;
    oy: number;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);

  /* --- resize --- */
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDims({
          width: Math.max(e.contentRect.width, 400),
          height: Math.max(e.contentRect.height, 400),
        });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  /* --- persisted skin --- */
  const persistSkin = (next: "world" | "dungeon") => {
    setSkin(next);
    setProject({
      ...project,
      mapSettings: { ...(project.mapSettings || {} as any), mapSkin: next },
      lastUpdated: new Date().toISOString(),
    });
  };

  /* --- node positions --- */
  const nodes = useMemo(
    () =>
      project.locations.map((loc, i) => {
        const override = dragOverrides[loc.id];
        if (override) return { ...loc, _x: override.x, _y: override.y };
        const p = fracPosition(loc, i, project.locations.length, dims.width, dims.height);
        return { ...loc, _x: p.x, _y: p.y };
      }),
    [project.locations, dragOverrides, dims]
  );

  const nodeMap = useMemo(() => {
    const m = new Map<string, (typeof nodes)[0]>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  /* --- svg helpers --- */
  const svgPt = (e: React.PointerEvent | PointerEvent): { x: number; y: number } | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  /* --- drag handlers --- */
  const onNodePointerDown = (e: React.PointerEvent, loc: LocationItem) => {
    if (drawMode) return;
    e.preventDefault();
    const pt = svgPt(e);
    if (!pt) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const pos = nodeMap.get(loc.id);
    dragRef.current = {
      id: loc.id,
      ox: pt.x - (pos?._x || 0),
      oy: pt.y - (pos?._y || 0),
      sx: pt.x,
      sy: pt.y,
      moved: false,
    };
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const pt = svgPt(e);
    if (!pt) return;

    if (drawMode) {
      setDrawMouse(pt);
      return;
    }

    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(pt.x - d.sx, pt.y - d.sy) > 4) d.moved = true;
    const nx = Math.min(Math.max(pt.x - d.ox, 30), dims.width - 30);
    const ny = Math.min(Math.max(pt.y - d.oy, 30), dims.height - 30);
    setDragOverrides((prev) => ({ ...prev, [d.id]: { x: nx, y: ny } }));
  };

  const onPointerUp = () => {
    if (dragRef.current?.moved) {
      // persist the final position
      const d = dragRef.current;
      const pos = dragOverrides[d.id];
      if (pos) {
        setProject({
          ...project,
          locations: project.locations.map((l) =>
            l.id === d.id ? { ...l, position: { x: (pos.x / dims.width) * 100, y: (pos.y / dims.height) * 100 } } : l
          ),
          lastUpdated: new Date().toISOString(),
        });
      }
    }
    window.setTimeout(() => { dragRef.current = null; }, 0);
  };

  /* --- node click --- */
  const onNodeClick = (loc: LocationItem) => {
    if (dragRef.current?.moved) return;

    if (drawMode) {
      if (!drawSourceId) {
        setDrawSourceId(loc.id);
      } else if (drawSourceId !== loc.id) {
        // Open route editor with these two endpoints
        setEditingRoute(null);
        setRouteEditorInit({ sourceId: drawSourceId, targetId: loc.id });
        setRouteEditorOpen(true);
        setDrawMode(false);
        setDrawSourceId(null);
        setDrawMouse(null);
      }
      return;
    }

    setSelectedNodeId(loc.id);
    setSelectedRouteId(null);
  };

  /* --- edge click --- */
  const onEdgeClick = (route: MapRoute) => {
    if (drawMode) return;
    setSelectedRouteId(route.id);
    setSelectedNodeId(null);
  };

  /* --- reset layout --- */
  const resetLayout = () => {
    setDragOverrides({});
  };

  /* --- delete helpers --- */
  const deleteLocation = (loc: LocationItem) => {
    if (!window.confirm(`Delete "${loc.name}" and remove all routes connected to it?`)) return;
    setProject({
      ...project,
      locations: project.locations.filter((l) => l.id !== loc.id),
      mapRoutes: (project.mapRoutes || []).filter(
        (r) => r.sourceId !== loc.id && r.targetId !== loc.id
      ),
      lastUpdated: new Date().toISOString(),
    });
    setSelectedNodeId(null);
  };

  const deleteRoute = (route: MapRoute) => {
    if (!window.confirm(`Delete route "${route.name}"?`)) return;
    setProject({
      ...project,
      mapRoutes: (project.mapRoutes || []).filter((r) => r.id !== route.id),
      lastUpdated: new Date().toISOString(),
    });
    setSelectedRouteId(null);
  };

  /* --- selected entity --- */
  const selectedNode = selectedNodeId
    ? project.locations.find((l) => l.id === selectedNodeId) || null
    : null;
  const selectedRoute = selectedRouteId
    ? (project.mapRoutes || []).find((r) => r.id === selectedRouteId) || null
    : null;

  /* --- connected routes for selected node --- */
  const connectedRoutes = useMemo(() => {
    if (!selectedNode) return [];
    return (project.mapRoutes || []).filter(
      (r) => r.sourceId === selectedNode.id || r.targetId === selectedNode.id
    );
  }, [selectedNode, project.mapRoutes]);

  /* ================================================================= */
  /* RENDER                                                              */
  /* ================================================================= */

  const canvasBg = theme === "dark" ? "#0a0a0e" : theme === "parchment" ? "#f5edd6" : "#0a1628";
  const edgeColor = theme === "dark" ? "#334155" : theme === "parchment" ? "#a8885a" : "#1e3a5f";
  const labelBg = theme === "dark" ? "#0c0c0e" : theme === "parchment" ? "#faf3e3" : "#0c1e36";
  const labelBorder = theme === "dark" ? "#25252e" : theme === "parchment" ? "#d4c49a" : "#1e3a5f";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ---- Canvas ---- */}
      <div
        className={`lg:col-span-8 rounded-2xl border p-4 sm:p-6 shadow-sm relative overflow-hidden flex flex-col ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-100/70 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 z-10">
          <div className="flex items-center space-x-2">
            <MapIcon className="w-5 h-5 text-amber-400" />
            <h3 className="font-serif font-bold text-base">
              {skin === "dungeon" ? "Dungeon Crawl Map" : "World Map"}
            </h3>
            <span className="text-xs opacity-50 font-mono">
              ({project.locations.length} nodes · {(project.mapRoutes || []).length} routes)
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            {/* Skin Toggle */}
            <div className="flex items-center rounded-lg p-0.5 border border-white/10">
              <button
                onClick={() => persistSkin("world")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  skin === "world"
                    ? "bg-amber-500/25 text-amber-300"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <MapIcon className="w-3 h-3 inline mr-1" />World
              </button>
              <button
                onClick={() => persistSkin("dungeon")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  skin === "dungeon"
                    ? "bg-purple-500/25 text-purple-300"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Castle className="w-3 h-3 inline mr-1" />Dungeon
              </button>
            </div>

            {/* Draw Route */}
            <button
              onClick={() => {
                setDrawMode(!drawMode);
                setDrawSourceId(null);
                setDrawMouse(null);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all active:scale-95 ${
                drawMode
                  ? "bg-red-500/25 border-red-400/60 text-red-300 animate-pulse"
                  : theme === "dark"
                  ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e]"
                  : "border-amber-300 text-stone-700 hover:bg-amber-200/50"
              }`}
              title="Click two nodes to draw a route between them"
            >
              <Route className="w-3.5 h-3.5" />
              <span>{drawMode ? "Cancel" : "Draw Route"}</span>
            </button>

            {/* Add Location */}
            <button
              onClick={() => { setEditingLocation(null); setLocationEditorOpen(true); }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all active:scale-95 ${
                theme === "dark"
                  ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
                  : theme === "parchment"
                  ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Node</span>
            </button>

            {/* Toggle labels */}
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`p-1.5 rounded-lg border text-[11px] transition-colors ${
                showLabels ? "border-amber-500/40 text-amber-400" : "border-white/10 opacity-50"
              }`}
              title={showLabels ? "Hide labels" : "Show labels"}
            >
              {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            {/* Toggle hazards */}
            <button
              onClick={() => setShowHazards(!showHazards)}
              className={`p-1.5 rounded-lg border text-[11px] transition-colors ${
                showHazards ? "border-red-500/40 text-red-400" : "border-white/10 opacity-50"
              }`}
              title={showHazards ? "Hide route hazards" : "Show route hazards"}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Draw-mode hint */}
        {drawMode && (
          <div className="text-[11px] text-center py-1.5 font-mono opacity-80 text-amber-300">
            {!drawSourceId
              ? "Click the origin node..."
              : `Origin selected — click the destination node...`}
          </div>
        )}

        {/* SVG Canvas */}
        <div ref={containerRef} className="w-full h-[450px] relative mt-2 select-none">
          {Object.keys(dragOverrides).length > 0 && (
            <button
              onClick={resetLayout}
              className={`absolute top-2 right-2 z-10 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                theme === "dark"
                  ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e]"
                  : "border-amber-300 text-stone-700 hover:bg-amber-200/50"
              }`}
            >
              Reset Layout
            </button>
          )}

          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ touchAction: "none" }}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* Grid background */}
            <defs>
              <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke={edgeColor} strokeOpacity="0.15" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={canvasBg} />
            <rect width="100%" height="100%" fill="url(#map-grid)" />

            {/* Route edges */}
            {(project.mapRoutes || []).map((route) => {
              const src = nodeMap.get(route.sourceId);
              const tgt = nodeMap.get(route.targetId);
              if (!src || !tgt) return null;

              const hazards = resolveHazards(route);
              const worstHazard = hazards.length > 0
                ? hazards.reduce((w, h) => {
                    const ord = { Minor: 0, Moderate: 1, Major: 2, Catastrophic: 3 };
                    return ord[h.severity] > ord[w.severity] ? h : w;
                  }, hazards[0])
                : null;
              const edgeHazardColor = worstHazard
                ? HAZARD_THREAT_COLORS[worstHazard.severity]
                : edgeColor;
              const isSelected = selectedRouteId === route.id;
              const days = autoTravelDays(route.distanceHexes, route.terrainDifficultyAvg);
              const lineW = Math.min(1 + route.terrainDifficultyAvg, 5);

              const mx = (src._x + tgt._x) / 2;
              const my = (src._y + tgt._y) / 2;

              return (
                <g key={route.id} onClick={() => onEdgeClick(route)} className="cursor-pointer">
                  <line
                    x1={src._x} y1={src._y}
                    x2={tgt._x} y2={tgt._y}
                    stroke={isSelected ? "#f59e0b" : edgeHazardColor}
                    strokeWidth={isSelected ? lineW + 2 : lineW}
                    strokeDasharray={days.onFoot > 3 ? "8 4" : "none"}
                    opacity={isSelected ? 1 : 0.7}
                  />
                  {/* Route label */}
                  {showLabels && (
                    <g transform={`translate(${mx}, ${my})`}>
                      <rect
                        x={-(route.name.length * 3.2 + 8)}
                        y="-10"
                        width={route.name.length * 6.4 + 16}
                        height="20"
                        rx="5"
                        fill={labelBg}
                        fillOpacity="0.9"
                        stroke={isSelected ? "#f59e0b" : labelBorder}
                        strokeWidth="1"
                      />
                      <text
                        textAnchor="middle" dy="4"
                        fontSize="9" fontWeight="bold"
                        fill={isSelected ? "#f59e0b" : "currentColor"}
                        fontFamily="monospace" opacity="0.8"
                      >
                        {route.name}
                      </text>
                    </g>
                  )}
                  {/* Hazard badges */}
                  {showHazards && hazards.length > 0 && (
                    <g transform={`translate(${mx + route.name.length * 3.2 + 14}, ${my - 6})`}>
                      <rect x="-2" y="-2" width="18" height="14" rx="4" fill={edgeHazardColor} opacity="0.9" />
                      <text textAnchor="middle" dy="8" fontSize="8" fontWeight="bold" fill="#fff" fontFamily="monospace">
                        {hazards.length}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Draw-mode temp line */}
            {drawMode && drawSourceId && drawMouse && (() => {
              const src = nodeMap.get(drawSourceId);
              if (!src) return null;
              return (
                <line
                  x1={src._x} y1={src._y}
                  x2={drawMouse.x} y2={drawMouse.y}
                  stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 4" opacity="0.7"
                />
              );
            })()}

            {/* Location nodes */}
            {nodes.map((loc) => {
              const isSelected = selectedNodeId === loc.id;
              const isDrawSource = drawSourceId === loc.id;
              const dangerColor = DANGER_COLORS[loc.dangerLevel] || "#64748b";
              const icon = nodeIcon(loc.type, skin);
              const nameLen = loc.name.length;
              const r = 26;

              return (
                <g
                  key={loc.id}
                  transform={`translate(${loc._x}, ${loc._y})`}
                  onClick={() => onNodeClick(loc)}
                  onPointerDown={(e) => onNodePointerDown(e, loc)}
                  className={`cursor-pointer transition-[filter] duration-150 hover:brightness-125 ${
                    drawMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
                  }`}
                >
                  {/* Selection pulse */}
                  {(isSelected || isDrawSource) && (
                    <circle
                      r={r + 10}
                      fill="none"
                      stroke={isDrawSource ? "#ef4444" : "#f59e0b"}
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      className="animate-spin"
                      style={{ animationDuration: "12s" }}
                    />
                  )}

                  {/* Node circle */}
                  <circle
                    r={r}
                    fill={skin === "dungeon" ? "#1a1028" : "#111827"}
                    stroke={isSelected ? "#f59e0b" : dangerColor}
                    strokeWidth={isSelected ? 3 : 2}
                  />

                  {/* Icon */}
                  <foreignObject x={-10} y={-10} width="20" height="20">
                    <div className="flex items-center justify-center w-full h-full text-white">
                      {icon}
                    </div>
                  </foreignObject>

                  {/* Danger ring */}
                  <circle
                    r={r + 3}
                    fill="none"
                    stroke={dangerColor}
                    strokeWidth="1.5"
                    opacity="0.4"
                  />

                  {/* Name label */}
                  {showLabels && (
                    <g transform={`translate(0, ${r + 14})`}>
                      <rect
                        x={-(nameLen * 3.5 + 8)}
                        y="-10"
                        width={nameLen * 7 + 16}
                        height="20"
                        rx="5"
                        fill={labelBg}
                        fillOpacity="0.92"
                        stroke={isSelected ? "#f59e0b" : labelBorder}
                        strokeWidth="1"
                      />
                      <text
                        textAnchor="middle" dy="4"
                        fontSize="10" fontWeight="bold"
                        fill="currentColor"
                        fontFamily="sans-serif"
                      >
                        {loc.name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ---- Sidebar ---- */}
      <div
        className={`lg:col-span-4 rounded-2xl border p-6 shadow-sm space-y-5 ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-50/90 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        {selectedNode ? (
          <div className="space-y-4">
            {/* Location Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border-2`}
                  style={{ borderColor: DANGER_COLORS[selectedNode.dangerLevel] || "#64748b" }}
                >
                  {nodeIcon(selectedNode.type, skin)}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm leading-tight">{selectedNode.name}</h3>
                  <span className="text-[10px] font-mono opacity-60">{typeLabel(selectedNode.type)}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => { setEditingLocation(selectedNode); setLocationEditorOpen(true); }}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    theme === "dark"
                      ? "border-slate-700 hover:bg-slate-800 text-amber-400"
                      : "border-amber-300 hover:bg-amber-200 text-amber-900"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {selectedNode.linkedArticleId && (
                  <button
                    onClick={() => onNavigateToArticle(selectedNode.name)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      theme === "dark"
                        ? "border-slate-700 hover:bg-slate-800 text-amber-400"
                        : "border-amber-300 hover:bg-amber-200 text-amber-900"
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => deleteLocation(selectedNode)}
                  className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Danger + Biome + Faction */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className={`p-2 rounded-lg border border-white/10 bg-black/20`}>
                <span className="text-[9px] font-mono uppercase opacity-50 block">Danger</span>
                <span className="font-bold" style={{ color: DANGER_COLORS[selectedNode.dangerLevel] }}>
                  {selectedNode.dangerLevel}
                </span>
              </div>
              {selectedNode.biome && (
                <div className="p-2 rounded-lg border border-white/10 bg-black/20">
                  <span className="text-[9px] font-mono uppercase opacity-50 block">Biome</span>
                  <span className="font-bold">{biomeLabel(selectedNode.biome)}</span>
                </div>
              )}
              {selectedNode.controllingFaction && (
                <div className="p-2 rounded-lg border border-white/10 bg-black/20 col-span-2">
                  <span className="text-[9px] font-mono uppercase opacity-50 block">Controlling Faction</span>
                  <span className="font-bold text-cyan-400">{selectedNode.controllingFaction}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedNode.description && (
              <p className="text-[11px] opacity-80 leading-relaxed">{selectedNode.description}</p>
            )}

            {/* Connected Routes */}
            {connectedRoutes.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <h4 className="font-serif font-bold text-xs mb-2">Connected Routes ({connectedRoutes.length})</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {connectedRoutes.map((r) => {
                    const otherId = r.sourceId === selectedNode!.id ? r.targetId : r.sourceId;
                    const other = project.locations.find((l) => l.id === otherId);
                    const hazards = resolveHazards(r);
                    const days = autoTravelDays(r.distanceHexes, r.terrainDifficultyAvg);
                    return (
                      <div
                        key={r.id}
                        className={`p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                          selectedRouteId === r.id
                            ? "border-amber-500/60 bg-amber-500/10"
                            : "border-white/10 bg-black/20 hover:bg-black/30"
                        }`}
                        onClick={() => { setSelectedRouteId(r.id); setSelectedNodeId(null); }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold font-serif">{r.name}</span>
                          {hazards.length > 0 && (
                            <span className="flex items-center space-x-0.5 text-[9px] text-red-400">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{hazards.length}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] opacity-60">
                          → {other?.name || "?"} · {days.onFoot}d on foot · {r.distanceHexes} hex
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : selectedRoute ? (
          <div className="space-y-4">
            {/* Route Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/20 border border-cyan-500/40">
                  <Compass className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm leading-tight">{selectedRoute.name}</h3>
                  <span className="text-[10px] font-mono opacity-60">
                    {project.locations.find((l) => l.id === selectedRoute.sourceId)?.name || "?"} →{" "}
                    {project.locations.find((l) => l.id === selectedRoute.targetId)?.name || "?"}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => { setEditingRoute(selectedRoute); setRouteEditorInit({}); setRouteEditorOpen(true); }}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    theme === "dark"
                      ? "border-slate-700 hover:bg-slate-800 text-amber-400"
                      : "border-amber-300 hover:bg-amber-200 text-amber-900"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteRoute(selectedRoute)}
                  className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Travel Days Matrix */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {(() => {
                const days = autoTravelDays(selectedRoute.distanceHexes, selectedRoute.terrainDifficultyAvg);
                return (
                  <>
                    <div className="p-2 rounded-lg border border-white/10 bg-black/20">
                      <span className="text-[9px] font-mono uppercase opacity-50 block">Distance</span>
                      <span className="font-bold">{selectedRoute.distanceHexes} hexes</span>
                    </div>
                    <div className="p-2 rounded-lg border border-white/10 bg-black/20">
                      <span className="text-[9px] font-mono uppercase opacity-50 block">Terrain Diff.</span>
                      <span className="font-bold">{selectedRoute.terrainDifficultyAvg}×</span>
                    </div>
                    <div className="p-2 rounded-lg border border-white/10 bg-black/20">
                      <span className="text-[9px] font-mono uppercase opacity-50 block">On Foot</span>
                      <span className="font-bold text-amber-400">{days.onFoot}d</span>
                    </div>
                    <div className="p-2 rounded-lg border border-white/10 bg-black/20">
                      <span className="text-[9px] font-mono uppercase opacity-50 block">Muffalo</span>
                      <span className="font-bold text-emerald-400">{days.muffalo}d</span>
                    </div>
                    <div className="p-2 rounded-lg border border-white/10 bg-black/20">
                      <span className="text-[9px] font-mono uppercase opacity-50 block">Drop Pods</span>
                      <span className="font-bold text-blue-400">{days.dropPods}d</span>
                    </div>
                    <div className="p-2 rounded-lg border border-white/10 bg-black/20">
                      <span className="text-[9px] font-mono uppercase opacity-50 block">Mechanoid</span>
                      <span className="font-bold text-purple-400">{days.mechanoid}d</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Hazards */}
            {(() => {
              const hazards = resolveHazards(selectedRoute);
              if (hazards.length === 0) return null;
              return (
                <div className="pt-2 border-t border-white/10">
                  <h4 className="font-serif font-bold text-xs mb-2">Travel Hazards ({hazards.length})</h4>
                  <div className="space-y-1.5">
                    {hazards.map((h) => (
                      <div key={h.id} className="p-2 rounded-lg border border-white/10 bg-black/20 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{h.label}</span>
                          <span
                            className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded"
                            style={{
                              backgroundColor: `${HAZARD_THREAT_COLORS[h.severity]}22`,
                              color: HAZARD_THREAT_COLORS[h.severity],
                            }}
                          >
                            {h.severity}
                          </span>
                        </div>
                        {h.description && (
                          <p className="text-[10px] opacity-70 mt-0.5">{h.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Notes */}
            {selectedRoute.notes && (
              <p className="text-[11px] italic opacity-70 pt-2 border-t border-white/10">{selectedRoute.notes}</p>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-16 opacity-60">
            <MapIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-xs">
              {project.locations.length === 0
                ? "Add your first location node to start mapping the world."
                : "Click a node or route edge to view details."}
            </p>
            {project.locations.length === 0 && (
              <button
                onClick={() => { setEditingLocation(null); setLocationEditorOpen(true); }}
                className={`mt-4 flex items-center space-x-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                  theme === "dark"
                    ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
                    : theme === "parchment"
                    ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Node</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---- Modals ---- */}
      {routeEditorOpen && (
        <RouteEditorModal
          project={project}
          setProject={setProject}
          theme={theme}
          route={editingRoute}
          initSourceId={routeEditorInit.sourceId}
          initTargetId={routeEditorInit.targetId}
          onClose={() => { setRouteEditorOpen(false); setEditingRoute(null); setRouteEditorInit({}); }}
          onSaved={(saved) => {
            setSelectedRouteId(saved.id);
            setRouteEditorOpen(false);
            setEditingRoute(null);
          }}
        />
      )}
      {locationEditorOpen && (
        <LocationEditorModal
          project={project}
          setProject={setProject}
          theme={theme}
          location={editingLocation}
          onClose={() => { setLocationEditorOpen(false); setEditingLocation(null); }}
          onSaved={(saved) => {
            setSelectedNodeId(saved.id);
            setLocationEditorOpen(false);
            setEditingLocation(null);
          }}
          onNavigateToArticle={onNavigateToArticle}
        />
      )}
    </div>
  );
};
