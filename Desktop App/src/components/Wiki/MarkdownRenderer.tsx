import React from "react";
import ReactMarkdown from "react-markdown";
import { CanonConstraint, ProjectTaxonomy, ThemeMode } from "../../types";
import { EntityLookup } from "../../lib/wikiParser";
import { WikiHoverCard } from "./WikiHoverCard";
import { extractCanonHighlightSpans } from "../../lib/canonEngine";

interface MarkdownRendererProps {
  content: string;
  lookup: EntityLookup;
  theme: ThemeMode;
  taxonomy: ProjectTaxonomy;
  onNavigateToArticle: (title: string) => void;
  className?: string;
  canonConstraints?: CanonConstraint[];
}

const canonSpanClasses = (theme: ThemeMode) =>
  theme === "parchment"
    ? "bg-red-800/15 text-red-900 rounded-sm px-0.5 underline decoration-red-700/60 decoration-wavy cursor-help"
    : "bg-red-500/20 text-red-300 rounded-sm px-0.5 border-b border-red-400/70 cursor-help";

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  lookup,
  theme,
  taxonomy,
  onNavigateToArticle,
  className = "",
  canonConstraints,
}) => {
  // Wrap sentences breaching active canon laws in a warning span (offsets are
  // local to each text node, so the scanner can run per-segment).
  const decorateCanonViolations = (text: string): React.ReactNode => {
    if (!canonConstraints || canonConstraints.length === 0) return text;
    const spans = extractCanonHighlightSpans(text, canonConstraints);
    if (spans.length === 0) return text;

    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    spans.forEach((span, i) => {
      if (span.start > lastIdx) {
        nodes.push(text.substring(lastIdx, span.start));
      }
      nodes.push(
        <span
          key={`canon-violation-${i}-${span.start}`}
          className={canonSpanClasses(theme)}
          title={`⚠️ Constraint Violation: ${span.message}`}
        >
          {text.substring(span.start, span.end)}
        </span>
      );
      lastIdx = span.end;
    });
    if (lastIdx < text.length) {
      nodes.push(text.substring(lastIdx));
    }
    return nodes;
  };

  // Pre-process text to replace [[WikiLink]] with a token we can custom-render
  const renderTextWithWikiLinks = (text: string) => {
    if (typeof text !== "string") return text;

    const parts: React.ReactNode[] = [];
    const regex = /\[\[(.*?)\]\]/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const linkText = match[1];

      if (start > lastIdx) {
        parts.push(decorateCanonViolations(text.substring(lastIdx, start)));
      }

      parts.push(
        <WikiHoverCard
          key={`${linkText}-${start}`}
          linkText={linkText}
          lookup={lookup}
          theme={theme}
          taxonomy={taxonomy}
          onNavigateToArticle={onNavigateToArticle}
        >
          {linkText}
        </WikiHoverCard>
      );

      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(decorateCanonViolations(text.substring(lastIdx)));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div
      className={`prose max-w-none transition-colors ${
        theme === "dark"
          ? "prose-invert prose-amber prose-headings:font-serif prose-headings:text-[#f1f5f9] prose-p:text-[#cbd5e1] prose-blockquote:border-amber-500/50 prose-blockquote:bg-[#121215] prose-blockquote:py-1.5 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-table:border-[#222228]"
          : theme === "parchment"
          ? "prose-stone prose-headings:font-serif prose-headings:text-amber-950 prose-blockquote:border-amber-700 prose-blockquote:bg-amber-100/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-p:text-stone-900 prose-strong:text-stone-950"
          : "prose-invert prose-cyan prose-headings:font-serif prose-headings:text-cyan-300 prose-blockquote:border-cyan-500/40 prose-blockquote:bg-slate-900/60 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg"
      } ${className}`}
    >
      <ReactMarkdown
        components={{
          p: ({ children }) => {
            const processedChildren = React.Children.map(children, (child) => {
              if (typeof child === "string") {
                return renderTextWithWikiLinks(child);
              }
              return child;
            });
            return <p className="mb-4 leading-relaxed">{processedChildren}</p>;
          },
          li: ({ children }) => {
            const processedChildren = React.Children.map(children, (child) => {
              if (typeof child === "string") {
                return renderTextWithWikiLinks(child);
              }
              return child;
            });
            return <li className="my-1">{processedChildren}</li>;
          },
          blockquote: ({ children }) => {
            return (
              <blockquote className="my-4 border-l-4 italic font-serif">
                {children}
              </blockquote>
            );
          },
          h1: ({ children }) => (
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-6 mb-3 border-b pb-2 border-white/10">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mt-6 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg sm:text-xl font-medium tracking-tight mt-4 mb-2">
              {children}
            </h3>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                {children}
              </table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
