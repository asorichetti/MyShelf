import { normaliseText, sameAuthor, titleKey } from '@/domain/text';

import type { BookCandidate, SearchQuery } from './types';

/** Points per signal, strongest first (P02-06): title, author, ISBN, cover, edition count. */
export const RANK_WEIGHTS = { exactTitle: 8, partialTitle: 4, author: 4, isbn: 2, cover: 1, editionCountMax: 2 } as const;
const MAX_SCORE = RANK_WEIGHTS.exactTitle + RANK_WEIGHTS.author + RANK_WEIGHTS.isbn + RANK_WEIGHTS.cover + RANK_WEIGHTS.editionCountMax;

const words = (s: string) => s.split(' ').filter(Boolean);

function titleScore(candidate: BookCandidate, query: SearchQuery): number {
  const title = titleKey(candidate.title);
  if (!title) return 0;
  if (query.title?.trim()) {
    const wanted = titleKey(query.title);
    if (!wanted) return 0;
    if (title === wanted) return RANK_WEIGHTS.exactTitle;
    const full = normaliseText(candidate.title);
    return full.includes(wanted) || wanted.includes(title) ? RANK_WEIGHTS.partialTitle : 0;
  }
  if (query.text?.trim()) {
    // Free text (e.g. OCR): every title word present scores like an exact title.
    const text = new Set(words(normaliseText(query.text)));
    const titleWords = words(title);
    const found = titleWords.filter((w) => text.has(w)).length;
    if (found === titleWords.length) return RANK_WEIGHTS.exactTitle;
    return (found / titleWords.length) * RANK_WEIGHTS.partialTitle;
  }
  return 0;
}

function authorScore(candidate: BookCandidate, query: SearchQuery): number {
  if (!candidate.authors.length) return 0;
  const wanted = query.author?.trim();
  if (wanted) {
    const key = normaliseText(wanted);
    const match = candidate.authors.some((a) => sameAuthor(a, wanted) || normaliseText(a).includes(key));
    return match ? RANK_WEIGHTS.author : 0;
  }
  if (query.text?.trim()) {
    const text = new Set(words(normaliseText(query.text)));
    const match = candidate.authors.some((a) => words(normaliseText(a)).some((w) => w.length > 2 && text.has(w)));
    return match ? RANK_WEIGHTS.author : 0;
  }
  return 0;
}

/** Relevance of a candidate to a query; higher is better. */
export function scoreCandidate(candidate: BookCandidate, query: SearchQuery): number {
  const editions = candidate.editionCount ?? 0;
  return (
    titleScore(candidate, query) +
    authorScore(candidate, query) +
    (candidate.isbn13 ? RANK_WEIGHTS.isbn : 0) +
    (candidate.coverUrl ? RANK_WEIGHTS.cover : 0) +
    Math.min(RANK_WEIGHTS.editionCountMax, Math.log10(1 + editions))
  );
}

/**
 * Sorts best first by `scoreCandidate` and sets each candidate's
 * `confidence` to its score as a fraction of the maximum. The sort is
 * stable: equal scores keep their incoming (provider) order.
 */
export function rankCandidates(candidates: readonly BookCandidate[], query: SearchQuery): BookCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreCandidate(candidate, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ candidate, score }) => ({ ...candidate, confidence: Math.round((score / MAX_SCORE) * 100) / 100 }));
}
