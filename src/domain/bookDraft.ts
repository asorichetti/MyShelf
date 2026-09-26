import { type AuthorRole } from './author';
import { bookFormats, type BookDetail, type BookFormat } from './book';
import { isbn10To13, isbn13To10, isValidIsbn10, isValidIsbn13, normalizeIsbn } from './isbn';
import { isLanguageCode } from './languages';
import { parseRating } from './rating';
import { formatSeriesPosition, isValidSeriesPosition, parseSeriesPosition } from './seriesPosition';

/** An author as typed in the form. `sortName` null means "derive it from the name". */
export interface DraftAuthor {
  name: string;
  role: AuthorRole;
  sortName: string | null;
}

/** The book form's values, as the user typed them (numbers are still text). */
export interface BookDraft {
  title: string;
  subtitle: string;
  authors: DraftAuthor[];
  isbn: string;
  publisher: string;
  year: string;
  edition: string;
  format: BookFormat | '';
  pages: string;
  /** ISO 639-1 code, or '' for none. */
  language: string;
  genres: string[];
  seriesName: string;
  seriesPosition: string;
  summary: string;
  notes: string;
  coverUri: string | null;
  /** The reader's rating, 1-5, or null for not rated. */
  rating: number | null;
}

export type BookDraftField = keyof BookDraft;

/** Plain-language error per field. */
export type BookDraftErrors = Partial<Record<BookDraftField, string>>;

/** A draft that passed validation, cleaned and ready to save. */
export interface ValidBookDraft {
  title: string;
  subtitle: string | null;
  isbn13: string | null;
  isbn10: string | null;
  publisher: string | null;
  publicationYear: number | null;
  edition: string | null;
  format: BookFormat | null;
  pageCount: number | null;
  language: string | null;
  summary: string | null;
  notes: string | null;
  coverUri: string | null;
  authors: DraftAuthor[];
  genres: string[];
  series: { name: string; position: number | null } | null;
  /**
   * The reader's rating (1-5, null to clear). Left undefined, a save keeps
   * the stored rating: "Refresh details" saves a draft that way, so a lookup
   * can never change it.
   */
  rating?: number | null;
}

export type DraftValidation = { ok: true; value: ValidBookDraft; errors: Record<string, never> } | { ok: false; errors: BookDraftErrors };

/** Fields in form order: the first invalid one gets focus on submit. */
export const draftFieldOrder: readonly BookDraftField[] = [
  'title',
  'subtitle',
  'authors',
  'isbn',
  'publisher',
  'year',
  'edition',
  'format',
  'pages',
  'language',
  'genres',
  'seriesName',
  'seriesPosition',
  'summary',
  'notes',
];

export const TITLE_MAX = 300;
export const EARLIEST_YEAR = 1450;

export function emptyDraft(): BookDraft {
  return {
    title: '',
    subtitle: '',
    authors: [],
    isbn: '',
    publisher: '',
    year: '',
    edition: '',
    format: '',
    pages: '',
    language: '',
    genres: [],
    seriesName: '',
    seriesPosition: '',
    summary: '',
    notes: '',
    coverUri: null,
    rating: null,
  };
}

/** The form values for editing an existing book. */
export function draftFromDetail(book: BookDetail): BookDraft {
  return {
    title: book.title,
    subtitle: book.subtitle ?? '',
    authors: book.authors.map((a) => ({ name: a.name, role: a.role, sortName: a.sortName })),
    isbn: book.isbn13 ?? book.isbn10 ?? '',
    publisher: book.publisher ?? '',
    year: book.publicationYear != null ? String(book.publicationYear) : '',
    edition: book.edition ?? '',
    format: book.format ?? '',
    pages: book.pageCount != null ? String(book.pageCount) : '',
    language: book.language ?? '',
    genres: book.genres.map((g) => g.name),
    seriesName: book.series?.name ?? '',
    seriesPosition: formatSeriesPosition(book.seriesPosition),
    summary: book.summary ?? '',
    notes: book.notes ?? '',
    coverUri: book.coverUri,
    rating: book.rating,
  };
}

const text = (v: string) => {
  const t = v.trim();
  return t ? t : null;
};

/** Case-insensitive de-duplication that keeps the first spelling. */
function uniqueNames<T>(items: T[], nameOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = nameOf(item).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function checkIsbn(raw: string): { isbn13: string | null; isbn10: string | null } | string {
  if (!raw.trim()) return { isbn13: null, isbn10: null };
  if (/[^0-9Xx\s-]/.test(raw)) return 'An ISBN only has digits (and maybe an X at the end).';
  const n = normalizeIsbn(raw)!;
  if (n.length === 13) {
    return isValidIsbn13(n) ? { isbn13: n, isbn10: isbn13To10(n) } : 'That ISBN doesn’t look right — check the last digit.';
  }
  if (n.length === 10) {
    return isValidIsbn10(n) ? { isbn13: isbn10To13(n), isbn10: n } : 'That ISBN doesn’t look right — check the last digit.';
  }
  return `An ISBN has 10 or 13 digits — this one has ${n.length}.`;
}

/**
 * Checks a draft and returns either the cleaned values or friendly,
 * field-level messages. `currentYear` is injectable for tests.
 */
export function validateBookDraft(draft: BookDraft, { currentYear = new Date().getFullYear() } = {}): DraftValidation {
  const errors: BookDraftErrors = {};

  const title = draft.title.trim();
  if (!title) errors.title = 'Every book needs a title.';
  else if (title.length > TITLE_MAX) errors.title = `That title is a little long — keep it under ${TITLE_MAX} characters.`;

  const isbn = checkIsbn(draft.isbn);
  if (typeof isbn === 'string') errors.isbn = isbn;

  let publicationYear: number | null = null;
  const year = draft.year.trim();
  if (year) {
    if (!/^\d{1,4}$/.test(year)) errors.year = 'Enter the year as four digits, like 1987.';
    else {
      publicationYear = Number(year);
      if (publicationYear < EARLIEST_YEAR || publicationYear > currentYear + 1) {
        errors.year = `Enter a year between ${EARLIEST_YEAR} and ${currentYear + 1}.`;
      }
    }
  }

  let pageCount: number | null = null;
  const pages = draft.pages.trim();
  if (pages) {
    if (!/^\d+$/.test(pages) || Number(pages) <= 0) errors.pages = 'Pages should be a whole number, like 320.';
    else if (Number(pages) > 100000) errors.pages = 'That’s a lot of pages — check the number.';
    else pageCount = Number(pages);
  }

  if (draft.language && !isLanguageCode(draft.language)) errors.language = 'Pick a language from the list.';
  if (draft.format && !(bookFormats as readonly string[]).includes(draft.format)) errors.format = 'Pick a format from the list.';

  const seriesName = draft.seriesName.trim();
  let seriesPosition: number | null = null;
  const position = draft.seriesPosition.trim();
  if (position) {
    const parsed = parseSeriesPosition(position);
    if (!isValidSeriesPosition(parsed)) errors.seriesPosition = 'Use a number like 3, or 2.5 for a novella between books.';
    else if (!seriesName) errors.seriesName = 'Add the series name to go with its number.';
    else seriesPosition = parsed;
  }

  const authors = uniqueNames(
    draft.authors.map((a) => ({ ...a, name: a.name.trim().replace(/\s+/g, ' '), sortName: a.sortName?.trim() || null })),
    (a) => a.name,
  );
  if (authors.some((a) => a.name.length > 200)) errors.authors = 'One of those names is very long — check it.';
  const genres = uniqueNames(
    draft.genres.map((g) => g.trim().replace(/\s+/g, ' ')),
    (g) => g,
  );

  if (Object.keys(errors).length) return { ok: false, errors };
  const codes = isbn as { isbn13: string | null; isbn10: string | null };
  return {
    ok: true,
    errors: {},
    value: {
      title,
      subtitle: text(draft.subtitle),
      isbn13: codes.isbn13,
      isbn10: codes.isbn10,
      publisher: text(draft.publisher),
      publicationYear,
      edition: text(draft.edition),
      format: draft.format || null,
      pageCount,
      language: draft.language || null,
      summary: text(draft.summary),
      notes: text(draft.notes),
      coverUri: draft.coverUri,
      authors,
      genres,
      series: seriesName ? { name: seriesName, position: seriesPosition } : null,
      rating: parseRating(draft.rating),
    },
  };
}

/** The first field with an error, in form order. */
export function firstInvalidField(errors: BookDraftErrors): BookDraftField | null {
  return draftFieldOrder.find((f) => errors[f]) ?? null;
}

/** Whether two drafts differ (for the unsaved-changes guard). */
export function draftsDiffer(a: BookDraft, b: BookDraft): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Adds an author unless the name is blank or already credited (ignoring case). */
export function addDraftAuthor(authors: DraftAuthor[], name: string): DraftAuthor[] {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean || authors.some((a) => a.name.toLowerCase() === clean.toLowerCase())) return authors;
  return [...authors, { name: clean, role: 'author', sortName: null }];
}

/** Adds a genre unless blank or already chosen; a genre already in the library keeps its spelling. */
export function addDraftGenre(genres: string[], name: string, existing: readonly string[] = []): string[] {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean || genres.some((g) => g.toLowerCase() === clean.toLowerCase())) return genres;
  return [...genres, existing.find((e) => e.toLowerCase() === clean.toLowerCase()) ?? clean];
}
