import type { BookFormat } from '@/domain';

/** Which provider a candidate (or a hint) came from. Matches `books.source`. */
export type CandidateSource = 'openlibrary' | 'googlebooks';

/**
 * A series hint as a provider states it, before `extractSeries` weighs them.
 * Open Library gives free text (`"Discworld ; 5"`, parsed into name and
 * position); Google Books gives only a position (`bookDisplayNumber`), so its
 * hints have no name.
 */
export interface SeriesHint {
  /** Series name, or null when the provider gave only a position. */
  name: string | null;
  /** Position in the series (may be fractional, e.g. 2.5), when known. */
  position: number | null;
  source: CandidateSource;
  /** The provider's text the hint was parsed from, for display and debugging. */
  raw?: string;
}

/**
 * One book as a provider describes it, normalised to the app's vocabulary.
 * Usually an edition (from an ISBN lookup, a work's editions, or a Google
 * Books volume); Open Library search results are works (`kind: 'work'`),
 * whose edition facts (ISBN, publisher, pages, format) are unknown until the
 * user picks an edition.
 *
 * Every field is optional in practice (null or empty) because providers are
 * patchy; nothing here has been confirmed by the user.
 */
export interface BookCandidate {
  kind: 'edition' | 'work';
  title: string;
  subtitle: string | null;
  /** Display names in credit order, e.g. `["Terry Pratchett"]`. */
  authors: string[];
  publisher: string | null;
  /** Year of this edition; for a work, the year it was first published. */
  publicationYear: number | null;
  pageCount: number | null;
  /** Normalised (digits only) and checksum-valid, or null. */
  isbn13: string | null;
  /** Normalised and checksum-valid, or null. */
  isbn10: string | null;
  /** Edition statement, e.g. "2nd ed." (`books.edition`). */
  edition: string | null;
  /** ISO 639-1 code, e.g. `en`. */
  language: string | null;
  format: BookFormat | null;
  /** Full description with HTML removed; shortened later with `briefSummary()`. */
  summary: string | null;
  /** HTTPS cover image URL. */
  coverUrl: string | null;
  /** Raw subjects / categories, for the genre normaliser. */
  subjects: string[];
  seriesHints: SeriesHint[];
  /** Open Library work key (`OL453657W`), used to list a work's editions. */
  workKey: string | null;
  /** Number of editions Open Library knows for the work (search results), for ranking. */
  editionCount: number | null;
  source: CandidateSource;
  /** Provider id: Open Library edition (`OL28477029M`) or work id, Google Books volume id. */
  sourceId: string;
  /**
   * 0–1: how sure we are this is the book asked for. An exact ISBN match is
   * near 1; search results carry their ranking score.
   */
  confidence: number;
}

/** What to search for. Title and author are preferred; `text` is free text (e.g. from OCR). */
export interface SearchQuery {
  title?: string;
  author?: string;
  text?: string;
}

/** A metadata source such as Open Library or Google Books. */
export interface MetadataProvider {
  id: CandidateSource;
  /**
   * Candidates for one ISBN-13 (usually zero or one). An unknown ISBN
   * resolves to `[]`; network trouble rejects with the HTTP errors
   * (`OfflineError`, `RateLimitedError`, …).
   */
  lookupIsbn(isbn13: string, signal?: AbortSignal): Promise<BookCandidate[]>;
  /** Candidates matching a title/author or free-text query, best first as the provider sees it. */
  search(query: SearchQuery, signal?: AbortSignal): Promise<BookCandidate[]>;
}

/** A provider that failed while the other succeeded, reported alongside the results. */
export interface ProviderWarning {
  provider: CandidateSource;
  /** `offline`: no network; `rate-limited`: quota or 429; `failed`: anything else. */
  reason: 'offline' | 'rate-limited' | 'failed';
  message: string;
}

/** Results of a lookup or search across providers. */
export interface MetadataResult {
  candidates: BookCandidate[];
  warnings: ProviderWarning[];
}
