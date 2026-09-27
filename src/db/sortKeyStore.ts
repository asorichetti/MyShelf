import { CALL_NUMBER_RULES, callNumber } from '@/domain';

import { foldSql, SORT_TITLE_SQL } from './sortKeys';

import type { Db } from './types';

/**
 * The stored sort keys (migration 0010, `book_sort_keys`): each book's
 * filing title, first author, primary genre and series, folded; its author
 * names for the Shelf; and its call number, as the book page prints it and
 * as the Shelf sorts it. Worked out once per book instead of once per book
 * in every Shelf query.
 *
 * The table's triggers mark a book's row out of date (`rules` 0) whenever
 * anything it is made from changes; `ensureSortKeys` makes every row that
 * needs it before anything reads them. The folds are the Shelf's own
 * (`foldSql`, `SORT_TITLE_SQL`) and the call number is `callNumber()`, so
 * the stored values cannot drift from the rules: a change to either bumps
 * `SORT_KEY_RULES` or `CALL_NUMBER_RULES`, and every row is made again.
 */

/**
 * Which version of the stored keys' rules made a row: bump it when the
 * fold, the filing title, or which author or genre comes first changes.
 * (A change to `callNumber()` bumps `CALL_NUMBER_RULES` instead.)
 */
export const SORT_KEY_RULES = 1;

/** Both only ever go up, so their sum does too: a row made under older rules has a smaller one. */
const CURRENT_RULES = SORT_KEY_RULES + CALL_NUMBER_RULES;

/** Separates a book's genre names in one column (a control character no name contains). */
const GENRE_SEPARATOR = '\u001f';

/** Years are stored in the sort key as fixed-width digits offset by this much, so negative years sort before positive ones. */
const YEAR_OFFSET = 1e15;

/**
 * A text that sorts call numbers in shelf order, compared byte by byte:
 * class, then author mark, then year (as a number; none last). Classes and
 * marks are capital letters only, so the space after each one sorts before
 * any letter could ("GN" before "GNA").
 */
export function callNumberSortKey(call: string): string {
  const [cls, mark, year] = call.split(' ');
  const y = year ? Number(year) : NaN;
  const yearKey = Number.isFinite(y) ? String(Math.min(Math.max(Math.round(y), 1 - YEAR_OFFSET), YEAR_OFFSET - 1) + YEAR_OFFSET).padStart(16, '0') : '~';
  return `${cls} ${mark} ${yearKey}`;
}

/** The keys SQL can make, for the rows to be made (`b` is the book, `s` its series). */
const MAKE_KEYS = `UPDATE book_sort_keys SET
  title = ${foldSql(`(${SORT_TITLE_SQL})`)},
  author = (SELECT ${foldSql('COALESCE(a.sort_name, a.name)')} FROM book_authors ba JOIN authors a ON a.id = ba.author_id
    WHERE ba.book_id = b.id ORDER BY ba.position, a.id LIMIT 1),
  author_names = (SELECT group_concat(a.name, char(31) ORDER BY ba.position, a.id) FROM book_authors ba JOIN authors a ON a.id = ba.author_id
    WHERE ba.book_id = b.id),
  genre = (SELECT ${foldSql('g.name')} FROM book_genres bg JOIN genres g ON g.id = bg.genre_id
    WHERE bg.book_id = b.id ORDER BY g.name COLLATE NOCASE, g.id LIMIT 1),
  series = ${foldSql('s.name')}
FROM books b LEFT JOIN series s ON s.id = b.series_id
WHERE b.id = book_sort_keys.book_id AND book_sort_keys.rules < ?`;

/** What a call number is made from, for the rows to be made. */
const CALL_INPUTS = `SELECT b.id, b.title, b.publication_year AS year,
  (SELECT group_concat(g.name, char(31) ORDER BY g.name, g.id) FROM book_genres bg JOIN genres g ON g.id = bg.genre_id WHERE bg.book_id = b.id) AS genres,
  (SELECT COALESCE(a.sort_name, a.name) FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id ORDER BY ba.position, a.id LIMIT 1) AS author
FROM book_sort_keys k JOIN books b ON b.id = k.book_id
WHERE k.rules < ?`;

interface CallInputs {
  id: number;
  title: string;
  year: number | null;
  genres: string | null;
  author: string | null;
}

/**
 * Makes the stored keys of every book whose row is out of date (or only
 * `bookId`'s). Costs one indexed lookup when none is.
 */
export async function ensureSortKeys(db: Db, bookId?: number): Promise<void> {
  const only = bookId != null ? ' AND book_id = ?' : '';
  const params = bookId != null ? [CURRENT_RULES, bookId] : [CURRENT_RULES];
  const pending = await db.get<{ n: number }>(`SELECT EXISTS (SELECT 1 FROM book_sort_keys WHERE rules < ?${only}) AS n`, params);
  if (!pending?.n) return;
  // Read and write in one transaction, so no change can land in between and leave a row made from old data.
  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM book_sort_keys WHERE rules < ?${only} AND NOT EXISTS (SELECT 1 FROM books WHERE id = book_id)`, params);
    await tx.run(`${MAKE_KEYS}${only.replace('book_id', 'book_sort_keys.book_id')}`, params);
    const rows = await tx.all<CallInputs>(`${CALL_INPUTS}${only.replace('book_id', 'k.book_id')}`, params);
    // Books by the same author in the same genres and year share a call number: work each one out once.
    const seen = new Map<string, [string, string]>();
    const made: [number, string, string][] = [];
    for (const r of rows) {
      const key = `${r.genres ?? ''}\u0000${r.author != null ? `a${r.author}` : `t${r.title}`}\u0000${r.year ?? ''}`;
      let call = seen.get(key);
      if (!call) {
        const printed = callNumber({ genres: r.genres ? r.genres.split(GENRE_SEPARATOR) : [], author: r.author, title: r.title, year: r.year });
        call = [printed, callNumberSortKey(printed)];
        seen.set(key, call);
      }
      made.push([r.id, call[0], call[1]]);
    }
    if (!made.length) return;
    await tx.run(
      `UPDATE book_sort_keys SET call_number = j.value ->> 1, call_key = j.value ->> 2, rules = ?
       FROM json_each(?) AS j WHERE book_sort_keys.book_id = j.value ->> 0`,
      [CURRENT_RULES, JSON.stringify(made)],
    );
  });
}

/** A book's call number as stored (made first if need be): what its page prints and the Shelf sorts by. Null if there is no such book. */
export async function getCallNumber(db: Db, bookId: number): Promise<string | null> {
  await ensureSortKeys(db, bookId);
  const row = await db.get<{ call_number: string | null }>('SELECT call_number FROM book_sort_keys WHERE book_id = ?', [bookId]);
  return row?.call_number ?? null;
}
