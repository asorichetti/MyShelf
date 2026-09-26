import type { Db } from '../types';

/** One book flattened for the spreadsheet export (P08-04). */
export interface ExportBook {
  id: number;
  title: string;
  subtitle: string | null;
  /** In credit order. */
  authors: string[];
  isbn13: string | null;
  isbn10: string | null;
  publisher: string | null;
  publicationYear: number | null;
  pageCount: number | null;
  format: string | null;
  language: string | null;
  genres: string[];
  series: string | null;
  seriesPosition: number | null;
  groups: string[];
  /** The open loan, if the book is out. */
  loan: { borrower: string; lentOn: string; dueOn: string | null } | null;
  notes: string | null;
  /** The reader's rating, 1-5; null when not rated. */
  rating: number | null;
  /** ISO-8601 UTC. */
  createdAt: string;
}

interface BookRow {
  id: number;
  title: string;
  subtitle: string | null;
  isbn13: string | null;
  isbn10: string | null;
  publisher: string | null;
  publication_year: number | null;
  page_count: number | null;
  format: string | null;
  language: string | null;
  series: string | null;
  series_position: number | null;
  notes: string | null;
  rating: number | null;
  created_at: string;
}

const multi = async (db: Db, sql: string) => {
  const map = new Map<number, string[]>();
  for (const r of await db.all<{ book_id: number; name: string }>(sql)) {
    let list = map.get(r.book_id);
    if (!list) map.set(r.book_id, (list = []));
    list.push(r.name);
  }
  return map;
};

/** Every book with its authors, genres, series, groups and open loan, in title order. */
export async function listBooksForExport(db: Db): Promise<ExportBook[]> {
  const books = await db.all<BookRow>(
    `SELECT b.id, b.title, b.subtitle, b.isbn13, b.isbn10, b.publisher, b.publication_year, b.page_count, b.format, b.language,
       s.name AS series, b.series_position, b.notes, b.rating, b.created_at
     FROM books b LEFT JOIN series s ON s.id = b.series_id
     ORDER BY b.title COLLATE NOCASE, b.id`,
  );
  const authors = await multi(db, 'SELECT ba.book_id, a.name FROM book_authors ba JOIN authors a ON a.id = ba.author_id ORDER BY ba.book_id, ba.position, a.id');
  const genres = await multi(db, 'SELECT bg.book_id, g.name FROM book_genres bg JOIN genres g ON g.id = bg.genre_id ORDER BY bg.book_id, g.name COLLATE NOCASE');
  const groups = await multi(db, 'SELECT gb.book_id, g.name FROM group_books gb JOIN groups g ON g.id = gb.group_id ORDER BY gb.book_id, g.name COLLATE NOCASE');
  const loans = new Map<number, ExportBook['loan']>();
  for (const l of await db.all<{ book_id: number; name: string; lent_on: string; due_on: string | null }>(
    'SELECT l.book_id, p.name, l.lent_on, l.due_on FROM loans l JOIN borrowers p ON p.id = l.borrower_id WHERE l.returned_on IS NULL',
  )) {
    loans.set(l.book_id, { borrower: l.name, lentOn: l.lent_on, dueOn: l.due_on });
  }
  return books.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    authors: authors.get(b.id) ?? [],
    isbn13: b.isbn13,
    isbn10: b.isbn10,
    publisher: b.publisher,
    publicationYear: b.publication_year,
    pageCount: b.page_count,
    format: b.format,
    language: b.language,
    genres: genres.get(b.id) ?? [],
    series: b.series,
    seriesPosition: b.series_position,
    groups: groups.get(b.id) ?? [],
    loan: loans.get(b.id) ?? null,
    notes: b.notes,
    rating: b.rating,
    createdAt: b.created_at,
  }));
}
