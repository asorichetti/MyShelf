import type { LanguagePreference } from '@/domain/bookLanguage';
import { normaliseText, sameAuthor, titleKey } from '@/domain/text';
import { titleSimilarity } from '@/domain/titleMatch';

import type { BookCandidate, SearchQuery } from './types';

/**
 * Points per signal, strongest first (P02-06): title, author, ISBN, cover,
 * edition count, then the preferred language (read on the cover, or else the
 * app's), which settles results that are otherwise alike.
 */
export const RANK_WEIGHTS = {
  exactTitle: 8,
  partialTitle: 4,
  author: 4,
  isbn: 2,
  cover: 1,
  editionCountMax: 2,
  languageDetected: 2,
  languageLocale: 1,
} as const;
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

/**
 * Whether a candidate is in a language: 1 when it is (for a work, when any
 * of its editions is), 0 when it is known to be in others, ½ when unknown.
 */
export function languageMatch(candidate: Pick<BookCandidate, 'language' | 'languages'>, code: string): 1 | 0.5 | 0 {
  const languages = candidate.languages?.length ? candidate.languages : candidate.language ? [candidate.language] : [];
  if (!languages.length) return 0.5;
  return languages.includes(code) ? 1 : 0;
}

const languageWeight = (language: LanguagePreference | undefined) =>
  !language ? 0 : language.detected ? RANK_WEIGHTS.languageDetected : RANK_WEIGHTS.languageLocale;

/** Relevance of a candidate to a query; higher is better. */
export function scoreCandidate(candidate: BookCandidate, query: SearchQuery): number {
  const editions = candidate.editionCount ?? 0;
  return (
    titleScore(candidate, query) +
    authorScore(candidate, query) +
    (candidate.isbn13 ? RANK_WEIGHTS.isbn : 0) +
    (candidate.coverUrl ? RANK_WEIGHTS.cover : 0) +
    Math.min(RANK_WEIGHTS.editionCountMax, Math.log10(1 + editions)) +
    (query.language ? languageWeight(query.language) * languageMatch(candidate, query.language.code) : 0)
  );
}

/**
 * Sorts best first by `scoreCandidate` and sets each candidate's
 * `confidence` to its score as a fraction of the maximum. The sort is
 * stable: equal scores keep their incoming (provider) order.
 */
export function rankCandidates(candidates: readonly BookCandidate[], query: SearchQuery): BookCandidate[] {
  const max = MAX_SCORE + languageWeight(query.language);
  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreCandidate(candidate, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ candidate, score }) => ({ ...candidate, confidence: Math.round((score / max) * 100) / 100 }));
}

/** Points per signal when ordering one work's editions (`rankEditions`). */
export const EDITION_WEIGHTS = {
  /** Times the square of the title's similarity to the one wanted (0–1), so a partial match counts for little. */
  title: 6,
  /** The app's language (when the cover's is unknown); a cover's detected language outranks every score. */
  localeLanguage: 2,
  cover: 2,
  isbn: 0.5,
  publisher: 0.25,
  year: 0.25,
  pages: 0.25,
  format: 0.25,
} as const;

/** Whether a candidate knows where a cover of its own is. */
export function hasOwnCover(c: Pick<BookCandidate, 'coverUrl' | 'coverRefs'>): boolean {
  return Boolean(c.coverRefs.olEditionCoverIds.length || c.coverRefs.googleImageUrl || c.coverUrl);
}

export interface RankEditionsOptions {
  /** The language to prefer: the cover's (`detected`) or the app's. */
  language?: LanguagePreference | null;
  /** The title the user is looking for (as read on the cover, or the work's title). */
  title?: string | null;
}

/** An edition's score apart from a detected language: title, cover, fuller record and, weakly, the app's language. */
export function scoreEdition(edition: BookCandidate, { language, title }: RankEditionsOptions = {}): number {
  const w = EDITION_WEIGHTS;
  return (
    (title ? w.title * titleSimilarity(edition.title, title) ** 2 : 0) +
    (language && !language.detected ? w.localeLanguage * languageMatch(edition, language.code) : 0) +
    (hasOwnCover(edition) ? w.cover : 0) +
    (edition.isbn13 || edition.isbn10 ? w.isbn : 0) +
    (edition.publisher ? w.publisher : 0) +
    (edition.publicationYear != null ? w.year : 0) +
    (edition.pageCount ? w.pages : 0) +
    (edition.format ? w.format : 0)
  );
}

/**
 * One work's editions, likeliest first for this user (the edition picker and
 * whatever saves its first choice). With a language read on the cover, every
 * edition in that language comes before those of unknown language, and those
 * before other languages: a Dutch edition is never offered first for an
 * English cover. Within that: title closest to the one wanted (a study guide
 * "Lektürehilfen Der Vorleser" sinks), the app's language when the cover's is
 * unknown, a cover of its own, a fuller record, then the newest. Ties keep
 * the provider's order.
 */
export function rankEditions(editions: readonly BookCandidate[], options: RankEditionsOptions = {}): BookCandidate[] {
  const { language } = options;
  const tier = (e: BookCandidate) => (language?.detected ? languageMatch(e, language.code) : 0);
  return editions
    .map((edition, index) => ({ edition, index, tier: tier(edition), score: scoreEdition(edition, options) }))
    .sort(
      (a, b) =>
        b.tier - a.tier ||
        b.score - a.score ||
        (b.edition.publicationYear ?? 0) - (a.edition.publicationYear ?? 0) ||
        a.index - b.index,
    )
    .map(({ edition }) => edition);
}
