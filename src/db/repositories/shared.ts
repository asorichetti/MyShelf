import type { Book, BookGroup } from '@/domain';

import type { SqlValue } from '../types';

export const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export interface BookRow {
  id: number;
  title: string;
  subtitle: string | null;
  isbn13: string | null;
  isbn10: string | null;
  edition: string | null;
  publisher: string | null;
  publication_year: number | null;
  page_count: number | null;
  summary: string | null;
  cover_uri: string | null;
  language: string | null;
  format: string | null;
  series_id: number | null;
  series_position: number | null;
  source: string | null;
  source_id: string | null;
  notes: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

/** `b.<col>` list for selecting a book alongside joined columns. */
export const BOOK_COLUMNS = [
  'id', 'title', 'subtitle', 'isbn13', 'isbn10', 'edition', 'publisher', 'publication_year', 'page_count',
  'summary', 'cover_uri', 'language', 'format', 'series_id', 'series_position', 'source', 'source_id', 'notes',
  'rating', 'created_at', 'updated_at',
].map((c) => `b.${c}`).join(', ');

export function toBook(r: BookRow): Book {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    isbn13: r.isbn13,
    isbn10: r.isbn10,
    edition: r.edition,
    publisher: r.publisher,
    publicationYear: r.publication_year,
    pageCount: r.page_count,
    summary: r.summary,
    coverUri: r.cover_uri,
    language: r.language,
    format: r.format as Book['format'],
    seriesId: r.series_id,
    seriesPosition: r.series_position,
    source: r.source as Book['source'],
    sourceId: r.source_id,
    notes: r.notes,
    rating: r.rating ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Folds rows sorted by group into BookGroups, preserving row order. Rows whose
 * key is null (e.g. a book with no genre) land in a trailing null group.
 * Rows with a null book id (an empty user group) create the group only.
 */
export function foldBookGroups<K extends { id: number }, R extends BookRow>(
  rows: R[],
  keyOf: (row: R) => K | null,
): BookGroup<K>[] {
  const groups = new Map<number | null, BookGroup<K>>();
  for (const row of rows) {
    const key = keyOf(row);
    const id = key?.id ?? null;
    let group = groups.get(id);
    if (!group) {
      group = { key, books: [] };
      groups.set(id, group);
    }
    if (row.id != null) group.books.push(toBook(row));
  }
  const ordered = [...groups.values()];
  return [...ordered.filter((g) => g.key !== null), ...ordered.filter((g) => g.key === null)];
}

/** Converts optional values to SQL values (undefined -> null, boolean -> 0/1). */
export function sqlValue(v: unknown): SqlValue {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string' || v instanceof Uint8Array) return v;
  throw new TypeError(`Unsupported SQL value: ${String(v)}`);
}
