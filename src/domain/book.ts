export const bookFormats = ['hardcover', 'paperback', 'ebook', 'audiobook', 'other'] as const;
export type BookFormat = (typeof bookFormats)[number];

/** Where a book's metadata came from. */
export type BookSource = 'manual' | 'barcode' | 'cover' | 'openlibrary' | 'googlebooks' | (string & {});

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

/** Strips spaces and hyphens and upper-cases a trailing X. Returns null when empty. */
export function normalizeIsbn(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return cleaned.length ? cleaned : null;
}
