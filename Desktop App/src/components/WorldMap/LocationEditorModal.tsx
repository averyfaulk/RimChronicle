import React, { useState } from "react";
import { X, Save, ExternalLink, MapPin } from "lucide-react";
import {
  LocationItem,
  LocationType,
  BiomeType,
  StoryProject,
  ThemeMode,
  WikiArticle,
} from "../../types";
import { selectClasses } from "../../lib/uiTheme";

interface LocationEditorModalProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  location: LocationItem | null;
  onClose: () => void;
  onSaved: (location: LocationItem) => void;
  onNavigateToArticle: (title: string) => void;
}

const LOCATION_TYPES: LocationType[] = [
  "Colony Settlement",
  "Mining Outpost",
  "Battlefield & War Zone",
  "Ancient Cryptosleep Ruins",
  "Resource Deposit",
  "Psychic Hotspot",
  "Crashed Ship Hull",
  "Trading Hub",
  "Tribal Camp",
  "Raider Fortress",
];

const BIOMES: BiomeType[] = [
  "Glacial Ice Sheet",
  "Tundra",
  "Boreal Mountain Forest",
  "Temperate Valley",
  "Arid Shrubland",
  "Desert Badlands",
  "Toxic Swampland",
  "Volcanic Ridge",
];

export const LocationEditorModal: React.FC<LocationEditorModalProps> = ({
  project,
  setProject,
  theme,
  location,
  onClose,
  onSaved,
  onNavigateToArticle,
}) => {
  const [name, setName] = useState(location?.name || "");
  const [type, setType] = useState<LocationType>((location?.type as LocationType) || "Colony Settlement");
  const [dangerLevel, setDangerLevel] = useState<"Safe" | "Dangerous" | "Extreme Hazard">(
    location?.dangerLevel || "Safe"
  );
  const [biome, setBiome] = useState<BiomeType | "">(location?.biome || "");
  const [controllingFaction, setControllingFaction] = useState(location?.controllingFaction || "");
  const [description, setDescription] = useState(location?.description || "");
  const [createArticle, setCreateArticle] = useState(!location);
  const [error, setError] = useState("");

  const existingArticle = location
    ? project.wikiArticles.find(
        (a) => a.title.trim().toLowerCase() === location.name.trim().toLowerCase()
      )
    : null;

  const handleSave = () => {
    if (!name.trim()) { setError("Name is required."); return; }

    const base: LocationItem = {
      id: location?.id || `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: name.trim(),
      type,
      dangerLevel,
      biome: biome || undefined,
      controllingFaction: controllingFaction.trim() || undefined,
      description: description.trim(),
      position: location?.position,
      hexCoord: location?.hexCoord,
      terrainDifficulty: location?.terrainDifficulty,
      elevationMeters: location?.elevationMeters,
      temperatureCelsius: location?.temperatureCelsius,
      garrisonColonists: location?.garrisonColonists || [],
      activeResources: location?.activeResources || [],
    };

    // Update or create wiki article
    let wikiArticles = project.wikiArticles;
    const articleTitle = base.name;
    const existingIdx = wikiArticles.findIndex(
      (a) => a.title.trim().toLowerCase() === articleTitle.trim().toLowerCase()
    );

    if (createArticle || existingIdx >= 0) {
      const articleContent =
        existingIdx >= 0
          ? wikiArticles[existingIdx].markdownContent
          : `# ${articleTitle}\n\n${description.trim() || "_No description yet._"}\n`;

      const updatedArticle: WikiArticle = {
        id: existingIdx >= 0 ? wikiArticles[existingIdx].id : `art-${Date.now().toString(36)}`,
        title: articleTitle,
        category: "Locations",
        tags: [type, biome, dangerLevel].filter(Boolean) as string[],
        markdownContent: articleContent,
        createdAt: existingIdx >= 0 ? wikiArticles[existingIdx].createdAt : new Date().toISOString().split("T")[0],
        lastModified: new Date().toISOString().split("T")[0],
        wordCount: articleContent.split(/\s+/).length,
        infoboxData: {
          Type: type,
          "Danger Level": dangerLevel,
          ...(biome ? { Biome: biome } : {}),
          ...(controllingFaction ? { "Controlling Faction": controllingFaction } : {}),
        },
      };

      if (existingIdx >= 0) {
        wikiArticles = wikiArticles.map((a, i) => (i === existingIdx ? updatedArticle : a));
      } else {
        wikiArticles = [updatedArticle, ...wikiArticles];
      }

      base.linkedArticleId = updatedArticle.id;
    }

    // Update or create LocationItem
    const existingLocIdx = project.locations.findIndex((l) => l.id === base.id);
    const nextLocations =
      existingLocIdx >= 0
        ? project.locations.map((l, i) => (i === existingLocIdx ? base : l))
        : [...project.locations, base];

    setProject({
      ...project,
      locations: nextLocations,
      wikiArticles,
      lastUpdated: new Date().toISOString(),
    });

    onSaved(base);
  };

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
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>{location ? "Edit Location" : "New Location"}</span>
          </h3>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Location Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mount Karas Caverns"
            className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
          />
        </div>

        {/* Type + Danger */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LocationType)}
              className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
            >
              {LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Danger Level</label>
            <select
              value={dangerLevel}
              onChange={(e) => setDangerLevel(e.target.value as any)}
              className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
            >
              <option value="Safe">Safe</option>
              <option value="Dangerous">Dangerous</option>
              <option value="Extreme Hazard">Extreme Hazard</option>
            </select>
          </div>
        </div>

        {/* Biome + Faction */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Biome</label>
            <select
              value={biome}
              onChange={(e) => setBiome(e.target.value as BiomeType | "")}
              className={`w-full px-2 py-1.5 rounded-lg outline-none text-xs cursor-pointer ${selectClasses(theme)}`}
            >
              <option value="">— None —</option>
              {BIOMES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Controlling Faction</label>
            <input
              type="text"
              value={controllingFaction}
              onChange={(e) => setControllingFaction(e.target.value)}
              placeholder="e.g. New Valhalla"
              className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-mono opacity-60 uppercase block mb-1">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Strategic importance, notable features, history..."
            className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-xs resize-y"
          />
        </div>

        {/* Wiki article toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-black/20">
          <input
            type="checkbox"
            id="create-article"
            checked={createArticle}
            onChange={(e) => setCreateArticle(e.target.checked)}
            disabled={!!existingArticle}
            className="accent-amber-500"
          />
          <label htmlFor="create-article" className="text-[11px]">
            {existingArticle ? (
              <span className="flex items-center gap-1.5">
                Wiki article exists
                <button
                  onClick={() => onNavigateToArticle(name)}
                  className="text-amber-400 underline"
                >
                  <ExternalLink className="w-3 h-3 inline" /> Open
                </button>
              </span>
            ) : (
              "Create / sync linked Wiki article"
            )}
          </label>
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
            <span>Save Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};
