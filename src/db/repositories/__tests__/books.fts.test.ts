/**
 * @jest-environment node
 */
import { authorsRepo, backupRepo, booksRepo, genresRepo, migrate, migrations, seriesRepo, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { noFilters } from '@/domain';
import { createFtsTestDb, createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { oneKey } from '@/testing/sorts';

interface Seed {
  title: string;
  subtitle?: string;
  authors?: string[];
  genres?: string[];
  series?: string;
  notes?: string;
  isbn13?: string;
  year?: number;
  format?: 'paperback' | 'hardcover';
}

const BOOKS: Seed[] = [
  { title: 'Cien años de soledad', authors: ['Gabriel García Márquez'], genres: ['Fiction'], isbn13: '9780060883287', year: 1967, format: 'paperback' },
  { title: 'El amor en los tiempos del cólera', authors: ['Gabriel García Márquez'], genres: ['Romance'], year: 1985, format: 'hardcover' },
  { title: 'The Colour of Magic', authors: ['Terry Pratchett'], genres: ['Fantasy'], series: 'Discworld', isbn13: '9780552166591', year: 1983, format: 'paperback' },
  { title: 'Mort', authors: ['Terry Pratchett'], genres: ['Fantasy', 'Humour'], series: 'Discworld', year: 1987, format: 'hardcover', notes: 'Signed at a Discworld convention' },
  { title: 'Good Omens', subtitle: 'The Nice and Accurate Prophecies of Agnes Nutter, Witch', authors: ['Terry Pratchett', 'Neil Gaiman'], genres: ['Fantasy'], year: 1990, format: 'paperback' },
  { title: 'Die Blechtrommel', authors: ['Günter Grass'], genres: ['Fiction'], year: 1959, format: 'hardcover', notes: 'Geschenk von Oma' },
  { title: 'The Hobbit', authors: ['J. R. R. Tolkien'], genres: ['Fantasy'], year: 1937, format: 'hardcover', notes: 'Water damage on the back cover' },
];

async function seed(db: Db, books: Seed[] = BOOKS): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const b of books) {
    const series = b.series ? await seriesRepo.findOrCreateSeries(db, b.series) : null;
    const book = await booksRepo.createBook(db, {
      title: b.title,
      subtitle: b.subtitle ?? null,
      notes: b.notes ?? null,
      isbn13: b.isbn13 ?? null,
      publicationYear: b.year ?? null,
      format: b.format ?? null,
      seriesId: series?.id ?? null,
      source: 'manual',
    });
    ids.set(b.title, book.id);
    const authors = [];
    for (const name of b.authors ?? []) authors.push({ authorId: (await authorsRepo.findOrCreateAuthor(db, name)).id, role: 'author' as const });
    if (authors.length) await authorsRepo.setBookAuthors(db, book.id, authors);
    const genres = [];
    for (const name of b.genres ?? []) genres.push((await genresRepo.findOrCreateGenre(db, name)).id);
    if (genres.length) await genresRepo.setBookGenres(db, book.id, genres);
  }
  return ids;
}

const search = async (db: Db, query: string, options: booksRepo.ListBookItemsOptions = {}) =>
  (await booksRepo.listBookItems(db, { ...options, query })).map((b) => b.title);

describe('searchTerms and searchGlob', () => {
  it('splits a search into accent-free, lower-case words', () => {
    expect(booksRepo.searchTerms('  Cien AÑOS de  soledad! ')).toEqual(['cien', 'anos', 'de', 'soledad']);
    expect(booksRepo.searchTerms("O'Brien & Co.")).toEqual(['o', 'brien', 'co']);
    expect(booksRepo.searchTerms('?!')).toEqual([]);
    expect(booksRepo.searchTerms('a b c d e f g h i j')).toHaveLength(8);
  });

  it('builds GLOB patterns for the start of a word that ignore case and accents', () => {
    const glob = booksRepo.searchGlob('anos');
    expect(glob.startsWith('* [') && glob.endsWith(']*')).toBe(true);
    // The plain index is stored in lower case (ASCII), so only accented capitals need listing.
    for (const letter of ['a', 'á', 'Å', 'ā']) expect(glob.includes(letter)).toBe(true);
    expect(glob.includes('A')).toBe(false);
    expect(glob).toContain('ñ');
    expect(booksRepo.searchGlob('42')).toBe('* 42*');
    expect(booksRepo.searchGlob('я')).toBe('* [яЯ]*');
  });
});

describe.each([
  ['FTS5 (Android)', 'fts5', createFtsTestDb],
  ['plain index (web, Node)', 'plain', createTestDb],
] as const)('full-text search with %s', (_name, kind, open) => {
  let db: Db;
  let ids: Map<string, number>;
  beforeEach(async () => {
    db = await open();
    ids = await seed(db);
  });
  afterEach(() => db.close());

  it(`uses the ${kind} index`, async () => {
    expect(await booksRepo.searchIndexKind(db)).toBe(kind);
  });

  it('matches word prefixes in any field, in any order', async () => {
    expect(await search(db, 'prat')).toEqual(['The Colour of Magic', 'Good Omens', 'Mort']);
    expect(await search(db, 'disc')).toEqual(['The Colour of Magic', 'Mort']);
    expect(await search(db, 'humour')).toEqual(['Mort']);
    expect(await search(db, 'prophecies agnes')).toEqual(['Good Omens']);
    expect(await search(db, 'gaiman omens')).toEqual(['Good Omens']);
    expect(await search(db, 'water damage')).toEqual(['The Hobbit']);
    expect(await search(db, 'pratchett tolkien')).toEqual([]);
  });

  it('ignores accents and case both ways', async () => {
    expect(await search(db, 'cien anos')).toEqual(['Cien años de soledad']);
    expect(await search(db, 'CIEN AÑOS')).toEqual(['Cien años de soledad']);
    expect(await search(db, 'garcia marquez')).toEqual(['Cien años de soledad', 'El amor en los tiempos del cólera']);
    expect(await search(db, 'colera')).toEqual(['El amor en los tiempos del cólera']);
    expect(await search(db, 'gunter')).toEqual(['Die Blechtrommel']);
    expect(await search(db, 'Günter grass')).toEqual(['Die Blechtrommel']);
    // An accent typed where the book has none (an all-ASCII row) is ignored too.
    expect(await search(db, 'HÓBBIT')).toEqual(['The Hobbit']);
  });

  it('finds letters that have no accent to drop (ø, ł, đ, ß, æ, œ, þ) typed as they are written', async () => {
    const titles = ['Søren Kierkegaard', 'Łódź nocą', 'Đuro Daničić', 'Straße der Besten', 'Ælfric’s Colloquy', 'Œuvres complètes', 'Þórr og Loki'];
    for (const title of titles) await booksRepo.createBook(db, { title });
    for (const [query, title] of [
      ['Søren', 'Søren Kierkegaard'],
      ['søren kier', 'Søren Kierkegaard'],
      ['Łódź', 'Łódź nocą'],
      ['łodz', 'Łódź nocą'],
      ['đuro', 'Đuro Daničić'],
      ['straße', 'Straße der Besten'],
      ['STRAßE', 'Straße der Besten'],
      ['ælfric', 'Ælfric’s Colloquy'],
      ['œuvres', 'Œuvres complètes'],
      ['Þórr', 'Þórr og Loki'],
      ['þorr loki', 'Þórr og Loki'],
    ]) {
      expect({ query, found: await search(db, query) }).toEqual({ query, found: [title] });
    }
  });

  it('finds those letters from the plain letters people type for them (soren, lodz, strasse, aelfric)', async () => {
    const titles = ['Søren Kierkegaard', 'Łódź nocą', 'Đuro Daničić', 'Straße der Besten', 'Ælfric’s Colloquy', 'Œuvres complètes', 'Þórr og Loki', 'Ðóra'];
    for (const title of titles) await booksRepo.createBook(db, { title });
    const author = await authorsRepo.findOrCreateAuthor(db, 'Jørgen Møller');
    await authorsRepo.setBookAuthors(db, ids.get('Mort')!, [{ authorId: author.id, role: 'author' }]);
    for (const [query, title] of [
      ['soren', 'Søren Kierkegaard'],
      ['SOREN kierkegaard', 'Søren Kierkegaard'],
      ['lodz', 'Łódź nocą'],
      ['lodz noca', 'Łódź nocą'],
      ['duro danicic', 'Đuro Daničić'],
      ['strasse', 'Straße der Besten'],
      ['aelfric', 'Ælfric’s Colloquy'],
      ['oeuvres', 'Œuvres complètes'],
      ['thorr', 'Þórr og Loki'],
      ['dora', 'Ðóra'],
      ['moller', 'Mort'],
      ['jorgen moll', 'Mort'],
    ]) {
      expect({ query, found: await search(db, query) }).toEqual({ query, found: [title] });
    }
    // Renaming the author keeps the index in step.
    await authorsRepo.updateAuthor(db, author.id, { name: 'Bjørn Ødegård' });
    expect(await search(db, 'odegard')).toEqual(['Mort']);
    expect(await search(db, 'moller')).toEqual([]);
  });

  it('puts books with the number in their title above books that only have it in their ISBN', async () => {
    await booksRepo.createBook(db, { title: '1984', isbn13: '9780451524935' });
    await booksRepo.createBook(db, { title: 'Zebra Crossings', isbn13: '9781984801258' });
    await booksRepo.createBook(db, { title: 'Apple 1984 Edition' });
    await booksRepo.createBook(db, { title: 'Yonder', isbn10: '1984801252' });
    // By title, Z to A: the ISBN-only matches would come first without the ranking.
    expect(await search(db, '1984', { sort: oneKey('title', 'desc') })).toEqual(['Apple 1984 Edition', '1984', 'Zebra Crossings', 'Yonder']);
    expect(await search(db, '1984', { sort: oneKey('title', 'asc') })).toEqual(['1984', 'Apple 1984 Edition', 'Yonder', 'Zebra Crossings']);
    // A word search is ordered by the sort alone.
    expect(await search(db, 'zebra yonder')).toEqual([]);
  });

  it('finds ISBNs typed with or without hyphens, and parts of them', async () => {
    expect(await search(db, '9780552166591')).toEqual(['The Colour of Magic']);
    expect(await search(db, '978-0-552')).toEqual(['The Colour of Magic']);
    // A run of digits inside an ISBN-13 matches it too (the ISBN-10 of this edition is not stored).
    expect(await search(db, '0060883287')).toEqual(['Cien años de soledad']);
    expect(await search(db, '166591')).toEqual(['The Colour of Magic']);
  });

  it('keeps filters and sorting exactly as without a search', async () => {
    const options: booksRepo.ListBookItemsOptions = { sort: oneKey('year', 'desc'), filters: { ...noFilters, formats: ['hardcover'] } };
    expect(await search(db, 'fantasy', options)).toEqual(['Mort', 'The Hobbit']);
    const everything = await search(db, '', options);
    expect(everything).toEqual(['Mort', 'El amor en los tiempos del cólera', 'Die Blechtrommel', 'The Hobbit']);
    const fantasy = new Set(await search(db, 'fantasy'));
    expect(everything.filter((t) => fantasy.has(t))).toEqual(await search(db, 'fantasy', options));
    expect(await search(db, 'marquez', { scope: { genreId: (await genresRepo.findGenreByName(db, 'Romance'))!.id } })).toEqual(['El amor en los tiempos del cólera']);
  });

  it('follows every change to a book, its authors, genres and series', async () => {
    const mort = ids.get('Mort')!;
    await booksRepo.updateBook(db, mort, { title: 'Mortimer', notes: null });
    expect(await search(db, 'mortimer')).toEqual(['Mortimer']);
    expect(await search(db, 'convention')).toEqual([]);

    const pratchett = (await authorsRepo.findAuthorByName(db, 'Terry Pratchett'))!;
    await authorsRepo.updateAuthor(db, pratchett.id, { name: 'Sir Terry Pratchett' });
    expect(await search(db, 'sir terry')).toEqual(['The Colour of Magic', 'Good Omens', 'Mortimer']);

    const humour = (await genresRepo.findGenreByName(db, 'Humour'))!;
    await genresRepo.renameGenre(db, humour.id, 'Comedy');
    expect(await search(db, 'comedy')).toEqual(['Mortimer']);
    await genresRepo.removeBookGenre(db, mort, humour.id);
    expect(await search(db, 'comedy')).toEqual([]);

    const discworld = (await seriesRepo.findSeriesByName(db, 'Discworld'))!;
    await db.run('UPDATE series SET name = ? WHERE id = ?', ['Disc World', discworld.id]);
    expect(await search(db, 'disc world')).toEqual(['The Colour of Magic', 'Mortimer']);
    await db.run('DELETE FROM series WHERE id = ?', [discworld.id]);
    expect(await search(db, 'disc world')).toEqual([]);

    await authorsRepo.setBookAuthors(db, mort, [{ authorId: (await authorsRepo.findOrCreateAuthor(db, 'Neil Gaiman')).id, role: 'author' }]);
    expect(await search(db, 'gaiman')).toEqual(['Good Omens', 'Mortimer']);

    await booksRepo.deleteBook(db, ids.get('Good Omens')!);
    expect(await search(db, 'omens')).toEqual([]);
    expect(await search(db, 'gaiman')).toEqual(['Mortimer']);
  });

  it('is rebuilt when a backup replaces the library, and emptied by an erase', async () => {
    const tables = await backupRepo.dumpTables(db);
    await db.run('DELETE FROM books');
    expect(await search(db, 'prat')).toEqual([]);
    await db.transaction((tx) => backupRepo.replaceAllTables(tx, tables));
    expect(await search(db, 'prat')).toEqual(['The Colour of Magic', 'Good Omens', 'Mort']);
    expect(await search(db, 'geschenk oma')).toEqual(['Die Blechtrommel']);
  });

  it('keeps one search row per book', async () => {
    const table = kind === 'fts5' ? 'books_fts' : 'books_search';
    expect((await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n).toBe(BOOKS.length);
  });
});

describe('FTS5 and the plain index agree', () => {
  let fts: Db;
  let plain: Db;
  beforeAll(async () => {
    fts = await createFtsTestDb();
    plain = await createTestDb();
    await loadFixture(fts, 'large');
    await loadFixture(plain, 'large');
    await seed(fts);
    await seed(plain);
  }, 60_000);
  afterAll(async () => {
    await fts.close();
    await plain.close();
  });

  it.each(['silent', 'garden 12', 'hugo castell', 'saga 3', 'mystery', 'the', 'fair', 'cien anos', 'pratch', 'j r r', '9780552', 'lantern 1', 'nothing like this'])(
    '%s: the same books in the same order',
    async (query) => {
      const a = await search(fts, query, { sort: oneKey('author') });
      expect(a).toEqual(await search(plain, query, { sort: oneKey('author') }));
    },
  );

  it('both match only the start of words, also after punctuation', async () => {
    for (const db of [fts, plain]) {
      expect(await search(db, 'chett')).toEqual([]);
      expect(await search(db, 'weather')).toEqual([]);
      expect(await search(db, 'witch')).toEqual(['Good Omens']);
      expect(await search(db, 'nutter')).toEqual(['Good Omens']);
    }
  });
});

// Every migration but the search index: the books table has today's columns (the repository reads them all).
const withoutSearchIndex = migrations.filter((m) => m.version !== 6);

describe('a database from before migration 0006', () => {
  it('still searches, with LIKE over titles, series and authors', async () => {
    const db = await openNodeDatabase();
    await migrate(db, withoutSearchIndex);
    await seed(db);
    expect(await booksRepo.searchIndexKind(db)).toBeNull();
    expect(await search(db, 'pratchett')).toEqual(['The Colour of Magic', 'Good Omens', 'Mort']);
    expect(await search(db, 'discworld')).toEqual(['The Colour of Magic', 'Mort']);
    await db.close();
  });

  it('gets the index, filled from the existing books, when it migrates', async () => {
    const db = await openNodeDatabase();
    await migrate(db, withoutSearchIndex);
    await seed(db);
    await migrate(db);
    expect(await booksRepo.searchIndexKind(db)).toBe('plain');
    expect(await search(db, 'cien anos')).toEqual(['Cien años de soledad']);
    await db.close();
  });
});
