import { ratingSectionTitle, sectionSort, ungroupedTitles, type BookListItem, type ShelfFilters, type ShelfGroupBy, type ShelfSort, type SortLevel } from '@/domain';

import { foldSql } from '../sortKeys';
import { listBookItems } from './books';

import type { Db } from '../types';

/** One section of the Shelf: a genre, series, author, user group or star rating (or everything, ungrouped). */
export interface ShelfSection {
  /** Unique across the Shelf, e.g. `genre:3`, `genre:none`, `all`. */
  sectionKey: string;
  /** "Fantasy", "No genre"; empty when the Shelf is not grouped. */
  sectionTitle: string;
  groupBy: ShelfGroupBy;
  /** The genre, series, author or group id (the number of stars for a rating); null for the ungrouped bucket (and `none`). */
  id: number | null;
  items: BookListItem[];
}

export interface ShelfSectionsOptions {
  sort: ShelfSort;
  groupBy: ShelfGroupBy;
  query?: string;
  filters?: ShelfFilters;
}

export interface ShelfSections {
  sections: ShelfSection[];
  /** Distinct books shown (a book in two genres counts once). */
  count: number;
  /** The first sort level when it is the grouping's own key: it orders the sections and is skipped inside them. */
  skipped: SortLevel | null;
}

interface Membership {
  book_id: number;
  key_id: number;
  key_name: string;
}

/** Which bucket(s) each book belongs to, buckets in display order (names ignoring case and accents). */
const MEMBERSHIP_SQL: Record<Exclude<ShelfGroupBy, 'none'>, string> = {
  genre: `SELECT bg.book_id, g.id AS key_id, g.name AS key_name
    FROM book_genres bg JOIN genres g ON g.id = bg.genre_id
    ORDER BY ${foldSql('g.name')} COLLATE NOCASE, g.id`,
  series: `SELECT b.id AS book_id, s.id AS key_id, s.name AS key_name
    FROM books b JOIN series s ON s.id = b.series_id
    ORDER BY ${foldSql('s.name')} COLLATE NOCASE, s.id`,
  author: `SELECT ba.book_id, a.id AS key_id, a.name AS key_name
    FROM book_authors ba JOIN authors a ON a.id = ba.author_id
    ORDER BY ${foldSql('COALESCE(a.sort_name, a.name)')} COLLATE NOCASE, a.id`,
  group: `SELECT gb.book_id, g.id AS key_id, g.name AS key_name
    FROM group_books gb JOIN groups g ON g.id = gb.group_id
    ORDER BY ${foldSql('g.name')} COLLATE NOCASE, g.id`,
  // Best first; the section is named in words below ("4 stars"), not in SQL.
  rating: `SELECT b.id AS book_id, b.rating AS key_id, '' AS key_name
    FROM books b WHERE b.rating IS NOT NULL
    ORDER BY b.rating DESC`,
};

/**
 * The Shelf split into sections: one query for the matching books (searched,
 * filtered and sorted in SQL, plus one for their authors) and one for the
 * grouping's memberships. A book appears in every section it belongs to (two
 * genres, two authors); books in none of them come last under "No genre",
 * "Not in a series", "No author", "Not in a group" or "Not rated". Empty
 * sections are left out.
 *
 * Sections come in the grouping's order and the sort applies inside each one
 * (P11-05). When the sort's first level is the grouping's own key (genre
 * inside genre sections) it is skipped inside them — every book there has
 * the same genre — and its direction orders the sections instead (Z to A
 * reverses them; the ungrouped section stays last).
 */
export async function listShelfSections(db: Db, options: ShelfSectionsOptions): Promise<ShelfSections> {
  const { groupBy, query, filters, sort } = options;
  const within = sectionSort(sort.levels, groupBy);
  const items = await listBookItems(db, { query, filters, sort: { ...sort, levels: within.levels } });
  if (groupBy === 'none') {
    return { sections: items.length ? [{ sectionKey: 'all', sectionTitle: '', groupBy, id: null, items }] : [], count: items.length, skipped: null };
  }

  const byId = new Map(items.map((item, index) => [item.id, { item, index }]));
  const rows = await db.all<Membership>(MEMBERSHIP_SQL[groupBy]);
  const buckets = new Map<number, { name: string; entries: { item: BookListItem; index: number }[] }>();
  const placed = new Set<number>();
  for (const row of rows) {
    const entry = byId.get(row.book_id);
    if (!entry) continue;
    let bucket = buckets.get(row.key_id);
    if (!bucket) {
      bucket = { name: groupBy === 'rating' ? ratingSectionTitle(row.key_id) : row.key_name, entries: [] };
      buckets.set(row.key_id, bucket);
    }
    bucket.entries.push(entry);
    placed.add(row.book_id);
  }

  const sections: ShelfSection[] = [];
  for (const [id, bucket] of buckets) {
    // Membership rows come in bucket order; within a bucket, books follow the sort.
    const entries = [...bucket.entries].sort((a, b) => a.index - b.index);
    sections.push({ sectionKey: `${groupBy}:${id}`, sectionTitle: bucket.name, groupBy, id, items: entries.map((e) => e.item) });
  }
  if (within.reverseSections) sections.reverse();
  const rest = items.filter((item) => !placed.has(item.id));
  if (rest.length) sections.push({ sectionKey: `${groupBy}:none`, sectionTitle: ungroupedTitles[groupBy], groupBy, id: null, items: rest });
  return { sections, count: items.length, skipped: within.skipped };
}
