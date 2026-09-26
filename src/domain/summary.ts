import { stripHtml } from './text';

/** The longest brief summary, in characters (PLAN §6 "Brief summary"). */
export const BRIEF_SUMMARY_MAX = 600;

/** Where a sentence ends: . ! ? … (optionally closed by a quote or bracket) before a space. */
const SENTENCE_END = /[.!?…]["'”’)\]]*(?=\s|$)/g;

/**
 * A provider description made brief for the summary field: HTML stripped,
 * the first paragraph only, whitespace collapsed, and cut at the last
 * sentence boundary at or below `max` characters. A first sentence longer
 * than `max` is cut at a word boundary and ends with "…". Null when nothing
 * is left.
 */
export function briefSummary(description: string | null | undefined, max = BRIEF_SUMMARY_MAX): string | null {
  const text = stripHtml(description);
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim());
  // Skip leading paragraphs that are only a heading-like fragment ("Book One", "From the back cover:").
  const first = paragraphs.find((p) => p.length > 40 || /[.!?…]$/.test(p)) ?? paragraphs.find(Boolean);
  if (!first) return null;
  if (first.length <= max) return first;

  let cut = -1;
  for (const m of first.matchAll(SENTENCE_END)) {
    const end = m.index + m[0].length;
    if (end > max) break;
    cut = end;
  }
  if (cut > 0) return first.slice(0, cut).trim();
  const words = first.slice(0, max - 1);
  const space = words.lastIndexOf(' ');
  return `${(space > max / 2 ? words.slice(0, space) : words).replace(/[\s,;:–—-]+$/, '')}…`;
}
