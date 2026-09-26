import { authorsRepo, bookExportRepo, booksRepo, genresRepo, groupsRepo, seriesRepo, type Db } from '@/db';
import {
  authorKey,
  isbn10To13,
  isbn13To10,
  isLanguageCode,
  isValidIsbn10,
  isValidIsbn13,
  normaliseText,
  normalizeIsbn,
  parsePosition,
  parseSeriesFromTitle,
  stripHtml,
  titleKey,
  toIso6391,
  type BookFormat,
  type NewBook,
} from '@/domain';

import { CsvParseError, detectDelimiter, parseCsv, type CsvDelimiter } from './csv';
import { detectPreset, type ImportField, type PresetId } from './csvPresets';

/** A CSV file read and split into its header and data rows. */
export interface CsvTable {
  delimiter: CsvDelimiter;
  headers: string[];
  /** Data rows, each padded or cut to the header's length. */
  rows: string[][];
  /** The preset the header looks like. */
  preset: PresetId;
}

export class CsvImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvImportError';
  }
}

/** Reads a spreadsheet file: detects the delimiter, the header and the preset. Throws `CsvImportError` with a friendly message. */
export function readCsvTable(text: string): CsvTable {
  if (!text.replace(/^﻿/, '').trim()) throw new CsvImportError('That file is empty. Choose a spreadsheet saved as CSV.');
  const delimiter = detectDelimiter(text);
  let all: string[][];
  try {
    all = parseCsv(text, delimiter);
  } catch (error) {
    if (error instanceof CsvParseError) {
      throw new CsvImportError(`That file looks cut short: a quoted cell starting on line ${error.line} never ends. Try exporting it again.`);
    }
    throw error;
  }
  const [header, ...data] = all;
  const headers = (header ?? []).map((h) => h.trim());
  if (headers.length < 1 || !headers.some(Boolean)) throw new CsvImportError('That file has no header row. The first line should name the columns, like Title and Author.');
  if (/^\s*[[{]/.test(headers[0])) throw new CsvImportError('That looks like a backup file, not a spreadsheet. Use “Restore from a backup” for it.');
  const rows = data.map((r) => headers.map((_, i) => r[i] ?? ''));
  return { delimiter, headers, rows, preset: detectPreset(headers) };
}

/** A book ready to be added, with everything linked by name. */
export interface PlannedBook {
  /** 1-based line of the file (the header is line 1). */
  line: number;
  book: Omit<NewBook, 'seriesId' | 'seriesPosition'>;
  authors: string[];
  genres: string[];
  series: { name: string; position: number | null } | null;
  groups: string[];
  /** ISO-8601 UTC, from "Date Added"; null keeps the import time. */
  addedAt: string | null;
  /** Things that were dropped from the row, e.g. an ISBN with a wrong check digit. */
  warnings: string[];
}

export interface SkippedRow {
  line: number;
  title: string | null;
  reason: string;
}

export interface RowOutcome {
  line: number;
  title: string | null;
  authors: string[];
  status: 'add' | 'skip';
  /** The reason for a skip, or warnings for an add. */
  notes: string[];
}

export interface ImportPlan {
  books: PlannedBook[];
  skipped: SkippedRow[];
  /** Every data row in file order, for the preview. */
  outcomes: RowOutcome[];
}

export interface PlanOptions {
  /** Goodreads shelves (and other "Shelves"/"Groups" columns) become MyShelf groups. Default true. */
  shelvesAsGroups?: boolean;
  /** Keys of books already on the shelf (`existingBookKeys`), so they are skipped rather than doubled. */
  existing?: ReadonlySet<string>;
}

/** Undoes the `="…"` spreadsheet-formula wrapping Goodreads puts round ISBNs. */
export function unwrapFormula(value: string): string {
  const m = /^="(.*)"$/s.exec(value.trim());
  return (m ? m[1] : value).trim();
}

const clean = (v: string | undefined) => {
  const s = unwrapFormula(v ?? '').replace(/\s+/g, ' ').trim();
  return s || null;
};
const splitList = (v: string | null, separator: RegExp) =>
  v ? v.split(separator).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean) : [];
const unique = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = normaliseText(x, { dropArticle: false });
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Goodreads bindings and other spellings → MyShelf formats. */
export function parseFormat(value: string | null): BookFormat | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (/audio|audible|mp3|cd\b/.test(v)) return 'audiobook';
  if (/kindle|ebook|e-book|nook|epub|digital/.test(v)) return 'ebook';
  if (/hard ?(cover|back)|library binding|board book/.test(v)) return 'hardcover';
  if (/paper ?back|mass market|trade|softcover|soft cover/.test(v)) return 'paperback';
  return 'other';
}

function parseYear(value: string | null): number | null {
  const m = value ? /^\s*(\d{3,4})\b/.exec(value) : null;
  const y = m ? Number(m[1]) : NaN;
  return Number.isInteger(y) && y > 0 && y <= new Date().getFullYear() + 5 ? y : null;
}

function parsePages(value: string | null): number | null {
  const n = value ? Number(value.replace(/[^\d]/g, '')) : NaN;
  return Number.isInteger(n) && n > 0 && n < 100_000 ? n : null;
}

/**
 * A rating cell: 1-5 whole stars (4.0 is 4); blank or 0 is "not rated"
 * (Goodreads writes 0 for books you have not rated). Undefined when the cell
 * holds something else (4.5, 7, "great"), so the import can say so.
 */
export function parseImportRating(value: string | null): number | null | undefined {
  const v = value?.trim() ?? '';
  if (!v || /^0+(\.0+)?$/.test(v)) return null;
  const m = /^([1-5])(\.0+)?$/.exec(v);
  return m ? Number(m[1]) : undefined;
}

/** "2023/01/15", "2023-01-15" or a full ISO timestamp → ISO-8601 UTC (midday for a plain date). */
export function parseAddedDate(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(value.trim());
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d, 12));
    return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date.toISOString() : null;
  }
  const t = Date.parse(value);
  return Number.isNaN(t) || !/^\d{4}-\d{2}-\d{2}T/.test(value.trim()) ? null : new Date(t).toISOString();
}

/** "to-read" → "To read", "currently-reading" → "Currently reading", "favourites" → "Favourites". */
export function shelfToGroupName(shelf: string): string {
  const words = shelf.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : words;
}

/** The trailing "(Series, #3)" Goodreads adds to titles, removed from the title and read as the series. */
function splitSeriesFromTitle(title: string): { title: string; series: { name: string; position: number | null } | null } {
  if (!/\)\s*$/.test(title)) return { title, series: null };
  const parsed = parseSeriesFromTitle(title);
  if (!parsed) return { title, series: null };
  const bare = title.replace(/\s*\([^()]*\)\s*$/, '').trim();
  return bare ? { title: bare, series: parsed } : { title, series: null };
}

/** Matching keys for "already on the shelf": the ISBN-13, and the title with the first author. */
export function bookKeys(isbn13: string | null, title: string, firstAuthor: string | null): string[] {
  const keys = [`t:${titleKey(title)}|${firstAuthor ? authorKey(firstAuthor) : ''}`];
  if (isbn13) keys.push(`i:${isbn13}`);
  return keys;
}

/** Keys for every book already in the library. */
export async function existingBookKeys(db: Db): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const b of await bookExportRepo.listBooksForExport(db)) for (const k of bookKeys(b.isbn13, b.title, b.authors[0] ?? null)) keys.add(k);
  return keys;
}

/**
 * Turns mapped rows into books (P08-05): every row with a title becomes a
 * book; rows without one are reported, never silently dropped. Fields that
 * do not parse (a bad ISBN, "n/a" pages) are left empty with a warning.
 * Pure: nothing is written.
 */
export function planImport(rows: readonly string[][], mapping: readonly ImportField[], { shelvesAsGroups = true, existing = new Set() }: PlanOptions = {}): ImportPlan {
  const plan: ImportPlan = { books: [], skipped: [], outcomes: [] };
  const seen = new Set(existing);
  const col = (row: readonly string[], field: ImportField) => {
    const i = mapping.indexOf(field);
    return i < 0 ? null : clean(row[i]);
  };
  const raw = (row: readonly string[], field: ImportField) => {
    const i = mapping.indexOf(field);
    return i < 0 ? null : (row[i] ?? '').trim() || null;
  };

  rows.forEach((row, index) => {
    const line = index + 2;
    const warnings: string[] = [];
    const rawTitle = col(row, 'title');
    const primary = splitList(col(row, 'authors'), /\s*(?:;|\s&\s)\s*/);
    const additional = splitList(col(row, 'additionalAuthors'), /\s*[,;]\s*/);
    const authors = unique([...primary, ...additional]);
    if (!rawTitle) {
      const reason = row.every((c) => !c.trim()) ? 'The row is empty.' : 'It has no title.';
      plan.skipped.push({ line, title: null, reason });
      plan.outcomes.push({ line, title: null, authors, status: 'skip', notes: [reason] });
      return;
    }

    const explicitSeries = col(row, 'series');
    const split = explicitSeries ? { title: rawTitle, series: null } : splitSeriesFromTitle(rawTitle);
    const series = explicitSeries ? { name: explicitSeries, position: parsePosition(col(row, 'seriesPosition')) } : split.series;
    const title = split.title;

    // ISBNs: ISBN-13 wins; a valid ISBN-10 fills in the 13 when it is missing.
    let isbn13: string | null = null;
    let isbn10: string | null = null;
    for (const field of ['isbn13', 'isbn10', 'isbn'] as const) {
      const value = col(row, field);
      if (!value) continue;
      const n = normalizeIsbn(value);
      if (n && n.length === 13 && isValidIsbn13(n)) isbn13 ??= n;
      else if (n && n.length === 10 && isValidIsbn10(n)) isbn10 ??= n;
      else warnings.push(`The ISBN “${value}” isn’t valid, so it was left out.`);
    }
    if (!isbn13 && isbn10) isbn13 = isbn10To13(isbn10);
    if (isbn13 && !isbn10) isbn10 = isbn13To10(isbn13);

    const keys = bookKeys(isbn13, title, authors[0] ?? null);
    if (keys.some((k) => seen.has(k))) {
      const inFile = keys.some((k) => seen.has(k) && !existing.has(k));
      const reason = inFile ? 'It appears twice in the file.' : 'It’s already on your shelf.';
      plan.skipped.push({ line, title, reason });
      plan.outcomes.push({ line, title, authors, status: 'skip', notes: [reason] });
      return;
    }
    keys.forEach((k) => seen.add(k));

    const yearText = col(row, 'year');
    const year = parseYear(yearText) ?? parseYear(col(row, 'originalYear'));
    if (yearText && parseYear(yearText) == null) warnings.push(`The year “${yearText}” wasn’t understood.`);
    const pagesText = col(row, 'pages');
    const pages = parsePages(pagesText);
    if (pagesText && pages == null) warnings.push(`The page count “${pagesText}” wasn’t understood.`);
    const languageText = col(row, 'language');
    const language = languageText ? (toIso6391(languageText) ?? (isLanguageCode(languageText.toLowerCase()) ? languageText.toLowerCase() : null)) : null;

    const ratingText = col(row, 'rating');
    const rating = parseImportRating(ratingText);
    if (rating === undefined) warnings.push(`The rating “${ratingText}” wasn’t understood, so it was left out.`);

    const review = stripHtml(raw(row, 'notes'));
    const privateNotes = stripHtml(raw(row, 'privateNotes'));
    const notes = [review, privateNotes].filter(Boolean).join('\n\n') || null;

    const groups = shelvesAsGroups
      ? unique([
          ...splitList(col(row, 'groups'), /\s*;\s*/),
          ...splitList(col(row, 'shelves'), /\s*,\s*/).map(shelfToGroupName),
          ...splitList(col(row, 'exclusiveShelf'), /\s*,\s*/).map(shelfToGroupName),
        ])
      : [];

    const book: PlannedBook = {
      line,
      book: {
        title,
        subtitle: col(row, 'subtitle'),
        isbn13,
        isbn10,
        publisher: col(row, 'publisher'),
        publicationYear: year,
        pageCount: pages,
        format: parseFormat(col(row, 'format')),
        language,
        notes,
        rating: rating ?? null,
        source: 'import',
      },
      authors,
      genres: unique(splitList(col(row, 'genres'), /\s*;\s*/)),
      series,
      groups,
      addedAt: parseAddedDate(col(row, 'added')),
      warnings,
    };
    plan.books.push(book);
    plan.outcomes.push({ line, title, authors, status: 'add', notes: warnings });
  });
  return plan;
}

export interface ImportReport {
  imported: number;
  /** Book ids created, in file order. */
  bookIds: number[];
  skipped: SkippedRow[];
  groupsCreated: string[];
}

/**
 * Adds the planned books in one transaction (P08-05): authors, genres,
 * series and groups are matched by name or created. A failure adds nothing.
 * Covers are not fetched here: the cover backfill finds real covers for the
 * new books afterwards, without holding up the import.
 */
export async function importPlannedBooks(db: Db, plan: ImportPlan): Promise<ImportReport> {
  return db.transaction(async (tx) => {
    const report: ImportReport = { imported: 0, bookIds: [], skipped: [...plan.skipped], groupsCreated: [] };
    const groups = new Map((await groupsRepo.listGroups(tx)).map((g) => [normaliseText(g.name, { dropArticle: false }), g.id]));
    const groupPositions = new Map<number, number>();
    for (const planned of plan.books) {
      const seriesId = planned.series ? (await seriesRepo.findOrCreateSeries(tx, planned.series.name)).id : null;
      const book = await booksRepo.createBook(tx, { ...planned.book, seriesId, seriesPosition: planned.series?.position ?? null });
      if (planned.addedAt) await booksRepo.setAddedAt(tx, book.id, planned.addedAt);
      const links = [];
      for (const name of planned.authors) links.push({ authorId: (await authorsRepo.findOrCreateAuthor(tx, name)).id, role: 'author' as const });
      if (links.length) await authorsRepo.setBookAuthors(tx, book.id, links);
      const genreIds = [];
      for (const name of planned.genres) genreIds.push((await genresRepo.findOrCreateGenre(tx, name)).id);
      if (genreIds.length) await genresRepo.setBookGenres(tx, book.id, genreIds, { userEdited: true });
      for (const name of planned.groups) {
        const k = normaliseText(name, { dropArticle: false });
        let id = groups.get(k);
        if (id == null) {
          id = (await groupsRepo.createGroup(tx, { name })).id;
          groups.set(k, id);
          report.groupsCreated.push(name);
        }
        const position = groupPositions.get(id) ?? (await groupsRepo.listGroupBookIds(tx, id)).length;
        await groupsRepo.addBookToGroup(tx, id, book.id, position);
        groupPositions.set(id, position + 1);
      }
      report.imported++;
      report.bookIds.push(book.id);
    }
    return report;
  });
}
