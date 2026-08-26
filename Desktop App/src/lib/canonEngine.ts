import { CanonConstraint } from "../types";

export interface CanonViolation {
  constraintId: string;
  constraintTitle: string;
  reminderMessage: string;
  keyword: string;
  sentence: string;
  start: number;
  end: number;
}

export interface CanonHighlightSpan {
  start: number;
  end: number;
  message: string;
}

export const CANON_CONSTRAINT_PRESETS: Omit<CanonConstraint, "id" | "isEnabled">[] = [
  {
    title: "FTL Prohibited",
    ruleStatement: "No faster-than-light travel exists within this system.",
    reminderMessage: "FTL is prohibited in your canon.",
    keywords: [
      "ftl",
      "faster than light",
      "warp drive",
      "warp jump",
      "hyperdrive",
      "jump drive",
      "hyperspace",
      "lightspeed",
    ],
  },
  {
    title: "Psionics Require Line-of-Sight",
    ruleStatement: "Psionic abilities require direct line-of-sight to their target.",
    reminderMessage: "Psionics require direct line-of-sight in your canon.",
    keywords: [
      "psionic",
      "telepathy",
      "telepathic",
      "telepathically",
      "psychic link",
      "mind meld",
      "psycast",
      "psylink",
    ],
  },
  {
    title: "Bionics Cause Chronic Pain",
    ruleStatement: "All bionic implants cause mild chronic pain.",
    reminderMessage: "All bionics cause mild chronic pain in your canon.",
    keywords: ["bionic", "prosthetic", "cybernetic", "implant"],
  },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive, word-bounded matcher. Hyphens/spaces inside a keyword are
 * interchangeable ("faster-than-light" matches "faster than light"), and a
 * trailing plural is tolerated ("bionic" catches "bionics").
 */
export function buildKeywordRegex(keyword: string): RegExp | null {
  const trimmed = keyword.trim();
  if (!trimmed) return null;
  const flexible = escapeRegex(trimmed).replace(/[\s-]+/g, "[\\s\\-]+");
  const suffix = /s$/i.test(trimmed) ? "" : "(?:e?s)?";
  return new RegExp(`\\b${flexible}${suffix}\\b`, "gi");
}

const SENTENCE_TERMINATOR = /[.!?]/;

function expandToSentence(text: string, index: number, length: number) {
  let start = 0;
  for (let i = index - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "\n" || SENTENCE_TERMINATOR.test(ch)) {
      start = i + 1;
      break;
    }
  }
  let end = text.length;
  for (let i = index + length; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") {
      end = i;
      break;
    }
    if (SENTENCE_TERMINATOR.test(ch)) {
      end = i + 1;
      break;
    }
  }
  return { start, end };
}

function collectWikiLinkRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    ranges.push([match.index, regex.lastIndex]);
  }
  return ranges;
}

/** Deterministic on-device scan. No AI involved — safe for offline mode. */
export function extractCanonViolations(
  text: string,
  constraints: CanonConstraint[]
): CanonViolation[] {
  if (!text || constraints.length === 0) return [];
  const enabled = constraints.filter((c) => c.isEnabled && c.keywords.length > 0);
  if (enabled.length === 0) return [];

  const wikiRanges = collectWikiLinkRanges(text);
  const violations: CanonViolation[] = [];
  const seenSentences = new Set<string>();

  for (const constraint of enabled) {
    for (const keyword of constraint.keywords) {
      const regex = buildKeywordRegex(keyword);
      if (!regex) continue;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const idx = match.index;
        if (wikiRanges.some(([s, e]) => idx >= s && idx < e)) continue;
        const { start, end } = expandToSentence(text, idx, match[0].length);
        const key = `${constraint.id}:${start}:${end}`;
        if (!seenSentences.has(key)) {
          seenSentences.add(key);
          violations.push({
            constraintId: constraint.id,
            constraintTitle: constraint.title,
            reminderMessage: constraint.reminderMessage,
            keyword: match[0],
            sentence: text.slice(start, end),
            start,
            end,
          });
        }
      }
    }
  }

  return violations.sort((a, b) => a.start - b.start);
}

/** Sentence spans for inline red highlighting; overlapping hits are merged. */
export function extractCanonHighlightSpans(
  text: string,
  constraints: CanonConstraint[]
): CanonHighlightSpan[] {
  const violations = extractCanonViolations(text, constraints);
  const merged: CanonHighlightSpan[] = [];
  for (const v of violations) {
    const prev = merged[merged.length - 1];
    if (prev && v.start <= prev.end) {
      prev.end = Math.max(prev.end, v.end);
      if (!prev.message.includes(v.reminderMessage)) {
        prev.message = `${prev.message} ${v.reminderMessage}`;
      }
    } else {
      merged.push({ start: v.start, end: v.end, message: v.reminderMessage });
    }
  }
  return merged;
}
