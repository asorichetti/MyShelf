import {
  neighboursInSeries,
  normaliseText,
  seriesGaps,
  seriesProgress,
  type Book,
  type BookGroup,
  type Series,
  type SeriesNeighbours,
  type SeriesProgress,
  type SeriesState,
} from '@/domain';

import { BOOK_COLUMNS, foldBookGroups, NOW_SQL, toBook, type BookRow } from './shared';

import type { Db } from '../types';

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

/**
 * Finds a series by name, ignoring case, accents, punctuation and a leading
 * article, so "The Expanse" and "expanse" are the same series. The oldest
 * match wins if the table already holds near-duplicates.
 */
export async function findSeriesByName(db: Db, name: string): Promise<Series | null> {
  const key = normaliseText(name);
  if (!key) return null;
  const rows = await db.all<SeriesRow>('SELECT id, name, total_count FROM series ORDER BY id');
  const row = rows.find((r) => normaliseText(r.name) === key);
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

/** Renames a series. Returns null when it does not exist. */
export async function renameSeries(db: Db, id: number, name: string): Promise<Series | null> {
  if (!name.trim()) throw new RangeError('A series needs a name');
  return updateSeries(db, id, { name });
}

/** Sets (or with null, forgets) how many books the series has. */
export async function setSeriesTotalCount(db: Db, id: number, totalCount: number | null): Promise<Series | null> {
  if (totalCount != null && !(Number.isInteger(totalCount) && totalCount > 0)) {
    throw new RangeError(`A series total must be a whole number above 0, got ${totalCount}`);
  }
  return updateSeries(db, id, { totalCount });
}

/**
 * Moves every book from `sourceId` into `targetId` (positions unchanged) and
 * deletes the source, atomically. The target keeps its total count, or takes
 * the source's when it has none. Returns the target, or null when either
 * series is missing or they are the same.
 */
export async function mergeSeries(db: Db, sourceId: number, targetId: number): Promise<Series | null> {
  if (sourceId === targetId) return null;
  return db.transaction(async (tx) => {
    const source = await getSeries(tx, sourceId);
    const target = await getSeries(tx, targetId);
    if (!source || !target) return null;
    await tx.run(`UPDATE books SET series_id = ?, updated_at = ${NOW_SQL} WHERE series_id = ?`, [targetId, sourceId]);
    const totalCount = target.totalCount ?? source.totalCount;
    if (totalCount !== target.totalCount) await tx.run('UPDATE series SET total_count = ? WHERE id = ?', [totalCount, targetId]);
    await tx.run('DELETE FROM series WHERE id = ?', [sourceId]);
    return { ...target, totalCount };
  });
}

/** Deletes a series; its books stay in the catalogue as standalones. */
export async function deleteSeries(db: Db, id: number): Promise<boolean> {
  return (await db.run('DELETE FROM series WHERE id = ?', [id])).changes > 0;
}

export interface SeriesSummary extends Series {
  /** Every book linked to the series, numbered or not. */
  bookCount: number;
  /** Distinct whole positions owned (see `seriesProgress`). */
  owned: number;
  /** Highest position owned, fractional ones included. */
  maxPosition: number | null;
  /** Known length of the series: max(total count, highest whole position). */
  total: number | null;
  /** Number of whole positions missing up to `total`. */
  missing: number;
  /** The missing whole positions, ascending (see `seriesGaps`). */
  gaps: number[];
  /** When the newest book in the series was added (ISO timestamp). */
  lastAddedAt: string | null;
}

export type SeriesSort = 'name' | 'recent';

/** Every series with its counts, A-Z or most recently added to first. */
export async function listSeriesWithStats(db: Db, { sort = 'name' }: { sort?: SeriesSort } = {}): Promise<SeriesSummary[]> {
  const rows = await db.all<SeriesRow & { book_count: number; last_added_at: string | null }>(
    `SELECT s.id, s.name, s.total_count, COUNT(b.id) AS book_count, MAX(b.created_at) AS last_added_at
     FROM series s LEFT JOIN books b ON b.series_id = s.id
     GROUP BY s.id
     ORDER BY ${sort === 'recent' ? 'last_added_at IS NULL, last_added_at DESC,' : ''} s.name COLLATE NOCASE, s.id`,
  );
  const positions = await db.all<{ series_id: number; series_position: number }>(
    'SELECT series_id, series_position FROM books WHERE series_id IS NOT NULL AND series_position IS NOT NULL',
  );
  const bySeries = new Map<number, number[]>();
  for (const p of positions) bySeries.set(p.series_id, [...(bySeries.get(p.series_id) ?? []), p.series_position]);
  return rows.map((r) => {
    const progress = seriesProgress({ positions: bySeries.get(r.id) ?? [], totalCount: r.total_count });
    return {
      ...toSeries(r),
      bookCount: r.book_count,
      owned: progress.owned,
      maxPosition: progress.maxPosition,
      total: progress.total,
      missing: progress.gaps.length,
      gaps: progress.gaps,
      lastAddedAt: r.last_added_at,
    };
  });
}

/** A series with its books in reading order, or null. */
export async function getSeriesWithBooks(db: Db, id: number): Promise<{ series: Series; books: Book[] } | null> {
  const series = await getSeries(db, id);
  return series ? { series, books: await listBooksInSeries(db, id) } : null;
}

/** Missing whole positions in a series (see `seriesGaps`); empty when it does not exist. */
export async function seriesGapsFor(db: Db, id: number): Promise<number[]> {
  const series = await getSeries(db, id);
  if (!series) return [];
  const rows = await db.all<{ series_position: number | null }>('SELECT series_position FROM books WHERE series_id = ?', [id]);
  return seriesGaps({ positions: rows.map((r) => r.series_position), totalCount: series.totalCount });
}

/** Puts a book in a series at a position (or takes it out with seriesId null). */
export async function setBookSeries(db: Db, bookId: number, seriesId: number | null, position: number | null = null): Promise<void> {
  await db.run(`UPDATE books SET series_id = ?, series_position = ?, updated_at = ${NOW_SQL} WHERE id = ?`, [
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

/** A book's place in its series: the series, its progress and the book's neighbours. */
export interface BookSeriesPlace {
  series: Series;
  position: number | null;
  progress: SeriesProgress;
  /** Books linked to the series, numbered or not. */
  bookCount: number;
  neighbours: SeriesNeighbours<Book>;
}

/**
 * Where a book sits in its series (P04-06): previous and next (owned books,
 * or missing whole positions), plus the series' progress. Null when the book
 * does not exist or is in no series.
 */
export async function neighbours(db: Db, bookId: number): Promise<BookSeriesPlace | null> {
  const row = await db.get<{ series_id: number | null; series_position: number | null }>(
    'SELECT series_id, series_position FROM books WHERE id = ?',
    [bookId],
  );
  if (row?.series_id == null) return null;
  const found = await getSeriesWithBooks(db, row.series_id);
  if (!found) return null;
  const progress = seriesProgress({ positions: found.books.map((b) => b.seriesPosition), totalCount: found.series.totalCount });
  const near = neighboursInSeries(
    found.books.map((b) => ({ id: b.id, title: b.title, position: b.seriesPosition })),
    bookId,
    progress.total,
  );
  const byId = new Map(found.books.map((b) => [b.id, b]));
  const unwrap = (n: (typeof near)['next']) => (n?.kind === 'owned' ? { kind: 'owned' as const, book: byId.get(n.book.id)! } : n);
  return { series: found.series, position: row.series_position, progress, bookCount: found.books.length, neighbours: { previous: unwrap(near.previous), next: unwrap(near.next) } };
}

/** Series as they stand now (name, total and book positions), for before/after comparisons. Missing ids are left out. */
export async function seriesStates(db: Db, ids: Iterable<number>): Promise<Map<number, SeriesState>> {
  const out = new Map<number, SeriesState>();
  for (const id of new Set(ids)) {
    const series = await getSeries(db, id);
    if (!series) continue;
    const rows = await db.all<{ series_position: number | null }>('SELECT series_position FROM books WHERE series_id = ?', [id]);
    out.set(id, { ...series, positions: rows.map((r) => r.series_position) });
  }
  return out;
}
