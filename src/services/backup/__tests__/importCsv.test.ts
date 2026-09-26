/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { authorsRepo, booksRepo, groupsRepo, seriesRepo, type Db } from '@/db';
import {
  CsvImportError,
  existingBookKeys,
  exportCsv,
  importPlannedBooks,
  mappingFor,
  parseAddedDate,
  parseFormat,
  parseImportRating,
  planImport,
  readCsvTable,
  shelfToGroupName,
  unwrapFormula,
} from '@/services/backup';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

const goodreads = readFileSync(join(__dirname, '../__fixtures__/goodreads_library_export.csv'), 'utf8');

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

function goodreadsPlan(existing?: Set<string>) {
  const table = readCsvTable(goodreads);
  return planImport(table.rows, mappingFor(table.headers, table.preset), { existing });
}

async function detailOf(title: string) {
  const [book] = (await booksRepo.searchBooks(db, title)).filter((b) => b.title === title);
  expect(book).toBeDefined();
  return (await booksRepo.getBookDetail(db, book.id))!;
}

describe('reading a Goodreads export', () => {
  it('finds 20 books and the Goodreads preset', () => {
    const table = readCsvTable(goodreads);
    expect(table.preset).toBe('goodreads');
    expect(table.delimiter).toBe(',');
    expect(table.rows).toHaveLength(20);
    const plan = goodreadsPlan();
    expect(plan.books).toHaveLength(20);
    expect(plan.skipped).toEqual([]);
  });

  it('imports all 20 with authors, series, groups, ISBNs and dates', async () => {
    const report = await importPlannedBooks(db, goodreadsPlan());
    expect(report.imported).toBe(20);
    expect(await booksRepo.countBooks(db)).toBe(20);

    // Series come out of "Title (Series, #n)", and the title loses them.
    const wind = await detailOf('The Name of the Wind');
    expect(wind.series?.name).toBe('The Kingkiller Chronicle');
    expect(wind.seriesPosition).toBe(1);
    expect(wind.isbn13).toBe('9780756404741');
    expect((await seriesRepo.listSeries(db)).map((s) => s.name).sort()).toEqual(
      ['Discworld', 'Dune', 'Harry Potter', 'Mistborn', 'Science of Discworld', 'The Expanse', 'The Kingkiller Chronicle', 'The Lord of the Rings', 'Thursday Murder Club'].sort(),
    );

    // Author plus comma-separated additional authors, in order.
    const feynman = await detailOf('"Surely You\'re Joking, Mr. Feynman!": Adventures of a Curious Character');
    expect(feynman.authors.map((a) => a.name)).toEqual(['Richard P. Feynman', 'Ralph Leighton', 'Edward Hutchings']);
    expect((await detailOf('Good Omens: The Nice and Accurate Prophecies of Agnes Nutter, Witch')).authors.map((a) => a.name)).toEqual(['Terry Pratchett', 'Neil Gaiman']);
    expect((await authorsRepo.listAuthors(db)).filter((a) => a.name === 'Terry Pratchett')).toHaveLength(1);

    // ="…" ISBNs unwrapped; an ISBN-10 alone gives the ISBN-13; an empty one stays empty.
    const dune = await detailOf('Dune');
    expect(dune).toMatchObject({ isbn13: '9780441172719', isbn10: '0441172717', format: 'paperback', publicationYear: 1990, pageCount: 896 });
    expect((await detailOf('The Colour of Magic')).isbn13).toBeNull();
    expect((await detailOf('The Colour of Magic')).format).toBe('ebook');

    // Year falls back to the original publication year; accents survive.
    expect((await detailOf("Harry Potter and the Philosopher's Stone")).publicationYear).toBe(1997);
    expect((await detailOf('Les Misérables')).authors.map((a) => a.name)).toEqual(['Victor Hugo', 'Lee Fahnestock', 'Norman MacAfee']);

    // Review HTML becomes text; private notes (with a line break) are added.
    expect((await detailOf('Good Omens: The Nice and Accurate Prophecies of Agnes Nutter, Witch')).notes).toBe(
      'Funniest book about the end of the world.\n\nCrowley and Aziraphale, forever. "Just popped out for some more," indeed.',
    );
    expect((await detailOf("Harry Potter and the Philosopher's Stone")).notes).toBe('Signed at the Edinburgh book festival.\nKeep it out of the sun!');

    // Date Added is kept as the date the book joined the shelf.
    expect((await detailOf('The Hobbit')).createdAt).toBe('2018-10-01T12:00:00.000Z');

    // Shelves became groups.
    const groups = await groupsRepo.listGroupsWithStats(db);
    const byName = Object.fromEntries(groups.map((g) => [g.name, g.count]));
    expect(byName).toEqual({ Read: 16, 'To read': 3, 'Currently reading': 1, Favourites: 4, Fantasy: 2, Classics: 4, 'Book club': 2, Mystery: 1, Signed: 1 });
    expect(report.groupsCreated).toHaveLength(9);
    expect((await detailOf('The Hobbit')).source).toBe('import');
  });

  it('brings the reader’s own ratings: My Rating 1-5 straight through, 0 as not rated', async () => {
    await importPlannedBooks(db, goodreadsPlan());
    const rated = Object.fromEntries((await booksRepo.listBooks(db)).map((b) => [b.title, b.rating]));
    expect(rated).toMatchObject({
      'The Hobbit': 5,
      '1984': 4,
      'The Science of Discworld': 3,
      'Norse Mythology': 2,
      'The Martian': 1,
      'The Name of the Wind': null,
      'Les Misérables': null,
    });
    expect(Object.values(rated).filter((r) => r != null)).toHaveLength(16);
  });

  it('can leave the shelves out', async () => {
    const table = readCsvTable(goodreads);
    await importPlannedBooks(db, planImport(table.rows, mappingFor(table.headers, 'goodreads'), { shelvesAsGroups: false }));
    expect(await groupsRepo.listGroups(db)).toEqual([]);
  });

  it('skips books already on the shelf, and the same file a second time', async () => {
    await loadFixture(db, 'demo');
    const plan = goodreadsPlan(await existingBookKeys(db));
    // Good Omens, The Left Hand of Darkness, Dune, Pride and Prejudice and The Colour of Magic are demo books
    // (Good Omens matches despite the subtitle Goodreads puts in its title).
    expect(plan.skipped.map((s) => [s.title, s.reason])).toEqual([
      ['Good Omens: The Nice and Accurate Prophecies of Agnes Nutter, Witch', 'It’s already on your shelf.'],
      ['The Left Hand of Darkness', 'It’s already on your shelf.'],
      ['Dune', 'It’s already on your shelf.'],
      ['Pride and Prejudice', 'It’s already on your shelf.'],
      ['The Colour of Magic', 'It’s already on your shelf.'],
    ]);
    await importPlannedBooks(db, plan);
    expect(await booksRepo.countBooks(db)).toBe(12 + 15);
    expect(goodreadsPlan(await existingBookKeys(db)).books).toHaveLength(0);
  });
});

describe('rows with problems', () => {
  const csv = [
    'Title,Author,ISBN13,Number of Pages,Year Published',
    'Good Book,Ann Author,9780441172719,200,2001',
    ',Nobody,,,',
    'Bad ISBN,Bea,9780441172710,n/a,sometime',
    ',,,,',
    'Good Book,Ann Author,,,',
    '"Unclosed',
  ].join('\n');

  it('reports a cut-off file clearly', () => {
    expect(() => readCsvTable(csv)).toThrow(CsvImportError);
    expect(() => readCsvTable(csv)).toThrow('never ends');
  });

  it('imports valid rows and reports invalid ones with reasons', async () => {
    const table = readCsvTable(csv.replace('\n"Unclosed', ''));
    expect(table.preset).toBe('custom');
    const plan = planImport(table.rows, mappingFor(table.headers, 'custom'));
    expect(plan.skipped).toEqual([
      { line: 3, title: null, reason: 'It has no title.' },
      { line: 5, title: null, reason: 'The row is empty.' },
      { line: 6, title: 'Good Book', reason: 'It appears twice in the file.' },
    ]);
    const bad = plan.books.find((b) => b.book.title === 'Bad ISBN')!;
    expect(bad.book).toMatchObject({ isbn13: null, pageCount: null, publicationYear: null });
    expect(bad.warnings).toEqual(['The ISBN “9780441172710” isn’t valid, so it was left out.', 'The year “sometime” wasn’t understood.', 'The page count “n/a” wasn’t understood.']);
    const report = await importPlannedBooks(db, plan);
    expect(report.imported).toBe(2);
    expect(report.skipped).toHaveLength(3);
    expect(plan.outcomes.map((o) => o.status)).toEqual(['add', 'skip', 'add', 'skip', 'skip']);
  });

  it('refuses empty files, headerless files and backups', () => {
    expect(() => readCsvTable('')).toThrow('That file is empty');
    expect(() => readCsvTable('\n\n')).toThrow('empty');
    expect(() => readCsvTable('{"format":"myshelf-backup"}')).toThrow('backup file');
  });

  it('adds nothing when the database refuses a book half-way', async () => {
    const table = readCsvTable('Title,Author\nFine,A\nAlso fine,B\n');
    const plan = planImport(table.rows, mappingFor(table.headers, 'custom'));
    plan.books[1].book.isbn13 = '123'; // breaks the length CHECK
    await expect(importPlannedBooks(db, plan)).rejects.toThrow();
    expect(await booksRepo.countBooks(db)).toBe(0);
  });
});

describe('round trip through MyShelf’s own CSV', () => {
  it('imports its own export back with the same books', async () => {
    await loadFixture(db, 'demo');
    const { text } = await exportCsv(db);
    const other = await createTestDb();
    const table = readCsvTable(text);
    expect(table.preset).toBe('myshelf');
    const report = await importPlannedBooks(other, planImport(table.rows, mappingFor(table.headers, table.preset)));
    expect(report.imported).toBe(12);
    const pick = (b: { title: string; isbn13: string | null; publicationYear: number | null; seriesPosition: number | null }) => [b.title, b.isbn13, b.publicationYear, b.seriesPosition];
    expect((await booksRepo.listBooks(other)).map(pick).sort()).toEqual((await booksRepo.listBooks(db)).map(pick).sort());
    const mort = (await booksRepo.searchBooks(other, 'Mort'))[0];
    expect((await booksRepo.getBookDetail(other, mort.id))!.series?.name).toBe('Discworld');
    const ratings = async (d: Db) => (await booksRepo.listBooks(d)).map((b) => [b.title, b.rating]).sort();
    expect(await ratings(other)).toEqual(await ratings(db));
    expect(mort.rating).toBe(5);
    await other.close();
  });
});

describe('field parsers', () => {
  it('unwraps Goodreads formulas', () => {
    expect(unwrapFormula('="9780441172719"')).toBe('9780441172719');
    expect(unwrapFormula('=""')).toBe('');
    expect(unwrapFormula('plain')).toBe('plain');
  });

  it('reads ratings: whole stars 1-5, blank or 0 for none, anything else not understood', () => {
    expect(['1', '5', ' 3 ', '4.0'].map(parseImportRating)).toEqual([1, 5, 3, 4]);
    expect(['', '0', '0.0', null].map(parseImportRating)).toEqual([null, null, null, null]);
    expect(['4.5', '6', '-1', 'great', '★★★'].map(parseImportRating)).toEqual([undefined, undefined, undefined, undefined, undefined]);
    const plan = planImport([['Dune', '4.5'], ['Emma', '2']], ['title', 'rating']);
    expect(plan.books.map((b) => [b.book.title, b.book.rating, b.warnings])).toEqual([
      ['Dune', null, ['The rating “4.5” wasn’t understood, so it was left out.']],
      ['Emma', 2, []],
    ]);
  });

  it('reads bindings, dates and shelves', () => {
    expect(parseFormat('Mass Market Paperback')).toBe('paperback');
    expect(parseFormat('Hardcover')).toBe('hardcover');
    expect(parseFormat('Kindle Edition')).toBe('ebook');
    expect(parseFormat('Audible Audio')).toBe('audiobook');
    expect(parseFormat('Leather Bound')).toBe('other');
    expect(parseAddedDate('2023/01/15')).toBe('2023-01-15T12:00:00.000Z');
    expect(parseAddedDate('2023-02-30')).toBeNull();
    expect(parseAddedDate('yesterday')).toBeNull();
    expect(shelfToGroupName('currently-reading')).toBe('Currently reading');
    expect(shelfToGroupName('book_club')).toBe('Book club');
  });
});
