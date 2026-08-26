import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  GitGraph,
  Heart,
  Skull,
  Shield,
  Zap,
  User,
  Plus,
  Filter,
  ExternalLink,
  Edit2,
  Edit3,
  Trash2,
  Info,
  Maximize2,
  Sparkles,
  UserPlus,
  Users
} from "lucide-react";
import {
  Character,
  CharacterRelationship,
  CharacterStatus,
  Faction,
  FactionStance,
  RelationshipType,
  ThemeMode,
  StoryProject,
  WikiArticle
} from "../../types";
import {
  buildCharacterDossierSections,
  ensureCharacterArticleSections
} from "../../lib/wikiParser";

interface RelationshipGraphProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  onNavigateToArticle: (title: string) => void;
}

interface NodePosition {
  id: string;
  name: string;
  nickname: string;
  role: string;
  status: string;
  traits: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface ColonistFormState {
  name: string;
  nickname: string;
  role: string;
  faction: string;
  status: CharacterStatus;
  traitsText: string;
  healthText: string;
  dramaticArc: string;
  bio: string;
}

const EMPTY_COLONIST_FORM: ColonistFormState = {
  name: "",
  nickname: "",
  role: "Colonist",
  faction: "",
  status: "Active",
  traitsText: "",
  healthText: "",
  dramaticArc: "",
  bio: "",
};

const CHARACTER_STATUSES: CharacterStatus[] = [
  "Active",
  "Injured",
  "In Mental Break",
  "Missing",
  "Deceased",
  "Transhumanist Ascended",
];

const FACTION_STANCES: FactionStance[] = ["Allied", "Hostile", "Neutral", "Player Colony"];

interface FactionFormState {
  name: string;
  type: string;
  stance: FactionStance;
  ideology: string;
  leader: string;
  description: string;
  settlementLocation: string;
}

const EMPTY_FACTION_FORM: FactionFormState = {
  name: "",
  type: "Pirate Clan",
  stance: "Hostile",
  ideology: "",
  leader: "",
  description: "",
  settlementLocation: "",
};

function parseListField(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  project,
  setProject,
  theme,
  onNavigateToArticle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 500 });
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    project.characters[0]?.id || null
  );
  const [filterType, setFilterType] = useState<string>("All");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New relationship form
  const [relSource, setRelSource] = useState(project.characters[0]?.name || "");
  const [relTarget, setRelTarget] = useState(project.characters[1]?.name || "");
  const [relType, setRelType] = useState<RelationshipType>("Romance");
  const [relOpinion, setRelOpinion] = useState<number>(50);
  const [relNotes, setRelNotes] = useState("");

  // Colonist (character) CRUD form state
  const [isColonistModalOpen, setIsColonistModalOpen] = useState(false);
  const [colonistModalMode, setColonistModalMode] = useState<"add" | "edit">("add");
  const [colonistForm, setColonistForm] = useState<ColonistFormState>(EMPTY_COLONIST_FORM);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);

  // Faction manager modal state
  const [isFactionModalOpen, setIsFactionModalOpen] = useState(false);
  const [factionForm, setFactionForm] = useState<FactionFormState>(EMPTY_FACTION_FORM);
  const [editingFactionId, setEditingFactionId] = useState<string | null>(null);

  // Resize observer for responsive canvas/SVG
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: Math.max(entry.contentRect.width, 400),
          height: Math.max(entry.contentRect.height, 450),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute node positions with simulation layout
  const nodes = useMemo(() => {
    const chars = project.characters;
    const count = chars.length;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.38;

    return chars.map((c, i) => {
      const angle = (i / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2;
      return {
        id: c.id,
        name: c.name,
        nickname: c.nickname || c.name,
        role: c.role,
        status: c.status,
        traits: c.traits,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: c.status === "Deceased" ? 22 : 28,
        color:
          c.status === "Deceased"
            ? "#64748b"
            : i === 0
            ? "#06b6d4"
            : i === 1
            ? "#f59e0b"
            : i === 2
            ? "#10b981"
            : i === 3
            ? "#a855f7"
            : "#ec4899",
      };
    });
  }, [project.characters, dimensions]);

  // Drag-to-rearrange: manual position overrides per character id.
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const dragInfoRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const effectiveNodes = useMemo(
    () =>
      nodes.map((n) => {
        const override = nodePositions[n.id];
        return override ? { ...n, x: override.x, y: override.y } : n;
      }),
    [nodes, nodePositions]
  );

  const getSvgPoint = (e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleNodePointerDown = (e: React.PointerEvent, node: NodePosition) => {
    e.preventDefault();
    const pt = getSvgPoint(e);
    if (!pt) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragInfoRef.current = {
      nodeId: node.id,
      offsetX: pt.x - node.x,
      offsetY: pt.y - node.y,
      startX: pt.x,
      startY: pt.y,
      moved: false,
    };
  };

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    const drag = dragInfoRef.current;
    const pt = getSvgPoint(e);
    if (!drag || !pt) return;
    if (!drag.moved && Math.hypot(pt.x - drag.startX, pt.y - drag.startY) > 4) {
      drag.moved = true;
    }
    const nx = Math.min(Math.max(pt.x - drag.offsetX, 40), dimensions.width - 40);
    const ny = Math.min(Math.max(pt.y - drag.offsetY, 40), dimensions.height - 55);
    setNodePositions((prev) => ({ ...prev, [drag.nodeId]: { x: nx, y: ny } }));
  };

  const endDrag = () => {
    // Clear asynchronously so the click event that follows pointerup
    // can still read the `moved` flag to suppress selection.
    window.setTimeout(() => {
      dragInfoRef.current = null;
    }, 0);
  };

  const handleNodeClick = (nodeId: string) => {
    if (dragInfoRef.current?.moved) return;
    setSelectedCharacterId(nodeId);
  };

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodePosition>();
    effectiveNodes.forEach((n) => {
      map.set(n.name.toLowerCase(), n);
      map.set(n.nickname.toLowerCase(), n);
      map.set(n.id, n);
    });
    return map;
  }, [effectiveNodes]);

  const filteredRelationships = useMemo(() => {
    return project.relationships.filter((rel) => {
      if (filterType === "All") return true;
      if (filterType === "Romance") return rel.type === "Romance" || rel.type === "Spouse";
      if (filterType === "Hostile") return rel.type === "Blood Feud" || rel.type === "Rival" || rel.type === "Grudge";
      if (filterType === "Bonded") return rel.type === "Bonded Beast" || rel.type === "Savior" || rel.type === "Kin";
      return rel.type === filterType;
    });
  }, [project.relationships, filterType]);

  const selectedCharacter = useMemo(() => {
    return project.characters.find((c) => c.id === selectedCharacterId) || project.characters[0];
  }, [project.characters, selectedCharacterId]);

  const characterRelationships = useMemo(() => {
    if (!selectedCharacter) return [];
    return project.relationships.filter(
      (r) =>
        r.source.toLowerCase() === selectedCharacter.name.toLowerCase() ||
        r.target.toLowerCase() === selectedCharacter.name.toLowerCase() ||
        r.source.toLowerCase() === selectedCharacter.nickname.toLowerCase() ||
        r.target.toLowerCase() === selectedCharacter.nickname.toLowerCase()
    );
  }, [selectedCharacter, project.relationships]);

  const handleAddRelationship = () => {
    if (!relSource || !relTarget || relSource === relTarget) return;

    const newRel: CharacterRelationship = {
      id: `rel-${Date.now()}`,
      source: relSource,
      target: relTarget,
      type: relType,
      opinion: relOpinion,
      notes: relNotes || `Dynamic connection between ${relSource} and ${relTarget}`,
    };

    setProject({
      ...project,
      relationships: [newRel, ...project.relationships],
      lastUpdated: new Date().toISOString(),
    });

    setIsAddModalOpen(false);
    setRelNotes("");
  };

  const handleDeleteRelationship = (id: string) => {
    setProject({
      ...project,
      relationships: project.relationships.filter((r) => r.id !== id),
      lastUpdated: new Date().toISOString(),
    });
  };

  /* ---------------------------------------------------------------- */
  /* Manual Colonist CRUD                                             */
  /* ---------------------------------------------------------------- */

  const openAddColonistModal = () => {
    setColonistModalMode("add");
    setEditingCharacterId(null);
    setColonistForm({ ...EMPTY_COLONIST_FORM, faction: project.factions[0]?.name || "" });
    setIsColonistModalOpen(true);
  };

  const openEditColonistModal = (char: Character) => {
    setColonistModalMode("edit");
    setEditingCharacterId(char.id);
    setColonistForm({
      name: char.name,
      nickname: char.nickname,
      role: char.role,
      faction: char.faction,
      status: char.status,
      traitsText: (char.traits || []).join(", "),
      healthText: (char.healthConditions || []).join(", "),
      dramaticArc: char.dramaticArc || "",
      bio: char.bio || "",
    });
    setIsColonistModalOpen(true);
  };

  const handleSaveColonist = () => {
    const name = colonistForm.name.trim();
    if (!name) return;

    const nickname = colonistForm.nickname.trim() || name;
    const today = new Date().toISOString().split("T")[0];

    if (colonistModalMode === "add") {
      // Create the character record...
      const newChar: Character = {
        id: `char-${Date.now()}`,
        name,
        nickname,
        role: colonistForm.role.trim() || "Colonist",
        faction: colonistForm.faction,
        status: colonistForm.status,
        traits: parseListField(colonistForm.traitsText),
        healthConditions: parseListField(colonistForm.healthText),
        bio: colonistForm.bio.trim(),
        dramaticArc: colonistForm.dramaticArc.trim(),
      };

      // ...and automatically initialize a matching Characters wiki article.
      const articleContent = `# ${name}\n\n## Overview\n${
        newChar.bio || "*Entity referenced in chronicle records.*"
      }\n\n${buildCharacterDossierSections(newChar)}\n\n## Key Events\n* *(Awaiting chronicle detail)*`;

      const newArticle: WikiArticle = {
        id: `art-${Date.now()}`,
        title: name,
        category: "Characters",
        tags: ["characters", "colonist"],
        markdownContent: articleContent,
        createdAt: today,
        lastModified: today,
        wordCount: articleContent.split(/\s+/).filter(Boolean).length,
      };

      setProject({
        ...project,
        characters: [newChar, ...project.characters],
        wikiArticles: [newArticle, ...project.wikiArticles],
        lastUpdated: new Date().toISOString(),
      });
      setSelectedCharacterId(newChar.id);

      if (!relSource) setRelSource(newChar.name);
      if (!relTarget) setRelTarget(project.characters[0]?.name || "");
    } else if (editingCharacterId) {
      const original = project.characters.find((c) => c.id === editingCharacterId);
      if (!original) return;

      const updatedChar: Character = {
        ...original,
        name,
        nickname,
        role: colonistForm.role.trim() || original.role,
        faction: colonistForm.faction,
        status: colonistForm.status,
        traits: parseListField(colonistForm.traitsText),
        healthConditions: parseListField(colonistForm.healthText),
        bio: colonistForm.bio.trim(),
        dramaticArc: colonistForm.dramaticArc.trim(),
      };

      // If renamed, keep relationship references and wiki titles in sync.
      const oldNames = [original.name.toLowerCase(), (original.nickname || "").toLowerCase()].filter(
        Boolean
      );
      const renamed =
        original.name.toLowerCase() !== name.toLowerCase();

      let relationships = project.relationships;
      if (renamed) {
        relationships = relationships.map((rel) => ({
          ...rel,
          source: oldNames.includes(rel.source.toLowerCase()) ? name : rel.source,
          target: oldNames.includes(rel.target.toLowerCase()) ? name : rel.target,
        }));
      }

      let wikiArticles = project.wikiArticles;
      if (renamed) {
        wikiArticles = wikiArticles.map((a) =>
          a.title.toLowerCase() === original.name.toLowerCase() ? { ...a, title: name } : a
        );
      }
      // Keep mandatory dossier sections present on the linked article.
      wikiArticles = wikiArticles.map((a) =>
        a.title.toLowerCase() === name.toLowerCase() && a.category === "Characters"
          ? {
              ...a,
              markdownContent: ensureCharacterArticleSections(a.markdownContent, updatedChar),
            }
          : a
      );

      setProject({
        ...project,
        characters: project.characters.map((c) => (c.id === editingCharacterId ? updatedChar : c)),
        relationships,
        wikiArticles,
        lastUpdated: new Date().toISOString(),
      });
    }

    setIsColonistModalOpen(false);
  };

  const handleDeleteColonist = (char: Character) => {
    if (
      !window.confirm(
        `Remove ${char.name} from the Social Web?\n\nTheir relationship bonds will be deleted too. Their wiki article is kept so you can repurpose or delete it from the World Wiki.`
      )
    ) {
      return;
    }

    const names = [char.name.toLowerCase(), (char.nickname || "").toLowerCase()].filter(Boolean);

    setProject({
      ...project,
      characters: project.characters.filter((c) => c.id !== char.id),
      relationships: project.relationships.filter(
        (r) => !names.includes(r.source.toLowerCase()) && !names.includes(r.target.toLowerCase())
      ),
      lastUpdated: new Date().toISOString(),
    });
  };

  /* ---------------------------------------------------------------- */
  /* Manual Faction CRUD                                              */
  /* ---------------------------------------------------------------- */

  const openAddFactionForm = () => {
    setFactionForm(EMPTY_FACTION_FORM);
    setEditingFactionId(null);
  };

  const openEditFactionForm = (faction: Faction) => {
    setEditingFactionId(faction.id);
    setFactionForm({
      name: faction.name,
      type: faction.type,
      stance: faction.stance,
      ideology: faction.ideology,
      leader: faction.leader || "",
      description: faction.description,
      settlementLocation: faction.settlementLocation || "",
    });
  };

  const handleSaveFaction = () => {
    const name = factionForm.name.trim();
    if (!name) return;

    const base: Omit<Faction, "id"> = {
      name,
      type: factionForm.type.trim() || "Unknown",
      stance: factionForm.stance,
      ideology: factionForm.ideology.trim(),
      leader: factionForm.leader.trim() || undefined,
      description: factionForm.description.trim(),
      settlementLocation: factionForm.settlementLocation.trim() || undefined,
    };

    if (editingFactionId) {
      setProject({
        ...project,
        factions: project.factions.map((f) =>
          f.id === editingFactionId ? { ...base, id: f.id } : f
        ),
        lastUpdated: new Date().toISOString(),
      });
    } else {
      const newFaction: Faction = { ...base, id: `fac-${Date.now()}` };
      setProject({
        ...project,
        factions: [...project.factions, newFaction],
        lastUpdated: new Date().toISOString(),
      });
    }

    openAddFactionForm();
  };

  const handleDeleteFaction = (faction: Faction) => {
    if (!window.confirm(`Delete faction "${faction.name}"? This cannot be undone.`)) return;
    setProject({
      ...project,
      factions: project.factions.filter((f) => f.id !== faction.id),
      lastUpdated: new Date().toISOString(),
    });
    if (editingFactionId === faction.id) openAddFactionForm();
  };

  const getEdgeStyle = (type: RelationshipType, opinion: number) => {
    switch (type) {
      case "Spouse":
      case "Romance":
        return { stroke: "#f43f5e", strokeWidth: 3.5, strokeDasharray: "none", labelColor: "text-rose-400" };
      case "Blood Feud":
        return { stroke: "#ef4444", strokeWidth: 3.5, strokeDasharray: "none", labelColor: "text-red-400" };
      case "Rival":
      case "Grudge":
        return { stroke: "#f97316", strokeWidth: 2, strokeDasharray: "4 3", labelColor: "text-orange-400" };
      case "Bonded Beast":
      case "Savior":
        return { stroke: "#10b981", strokeWidth: 3, strokeDasharray: "none", labelColor: "text-emerald-400" };
      case "Kin":
      case "Mentor":
        return { stroke: "#a855f7", strokeWidth: 2.5, strokeDasharray: "none", labelColor: "text-purple-400" };
      default:
        return { stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "none", labelColor: "text-slate-400" };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Visual Network Canvas */}
      <div
        id="relationship-graph-container"
        className={`lg:col-span-8 rounded-2xl border p-4 sm:p-6 shadow-sm relative overflow-hidden flex flex-col ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-100/70 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 z-10">
          <div className="flex items-center space-x-2">
            <GitGraph className="w-5 h-5 text-amber-400" />
            <h3 className="font-serif font-bold text-base">Social Dynamic Web</h3>
            <span className="text-xs opacity-50 font-mono">
              ({project.characters.length} Colonists • {project.relationships.length} Bonds)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter */}
            <div className="flex items-center space-x-1 text-xs">
              <span className="opacity-60 text-[11px] font-mono">Filter:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2 py-1 rounded-lg border text-xs bg-black/20 outline-none font-medium"
              >
                <option value="All">All Bonds</option>
                <option value="Romance">Romance & Spouse</option>
                <option value="Hostile">Feuds & Rivals</option>
                <option value="Bonded">Beasts & Saviors</option>
              </select>
            </div>

            {/* Add Relation Button */}
            <button
              id="btn-add-relationship"
              onClick={() => setIsAddModalOpen(true)}
              disabled={project.characters.length < 2}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                theme === "dark"
                  ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
                  : theme === "parchment"
                  ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              }`}
              title={
                project.characters.length < 2
                  ? "Add at least two colonists to bond them"
                  : "Create a relationship bond between two characters"
              }
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bond</span>
            </button>

            {/* Manual Colonist & Faction Management */}
            <button
              id="btn-add-colonist"
              onClick={openAddColonistModal}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                theme === "dark"
                  ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e] hover:text-white"
                  : theme === "parchment"
                  ? "border-amber-300 text-stone-700 hover:bg-amber-200/50"
                  : "border-cyan-900 text-cyan-300 hover:bg-cyan-950/60"
              }`}
              title="Manually create a colonist (also generates their wiki article)"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Colonist</span>
            </button>

            <button
              id="btn-manage-factions"
              onClick={() => {
                openAddFactionForm();
                setIsFactionModalOpen(true);
              }}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                theme === "dark"
                  ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e] hover:text-white"
                  : theme === "parchment"
                  ? "border-amber-300 text-stone-700 hover:bg-amber-200/50"
                  : "border-cyan-900 text-cyan-300 hover:bg-cyan-950/60"
              }`}
              title="Add, edit, or delete factions in this project"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Manage Factions</span>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] py-2 opacity-80 border-b border-white/5 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Romance/Spouse
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Blood Feud (-100)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Bonded/Savior (+100)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Kin & Mentorship
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Rivalry / Tension
          </span>
        </div>

        {/* SVG Interactive Graph */}
        <div ref={containerRef} className="w-full h-[450px] relative mt-2 select-none">
          {Object.keys(nodePositions).length > 0 && (
            <button
              id="btn-reset-graph-layout"
              onClick={() => setNodePositions({})}
              className={`absolute top-2 right-2 z-10 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                theme === "dark"
                  ? "border-[#25252e] text-zinc-300 hover:bg-[#18181e] hover:text-white"
                  : theme === "parchment"
                  ? "border-amber-300 text-stone-700 hover:bg-amber-200/50"
                  : "border-cyan-900 text-cyan-300 hover:bg-cyan-950/60"
              }`}
              title="Return all dragged nodes to their default ring positions"
            >
              Reset Layout
            </button>
          )}
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ touchAction: "none" }}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Grid Pattern */}
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.04"
                strokeWidth="1"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Relationship Edges */}
            {filteredRelationships.map((rel) => {
              const src = nodeMap.get(rel.source.toLowerCase());
              const tgt = nodeMap.get(rel.target.toLowerCase());
              if (!src || !tgt) return null;

              const style = getEdgeStyle(rel.type, rel.opinion);
              const isHighlighted =
                selectedCharacter &&
                (rel.source.toLowerCase() === selectedCharacter.name.toLowerCase() ||
                  rel.target.toLowerCase() === selectedCharacter.name.toLowerCase() ||
                  rel.source.toLowerCase() === selectedCharacter.nickname.toLowerCase() ||
                  rel.target.toLowerCase() === selectedCharacter.nickname.toLowerCase());

              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;

              return (
                <g key={rel.id} className="transition-opacity duration-300">
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={style.stroke}
                    strokeWidth={isHighlighted ? style.strokeWidth * 1.5 : style.strokeWidth}
                    strokeDasharray={style.strokeDasharray}
                    opacity={isHighlighted ? 1 : 0.45}
                    filter={isHighlighted ? "url(#glow)" : undefined}
                  />
                  {/* Opinion badge on midpoint */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-18"
                      y="-9"
                      width="36"
                      height="18"
                      rx="6"
                      fill={theme === "dark" ? "#0c0c0e" : theme === "parchment" ? "#fef3c7" : "#082f49"}
                      stroke={style.stroke}
                      strokeWidth="1"
                      opacity={isHighlighted ? 1 : 0.75}
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="9"
                      fontWeight="bold"
                      fill={rel.opinion >= 0 ? "#10b981" : "#ef4444"}
                      fontFamily="monospace"
                    >
                      {rel.opinion > 0 ? `+${rel.opinion}` : rel.opinion}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Character Nodes */}
            {effectiveNodes.map((node) => {
              const isSelected = selectedCharacter?.id === node.id;
              const isDeceased = node.status === "Deceased";

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => handleNodeClick(node.id)}
                  onPointerDown={(e) => handleNodePointerDown(e, node)}
                  className="cursor-grab active:cursor-grabbing transition-[filter] duration-150 hover:brightness-125"
                >
                  {/* Selection Pulse Ring */}
                  {isSelected && (
                    <circle
                      r={node.radius + 8}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      className="animate-spin"
                      style={{ animationDuration: "12s" }}
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r={node.radius}
                    fill={node.color}
                    stroke={isSelected ? "#ffffff" : "#000000"}
                    strokeWidth={isSelected ? "3" : "1.5"}
                    opacity={isDeceased ? 0.6 : 1}
                    filter={isSelected ? "url(#glow)" : undefined}
                  />

                  {/* Icon or Initials */}
                  <text
                    textAnchor="middle"
                    dy="5"
                    fontSize="13"
                    fontWeight="bold"
                    fill="#ffffff"
                    fontFamily="serif"
                  >
                    {isDeceased ? "✝" : node.nickname.slice(0, 2).toUpperCase()}
                  </text>

                  {/* Name Label */}
                  <g transform={`translate(0, ${node.radius + 16})`}>
                    <rect
                      x={-(node.nickname.length * 4.5 + 8)}
                      y="-9"
                      width={node.nickname.length * 9 + 16}
                      height="18"
                      rx="4"
                      fill={theme === "dark" ? "#0c0c0e" : theme === "parchment" ? "#fffbeb" : "#082f49"}
                      fillOpacity="0.9"
                      stroke={isSelected ? "#f59e0b" : "currentColor"}
                      strokeOpacity="0.2"
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="10"
                      fontWeight="bold"
                      fill="currentColor"
                      fontFamily="sans-serif"
                    >
                      {node.nickname}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Right Social Dossier Panel */}
      <div
        id="character-dossier-panel"
        className={`lg:col-span-4 rounded-2xl border p-6 shadow-sm space-y-5 ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-50/90 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        {selectedCharacter ? (
          <div className="space-y-4">
            {/* Header Profile */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-serif text-lg font-bold text-white shadow-md bg-gradient-to-br ${
                    selectedCharacter.avatarColor || "from-amber-600 to-red-800"
                  }`}
                >
                  {selectedCharacter.nickname.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg leading-tight">
                    {selectedCharacter.name}
                  </h3>
                  <p className="text-xs opacity-75">{selectedCharacter.role}</p>
                  <span
                    className={`inline-block text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded mt-1 ${
                      selectedCharacter.status === "Active"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : selectedCharacter.status === "Deceased"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {selectedCharacter.status}
                  </span>
                </div>
              </div>

              {/* Link to full wiki + manual dossier controls */}
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  id="btn-edit-dossier"
                  onClick={() => openEditColonistModal(selectedCharacter)}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-colors ${
                    theme === "dark"
                      ? "border-slate-700 hover:bg-slate-800 text-amber-400"
                      : theme === "parchment"
                      ? "border-amber-300 hover:bg-amber-200 text-amber-900 font-bold"
                      : "border-cyan-800 hover:bg-cyan-950 text-cyan-300"
                  }`}
                  title="Edit colonist dossier details (name, role, status, traits, health, arc & bio)"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  id="btn-delete-colonist"
                  onClick={() => handleDeleteColonist(selectedCharacter)}
                  className="p-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                  title="Remove this colonist and their relationship bonds"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  id="btn-dossier-open-wiki"
                  onClick={() => onNavigateToArticle(selectedCharacter.name)}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-colors ${
                    theme === "dark"
                      ? "border-slate-700 hover:bg-slate-800 text-amber-400"
                      : theme === "parchment"
                      ? "border-amber-300 hover:bg-amber-200 text-amber-900 font-bold"
                      : "border-cyan-800 hover:bg-cyan-950 text-cyan-300"
                  }`}
                  title="Open full Wiki Article"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Traits */}
            {selectedCharacter.traits && (
              <div>
                <span className="text-[11px] font-mono opacity-60 uppercase block mb-1">
                  Personality Traits:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCharacter.traits.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white/10 border border-white/5 font-semibold"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Health / Bionics */}
            {selectedCharacter.healthConditions && (
              <div>
                <span className="text-[11px] font-mono opacity-60 uppercase block mb-1">
                  Health, Scars & Bionics:
                </span>
                <div className="space-y-1">
                  {selectedCharacter.healthConditions.map((h, i) => (
                    <div
                      key={i}
                      className="text-xs p-1.5 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between"
                    >
                      <span>{h}</span>
                      <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dramatic Arc */}
            {selectedCharacter.dramaticArc && (
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/30 text-xs">
                <span className="text-[10px] font-mono uppercase font-bold text-purple-400 block mb-1">
                  Dramatic Arc & Inner Conflict:
                </span>
                <p className="opacity-90 leading-relaxed italic">
                  "{selectedCharacter.dramaticArc}"
                </p>
              </div>
            )}

            {/* Social Opinion Matrix */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-serif font-bold text-sm">Interpersonal Bonds</h4>
                <span className="text-[10px] font-mono opacity-50">
                  {characterRelationships.length} recorded
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {characterRelationships.length === 0 ? (
                  <p className="text-xs opacity-50 italic py-2">
                    No active relationship bonds recorded for this colonist.
                  </p>
                ) : (
                  characterRelationships.map((rel) => {
                    const otherName =
                      rel.source.toLowerCase() === selectedCharacter.name.toLowerCase() ||
                      rel.source.toLowerCase() === selectedCharacter.nickname.toLowerCase()
                        ? rel.target
                        : rel.source;

                    return (
                      <div
                        key={rel.id}
                        className="p-2.5 rounded-xl border border-white/10 bg-black/20 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm font-serif">{otherName}</span>
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                rel.opinion >= 50
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : rel.opinion < 0
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }`}
                            >
                              {rel.opinion > 0 ? `+${rel.opinion}` : rel.opinion}
                            </span>
                            <button
                              onClick={() => handleDeleteRelationship(rel.id)}
                              className="text-red-400 opacity-60 hover:opacity-100 p-0.5"
                              title="Remove relationship"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 text-[11px] opacity-75 font-mono">
                          <span className="font-semibold text-amber-400">{rel.type}</span>
                        </div>
                        {rel.notes && (
                          <p className="text-[11px] opacity-80 italic pt-0.5">"{rel.notes}"</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 opacity-60">
            <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Click a character node on the network to view their dossier.</p>
            <button
              onClick={openAddColonistModal}
              className={`mt-4 flex items-center space-x-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                theme === "dark"
                  ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
                  : theme === "parchment"
                  ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add First Colonist</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Relationship Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
              theme === "dark"
                ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
                : theme === "parchment"
                ? "bg-amber-50 border-amber-300 text-stone-900"
                : "bg-slate-900 border-cyan-800 text-cyan-50"
            }`}
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base flex items-center space-x-2">
                <Plus className="w-4 h-4 text-amber-500" />
                <span>Establish Character Bond</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-mono opacity-70 block mb-1">Source Colonist</label>
                  <select
                    value={relSource}
                    onChange={(e) => setRelSource(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border text-xs bg-black/20 outline-none"
                  >
                    {project.characters.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-mono opacity-70 block mb-1">Target Colonist</label>
                  <select
                    value={relTarget}
                    onChange={(e) => setRelTarget(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border text-xs bg-black/20 outline-none"
                  >
                    {project.characters.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-mono opacity-70 block mb-1">Bond Type</label>
                  <select
                    value={relType}
                    onChange={(e) => setRelType(e.target.value as RelationshipType)}
                    className="w-full px-2.5 py-1.5 rounded-lg border text-xs bg-black/20 outline-none"
                  >
                    <option value="Romance">Romance</option>
                    <option value="Spouse">Spouse / Marriage</option>
                    <option value="Blood Feud">Blood Feud</option>
                    <option value="Rival">Rivalry</option>
                    <option value="Savior">Savior / Rescuer</option>
                    <option value="Bonded Beast">Bonded Beast</option>
                    <option value="Kin">Kin / Family</option>
                    <option value="Mentor">Mentor / Student</option>
                    <option value="Betrayer">Betrayer</option>
                    <option value="Grudge">Grudge</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono opacity-70 block mb-1">
                    Opinion Rating ({relOpinion})
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={relOpinion}
                    onChange={(e) => setRelOpinion(parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] opacity-60 font-mono">
                    <span>-100 (Hatred)</span>
                    <span>+100 (Devotion)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono opacity-70 block mb-1">Context / Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Saved each other during the toxic fallout; shared emergency meals."
                  value={relNotes}
                  onChange={(e) => setRelNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border text-xs bg-black/20 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRelationship}
                disabled={!relSource || !relTarget || relSource === relTarget}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                  theme === "dark"
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                    : theme === "parchment"
                    ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                    : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                }`}
              >
                Save Bond
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add / Edit Colonist Modal */}
      {isColonistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-4 ${
              theme === "dark"
                ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
                : theme === "parchment"
                ? "bg-amber-50 border-amber-300 text-stone-900"
                : "bg-slate-900 border-cyan-800 text-cyan-50"
            }`}
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-amber-500" />
                <span>
                  {colonistModalMode === "add" ? "Add Colonist" : `Edit Dossier: ${colonistForm.name || "Colonist"}`}
                </span>
              </h3>
              <button
                onClick={() => setIsColonistModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] opacity-70 leading-relaxed">
              {colonistModalMode === "add"
                ? "Creates the colonist record and automatically initializes a matching Characters wiki article you can flesh out later."
                : "Changes apply to the Social Web immediately; relationship bonds follow any name change automatically."}
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Name *</label>
                  <input
                    type="text"
                    value={colonistForm.name}
                    onChange={(e) => setColonistForm({ ...colonistForm, name: e.target.value })}
                    placeholder="e.g. Dr. Valerie Vance"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-sm font-semibold"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">Nickname</label>
                  <input
                    type="text"
                    value={colonistForm.nickname}
                    onChange={(e) => setColonistForm({ ...colonistForm, nickname: e.target.value })}
                    placeholder="e.g. Vex"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Role / Title</label>
                  <input
                    type="text"
                    value={colonistForm.role}
                    onChange={(e) => setColonistForm({ ...colonistForm, role: e.target.value })}
                    placeholder="e.g. Colony Surgeon"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">Faction</label>
                  <select
                    value={colonistForm.faction}
                    onChange={(e) => setColonistForm({ ...colonistForm, faction: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none"
                  >
                    <option value="">— No Faction —</option>
                    {project.factions.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Status</label>
                  <select
                    value={colonistForm.status}
                    onChange={(e) =>
                      setColonistForm({ ...colonistForm, status: e.target.value as CharacterStatus })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none"
                  >
                    {CHARACTER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">Traits (comma separated)</label>
                  <input
                    type="text"
                    value={colonistForm.traitsText}
                    onChange={(e) => setColonistForm({ ...colonistForm, traitsText: e.target.value })}
                    placeholder="Iron-willed, Bloodlust, Night Owl"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">
                  Health, Scars &amp; Bionics (comma separated)
                </label>
                <input
                  type="text"
                  value={colonistForm.healthText}
                  onChange={(e) => setColonistForm({ ...colonistForm, healthText: e.target.value })}
                  placeholder="Mangled Torso scar, Bionic Left Arm, Frostbitten finger"
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Dramatic Arc / Inner Conflict</label>
                <textarea
                  rows={2}
                  value={colonistForm.dramaticArc}
                  onChange={(e) => setColonistForm({ ...colonistForm, dramaticArc: e.target.value })}
                  placeholder="e.g. Fears losing control again; seeks redemption for Gorgon's broken ribs."
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Bio / Background</label>
                <textarea
                  rows={3}
                  value={colonistForm.bio}
                  onChange={(e) => setColonistForm({ ...colonistForm, bio: e.target.value })}
                  placeholder="Where they came from, why they crashed here, what they left behind..."
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsColonistModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveColonist}
                disabled={!colonistForm.name.trim()}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 disabled:opacity-40 ${
                  theme === "dark"
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                    : theme === "parchment"
                    ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                    : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                }`}
              >
                {colonistModalMode === "add" ? "Create Colonist" : "Save Dossier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Factions Modal */}
      {isFactionModalOpen && (
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
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base flex items-center space-x-2">
                <Shield className="w-4 h-4 text-red-400" />
                <span>Manage Factions ({project.factions.length})</span>
              </h3>
              <button
                onClick={() => setIsFactionModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            {/* Existing faction list */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {project.factions.length === 0 ? (
                <div className="flex items-center justify-center space-x-2 py-6 opacity-50 text-xs italic">
                  <Users className="w-4 h-4" />
                  <span>No factions recorded yet — add your first below.</span>
                </div>
              ) : (
                project.factions.map((f) => (
                  <div
                    key={f.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      editingFactionId === f.id
                        ? "border-amber-500/60 bg-amber-500/10"
                        : theme === "dark"
                        ? "border-white/10 bg-black/20"
                        : "border-amber-200 bg-amber-100/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-serif font-bold text-sm truncate">{f.name}</span>
                        <span
                          className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${
                            f.stance === "Allied"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : f.stance === "Hostile"
                              ? "bg-red-500/20 text-red-400"
                              : f.stance === "Player Colony"
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {f.stance}
                        </span>
                      </div>
                      <span className="block text-[11px] opacity-60 truncate">
                        {f.type}
                        {f.leader ? ` • Leader: ${f.leader}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => openEditFactionForm(f)}
                        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10"
                        title="Edit faction"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteFaction(f)}
                        className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                        title="Delete faction"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add / edit form */}
            <div className="pt-2 border-t border-white/10 space-y-3 text-xs">
              <h4 className="font-mono uppercase font-bold text-[10px] opacity-60 tracking-wider">
                {editingFactionId ? `Editing: ${factionForm.name || "faction"}` : "Add New Faction"}
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Name *</label>
                  <input
                    type="text"
                    value={factionForm.name}
                    onChange={(e) => setFactionForm({ ...factionForm, name: e.target.value })}
                    placeholder="e.g. The Ashen Skulls"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">Type</label>
                  <input
                    type="text"
                    value={factionForm.type}
                    onChange={(e) => setFactionForm({ ...factionForm, type: e.target.value })}
                    placeholder="e.g. Pirate Clan, Tribal Confederacy"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Stance Toward Colony</label>
                  <select
                    value={factionForm.stance}
                    onChange={(e) =>
                      setFactionForm({ ...factionForm, stance: e.target.value as FactionStance })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border bg-black/20 outline-none"
                  >
                    {FACTION_STANCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">Leader (optional)</label>
                  <input
                    type="text"
                    value={factionForm.leader}
                    onChange={(e) => setFactionForm({ ...factionForm, leader: e.target.value })}
                    placeholder="e.g. Warlord Kaskrin"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono opacity-70 block mb-1">Ideology</label>
                  <input
                    type="text"
                    value={factionForm.ideology}
                    onChange={(e) => setFactionForm({ ...factionForm, ideology: e.target.value })}
                    placeholder="e.g. Might-makes-right raider creed"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
                <div>
                  <label className="font-mono opacity-70 block mb-1">Settlement Location</label>
                  <input
                    type="text"
                    value={factionForm.settlementLocation}
                    onChange={(e) =>
                      setFactionForm({ ...factionForm, settlementLocation: e.target.value })
                    }
                    placeholder="e.g. Southern Badlands Ridge"
                    className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono opacity-70 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={factionForm.description}
                  onChange={(e) => setFactionForm({ ...factionForm, description: e.target.value })}
                  placeholder="History, military strength, grudges against the colony..."
                  className="w-full px-3 py-1.5 rounded-lg border bg-black/20 outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                {editingFactionId && (
                  <button
                    onClick={openAddFactionForm}
                    className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  onClick={handleSaveFaction}
                  disabled={!factionForm.name.trim()}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 disabled:opacity-40 ${
                    theme === "dark"
                      ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                      : theme === "parchment"
                      ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                      : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  }`}
                >
                  {editingFactionId ? "Save Faction Changes" : "Add Faction"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
