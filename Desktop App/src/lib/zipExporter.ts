import JSZip from "jszip";
import { StoryProject } from "../types";
import { getSlotEntries } from "./attributeSlots";
import { renderStatBlock } from "./statBlock";
import { resolveSlotConfig } from "./wikiParser";

export async function exportProjectToMarkdownZip(project: StoryProject): Promise<Blob> {
  const zip = new JSZip();

  // Root README / Overview
  const readmeContent = `# ${project.title}
_${project.subtitle}_

Last Updated: ${new Date(project.lastUpdated).toLocaleString()}

## Table of Contents
- **Wiki**: Markdown world encyclopaedia with [[WikiLinks]]
- **Characters**: Colonist profiles, traits, health status, and dramatic arcs
- **Timeline**: Chronological events and RimWorld season log
- **Hierarchy**: Act, Chapter, and Scene structure
- **Manuscript**: Drafted novelization chapters

Generated with RimChronicle Storyteller Studio.
`;
  zip.file("README.md", readmeContent);

  // Wiki directory
  const wikiFolder = zip.folder("wiki");
  if (wikiFolder) {
    project.wikiArticles.forEach((art) => {
      const safeTitle = art.title.replace(/[/\\?%*:|"<>]/g, "-");
      const categoryDir = wikiFolder.folder(art.category.toLowerCase()) || wikiFolder;
      categoryDir.file(`${safeTitle}.md`, art.markdownContent);
    });
  }

  // Characters directory: dossier + dynamic attribute slots + stat block
  const charactersFolder = zip.folder("characters");
  if (charactersFolder) {
    const slots = resolveSlotConfig(project);
    project.characters.forEach((c) => {
      const safeName = c.name.replace(/[/\\?%*:|"<>]/g, "-");
      let md = `# ${c.name}\n*${c.role}${c.faction ? ` — ${c.faction}` : ""}*\n\n${c.bio || ""}\n\n`;
      if (c.traits?.length) md += `## Traits\n${c.traits.map((t) => `* **${t}**`).join("\n")}\n\n`;
      slots.forEach((slot) => {
        const entries = getSlotEntries(c, slot.id);
        md += `## ${slot.label}\n${entries.length > 0 ? entries.map((e) => `* **${e}**`).join("\n") : "* *(No entries recorded yet.)*"}\n\n`;
      });
      md += `${renderStatBlock(c, project)}\n`;
      if (c.dramaticArc) md += `\n## Dramatic Arc\n${c.dramaticArc}\n`;
      charactersFolder.file(`${safeName}.md`, md);
    });
  }

  // Manuscript directory
  const novelFolder = zip.folder("novel");
  if (novelFolder) {
    let fullManuscript = `# ${project.title}\n_${project.subtitle}_\n\n---\n\n`;

    project.storyHierarchy.forEach((act, actIdx) => {
      fullManuscript += `# ${act.title}\n*Theme: ${act.theme}*\n\n`;
      act.chapters.forEach((chap, chapIdx) => {
        const chapTitle = chap.title || `Chapter ${chapIdx + 1}`;
        const chapContent = chap.fullChapterMarkdown || `_${chap.summary}_\n\n*(Chapter draft in progress)*\n`;
        fullManuscript += `\n${chapContent}\n\n---\n\n`;

        const safeChapTitle = `Act${actIdx + 1}_${chapTitle.replace(/[/\\?%*:|"<>]/g, "-")}.md`;
        novelFolder.file(safeChapTitle, chapContent);
      });
    });

    novelFolder.file("FULL_MANUSCRIPT.md", fullManuscript);
  }

  // Data JSON backup
  zip.file("project-backup.json", JSON.stringify(project, null, 2));

  // Timeline CSV / Summary
  let timelineDoc = `# Colony Timeline & Chronicle Logs\n\n`;
  timelineDoc += `| Timestamp | Title | Category | Threat | Location | Summary |\n`;
  timelineDoc += `|---|---|---|---|---|---|\n`;
  project.timelineEvents.forEach((e) => {
    timelineDoc += `| ${e.timestamp} | ${e.title} | ${e.category} | ${e.threatLevel} | ${e.location} | ${e.description.replace(/\|/g, "/")} |\n`;
  });
  zip.file("TIMELINE.md", timelineDoc);

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
