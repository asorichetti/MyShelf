import { emptyDraft, type BookDraft } from './bookDraft';
import { normaliseGenres } from './genreNormaliser';
import { isValidIsbn10, isValidIsbn13 } from './isbn';
import { isLanguageCode } from './languages';
import { extractSeries, type SeriesHintInput, type SeriesMatch } from './seriesParser';
import { formatSeriesPosition } from './seriesPosition';
import { briefSummary } from './summary';

import type { BookFormat } from './book';

/**
 * What the app needs from a metadata candidate (`BookCandidate` in
 * `src/services/metadata`), stated here so the domain does not depend on the
 * services layer. A `BookCandidate` is one.
 */
export interface CandidateLike {
  kind: 'edition' | 'work';
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publicationYear: number | null;
  pageCount: number | null;
  isbn13: string | null;
  isbn10: string | null;
  edition: string | null;
  language: string | null;
  format: BookFormat | null;
  summary: string | null;
  coverUrl: string | null;
  subjects: string[];
  seriesHints: readonly SeriesHintInput[];
  workKey: string | null;
  editionCount: number | null;
  source: 'openlibrary' | 'googlebooks';
  sourceId: string;
  confidence: number;
}

export interface CandidateToDraftOptions {
  /** Genres already in the library: a matching genre keeps the library's spelling. */
  existingGenres?: readonly string[];
}

/** The candidate's series guess (P02-08), or null. */
export function candidateSeries(candidate: Pick<CandidateLike, 'title' | 'subtitle' | 'seriesHints'>): SeriesMatch | null {
  return extractSeries({ title: candidate.title, subtitle: candidate.subtitle, seriesHints: candidate.seriesHints });
}

/**
 * A book form draft from a lookup candidate (P02-11): every field the
 * provider knows, with genres from the normaliser, the series guess and a
 * brief summary. The user reviews it before saving. The cover is the
 * candidate's display cover, so the form shows the real art at once.
 */
export function candidateToDraft(candidate: CandidateLike, { existingGenres = [] }: CandidateToDraftOptions = {}): BookDraft {
  const series = candidateSeries(candidate);
  const isbn = candidate.isbn13 && isValidIsbn13(candidate.isbn13) ? candidate.isbn13 : candidate.isbn10 && isValidIsbn10(candidate.isbn10) ? candidate.isbn10 : '';
  const genres = normaliseGenres(candidate.subjects).map((g) => existingGenres.find((e) => e.toLowerCase() === g.toLowerCase()) ?? g);
  return {
    ...emptyDraft(),
    title: candidate.title.trim(),
    subtitle: candidate.subtitle?.trim() ?? '',
    authors: candidate.authors
      .map((name) => name.trim())
      .filter((name, i, all) => name && all.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === i)
      .map((name) => ({ name, role: 'author' as const, sortName: null })),
    isbn,
    publisher: candidate.publisher?.trim() ?? '',
    year: candidate.publicationYear != null ? String(candidate.publicationYear) : '',
    edition: candidate.edition?.trim() ?? '',
    format: candidate.format ?? '',
    pages: candidate.pageCount != null && candidate.pageCount > 0 ? String(candidate.pageCount) : '',
    language: candidate.language && isLanguageCode(candidate.language) ? candidate.language : '',
    genres,
    seriesName: series?.name ?? '',
    seriesPosition: series ? formatSeriesPosition(series.position) : '',
    summary: briefSummary(candidate.summary) ?? '',
    coverUri: candidate.coverUrl ?? null,
  };
}
