import type { Book, BookGroup, Series } from '@/domain';

import type { Db } from '../types';
import { BOOK_COLUMNS, foldBookGroups, toBook, type BookRow } from './shared';

interface SeriesRow {
  id: number;
  name: string;
  total_count: number | null;
}

const toSeries = (r: SeriesRow): Series => ({ id: r.id, name: r.name, totalCount: r.total_count });

/** Series order: numbered books by position, then unnumbered ones by year and title. */
const SERIES_ORDER = 'b.series_position IS NULL, b.series_position, b.publication_year, b.title COLLATE NOCASE, b.id';

export async function createSeries(db: Db, name: string, totalCount: number | null = null): Promise<Series> {
  const clean = name.trim();
  const { lastInsertRowId } = await db.run('INSERT INTO series (name, total_count) VALUES (?, ?)', [clean, totalCount]);
  return { id: lastInsertRowId, name: clean, totalCount };
}

export async function getSeries(db: Db, id: number): Promise<Series | null> {
  const row = await db.get<SeriesRow>('SELECT id, name, total_count FROM series WHERE id = ?', [id]);
  return row ? toSeries(row) : null;
}

export async function findSeriesByName(db: Db, name: string): Promise<Series | null> {
  const row = await db.get<SeriesRow>(
    'SELECT id, name, total_count FROM series WHERE name = ? COLLATE NOCASE ORDER BY id LIMIT 1',
    [name.trim()],
  );
  return row ? toSeries(row) : null;
}

export async function findOrCreateSeries(db: Db, name: string): Promise<Series> {
  return (await findSeriesByName(db, name)) ?? createSeries(db, name);
}

export async function listSeries(db: Db): Promise<Series[]> {
  const rows = await db.all<SeriesRow>('SELECT id, name, total_count FROM series ORDER BY name COLLATE NOCASE, id');
  return rows.map(toSeries);
}

export async function updateSeries(db: Db, id: number, patch: Partial<Pick<Series, 'name' | 'totalCount'>>): Promise<Series | null> {
  const current = await getSeries(db, id);
  if (!current) return null;
  const next = { ...current, ...patch, name: patch.name?.trim() ?? current.name };
  await db.run('UPDATE series SET name = ?, total_count = ? WHERE id = ?', [next.name, next.totalCount, id]);
  return next;
}

/** Deletes a series; its books stay in the catalogue as standalones. */
export async function deleteSeries(db: Db, id: number): Promise<boolean> {
  return (await db.run('DELETE FROM series WHERE id = ?', [id])).changes > 0;
}

/** Puts a book in a series at a position (or takes it out with seriesId null). */
export async function setBookSeries(db: Db, bookId: number, seriesId: number | null, position: number | null = null): Promise<void> {
  await db.run("UPDATE books SET series_id = ?, series_position = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [
    seriesId,
    seriesId == null ? null : position,
    bookId,
  ]);
}

export async function listBooksInSeries(db: Db, seriesId: number): Promise<Book[]> {
  const rows = await db.all<BookRow>(`SELECT ${BOOK_COLUMNS} FROM books b WHERE b.series_id = ? ORDER BY ${SERIES_ORDER}`, [
    seriesId,
  ]);
  return rows.map(toBook);
}

/** Books per series (A-Z, each in reading order); standalone books come last under a null key. */
export async function groupBooksBySeries(db: Db): Promise<BookGroup<Series>[]> {
  const rows = await db.all<BookRow & { s_id: number | null; s_name: string | null; s_total_count: number | null }>(
    `SELECT ${BOOK_COLUMNS}, s.id AS s_id, s.name AS s_name, s.total_count AS s_total_count
     FROM books b LEFT JOIN series s ON s.id = b.series_id
     ORDER BY s.id IS NULL, s.name COLLATE NOCASE, s.id, ${SERIES_ORDER}`,
  );
  return foldBookGroups(rows, (r) => (r.s_id == null ? null : { id: r.s_id, name: r.s_name!, totalCount: r.s_total_count }));
}
