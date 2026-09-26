import { t } from '@/i18n';


import type { BookAuthor } from './author';
import type { BookGenre } from './genre';
import type { Loan } from './loan';
import type { Series } from './series';

export const bookFormats = ['hardcover', 'paperback', 'ebook', 'audiobook', 'other'] as const;
export type BookFormat = (typeof bookFormats)[number];

/** Where a book's metadata came from. */
export type BookSource = 'openlibrary' | 'googlebooks' | 'manual' | 'import';

export interface Book {
  id: number;
  title: string;
  subtitle: string | null;
  isbn13: string | null;
  isbn10: string | null;
  edition: string | null;
  publisher: string | null;
  publicationYear: number | null;
  pageCount: number | null;
  summary: string | null;
  coverUri: string | null;
  language: string | null;
  format: BookFormat | null;
  seriesId: number | null;
  /** Position within the series; REAL so novellas can sit at 1.5. */
  seriesPosition: number | null;
  source: BookSource | null;
  sourceId: string | null;
  notes: string | null;
  /** The reader's own rating, 1-5 whole stars; null when not rated. Lookups never set it. */
  rating: number | null;
  createdAt: string;
  updatedAt: string;
}

type Editable = Omit<Book, 'id' | 'createdAt' | 'updatedAt'>;

/** Fields for creating a book: title is required, everything else optional. */
export type NewBook = Pick<Editable, 'title'> & Partial<Omit<Editable, 'title'>>;

export type BookPatch = Partial<Editable>;

/** A named bucket of books, e.g. one genre or series. `key` is null for "none". */
export interface BookGroup<K> {
  key: K | null;
  books: Book[];
}

/** A compact row for the Shelf list. */
export interface BookListItem {
  id: number;
  title: string;
  subtitle: string | null;
  /** Credited names in order. */
  authors: string[];
  coverUri: string | null;
  publicationYear: number | null;
  /** The series' id (always set by the repository; optional so hand-made items can leave it out). */
  seriesId?: number | null;
  seriesName: string | null;
  seriesPosition: number | null;
  onLoan: boolean;
  /** Who has it now, when on loan (the Shelf's loan stamp). */
  loanBorrower?: string | null;
  /** When the open loan is due back, if it has a due date. */
  loanDueOn?: string | null;
  /** The reader's rating, 1-5 (always set by the repository; optional so hand-made items can leave it out). */
  rating?: number | null;
}

/** Everything the book detail page shows. */
export interface BookDetail extends Book {
  authors: BookAuthor[];
  genres: BookGenre[];
  series: Series | null;
  openLoan: (Loan & { borrowerName: string }) | null;
}

const LEADING_ARTICLE = /^(the|a|an)\s+(?=\S)/i;

/** The title as a library files it: a leading "The", "A" or "An" is ignored ("The Hobbit" -> "Hobbit"). */
export function sortableTitle(title: string): string {
  const t = title.trim();
  return t.replace(LEADING_ARTICLE, '');
}

/** "Terry Pratchett", "Terry Pratchett and Neil Gaiman", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const last = names[names.length - 1];
  if (names.length === 2) return t('common.list.pair', { first: names[0], last });
  return t('common.list.many', { rest: names.slice(0, -1).join(t('common.list.separator')), last });
}
