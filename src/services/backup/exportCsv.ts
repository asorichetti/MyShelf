import { bookExportRepo, type Db, type ExportBook } from '@/db';
import { toIsoDate } from '@/domain';

import { toCsv } from './csv';

/** The spreadsheet's column headings, in order; the import's "MyShelf" preset reads the same names. */
export const MYSHELF_CSV_COLUMNS = {
  title: 'Title',
  subtitle: 'Subtitle',
  authors: 'Authors',
  isbn13: 'ISBN-13',
  isbn10: 'ISBN-10',
  publisher: 'Publisher',
  year: 'Year',
  pages: 'Pages',
  format: 'Format',
  language: 'Language',
  genres: 'Genres',
  series: 'Series',
  seriesPosition: 'Series position',
  groups: 'Groups',
  rating: 'Rating',
  loanBorrower: 'On loan to',
  loanLentOn: 'Lent on',
  loanDueOn: 'Due on',
  notes: 'Notes',
  added: 'Added',
} as const;

type Column = keyof typeof MYSHELF_CSV_COLUMNS;
const LOAN_COLUMNS: readonly Column[] = ['loanBorrower', 'loanLentOn', 'loanDueOn'];

/** Separator for several names in one cell ("Terry Pratchett; Neil Gaiman"). */
export const LIST_SEPARATOR = '; ';

export interface CsvExportOptions {
  /** Add who has each book and when it is due. Off by default: borrower names are personal. */
  includeLoans?: boolean;
}

const value = (b: ExportBook, c: Column): string | number | null => {
  switch (c) {
    case 'title':
      return b.title;
    case 'subtitle':
      return b.subtitle;
    case 'authors':
      return b.authors.join(LIST_SEPARATOR);
    case 'isbn13':
      return b.isbn13;
    case 'isbn10':
      return b.isbn10;
    case 'publisher':
      return b.publisher;
    case 'year':
      return b.publicationYear;
    case 'pages':
      return b.pageCount;
    case 'format':
      return b.format;
    case 'language':
      return b.language;
    case 'genres':
      return b.genres.join(LIST_SEPARATOR);
    case 'series':
      return b.series;
    case 'seriesPosition':
      return b.seriesPosition;
    case 'groups':
      return b.groups.join(LIST_SEPARATOR);
    case 'rating':
      return b.rating;
    case 'loanBorrower':
      return b.loan?.borrower ?? null;
    case 'loanLentOn':
      return b.loan?.lentOn ?? null;
    case 'loanDueOn':
      return b.loan?.dueOn ?? null;
    case 'notes':
      return b.notes;
    case 'added':
      // The day on the reader's calendar: a book added late in the evening west of Greenwich is already "tomorrow" in UTC.
      return toIsoDate(new Date(b.createdAt));
  }
};

/** The columns written, in order. */
export function csvColumns({ includeLoans = false }: CsvExportOptions = {}): Column[] {
  return (Object.keys(MYSHELF_CSV_COLUMNS) as Column[]).filter((c) => includeLoans || !LOAN_COLUMNS.includes(c));
}

/** Books as a spreadsheet: a header row then one row per book, UTF-8 with a BOM, CRLF line endings. */
export function booksToCsv(books: readonly ExportBook[], options: CsvExportOptions = {}): string {
  const columns = csvColumns(options);
  return toCsv([columns.map((c) => MYSHELF_CSV_COLUMNS[c]), ...books.map((b) => columns.map((c) => value(b, c)))], { bom: true });
}

/** The whole library as CSV text (P08-04), and how many books it holds. */
export async function exportCsv(db: Db, options: CsvExportOptions = {}): Promise<{ text: string; count: number }> {
  const books = await bookExportRepo.listBooksForExport(db);
  return { text: booksToCsv(books, options), count: books.length };
}

/** `myshelf-books-2026-10-12.csv`. */
export function csvFileName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `myshelf-books-${y}-${m}-${d}.csv`;
}
