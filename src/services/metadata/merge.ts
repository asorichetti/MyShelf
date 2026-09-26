import { bookMatchKey } from '@/domain/text';

import { uniqueStrings } from './openLibraryMap';

import type { BookCandidate, SeriesHint } from './types';

const SCALARS = [
  'subtitle',
  'publisher',
  'publicationYear',
  'pageCount',
  'isbn13',
  'isbn10',
  'edition',
  'language',
  'format',
  'summary',
  'coverUrl',
  'workKey',
  'editionCount',
] as const satisfies readonly (keyof BookCandidate)[];

function hintKey(h: SeriesHint): string {
  return `${h.source}|${h.name?.toLowerCase() ?? ''}|${h.position ?? ''}`;
}

/**
 * Merges two descriptions of the same book. The primary (Open Library, by
 * convention) wins every field it has — edition facts such as publisher,
 * format, pages and ISBNs; the secondary (Google Books) fills the gaps,
 * notably the summary. Subjects and series hints are united. Title and
 * source stay the primary's, so `source_id` points at one record.
 */
export function mergeCandidates(primary: BookCandidate, secondary: BookCandidate): BookCandidate {
  const merged: BookCandidate = { ...primary };
  for (const key of SCALARS) {
    if (merged[key] == null && secondary[key] != null) (merged as unknown as Record<string, unknown>)[key] = secondary[key];
  }
  if (!merged.authors.length) merged.authors = secondary.authors;
  merged.subjects = uniqueStrings([...primary.subjects, ...secondary.subjects]);
  const hints = new Map<string, SeriesHint>();
  for (const h of [...primary.seriesHints, ...secondary.seriesHints]) if (!hints.has(hintKey(h))) hints.set(hintKey(h), h);
  merged.seriesHints = [...hints.values()];
  merged.kind = primary.kind === 'edition' || secondary.kind === 'edition' ? 'edition' : 'work';
  merged.confidence = Math.max(primary.confidence, secondary.confidence);
  return merged;
}

/**
 * Folds a list (primary provider's results first) into one candidate per
 * book: first by ISBN-13; then by normalised title + first author, but only
 * when one side has no ISBN (a work, or an ISBN-less record) — two different
 * ISBNs are two editions and stay apart. Order of first appearance is kept.
 */
export function dedupeCandidates(candidates: readonly BookCandidate[]): BookCandidate[] {
  const out: BookCandidate[] = [];
  const byIsbn = new Map<string, number>();
  for (const candidate of candidates) {
    let index = candidate.isbn13 ? byIsbn.get(candidate.isbn13) : undefined;
    if (index === undefined) {
      const key = bookMatchKey(candidate.title, candidate.authors[0]);
      index = out.findIndex(
        (c) => (!c.isbn13 || !candidate.isbn13) && bookMatchKey(c.title, c.authors[0]) === key,
      );
      if (index < 0) index = undefined;
    }
    if (index === undefined) {
      out.push(candidate);
      index = out.length - 1;
    } else {
      out[index] = mergeCandidates(out[index], candidate);
    }
    if (out[index].isbn13) byIsbn.set(out[index].isbn13!, index);
  }
  return out;
}
