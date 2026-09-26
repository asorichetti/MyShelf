import { translate, type MessageKey } from '@/i18n';

import { MYSHELF_CSV_COLUMNS } from './exportCsv';

/** What a spreadsheet column can become in MyShelf. */
export type ImportField =
  | 'ignore'
  | 'title'
  | 'subtitle'
  | 'authors'
  | 'additionalAuthors'
  | 'isbn13'
  | 'isbn10'
  | 'isbn'
  | 'publisher'
  | 'year'
  | 'originalYear'
  | 'pages'
  | 'format'
  | 'language'
  | 'genres'
  | 'series'
  | 'seriesPosition'
  | 'groups'
  | 'shelves'
  | 'exclusiveShelf'
  | 'rating'
  | 'notes'
  | 'privateNotes'
  | 'added';

/** The choices in the column mapper, in the order shown: each field's label key. */
export const importFieldLabelKeys: Record<ImportField, MessageKey> = {
  ignore: 'csvFields.ignore',
  title: 'csvFields.title',
  subtitle: 'csvFields.subtitle',
  authors: 'csvFields.authors',
  additionalAuthors: 'csvFields.additionalAuthors',
  isbn: 'csvFields.isbn',
  isbn13: 'csvFields.isbn13',
  isbn10: 'csvFields.isbn10',
  publisher: 'csvFields.publisher',
  year: 'csvFields.year',
  originalYear: 'csvFields.originalYear',
  pages: 'csvFields.pages',
  format: 'csvFields.format',
  language: 'csvFields.language',
  genres: 'csvFields.genres',
  series: 'csvFields.series',
  seriesPosition: 'csvFields.seriesPosition',
  groups: 'csvFields.groups',
  shelves: 'csvFields.shelves',
  exclusiveShelf: 'csvFields.exclusiveShelf',
  rating: 'csvFields.rating',
  notes: 'csvFields.notes',
  privateNotes: 'csvFields.privateNotes',
  added: 'csvFields.added',
};

/** What the column mapper calls a field ("Don’t import", "Author(s)"). */
export function importFieldLabel(field: ImportField): string {
  return translate(importFieldLabelKeys[field]);
}

export const importFieldOrder = Object.keys(importFieldLabelKeys) as ImportField[];

export type PresetId = 'goodreads' | 'myshelf' | 'custom';

export interface CsvPreset {
  id: PresetId;
  /** The preset's name in the "This file is a" list (translate it when showing it). */
  labelKey: MessageKey;
  /** What each known header becomes; unknown headers are ignored (or guessed, for `custom`). */
  columns: Record<string, ImportField>;
}

/**
 * Goodreads' "Export Library" file (My Books → Import and export): its real
 * column names. `ISBN` and `ISBN13` are written as `="…"` (a spreadsheet
 * formula that keeps leading zeros), series sit in the title as
 * "Title (Series, #3)", `Author` is one name and `Additional Authors` a
 * comma-separated list, `Bookshelves` is comma-separated, dates look
 * like 2023/01/15, and `My Rating` is 0 (not rated) to 5 stars.
 */
export const GOODREADS_PRESET: CsvPreset = {
  id: 'goodreads',
  labelKey: 'importCsv.presets.goodreads',
  columns: {
    'Book Id': 'ignore',
    Title: 'title',
    Author: 'authors',
    'Author l-f': 'ignore',
    'Additional Authors': 'additionalAuthors',
    ISBN: 'isbn10',
    ISBN13: 'isbn13',
    'My Rating': 'rating',
    'Average Rating': 'ignore',
    Publisher: 'publisher',
    Binding: 'format',
    'Number of Pages': 'pages',
    'Year Published': 'year',
    'Original Publication Year': 'originalYear',
    'Date Read': 'ignore',
    'Date Added': 'added',
    Bookshelves: 'shelves',
    'Bookshelves with positions': 'ignore',
    'Exclusive Shelf': 'exclusiveShelf',
    'My Review': 'notes',
    Spoiler: 'ignore',
    'Private Notes': 'privateNotes',
    'Read Count': 'ignore',
    'Owned Copies': 'ignore',
  },
};

/** MyShelf's own spreadsheet export (P08-04), read back. Loan columns are not imported. */
export const MYSHELF_PRESET: CsvPreset = {
  id: 'myshelf',
  labelKey: 'importCsv.presets.myshelf',
  columns: {
    [MYSHELF_CSV_COLUMNS.title]: 'title',
    [MYSHELF_CSV_COLUMNS.subtitle]: 'subtitle',
    [MYSHELF_CSV_COLUMNS.authors]: 'authors',
    [MYSHELF_CSV_COLUMNS.isbn13]: 'isbn13',
    [MYSHELF_CSV_COLUMNS.isbn10]: 'isbn10',
    [MYSHELF_CSV_COLUMNS.publisher]: 'publisher',
    [MYSHELF_CSV_COLUMNS.year]: 'year',
    [MYSHELF_CSV_COLUMNS.pages]: 'pages',
    [MYSHELF_CSV_COLUMNS.format]: 'format',
    [MYSHELF_CSV_COLUMNS.language]: 'language',
    [MYSHELF_CSV_COLUMNS.genres]: 'genres',
    [MYSHELF_CSV_COLUMNS.series]: 'series',
    [MYSHELF_CSV_COLUMNS.seriesPosition]: 'seriesPosition',
    [MYSHELF_CSV_COLUMNS.groups]: 'groups',
    [MYSHELF_CSV_COLUMNS.rating]: 'rating',
    [MYSHELF_CSV_COLUMNS.loanBorrower]: 'ignore',
    [MYSHELF_CSV_COLUMNS.loanLentOn]: 'ignore',
    [MYSHELF_CSV_COLUMNS.loanDueOn]: 'ignore',
    [MYSHELF_CSV_COLUMNS.notes]: 'notes',
    [MYSHELF_CSV_COLUMNS.added]: 'added',
  },
};

export const CUSTOM_PRESET: CsvPreset = { id: 'custom', labelKey: 'importCsv.presets.custom', columns: {} };

export const csvPresets: readonly CsvPreset[] = [GOODREADS_PRESET, MYSHELF_PRESET, CUSTOM_PRESET];

const key = (header: string) => header.replace(/^﻿/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Header words other spreadsheets use, for guessing a mapping. */
const SYNONYMS: [RegExp, ImportField][] = [
  [/^(book )?title$|^name$/, 'title'],
  [/^subtitle$/, 'subtitle'],
  [/^(authors?|writers?|by|author s)$/, 'authors'],
  [/^additional authors$/, 'additionalAuthors'],
  [/^isbn ?13$|^ean$/, 'isbn13'],
  [/^isbn ?10$/, 'isbn10'],
  [/^isbn$/, 'isbn'],
  [/^publisher$/, 'publisher'],
  [/^(year|year published|publication year|published|pub year)$/, 'year'],
  [/^original publication year$/, 'originalYear'],
  [/^(pages|page count|number of pages)$/, 'pages'],
  [/^(format|binding)$/, 'format'],
  [/^language$/, 'language'],
  [/^(genres?|categories|category|subjects?)$/, 'genres'],
  [/^series$/, 'series'],
  [/^(series (position|number|no|index)|volume|number in series)$/, 'seriesPosition'],
  [/^(groups?|collections?|tags?)$/, 'groups'],
  [/^(bookshelves|shelves)$/, 'shelves'],
  [/^exclusive shelf$/, 'exclusiveShelf'],
  [/^(my )?(rating|stars|score)$/, 'rating'],
  [/^(notes?|comments?|my review|review)$/, 'notes'],
  [/^private notes$/, 'privateNotes'],
  [/^(date added|added|created)$/, 'added'],
];

/** A best guess for one header in an unknown spreadsheet. */
export function guessField(header: string): ImportField {
  const k = key(header);
  for (const [re, field] of SYNONYMS) if (re.test(k)) return field;
  return 'ignore';
}

/** Which preset a header row looks like: Goodreads' distinctive columns, MyShelf's own, or neither. */
export function detectPreset(headers: readonly string[]): PresetId {
  const set = new Set(headers.map((h) => h.replace(/^﻿/, '').trim()));
  if (['Book Id', 'Title', 'Author', 'Exclusive Shelf'].every((h) => set.has(h))) return 'goodreads';
  const mine = Object.values(MYSHELF_CSV_COLUMNS);
  if ([MYSHELF_CSV_COLUMNS.title, MYSHELF_CSV_COLUMNS.authors, MYSHELF_CSV_COLUMNS.isbn13].every((h) => set.has(h)) && headers.every((h) => mine.includes(h.trim() as never))) {
    return 'myshelf';
  }
  return 'custom';
}

export function presetById(id: PresetId): CsvPreset {
  return csvPresets.find((p) => p.id === id)!;
}

/**
 * One field per column for a preset. Known headers take the preset's field,
 * the rest are guessed (custom) or ignored. A field already taken by an
 * earlier column is not given to a second one.
 */
export function mappingFor(headers: readonly string[], preset: PresetId): ImportField[] {
  const table = presetById(preset).columns;
  const taken = new Set<ImportField>();
  return headers.map((h) => {
    const clean = h.replace(/^﻿/, '').trim();
    const field = clean in table ? table[clean] : preset === 'custom' ? guessField(clean) : 'ignore';
    if (field === 'ignore' || taken.has(field)) return 'ignore';
    taken.add(field);
    return field;
  });
}
