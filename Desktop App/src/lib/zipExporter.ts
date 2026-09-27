import JSZip from "jszip";
import { StoryProject, TaxonomyEntry, WikiArticle } from "../types";
import { getSlotEntries } from "./attributeSlots";
import { renderStatBlock } from "./statBlock";
import { getChildrenMap, resolveSlotConfig } from "./wikiParser";
import { getTaxonomy, taxonomyLabel } from "./taxonomy";

/** Device names Windows reserves — unusable as file or folder names. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

const safeName = (value: string) => {
  // Trailing dots/spaces are silently stripped by Windows, which would make the
  // written path differ from the requested one.
  const cleaned = (value || "").replace(/[/\\?%*:|"<>]/g, "-").replace(/[. ]+$/, "");
  if (!cleaned) return "Untitled";
  return RESERVED_NAMES.test(cleaned) ? `_${cleaned}` : cleaned;
};

/**
 * Relative path segments (no extension) for every article, mirroring the app's
 * nesting: an article sits in a folder named after its parent, following the
 * Obsidian `Foo.md` + `Foo/` convention. Each name is allocated per parent, so
 * two sibling articles sharing a title get distinct files instead of one
 * overwriting the other. Articles whose parent is missing — or caught in a
 * parent cycle — fall back to the top level rather than being dropped.
 */
export function buildArticlePaths(articles: WikiArticle[]): Map<string, string[]> {
  const childrenMap = getChildrenMap(articles);
  const known = new Set(articles.map((a) => a.id));
  const paths = new Map<string, string[]>();
  const taken = new Map<string, Set<string>>();

  const place = (article: WikiArticle, parentKey: string, prefix: string[]) => {
    if (paths.has(article.id)) return;
    const base = safeName(article.title);
    const used = taken.get(parentKey) || new Set<string>();
    let name = base;
    let n = 1;
    while (used.has(name.toLowerCase())) name = `${base} (${++n})`;
    used.add(name.toLowerCase());
    taken.set(parentKey, used);

    const segments = [...prefix, name];
    paths.set(article.id, segments);
    (childrenMap.get(article.id) || []).forEach((child) => place(child, article.id, segments));
  };

  articles.forEach((a) => {
    if (!a.parentId || !known.has(a.parentId)) place(a, "", []);
  });
  articles.forEach((a) => {
    if (!paths.has(a.id)) place(a, "", []);
  });
  return paths;
}

/** Always-double-quoted YAML scalar, so `:`, `#`, quotes and leading digits survive. */
const yamlString = (value: string) => JSON.stringify(String(value));

/**
 * Prepend a YAML front-matter block to an article. With the category folders
 * gone, this is what keeps an article's category and tags machine-readable for
 * Obsidian filters, grep, and re-import.
 */
function withFrontMatter(article: WikiArticle, articleCategories: TaxonomyEntry[]): string {
  const tags = article.tags || [];
  const lines = [
    "---",
    `title: ${yamlString(article.title)}`,
    `category: ${yamlString(taxonomyLabel(articleCategories, article.category))}`,
    `tags: [${tags.map(yamlString).join(", ")}]`,
  ];
  if (article.lastModified) lines.push(`updated: ${yamlString(article.lastModified)}`);
  lines.push("---", "");
  return `${lines.join("\n")}\n${article.markdownContent}`;
}

/**
 * Build the full Markdown wiki export as a flat map of relative path -> file
 * content. Used both by the .zip exporter and the "save to chosen folder"
 * feature so both produce identical output.
 */
export function buildWikiExportFiles(project: StoryProject): Record<string, string> {
  const files: Record<string, string> = {};

  // Root README / Overview
  const readmeContent = `# ${project.title}
_${project.subtitle}_

Last Updated: ${new Date(project.lastUpdated).toLocaleString()}

## Table of Contents
- **Wiki**: Markdown world encyclopaedia with [[WikiLinks]], filed in a folder tree that mirrors the article nesting (each article sits in a folder named after its parent) and tagged with YAML front-matter
- **Characters**: Colonist profiles, traits, health status, and dramatic arcs
- **Timeline**: Chronological events and RimWorld season log
- **Hierarchy**: Act, Chapter, and Scene structure
- **Manuscript**: Drafted novelization chapters

Generated with RimChronicle Storyteller Studio.
`;
  files["README.md"] = readmeContent;

  // Wiki directory — the folder tree mirrors the app's article nesting: every
  // article lives in a folder named after its parent, so the whole wiki is one
  // tree instead of one copy per category. The category travels in the
  // front-matter of each file rather than in the path.
  const articlePaths = buildArticlePaths(project.wikiArticles);
  const articleCategories = getTaxonomy(project).articleCategories;
  project.wikiArticles.forEach((art) => {
    const segments = articlePaths.get(art.id) || [safeName(art.title)];
    files[`wiki/${segments.join("/")}.md`] = withFrontMatter(art, articleCategories);
  });

  // Characters directory: dossier + dynamic attribute slots + stat block
  const slots = resolveSlotConfig(project);
  project.characters.forEach((c) => {
    let md = `# ${c.name}\n*${c.role}${c.faction ? ` — ${c.faction}` : ""}*\n\n${c.bio || ""}\n\n`;
    if (c.traits?.length) md += `## Traits\n${c.traits.map((t) => `* **${t}**`).join("\n")}\n\n`;
    slots.forEach((slot) => {
      const entries = getSlotEntries(c, slot.id);
      md += `## ${slot.label}\n${entries.length > 0 ? entries.map((e) => `* **${e}**`).join("\n") : "* *(No entries recorded yet.)*"}\n\n`;
    });
    md += `${renderStatBlock(c, project)}\n`;
    if (c.dramaticArc) md += `\n## Dramatic Arc\n${c.dramaticArc}\n`;
    files[`characters/${safeName(c.name)}.md`] = md;
  });

  // Manuscript directory
  let fullManuscript = `# ${project.title}\n_${project.subtitle}_\n\n---\n\n`;
  project.storyHierarchy.forEach((act, actIdx) => {
    fullManuscript += `# ${act.title}\n*Theme: ${act.theme}*\n\n`;
    act.chapters.forEach((chap, chapIdx) => {
      const chapTitle = chap.title || `Chapter ${chapIdx + 1}`;
      const chapContent = chap.fullChapterMarkdown || `_${chap.summary}_\n\n*(Chapter draft in progress)*\n`;
      fullManuscript += `\n${chapContent}\n\n---\n\n`;

      const safeChapTitle = `Act${actIdx + 1}_${safeName(chapTitle)}.md`;
      files[`novel/${safeChapTitle}`] = chapContent;
    });
  });
  files["novel/FULL_MANUSCRIPT.md"] = fullManuscript;

  // Data JSON backup
  files["project-backup.json"] = JSON.stringify(project, null, 2);

  // Timeline CSV / Summary
  let timelineDoc = `# Colony Timeline & Chronicle Logs\n\n`;
  timelineDoc += `| Timestamp | Title | Category | Threat | Location | Summary |\n`;
  timelineDoc += `|---|---|---|---|---|---|\n`;
  project.timelineEvents.forEach((e) => {
    timelineDoc += `| ${e.timestamp} | ${e.title} | ${e.category} | ${e.threatLevel} | ${e.location} | ${e.description.replace(/\|/g, "/")} |\n`;
  });
  files["TIMELINE.md"] = timelineDoc;

  return files;
}

export async function exportProjectToMarkdownZip(project: StoryProject): Promise<Blob> {
  const zip = new JSZip();
  const files = buildWikiExportFiles(project);
  Object.entries(files).forEach(([relPath, content]) => {
    zip.file(relPath, content);
  });
  return await zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportProjectToZip(project: StoryProject) {
  const blob = await exportProjectToMarkdownZip(project);
  const safeName = project.title.replace(/[/\\?%*:|"<>]/g, "-");
  downloadBlob(blob, `${safeName}_Markdown_Wiki_Archive.zip`);
}
