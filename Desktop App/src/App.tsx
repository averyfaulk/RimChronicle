import React, { useEffect, useMemo, useState } from "react";
import { ActiveTab, StoryProject, ThemeMode } from "./types";
import { LexiconContext, LexiconMode, loadLexiconMode, saveLexiconMode } from "./lib/lexicon";
import { Navigation } from "./components/Navigation";
import { WelcomeScreen } from "./components/Startup/WelcomeScreen";
import { WikiManager } from "./components/Wiki/WikiManager";
import { RelationshipGraph } from "./components/Relationships/RelationshipGraph";
import { WorldMapView } from "./components/WorldMap/WorldMapView";
import { ChronicleTimeline } from "./components/Timeline/ChronicleTimeline";
import { IdeologyPage } from "./components/Ideology/IdeologyPage";
import { PlotGapAnalyzer } from "./components/PlotAnalyzer/PlotGapAnalyzer";
import { NovelizationStudio } from "./components/Novel/NovelizationStudio";
import { ChroniclerBot } from "./components/Archivist/ChroniclerBot";
import { LogIngestionModal } from "./components/Ingest/LogIngestionModal";
import { TaxonomyManagerModal } from "./components/Worldbuilding/TaxonomyManagerModal";
import { DiceRollerModal } from "./components/DiceRoller/DiceRollerModal";
import { buildEntityLookup, EntityLookup } from "./lib/wikiParser";
import { applyModePreset, migrateProjectSlots } from "./lib/attributeSlots";
import { exportProjectToMarkdownZip, downloadBlob } from "./lib/zipExporter";
import {
  createFreshProject,
  deleteWiki,
  getLastOpenedWikiId,
  getSampleProject,
  listWikis,
  loadWiki,
  migrateLegacyProject,
  saveWiki,
  setLastOpenedWikiId,
  WikiSummary,
} from "./lib/projectStore";

const App: React.FC = () => {
  const [project, setProject] = useState<StoryProject | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("wiki");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isAiMode, setIsAiMode] = useState(false);
  const [lexiconMode, setLexiconMode] = useState<LexiconMode>(() => loadLexiconMode());
  const [showLibrary, setShowLibrary] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>(undefined);
  const [wikis, setWikis] = useState<WikiSummary[]>([]);

  useEffect(() => {
    migrateLegacyProject();
    refreshWikis();
    const lastId = getLastOpenedWikiId();
    const loaded = lastId ? loadWiki(lastId) : null;
    setProject(migrateProjectSlots(loaded ?? getSampleProject()));
    if (loaded) {
      setLastOpenedWikiId(loaded.id);
    }
  }, []);

  const refreshWikis = () => {
    setWikis(listWikis());
  };

  const handleSetLexiconMode = (mode: LexiconMode) => {
    setLexiconMode(mode);
    saveLexiconMode(mode);
    // Relabel untouched attribute slots to the new mode's preset (Bionics →
    // Spells / Prepared, ...). Hand-renamed slots keep their labels.
    if (project) {
      handleSave(applyModePreset(project, mode));
    }
  };

  const lookup: EntityLookup = useMemo(
    () => (project ? buildEntityLookup(project) : { characters: new Map(), factions: new Map(), locations: new Map(), relics: new Map(), articles: new Map() }),
    [project]
  );

  const handleSave = (next: StoryProject) => {
    setProject(next);
    saveWiki(next);
    refreshWikis();
  };

  const handleNavigateToArticle = (title: string) => {
    if (!project) return;
    const target = project.wikiArticles.find(
      (a) => a.title.toLowerCase() === title.toLowerCase()
    );
    setActiveTab("wiki");
    setSelectedArticleId(target?.id);
  };

  const handleExportZip = async () => {
    if (!project) return;
    try {
      const blob = await exportProjectToMarkdownZip(project);
      downloadBlob(blob, `${project.title}.zip`);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleStartFresh = (title: string) => {
    const fresh = migrateProjectSlots(createFreshProject(title));
    setProject(fresh);
    setLastOpenedWikiId(fresh.id);
    setActiveTab("wiki");
    setSelectedArticleId(undefined);
    setShowLibrary(false);
    refreshWikis();
  };

  const handleOpenSample = () => {
    const sample = migrateProjectSlots(getSampleProject());
    setProject(sample);
    setLastOpenedWikiId(sample.id);
    setActiveTab("wiki");
    setSelectedArticleId(undefined);
    setShowLibrary(false);
    refreshWikis();
  };

  const handleOpenWiki = (id: string) => {
    const loaded = loadWiki(id);
    if (loaded) {
      setProject(migrateProjectSlots(loaded));
      setLastOpenedWikiId(loaded.id);
      setActiveTab("wiki");
      setSelectedArticleId(undefined);
      setShowLibrary(false);
      refreshWikis();
    }
  };

  const handleDeleteWiki = (id: string) => {
    deleteWiki(id);
    refreshWikis();
  };

  if (!project) {
    return (
      <WelcomeScreen
        theme={theme}
        wikis={wikis}
        canClose={false}
        onClose={() => setShowLibrary(false)}
        onStartFresh={handleStartFresh}
        onOpenSample={handleOpenSample}
        onOpenWiki={handleOpenWiki}
        onDeleteWiki={handleDeleteWiki}
      />
    );
  }

  return (
    <LexiconContext.Provider value={lexiconMode}>
    <div
      className={`min-h-screen transition-colors duration-200 ${
        theme === "dark"
          ? "bg-[#0c0c0e] text-[#e2e8f0]"
          : theme === "parchment"
          ? "bg-[#fbf7ee] text-stone-900"
          : "bg-slate-950 text-cyan-50"
      }`}
    >
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        setTheme={setTheme}
        project={project}
        isAiMode={isAiMode}
        setIsAiMode={setIsAiMode}
        lexiconMode={lexiconMode}
        setLexiconMode={handleSetLexiconMode}
        onOpenIngestModal={() => setIngestOpen(true)}
        onExportZip={handleExportZip}
        onOpenLibrary={() => setShowLibrary(true)}
        onOpenTaxonomy={() => setTaxonomyOpen(true)}
        onOpenDiceRoller={() => setDiceOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "wiki" && (
          <WikiManager
            project={project}
            setProject={handleSave}
            theme={theme}
            isAiMode={isAiMode}
            lookup={lookup}
            selectedArticleId={selectedArticleId}
            setSelectedArticleId={setSelectedArticleId}
          />
        )}
        {activeTab === "network" && (
          <RelationshipGraph
            project={project}
            setProject={handleSave}
            theme={theme}
            onNavigateToArticle={handleNavigateToArticle}
          />
        )}
        {activeTab === "map" && (
          <WorldMapView
            project={project}
            setProject={handleSave}
            theme={theme}
            onNavigateToArticle={handleNavigateToArticle}
          />
        )}
        {activeTab === "timeline" && (
          <ChronicleTimeline
            project={project}
            setProject={handleSave}
            theme={theme}
            isAiMode={isAiMode}
            onNavigateToArticle={handleNavigateToArticle}
          />
        )}
        {activeTab === "ideology" && (
          <IdeologyPage project={project} setProject={handleSave} theme={theme} />
        )}
        {activeTab === "plotgap" && (
          <PlotGapAnalyzer
            project={project}
            setProject={handleSave}
            theme={theme}
            isAiMode={isAiMode}
            onNavigateToArticle={handleNavigateToArticle}
          />
        )}
        {activeTab === "novel" && (
          <NovelizationStudio
            project={project}
            setProject={handleSave}
            theme={theme}
            lookup={lookup}
            isAiMode={isAiMode}
            onNavigateToArticle={handleNavigateToArticle}
          />
        )}
        {activeTab === "chronicler" && isAiMode && (
          <ChroniclerBot
            project={project}
            setProject={handleSave}
            theme={theme}
            lookup={lookup}
            onNavigateToArticle={handleNavigateToArticle}
          />
        )}
      </main>

      <LogIngestionModal
        isOpen={ingestOpen}
        onClose={() => setIngestOpen(false)}
        project={project}
        setProject={handleSave}
        theme={theme}
        isAiMode={isAiMode}
      />

      {taxonomyOpen && (
        <TaxonomyManagerModal
          project={project}
          setProject={handleSave}
          theme={theme}
          onClose={() => setTaxonomyOpen(false)}
        />
      )}

      <DiceRollerModal
        isOpen={diceOpen}
        onClose={() => setDiceOpen(false)}
        theme={theme}
      />

      {showLibrary && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <WelcomeScreen
            theme={theme}
            wikis={wikis}
            canClose={true}
            onClose={() => setShowLibrary(false)}
            onStartFresh={handleStartFresh}
            onOpenSample={handleOpenSample}
            onOpenWiki={handleOpenWiki}
            onDeleteWiki={handleDeleteWiki}
          />
        </div>
      )}
    </div>
    </LexiconContext.Provider>
  );
};

export default App;