import React, { useState, useMemo, useEffect } from "react";
import { aiFetch } from "../../lib/aiClient";
import {
  BookOpen,
  Search,
  Plus,
  Edit3,
  Pencil,
  Sparkles,
  Download,
  Trash2,
  Link as LinkIcon,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  FolderPlus,
  Layers,
  User,
  Check
} from "lucide-react";
import { WikiArticle, ThemeMode, StoryProject } from "../../types";
import { selectClasses } from "../../lib/uiTheme";
import { useLexicon } from "../../lib/lexicon";
import {
  getTaxonomy,
  entryByLabel,
  hasFlag,
} from "../../lib/taxonomy";
import {
  EntityLookup,
  computeArticleBacklinks,
  sanitizeCharacterArticleSections,
  findCharacterByTitle,
  resolveSlotConfig,
  getChildrenMap,
  getAncestorChain,
  getDescendantIds,
} from "../../lib/wikiParser";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { CharacterSheetPanel } from "../Characters/CharacterSheetPanel";
import { CharacterEditModal } from "../Characters/CharacterEditModal";
import { downloadBlob } from "../../lib/zipExporter";

interface WikiManagerProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  isAiMode: boolean;
  lookup: EntityLookup;
  selectedArticleId?: string;
  setSelectedArticleId: (id: string | undefined) => void;
}

export const WikiManager: React.FC<WikiManagerProps> = ({
  project,
  setProject,
  theme,
  isAiMode,
  lookup,
  selectedArticleId,
  setSelectedArticleId,
}) => {
  const lex = useLexicon();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedCategory, setEditedCategory] = useState<string>("");
  const [editedParentId, setEditedParentId] = useState<string>("");
  const [editedTags, setEditedTags] = useState("");

  // Sidebar tree expansion — a Set of folder-article ids whose children are shown.
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Drag-and-drop reparenting.
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);

  // Auto-expand the ancestor chain whenever the selection changes, so the author
  // always sees the currently open article even if its parent was collapsed.
  useEffect(() => {
    if (!selectedArticleId) return;
    const chain = getAncestorChain(project.wikiArticles, selectedArticleId);
    if (chain.length === 0) return;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      let changed = false;
      chain.forEach((p) => {
        if (!next.has(p.id)) {
          next.add(p.id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [selectedArticleId, project.wikiArticles]);

  // AI Expand modal state
  const [isAiExpandModalOpen, setIsAiExpandModalOpen] = useState(false);
  const [aiPromptInstruction, setAiPromptInstruction] = useState("");
  const [isExpanding, setIsExpanding] = useState(false);
  const [aiExpandError, setAiExpandError] = useState("");

  // Character sheet editor (shared CharacterEditModal) for the linked dossier
  const [isSheetEditorOpen, setIsSheetEditorOpen] = useState(false);

  // Create article modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newParentId, setNewParentId] = useState<string>("");

  // Calculate dynamic backlinks
  const backlinksMap = useMemo(() => {
    return computeArticleBacklinks(project.wikiArticles);
  }, [project.wikiArticles]);

  const tax = useMemo(() => getTaxonomy(project), [project]);

  const categoryMeta = (value: string | undefined): { entry?: (typeof tax.articleCategories)[0]; label: string; color?: string } => {
    const entry = entryByLabel(tax.articleCategories, value || "");
    return {
      entry,
      label: entry?.label || value || "",
      color: entry?.color,
    };
  };

  const categories: { value: string; label: string; count: number; icon: React.ReactNode; color?: string }[] = useMemo(() => {
    const counts: Record<string, number> = {};
    project.wikiArticles.forEach((a) => {
      const key = entryByLabel(tax.articleCategories, a.category)?.id || a.category;
      counts[key] = (counts[key] || 0) + 1;
    });

    return [
      { value: "All", label: "All", count: project.wikiArticles.length, icon: <Layers className="w-3.5 h-3.5" /> },
      ...tax.articleCategories.map((entry) => ({
        value: entry.id,
        label: entry.label,
        count: counts[entry.id] || 0,
        icon: <User className="w-3.5 h-3.5" />,
        color: entry.color,
      })),
    ];
  }, [project.wikiArticles, tax]);

  const childrenMap = useMemo(
    () => getChildrenMap(project.wikiArticles),
    [project.wikiArticles]
  );

  const displayPath = (art: WikiArticle): string => {
    const chain = getAncestorChain(project.wikiArticles, art.id);
    return chain.length > 0
      ? `${chain.map((p) => p.title).join(" › ")} › ${art.title}`
      : art.title;
  };

  const sortedParentOptions = (candidates: WikiArticle[]) =>
    candidates.slice().sort((a, b) => displayPath(a).localeCompare(displayPath(b)));

  // Articles available as a parent when creating a new article.
  const createParentOptions = useMemo(
    () => sortedParentOptions(project.wikiArticles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.wikiArticles, childrenMap]
  );

  interface SidebarRow {
    article: WikiArticle;
    depth: number;
    hasChildren: boolean;
    childCount: number;
    isExpanded: boolean;
  }

  // Flatten the article hierarchy into indented rows for the sidebar tree.
  const treeRows = useMemo<SidebarRow[]>(() => {
    const articles = project.wikiArticles;
    const isSearching = searchQuery.trim().length > 0;

    const matchesSearch = (art: WikiArticle) =>
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      art.markdownContent.toLowerCase().includes(searchQuery.toLowerCase());

    // Collect the ids that belong in the tree given the active filters.
    const relevant = new Set<string>();
    if (isSearching) {
      // Matches plus their ancestor chain only — keeps the tree focused on
      // the path to each match rather than flooding it with siblings.
      articles.forEach((a) => {
        if (!matchesSearch(a)) return;
        relevant.add(a.id);
        getAncestorChain(articles, a.id).forEach((p) => relevant.add(p.id));
      });
    } else {
      // Category chips filter roots; descendants always follow a visible parent.
      const collect = (id: string) => {
        relevant.add(id);
        (childrenMap.get(id) || []).forEach((c) => collect(c.id));
      };
      articles.forEach((a) => {
        if (!a.parentId && (activeCategory === "All" || a.category === activeCategory)) {
          collect(a.id);
        }
      });
    }

    const shouldExpand = (id: string) => isSearching || expandedFolders.has(id);

    const rows: SidebarRow[] = [];
    const pushChildren = (parentId: string, depth: number) => {
      (childrenMap.get(parentId) || []).forEach((child) => {
        if (!relevant.has(child.id)) return;
        const childList = childrenMap.get(child.id) || [];
        rows.push({
          article: child,
          depth,
          hasChildren: childList.length > 0,
          childCount: childList.length,
          isExpanded: shouldExpand(child.id),
        });
        if (childList.length > 0 && shouldExpand(child.id)) {
          pushChildren(child.id, depth + 1);
        }
      });
    };

    articles.forEach((a) => {
      if (a.parentId || !relevant.has(a.id)) return;
      const childList = childrenMap.get(a.id) || [];
      rows.push({
        article: a,
        depth: 0,
        hasChildren: childList.length > 0,
        childCount: childList.length,
        isExpanded: shouldExpand(a.id),
      });
      if (childList.length > 0 && shouldExpand(a.id)) {
        pushChildren(a.id, 1);
      }
    });

    return rows;
  }, [project.wikiArticles, activeCategory, searchQuery, expandedFolders, childrenMap]);

  const currentArticle = useMemo(() => {
    if (!selectedArticleId && project.wikiArticles.length > 0) {
      return project.wikiArticles[0];
    }
    return project.wikiArticles.find((a) => a.id === selectedArticleId) || project.wikiArticles[0];
  }, [project.wikiArticles, selectedArticleId]);

  const currentBacklinks = useMemo(() => {
    if (!currentArticle) return [];
    return backlinksMap.get(currentArticle.title.toLowerCase()) || [];
  }, [currentArticle, backlinksMap]);

  // Character dossier linked to this article (category flagged as character + title match).
  const isCharacterCategory = useMemo(
    () => hasFlag(entryByLabel(tax.articleCategories, currentArticle?.category || ""), "is-character"),
    [tax, currentArticle]
  );

  const linkedCharacter = useMemo(() => {
    if (!currentArticle || !isCharacterCategory) return undefined;
    return findCharacterByTitle(project.characters, currentArticle.title);
  }, [currentArticle, isCharacterCategory, project.characters]);

  // Articles available as a parent when reparenting the article being edited
  // (excludes the article itself and any of its descendants to avoid cycles).
  const editParentOptions = useMemo(() => {
    if (!currentArticle) return [];
    const excluded = getDescendantIds(project.wikiArticles, currentArticle.id);
    excluded.add(currentArticle.id);
    return sortedParentOptions(project.wikiArticles.filter((a) => !excluded.has(a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.wikiArticles, currentArticle, childrenMap]);

  const ancestorChain = useMemo(
    () => getAncestorChain(project.wikiArticles, currentArticle?.id),
    [currentArticle, project.wikiArticles]
  );

  const handleSelectArticle = (art: WikiArticle) => {
    setSelectedArticleId(art.id);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (!currentArticle) return;
    setEditedTitle(currentArticle.title);
    setEditedCategory(currentArticle.category);
    setEditedParentId(currentArticle.parentId || "");
    setEditedContent(currentArticle.markdownContent);
    setEditedTags(currentArticle.tags.join(", "));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!currentArticle) return;

    // Traits & attribute slots render live in the Dossier card — strip any
    // stale static copies from character articles on every save.
    const finalContent = sanitizeCharacterArticleSections(
      editedContent,
      resolveSlotConfig(project)
    );
    const words = finalContent.trim().split(/\s+/).filter(Boolean).length;
    const tagArray = editedTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const updatedArticles = project.wikiArticles.map((a) => {
      if (a.id === currentArticle.id) {
        return {
          ...a,
          title: editedTitle,
          category: editedCategory,
          parentId: editedParentId || undefined,
          markdownContent: finalContent,
          tags: tagArray,
          wordCount: words,
          lastModified: new Date().toISOString().split("T")[0],
        };
      }
      return a;
    });

    setProject({
      ...project,
      wikiArticles: updatedArticles,
      lastUpdated: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const handleCreateArticle = () => {
    if (!newTitle.trim()) return;

    const id = `art-${Date.now()}`;
    // Resolve the chosen category (id or legacy label) to its stable id and label.
    const categoryEntry =
      entryByLabel(tax.articleCategories, newCategory) || tax.articleCategories[0];
    const categoryId = categoryEntry.id;
    const label = categoryEntry.label;
    const isCharacterArticle = hasFlag(categoryEntry, "is-character");

    // Character articles stay prose-only: traits & attribute slots render
    // live in the Dossier card above the article.
    const initialContent = isCharacterArticle
      ? `# ${newTitle}\n\n## Overview\nAdd background lore, chronicle references, and [[WikiLinks]] here.\n\n## Key Events\n* Mention key dates or colony exploits.`
      : `# ${newTitle}\n\n## Overview\nAdd background lore, traits, chronicle references, and [[WikiLinks]] here.\n\n## Key Events\n* Mention key dates or colony exploits.`;
    const newArticle: WikiArticle = {
      id,
      title: newTitle.trim(),
      category: categoryId,
      parentId: newParentId || undefined,
      tags: [label.toLowerCase()],
      markdownContent: initialContent,
      createdAt: new Date().toISOString().split("T")[0],
      lastModified: new Date().toISOString().split("T")[0],
      wordCount: initialContent.split(/\s+/).length,
    };

    setProject({
      ...project,
      wikiArticles: [newArticle, ...project.wikiArticles],
      lastUpdated: new Date().toISOString(),
    });

    // Reveal the fresh sub-article by expanding its parent folder.
    if (newArticle.parentId) {
      setExpandedFolders((prev) => {
        if (prev.has(newArticle.parentId!)) return prev;
        const next = new Set(prev);
        next.add(newArticle.parentId!);
        return next;
      });
    }

    setSelectedArticleId(id);
    setIsCreateModalOpen(false);
    setNewTitle("");
    setNewParentId("");
    setIsEditing(true);
    setEditedTitle(newArticle.title);
    setEditedCategory(newArticle.category);
    setEditedParentId(newArticle.parentId || "");
    setEditedContent(initialContent);
    setEditedTags(newArticle.tags.join(", "));
  };

  const handleDeleteArticle = (id: string) => {
    if (project.wikiArticles.length <= 1) {
      alert("Cannot delete the last remaining article.");
      return;
    }
    const target = project.wikiArticles.find((a) => a.id === id);
    if (!target) return;

    const childrenCount = project.wikiArticles.filter((a) => a.parentId === id).length;
    const confirmMsg =
      childrenCount > 0
        ? `Delete "${target.title}"? Its ${childrenCount} sub-article${childrenCount > 1 ? "s" : ""} will be moved to the top level.`
        : `Delete "${target.title}"?`;
    if (!window.confirm(confirmMsg)) return;

    // Lift direct children to the top level so no content is orphaned or lost.
    const filtered = project.wikiArticles
      .filter((a) => a.id !== id)
      .map((a) => (a.parentId === id ? { ...a, parentId: undefined } : a));
    setProject({
      ...project,
      wikiArticles: filtered,
      lastUpdated: new Date().toISOString(),
    });
    setExpandedFolders((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedArticleId(filtered[0]?.id);
    setIsEditing(false);
  };

  const reparentArticle = (id: string, parentId: string | undefined) => {
    const nextArticles = project.wikiArticles.map((a) =>
      a.id === id ? { ...a, parentId: parentId || undefined } : a
    );
    setProject({
      ...project,
      wikiArticles: nextArticles,
      lastUpdated: new Date().toISOString(),
    });
    // Reveal the new location by expanding the target folder.
    if (parentId) {
      setExpandedFolders((prev) => {
        if (prev.has(parentId)) return prev;
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });
    }
    // Keep a live editor's parent field in sync so Save doesn't revert the move.
    if (currentArticle?.id === id) setEditedParentId(parentId || "");
  };

  const handleDragStart = (e: React.DragEvent, art: WikiArticle) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", art.id);
    setDraggedId(art.id);
  };

  const endDrag = () => {
    setDraggedId(null);
    setDragOverId(null);
    setIsDragOverRoot(false);
  };

  const isInvalidDropTarget = (target: WikiArticle) => {
    if (!draggedId || target.id === draggedId) return true;
    return getDescendantIds(project.wikiArticles, draggedId).has(target.id);
  };

  const handleDragOverRow = (e: React.DragEvent, art: WikiArticle) => {
    if (!draggedId) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
    if (isInvalidDropTarget(art)) return;
    setDragOverId(art.id);
  };

  const handleDropOnRow = (e: React.DragEvent, art: WikiArticle) => {
    e.preventDefault();
    e.stopPropagation();
    const id = draggedId;
    setDragOverId(null);
    if (!id || isInvalidDropTarget(art)) return;
    reparentArticle(id, art.id);
  };

  const handleDragOverRoot = (e: React.DragEvent) => {
    if (!draggedId) return;
    e.preventDefault();
    setIsDragOverRoot(true);
    setDragOverId(null);
  };

  const handleDropOnRoot = (e: React.DragEvent) => {
    e.preventDefault();
    const id = draggedId;
    setIsDragOverRoot(false);
    if (id) reparentArticle(id, undefined);
  };

  const handleExportSingleArticle = () => {
    if (!currentArticle) return;
    const blob = new Blob([currentArticle.markdownContent], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, `${currentArticle.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`);
  };

  const handleAiExpand = async () => {
    if (!currentArticle) return;
    setIsExpanding(true);
    setAiExpandError("");

    try {
      const res = await aiFetch("/api/ai/expand-wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxonomy: tax,
          articleTitle: currentArticle.title,
          category: currentArticle.category,
          currentContent: currentArticle.markdownContent,
          promptInstruction: aiPromptInstruction || "Deepen historical lore, character trauma, and combat chronicles with cross-references.",
          context: {
            characters: project.characters,
            timelineEvents: project.timelineEvents,
            factions: project.factions,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to expand article with AI");
      }

      const data = await res.json();
      if (data.markdownContent) {
        const words = data.markdownContent.trim().split(/\s+/).filter(Boolean).length;
        const updated = project.wikiArticles.map((a) =>
          a.id === currentArticle.id
            ? {
                ...a,
                markdownContent: data.markdownContent,
                wordCount: words,
                lastModified: new Date().toISOString().split("T")[0],
              }
            : a
        );

        setProject({
          ...project,
          wikiArticles: updated,
          lastUpdated: new Date().toISOString(),
        });
        setIsAiExpandModalOpen(false);
        setAiPromptInstruction("");
      }
    } catch (err: any) {
      setAiExpandError(err.message || "Failed to expand article");
    } finally {
      setIsExpanding(false);
    }
  };

  const insertWikiLinkSnippet = () => {
    setEditedContent((prev) => prev + " [[Entity Name]] ");
  };

  const insertQuoteSnippet = () => {
    setEditedContent((prev) => prev + "\n\n> *\"Notable colonist quote or colony log snippet.\"*\n> — Speaker\n\n");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Sidebar: Categories & Article Directory */}
      <aside
        id="wiki-sidebar"
        className={`lg:col-span-4 rounded-2xl border p-4 space-y-4 shadow-sm ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-100/70 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        {/* Search & New Article */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              id="wiki-search-input"
              placeholder="Search wiki articles, tags, text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border outline-none transition-colors ${
                theme === "dark"
                  ? "bg-[#0c0c0e] border-[#25252d] text-[#e2e8f0] focus:border-amber-500"
                  : theme === "parchment"
                  ? "bg-amber-50 border-amber-300 text-stone-900 focus:border-amber-700"
                  : "bg-slate-950 border-cyan-900 text-cyan-50 focus:border-cyan-400"
              }`}
            />
          </div>
          <button
            id="btn-new-wiki-article"
            onClick={() => {
              setNewCategory(tax.articleCategories[0]?.id || "");
              setNewParentId("");
              setIsCreateModalOpen(true);
            }}
            className={`p-2 rounded-xl border flex items-center justify-center transition-transform active:scale-95 ${
              theme === "dark"
                ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e] border-amber-400 font-bold shadow-amber-500/10"
                : theme === "parchment"
                ? "bg-amber-800 hover:bg-amber-700 text-amber-50 border-amber-900 font-bold"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 font-bold"
            }`}
            title="Create New Markdown Article"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Chips */}
        <div className="flex items-center flex-wrap gap-1.5 pb-1">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.value
                  ? theme === "dark"
                    ? "bg-[#1f1f26] text-amber-400 border border-[#2e2e38] font-semibold"
                    : theme === "parchment"
                    ? "bg-amber-800 text-amber-50 font-bold"
                    : "bg-cyan-950 text-cyan-300 border border-cyan-700"
                  : theme === "dark"
                  ? "bg-[#16161a]/60 text-zinc-400 hover:text-zinc-200 border border-transparent"
                  : theme === "parchment"
                  ? "bg-amber-200/60 text-stone-700 hover:text-stone-900 border border-transparent"
                  : "bg-slate-950/60 text-cyan-400/70 hover:text-cyan-200 border border-transparent"
              }`}
            >
              {cat.color && (
                <span className="w-2 h-2 rounded-full shrink-0 inline-block mr-0.5" style={{ backgroundColor: cat.color }} />
              )}
              {cat.icon}
              <span>{cat.label}</span>
              <span className="text-[10px] opacity-60">({cat.count})</span>
            </button>
          ))}
        </div>

        {/* Article Cards List */}
        <div
          onDragOver={handleDragOverRoot}
          onDrop={handleDropOnRoot}
          onDragLeave={() => setIsDragOverRoot(false)}
          className={`space-y-1.5 max-h-[600px] overflow-y-auto pr-1 rounded-xl transition-shadow ${
            draggedId
              ? isDragOverRoot
                ? "ring-2 ring-dashed ring-amber-400/60"
                : "ring-1 ring-dashed ring-white/10"
              : ""
          }`}
        >
          {isDragOverRoot && draggedId && (
            <div className="p-2 text-center text-[11px] font-mono opacity-80 text-amber-400 bg-amber-500/10 rounded-xl border border-dashed border-amber-400/40">
              Drop to move to the top level
            </div>
          )}
          {treeRows.length === 0 ? (
            <div className="text-center py-8 opacity-60 text-xs italic">
              No wiki articles found matching "{searchQuery}".
            </div>
          ) : (
            treeRows.map(({ article: art, depth, hasChildren, childCount, isExpanded }) => {
              const isSelected = currentArticle?.id === art.id;
              const toggleExpand = (e: React.MouseEvent) => {
                e.stopPropagation();
                setExpandedFolders((prev) => {
                  const next = new Set(prev);
                  if (next.has(art.id)) next.delete(art.id);
                  else next.add(art.id);
                  return next;
                });
              };
              return (
                <button
                  key={art.id}
                  id={`article-card-${art.id}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, art)}
                  onDragEnd={endDrag}
                  onDragOver={(e) => handleDragOverRow(e, art)}
                  onDrop={(e) => handleDropOnRow(e, art)}
                  onDragLeave={() => setDragOverId((prev) => (prev === art.id ? null : prev))}
                  onClick={() => handleSelectArticle(art)}
                  style={{ paddingLeft: 12 + depth * 20 }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? theme === "dark"
                        ? "bg-[#1a1a20] border-amber-500/50 text-[#fafafa] shadow-sm font-medium"
                        : theme === "parchment"
                        ? "bg-amber-200/90 border-amber-400 text-stone-950 shadow-sm font-semibold"
                        : "bg-cyan-950/90 border-cyan-400 text-cyan-50 shadow-sm"
                      : dragOverId === art.id
                      ? "bg-amber-500/10 border-amber-400 text-inherit"
                      : theme === "dark"
                      ? "bg-[#0e0e11]/80 border-[#202026] text-zinc-300 hover:bg-[#16161b]"
                      : theme === "parchment"
                      ? "bg-amber-50/70 border-amber-200 text-stone-800 hover:bg-amber-100"
                      : "bg-slate-950/40 border-cyan-950 text-cyan-300/80 hover:bg-slate-800/50"
                  } ${dragOverId === art.id && !isSelected ? "ring-2 ring-amber-400/50" : ""}`}
                >
                  <div className="min-w-0 pr-2 flex items-start gap-1.5">
                    <span
                      onClick={hasChildren ? toggleExpand : undefined}
                      className={`shrink-0 mt-0.5 ${
                        hasChildren ? "cursor-pointer hover:opacity-80" : "opacity-40"
                      }`}
                      title={
                        hasChildren
                          ? isExpanded
                            ? "Collapse sub-articles"
                            : `Expand sub-articles (${childCount})`
                          : depth > 0
                          ? "Sub-article"
                          : undefined
                      }
                    >
                      {hasChildren ? (
                        isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 opacity-90" />
                        )
                      ) : depth > 0 ? (
                        <CornerDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5 h-3.5 block" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span
                          className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded font-bold ${
                            theme === "dark" ? "text-[#e2e8f0]" : theme === "parchment" ? "text-stone-800" : "text-cyan-50"
                          }`}
                          style={
                            categoryMeta(art.category).color
                              ? { backgroundColor: `${categoryMeta(art.category).color}33`, color: categoryMeta(art.category).color }
                              : undefined
                          }
                        >
                          {categoryMeta(art.category).label}
                        </span>
                        <span className="text-[10px] opacity-40 font-mono">
                          {art.wordCount || art.markdownContent.split(/\s+/).length} words
                        </span>
                        {hasChildren && (
                          <span className="text-[10px] px-1.5 rounded bg-black/20 opacity-60 font-mono" title="Folder article">
                            ▾{childCount}
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif font-bold text-sm truncate">{art.title}</h4>
                      {art.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {art.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="text-[9px] px-1 rounded bg-black/20 opacity-70 font-mono"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected ? "translate-x-1 opacity-100 text-amber-400" : "opacity-30 group-hover:opacity-70"
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Main Pane: Article Content / Editor */}
      <main
        id="wiki-article-view"
        className={`lg:col-span-8 rounded-2xl border p-6 sm:p-8 shadow-sm space-y-6 min-h-[600px] ${
          theme === "dark"
            ? "bg-[#121215] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-50/90 border-amber-200"
            : "bg-slate-900/80 border-cyan-900"
        }`}
      >
        {currentArticle ? (
          <div>
            {/* Breadcrumb — location within the article tree */}
            {ancestorChain.length > 0 && (
              <div className="flex items-center flex-wrap gap-1 text-[11px] font-mono opacity-70 pb-3 -mt-1">
                {ancestorChain.map((p) => (
                  <React.Fragment key={p.id}>
                    <button
                      onClick={() => setSelectedArticleId(p.id)}
                      className="underline decoration-dotted hover:opacity-100"
                      title={`Open "${p.title}"`}
                    >
                      {p.title}
                    </button>
                    <ChevronRight className="w-3 h-3 opacity-40" />
                  </React.Fragment>
                ))}
                <span className="font-semibold opacity-90">{currentArticle.title}</span>
              </div>
            )}
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div className="flex items-start gap-2">
                <span
                  className={`text-xs uppercase font-mono px-2 py-0.5 rounded-md font-bold ${
                    theme === "dark" ? "text-[#e2e8f0]" : theme === "parchment" ? "text-stone-800" : "text-cyan-50"
                  }`}
                  style={
                    categoryMeta(currentArticle.category).color
                      ? { backgroundColor: `${categoryMeta(currentArticle.category).color}33`, color: categoryMeta(currentArticle.category).color }
                      : undefined
                  }
                >
                  {categoryMeta(currentArticle.category).label}
                </span>
                <div className="min-w-0">
                  {linkedCharacter && (
                    <span className="block font-serif font-bold text-base leading-snug truncate">
                      {linkedCharacter.name}
                      {linkedCharacter.nickname &&
                        linkedCharacter.nickname.toLowerCase() !==
                          linkedCharacter.name.toLowerCase() && (
                          <span className="opacity-50 font-normal text-sm"> "{linkedCharacter.nickname}"</span>
                        )}
                    </span>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs opacity-50 font-mono">
                      {currentArticle.wordCount || currentArticle.markdownContent.split(/\s+/).length} words
                    </span>
                    <span className="text-xs opacity-40 font-mono">
                      • Modified {currentArticle.lastModified}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {/* AI Expand — hidden in Offline Mode (no AI available) */}
                {isAiMode && (
                  <button
                    id="btn-ai-expand-wiki"
                    onClick={() => setIsAiExpandModalOpen(true)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      theme === "dark"
                        ? "bg-purple-950/40 border-purple-800/50 text-purple-300 hover:bg-purple-900/60"
                        : theme === "parchment"
                        ? "bg-purple-100 border-purple-300 text-purple-900 hover:bg-purple-200"
                        : "bg-purple-950/60 border-purple-700 text-purple-300 hover:bg-purple-900"
                    }`}
                    title="Ask AI to expand this article with historical lore, relationships, or combat records"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Deepen with AI</span>
                  </button>
                )}

                {/* Edit / Read Mode Toggle */}
                {isEditing ? (
                  <button
                    id="btn-save-wiki-edit"
                    onClick={handleSaveEdit}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${
                      theme === "dark"
                        ? "bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold"
                        : theme === "parchment"
                        ? "bg-emerald-700 hover:bg-emerald-600 text-white font-bold"
                        : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Article</span>
                  </button>
                ) : (
                  <button
                    id="btn-start-wiki-edit"
                    onClick={handleStartEdit}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      theme === "dark"
                        ? "border-[#2c2c36] text-zinc-300 hover:bg-[#1c1c24]"
                        : theme === "parchment"
                        ? "border-amber-300 text-stone-800 hover:bg-amber-100"
                        : "border-cyan-800 text-cyan-300 hover:bg-slate-800"
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit .md</span>
                  </button>
                )}

                {/* New Sub-article — nests the new article under the current one */}
                {!isEditing && (
                  <button
                    id="btn-new-sub-article"
                    onClick={() => {
                      setNewCategory(currentArticle.category || tax.articleCategories[0]?.id || "");
                      setNewParentId(currentArticle.id);
                      setNewTitle("");
                      setIsCreateModalOpen(true);
                    }}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      theme === "dark"
                        ? "border-[#2c2c36] text-zinc-300 hover:bg-[#1c1c24]"
                        : theme === "parchment"
                        ? "border-amber-300 text-stone-800 hover:bg-amber-100"
                        : "border-cyan-800 text-cyan-300 hover:bg-slate-800"
                    }`}
                    title="Create a sub-article nested inside this article (folder-style)"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Sub-article</span>
                  </button>
                )}

                {/* Export single .md */}
                <button
                  id="btn-export-single-md"
                  onClick={handleExportSingleArticle}
                  className="p-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/10 opacity-80 hover:opacity-100"
                  title="Download .md file"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {/* Delete */}
                <button
                  id="btn-delete-wiki-article"
                  onClick={() => handleDeleteArticle(currentArticle.id)}
                  className="p-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10"
                  title="Delete article"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Backlinks Bar */}
            {currentBacklinks.length > 0 && (
              <div
                className={`p-2.5 rounded-xl border flex items-center space-x-2 text-xs mb-4 ${
                  theme === "dark"
                    ? "bg-[#0c0c0e] border-[#222228] text-zinc-300"
                    : theme === "parchment"
                    ? "bg-amber-100/60 border-amber-300 text-stone-800"
                    : "bg-slate-950/60 border-cyan-950 text-cyan-300"
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                <span className="opacity-75 font-mono text-[11px]">Referenced in:</span>
                <div className="flex flex-wrap gap-1.5">
                  {currentBacklinks.map((bTitle) => (
                    <button
                      key={bTitle}
                      onClick={() => {
                        const target = project.wikiArticles.find(
                          (a) => a.title.toLowerCase() === bTitle.toLowerCase()
                        );
                        if (target) setSelectedArticleId(target.id);
                      }}
                      className="px-2 py-0.5 rounded font-semibold text-[11px] underline decoration-dotted hover:opacity-80"
                    >
                      [[{bTitle}]]
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Character Sheet: Traits + Attribute Slots + Stat Block */}
            {!isEditing && linkedCharacter && (
              <div
                className={`rounded-2xl border p-4 space-y-3 ${
                  theme === "dark"
                    ? "bg-[#0c0c0e] border-[#25252d]"
                    : theme === "parchment"
                    ? "bg-amber-100/50 border-amber-300"
                    : "bg-slate-950/60 border-cyan-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-400" />
                    {lex.t("dossierWord")} — {linkedCharacter.role || lex.t("defaultRole")}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-wiki-edit-character-sheet"
                      onClick={() => setIsSheetEditorOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 opacity-80 hover:opacity-100 transition-opacity"
                      title="Edit this character sheet — identity, status, traits & attribute slots"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit Sheet
                    </button>
                    <span className="text-[10px] font-mono opacity-40 uppercase">
                      live-linked to the Social Web
                    </span>
                  </div>
                </div>
                <CharacterSheetPanel
                  character={linkedCharacter}
                  project={project}
                  setProject={setProject}
                  theme={theme}
                />
              </div>
            )}

            {/* Article Content or Markdown Editor */}
            {isEditing ? (
              <div className="space-y-4">
                {/* Meta Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono opacity-70 block mb-1">Title</label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm bg-black/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono opacity-70 block mb-1">Category</label>
                    <select
                      value={editedCategory}
                      onChange={(e) => setEditedCategory(e.target.value)}
                      className={`w-full px-3 py-1.5 rounded-lg outline-none text-sm cursor-pointer ${selectClasses(theme)}`}
                    >
                      {tax.articleCategories.map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono opacity-70 block mb-1">Parent / Folder (Sub-article of)</label>
                    <select
                      value={editedParentId}
                      onChange={(e) => setEditedParentId(e.target.value)}
                      className={`w-full px-3 py-1.5 rounded-lg outline-none text-sm cursor-pointer ${selectClasses(theme)}`}
                    >
                      <option value="">None (top-level)</option>
                      {editParentOptions.map((a) => (
                        <option key={a.id} value={a.id}>{displayPath(a)}</option>
                      ))}
                    </select>
                    {editedParentId && (
                      <p className="text-[10px] font-mono opacity-50 mt-1">
                        {displayPath(project.wikiArticles.find((a) => a.id === editedParentId) || currentArticle!)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-mono opacity-70 block mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={editedTags}
                      onChange={(e) => setEditedTags(e.target.value)}
                      placeholder="colonist, surgery, founder"
                      className="w-full px-3 py-1.5 rounded-lg border text-sm bg-black/20 outline-none"
                    />
                  </div>
                </div>

                {/* Markdown Editor Toolbar */}
                <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-xs">
                  <span className="font-mono opacity-60">Insert:</span>
                  <button
                    type="button"
                    onClick={insertWikiLinkSnippet}
                    className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 font-mono text-[11px] text-amber-400"
                  >
                    + [[WikiLink]]
                  </button>
                  <button
                    type="button"
                    onClick={insertQuoteSnippet}
                    className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 font-mono text-[11px]"
                  >
                    + Infobox Quote
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditedContent((p) => p + "\n\n## New Section\nDetails here...")}
                    className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 font-mono text-[11px]"
                  >
                    + Header ##
                  </button>
                </div>

                {/* Editor Textarea */}
                <textarea
                  id="wiki-markdown-editor"
                  rows={20}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className={`w-full p-4 rounded-xl font-mono text-xs sm:text-sm border outline-none leading-relaxed resize-y ${
                    theme === "dark"
                      ? "bg-[#0c0c0e] border-[#222228] text-[#e2e8f0]"
                      : theme === "parchment"
                      ? "bg-amber-50 border-amber-300 text-stone-900"
                      : "bg-slate-950 border-cyan-900 text-cyan-50"
                  }`}
                  placeholder="Write in Markdown... Use [[WikiLinks]] for automatic cross-referencing!"
                />
              </div>
            ) : (
              <div className="pt-2">
                <MarkdownRenderer
                  content={currentArticle.markdownContent}
                  lookup={lookup}
                  theme={theme}
                  taxonomy={tax}
                  onNavigateToArticle={(targetTitle) => {
                    const target = project.wikiArticles.find(
                      (a) => a.title.toLowerCase() === targetTitle.toLowerCase()
                    );
                    if (target) {
                      setSelectedArticleId(target.id);
                    } else {
                      // Prompt to create
                      if (window.confirm(`Article "[[${targetTitle}]]" does not exist yet. Would you like to create it?`)) {
                        setNewTitle(targetTitle);
                        setNewCategory(tax.articleCategories[0]?.id || "");
                        setNewParentId("");
                        setIsCreateModalOpen(true);
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 opacity-60">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <h3 className="font-serif text-lg font-bold">No Article Selected</h3>
            <p className="text-xs mt-1">Select an article from the left directory or create a new one.</p>
          </div>
        )}
      </main>

      {/* Create Article Modal */}
      {isCreateModalOpen && (
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
                <span>Create New Wiki Article</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono opacity-70 block mb-1">Article Title / Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Valerie Vance, Ashen Skulls, The Great Cold Snap"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm bg-black/20 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-mono opacity-70 block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl outline-none text-sm cursor-pointer ${selectClasses(theme)}`}
                >
                  {tax.articleCategories.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-mono opacity-70 block mb-1">Parent / Folder (Sub-article of)</label>
                <select
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl outline-none text-sm cursor-pointer ${selectClasses(theme)}`}
                >
                  <option value="">None (top-level)</option>
                  {createParentOptions.map((a) => (
                    <option key={a.id} value={a.id}>{displayPath(a)}</option>
                  ))}
                </select>
                <label
                  className={`flex items-center gap-2 mt-2 text-[11px] font-mono cursor-pointer select-none ${
                    currentArticle ? "opacity-80 hover:opacity-100" : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!currentArticle}
                    checked={newParentId === (currentArticle?.id || "")}
                    onChange={(e) =>
                      setNewParentId(e.target.checked && currentArticle ? currentArticle.id : "")
                    }
                    className="accent-amber-500"
                  />
                  Create as a sub-article of "{currentArticle?.title || "the current article"}"
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateArticle}
                disabled={!newTitle.trim()}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                  theme === "dark"
                    ? "bg-amber-500 text-[#0c0c0e] hover:bg-amber-400"
                    : theme === "parchment"
                    ? "bg-amber-800 text-amber-50 hover:bg-amber-700"
                    : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                }`}
              >
                Create Article
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Expand Article Modal */}
      {isAiExpandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl space-y-4 ${
              theme === "dark"
                ? "bg-[#121215] border-[#25252e] text-[#e2e8f0]"
                : theme === "parchment"
                ? "bg-amber-50 border-amber-300 text-stone-900"
                : "bg-slate-900 border-cyan-800 text-cyan-50"
            }`}
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Deepen & Expand Article: "{currentArticle?.title}"</span>
              </h3>
              <button
                onClick={() => setIsAiExpandModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs opacity-80 leading-relaxed">
              OpenCode AI will analyze your colony events, relationships, and world context to enhance this article with rich Markdown formatting, psychological nuances, dramatic quotes, and automatic cross-references.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-mono opacity-70 block">Custom Focus / Instructions (Optional)</label>
              <textarea
                rows={3}
                placeholder="e.g. Focus on the trauma of the 5502 Mortar Siege, add a combat record section, and detail their relationship with Cole."
                value={aiPromptInstruction}
                onChange={(e) => setAiPromptInstruction(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs sm:text-sm bg-black/20 outline-none"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setAiPromptInstruction("Add a detailed combat and surgical record section with timestamps.")}
                  className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 font-mono"
                >
                  + Combat/Medical Record
                </button>
                <button
                  type="button"
                  onClick={() => setAiPromptInstruction("Dramatize psychological trauma, mental break history, and character growth.")}
                  className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 font-mono"
                >
                  + Psychological Profile
                </button>
                <button
                  type="button"
                  onClick={() => setAiPromptInstruction("Include quotes, dialogue snippets, and interpersonal dynamics with other colonists.")}
                  className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 font-mono"
                >
                  + Colonist Quotes & Dialogue
                </button>
              </div>
            </div>

            {aiExpandError && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                {aiExpandError}
              </p>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsAiExpandModalOpen(false)}
                disabled={isExpanding}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAiExpand}
                disabled={isExpanding}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                  theme === "dark"
                    ? "bg-purple-600 text-white hover:bg-purple-500"
                    : theme === "parchment"
                    ? "bg-purple-800 text-purple-50 hover:bg-purple-700"
                    : "bg-purple-600 text-white hover:bg-purple-500"
                }`}
              >
                {isExpanding ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Expanding Lore...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Expand Article</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Character Sheet Editor (linked dossier) */}
      {isSheetEditorOpen && linkedCharacter && (
        <CharacterEditModal
          project={project}
          setProject={setProject}
          theme={theme}
          mode="edit"
          character={linkedCharacter}
          onClose={() => setIsSheetEditorOpen(false)}
        />
      )}
    </div>
  );
};
