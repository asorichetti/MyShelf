/**
 * @jest-environment node
 */
import { booksRepo, type Db } from '@/db';
import { foldedLetters, foldSql, orderTerm, shuffleSql, sortKeyList, sortKeyRegistry } from '@/db/sortKeys';
import {
  callNumber,
  hashColour,
  shuffleRank,
  sortableTitle,
  sortKeyIds,
  stripDiacritics,
  type SortDirection,
  type SortKeyId,
} from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import type { Fixture } from '@/testing/fixtures';
import { loadFixture } from '@/testing/loadFixture';
import { oneKey } from '@/testing/sorts';
import { coverPalette, rainbowRanks } from '@/theme';


/**
 * A small library built to catch every way a key can go wrong: leading
 * articles, accents at the start of titles, authors, series, publishers and
 * borrowers; a series with a book 2.5 and a book 10; a co-written book; a book
 * in two genres; one in two groups; and a book with nothing known at all.
 */
const crafted: Fixture = {
  books: [
    { title: 'The Hobbit', authors: ['J. R. R. Tolkien'], genres: ['Fantasy'], publicationYear: 1937, pageCount: 310, publisher: 'Allen & Unwin', language: 'en', format: 'hardcover' },
    { title: 'Émile', authors: ['Jean-Jacques Rousseau'], genres: ['Philosophy'], publicationYear: 1762, pageCount: 500, publisher: 'Éditions Duchesne', language: 'fr', format: 'paperback' },
    { title: 'Eagle', authors: ['Carlos Ñúñez'], genres: ['Thriller'], publicationYear: 2001, pageCount: 120, publisher: 'Zebra Press', language: 'de', format: 'ebook' },
    { title: 'Ezra', authors: ['Åsa Larsson'], genres: ['Mystery'], publicationYear: 1999, pageCount: 200, publisher: 'Bonnier', language: 'sv', format: 'audiobook' },
    { title: 'An Apple a Day', authors: ['Terry Pratchett', 'Neil Gaiman'], genres: ['Mystery', 'Classics'], publicationYear: 1990, pageCount: 288, publisher: 'Gollancz', language: 'en', format: 'other' },
    { title: 'Saga Two', authors: ['Ann Leckie'], genres: ['Science Fiction'], series: { name: 'Saga', position: 2 }, publicationYear: 2014 },
    { title: 'Saga One', authors: ['Ann Leckie'], genres: ['Science Fiction'], series: { name: 'Saga', position: 1 }, publicationYear: 2013 },
    { title: 'Saga Three', authors: ['Ann Leckie'], genres: ['Science Fiction'], series: { name: 'Saga', position: 3 }, publicationYear: 2015 },
    { title: 'Saga Novella', authors: ['Ann Leckie'], genres: ['Science Fiction'], series: { name: 'Saga', position: 2.5 }, publicationYear: 2014 },
    { title: 'Saga Ten', authors: ['Ann Leckie'], genres: ['Science Fiction'], series: { name: 'Saga', position: 10 }, publicationYear: 2020 },
    { title: 'Untitled Notes' },
    { title: 'Ålborg Diaries', authors: ['Zadie Smith'], genres: ['Travel'], series: { name: 'Ångström Cycle', position: 1 } },
  ],
  loans: [
    { book: 'Eagle', borrower: 'Zed', lentDaysAgo: 3 },
    { book: 'The Hobbit', borrower: 'Ángela', lentDaysAgo: 5 },
    { book: 'Ezra', borrower: 'Bea', lentDaysAgo: 40, returnedDaysAgo: 20 },
  ],
  groups: [
    { name: 'Beach', books: ['The Hobbit', 'Ezra'] },
    { name: 'Attic', books: ['The Hobbit'] },
  ],
};

const SAGAS_BY_TITLE = ['Saga Novella', 'Saga One', 'Saga Ten', 'Saga Three', 'Saga Two'];

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await loadFixture(db, crafted);
});
afterAll(() => db.close());

const coverOrder = rainbowRanks(coverPalette);
const coverCount = coverPalette.length;
const titles = async (key: SortKeyId, direction: SortDirection = 'asc', seed?: number) =>
  (await booksRepo.listBookItems(db, { sort: { ...oneKey(key, direction), seed }, coverOrder })).map((b) => b.title);

/** The title order a library files by, in TypeScript: articles and accents ignored. */
const byTitle = (a: string, b: string) => {
  const fa = stripDiacritics(sortableTitle(a)).toLowerCase();
  const fb = stripDiacritics(sortableTitle(b)).toLowerCase();
  return fa < fb ? -1 : fa > fb ? 1 : 0;
};

describe('the key registry', () => {
  it('defines every key once, with a label, both direction names and a default direction', () => {
    expect(Object.keys(sortKeyRegistry).sort()).toEqual([...sortKeyIds].sort());
    for (const def of sortKeyList) {
      expect(def.label).toBeTruthy();
      expect(def.hint).toBeTruthy();
      expect(def.directionLabels.asc).toBeTruthy();
      expect(def.directionLabels.desc).toBeTruthy();
      expect(['asc', 'desc']).toContain(def.defaultDirection);
    }
  });

  it('puts unknown values last in both directions without evaluating the value twice', () => {
    const def = sortKeyRegistry.author;
    const ctx = { seed: 1, bind: () => '?' };
    const asc = orderTerm(def, 'asc', ctx);
    const desc = orderTerm(def, 'desc', ctx);
    // One copy of the correlated subquery per term.
    expect(asc.split('FROM book_authors').length - 1).toBe(1);
    expect(desc.split('FROM book_authors').length - 1).toBe(1);
    expect(asc).toMatch(/COALESCE\(.*x'FFFFFFFF'\) COLLATE NOCASE ASC$/s);
    expect(desc).toMatch(/ COLLATE NOCASE DESC$/);
  });

  it('folds exactly the letters stripDiacritics folds, and case', async () => {
    const letters = foldedLetters.map(([from]) => from).join('');
    const row = await db.get<{ folded: string }>(`SELECT ${foldSql('?')} AS folded`.replace(/\?/g, "'" + letters + "'"));
    expect(row!.folded.toLowerCase()).toBe(stripDiacritics(letters).toLowerCase());
    const ascii = await db.get<{ folded: string }>(`SELECT ${foldSql("'Plain ASCII'")} AS folded`);
    expect(ascii!.folded).toBe('Plain ASCII');
  });
});

describe('each key on its own', () => {
  it('title: ignores a leading The/A/An and accents ("Émile" between "Eagle" and "Ezra")', async () => {
    const asc = await titles('title');
    expect(asc).toEqual([
      'Ålborg Diaries',
      'An Apple a Day',
      'Eagle',
      'Émile',
      'Ezra',
      'The Hobbit',
      ...SAGAS_BY_TITLE,
      'Untitled Notes',
    ]);
    expect(asc).toEqual(crafted.books.map((b) => b.title).sort(byTitle));
    expect(await titles('title', 'desc')).toEqual([...asc].reverse());
  });

  it('author: the first author’s sort name, accents folded; no author last both ways', async () => {
    expect(await titles('author')).toEqual([
      'Ezra', // Larsson, Åsa
      ...SAGAS_BY_TITLE, // Leckie
      'Eagle', // Ñúñez -> Nunez
      'An Apple a Day', // Pratchett (first of two authors; not Gaiman)
      'Émile', // Rousseau
      'Ålborg Diaries', // Smith
      'The Hobbit', // Tolkien
      'Untitled Notes',
    ]);
    expect(await titles('author', 'desc')).toEqual(['The Hobbit', 'Ålborg Diaries', 'Émile', 'An Apple a Day', 'Eagle', ...SAGAS_BY_TITLE, 'Ezra', 'Untitled Notes']);
  });

  it('series: by name (Ångström before Saga), books in no series last both ways', async () => {
    const standalones = ['An Apple a Day', 'Eagle', 'Émile', 'Ezra', 'The Hobbit', 'Untitled Notes'];
    expect(await titles('series')).toEqual(['Ålborg Diaries', ...SAGAS_BY_TITLE, ...standalones]);
    expect(await titles('series', 'desc')).toEqual([...SAGAS_BY_TITLE, 'Ålborg Diaries', ...standalones]);
  });

  it('series position: numeric, so 2.5 sits between 2 and 3 and 10 comes after 3; none last both ways', async () => {
    const none = ['An Apple a Day', 'Eagle', 'Émile', 'Ezra', 'The Hobbit', 'Untitled Notes'];
    expect(await titles('seriesPosition')).toEqual(['Ålborg Diaries', 'Saga One', 'Saga Two', 'Saga Novella', 'Saga Three', 'Saga Ten', ...none]);
    expect(await titles('seriesPosition', 'desc')).toEqual(['Saga Ten', 'Saga Three', 'Saga Novella', 'Saga Two', 'Ålborg Diaries', 'Saga One', ...none]);
  });

  it('genre: a book in several genres files under the first alphabetically (Mystery + Classics -> Classics)', async () => {
    expect(await titles('genre')).toEqual([
      'An Apple a Day', // Classics
      'The Hobbit', // Fantasy
      'Ezra', // Mystery
      'Émile', // Philosophy
      ...SAGAS_BY_TITLE, // Science Fiction
      'Eagle', // Thriller
      'Ålborg Diaries', // Travel
      'Untitled Notes',
    ]);
    const desc = await titles('genre', 'desc');
    expect(desc[0]).toBe('Ålborg Diaries');
    expect(desc.at(-2)).toBe('An Apple a Day');
    expect(desc.at(-1)).toBe('Untitled Notes');
  });

  it('year: oldest first; no year last both ways', async () => {
    expect(await titles('year')).toEqual([
      'Émile',
      'The Hobbit',
      'An Apple a Day',
      'Ezra',
      'Eagle',
      'Saga One',
      'Saga Novella',
      'Saga Two',
      'Saga Three',
      'Saga Ten',
      'Ålborg Diaries',
      'Untitled Notes',
    ]);
    expect((await titles('year', 'desc')).slice(0, 2)).toEqual(['Saga Ten', 'Saga Three']);
    expect((await titles('year', 'desc')).slice(-2)).toEqual(['Ålborg Diaries', 'Untitled Notes']);
  });

  it('date added and date updated: insertion order, newest first by default', async () => {
    const order = crafted.books.map((b) => b.title);
    expect(await titles('added', 'desc')).toEqual([...order].reverse());
    expect(await titles('added', 'asc')).toEqual(order);
    await booksRepo.updateBook(db, (await booksRepo.listBooks(db)).find((b) => b.title === 'Ezra')!.id, { notes: 'touched' });
    await db.run("UPDATE books SET updated_at = '2999-01-01T00:00:00.000Z' WHERE title = 'Ezra'");
    expect((await titles('updated', 'desc'))[0]).toBe('Ezra');
    expect((await titles('updated', 'asc')).at(-1)).toBe('Ezra');
  });

  it('page count: shortest first; unknown last both ways', async () => {
    const asc = await titles('pages');
    expect(asc.slice(0, 5)).toEqual(['Eagle', 'Ezra', 'An Apple a Day', 'The Hobbit', 'Émile']);
    expect(asc.slice(5)).toEqual(['Ålborg Diaries', ...SAGAS_BY_TITLE, 'Untitled Notes']);
    expect((await titles('pages', 'desc')).slice(0, 5)).toEqual(['Émile', 'The Hobbit', 'An Apple a Day', 'Ezra', 'Eagle']);
  });

  it('publisher: accents folded ("Éditions" among the Es); none last both ways', async () => {
    const none = ['Ålborg Diaries', ...SAGAS_BY_TITLE, 'Untitled Notes'];
    expect(await titles('publisher')).toEqual(['The Hobbit', 'Ezra', 'Émile', 'An Apple a Day', 'Eagle', ...none]);
    expect(await titles('publisher', 'desc')).toEqual(['Eagle', 'An Apple a Day', 'Émile', 'Ezra', 'The Hobbit', ...none]);
  });

  it('language: by English name (English, French, German, Swedish); none last', async () => {
    const asc = await titles('language');
    expect(asc.slice(0, 5)).toEqual(['An Apple a Day', 'The Hobbit', 'Émile', 'Eagle', 'Ezra']);
    expect((await titles('language', 'desc')).slice(0, 3)).toEqual(['Ezra', 'Eagle', 'Émile']);
  });

  it('format: hardback, paperback, e-book, audiobook; "other" and none last both ways', async () => {
    const rest = ['Ålborg Diaries', 'An Apple a Day', ...SAGAS_BY_TITLE, 'Untitled Notes'];
    expect(await titles('format')).toEqual(['The Hobbit', 'Émile', 'Eagle', 'Ezra', ...rest]);
    expect(await titles('format', 'desc')).toEqual(['Ezra', 'Eagle', 'Émile', 'The Hobbit', ...rest]);
  });

  it('on loan: lent books first (a returned loan does not count), then the rest', async () => {
    const asc = await titles('onLoan');
    expect(asc.slice(0, 2)).toEqual(['Eagle', 'The Hobbit']);
    expect(asc.slice(2)).toContain('Ezra');
    expect((await titles('onLoan', 'desc')).slice(-2)).toEqual(['Eagle', 'The Hobbit']);
  });

  it('borrower: accents folded (Ángela before Zed); books at home last both ways', async () => {
    expect((await titles('borrower')).slice(0, 2)).toEqual(['The Hobbit', 'Eagle']);
    expect((await titles('borrower', 'desc')).slice(0, 2)).toEqual(['Eagle', 'The Hobbit']);
    expect((await titles('borrower', 'desc')).slice(2)).toEqual((await titles('title')).filter((t) => t !== 'Eagle' && t !== 'The Hobbit'));
  });

  it('group: the first of a book’s groups alphabetically (Attic before Beach); ungrouped last', async () => {
    expect((await titles('group')).slice(0, 2)).toEqual(['The Hobbit', 'Ezra']);
    expect((await titles('group', 'desc')).slice(0, 2)).toEqual(['Ezra', 'The Hobbit']);
    expect((await titles('group', 'desc')).at(-1)).toBe('Untitled Notes');
  });

  it('title length: shortest first, characters not bytes ("Émile" is 5)', async () => {
    const asc = await titles('titleLength');
    expect(asc.slice(0, 3)).toEqual(['Ezra', 'Eagle', 'Émile']);
    expect(asc.slice(-3)).toEqual(['Ålborg Diaries', 'An Apple a Day', 'Untitled Notes']);
    expect((await titles('titleLength', 'desc'))[0]).toBe('Ålborg Diaries');
  });

  it('spine colour: the generated binding’s place on the colour wheel, then title', async () => {
    const hue = coverOrder;
    const expected = crafted.books
      .map((b) => b.title)
      .sort((a, b) => hue[hashColour(a, coverCount)] - hue[hashColour(b, coverCount)] || byTitle(a, b));
    expect(await titles('colour')).toEqual(expected);
    const desc = crafted.books
      .map((b) => b.title)
      .sort((a, b) => hue[hashColour(b, coverCount)] - hue[hashColour(a, coverCount)] || byTitle(a, b));
    expect(await titles('colour', 'desc')).toEqual(desc);
  });

  it('call number: exactly what the book page prints, in shelf order', async () => {
    const detail = await Promise.all((await booksRepo.listBooks(db)).map((b) => booksRepo.getBookDetail(db, b.id)));
    const printed = detail.map((d) => {
      const first = d!.authors[0];
      return {
        title: d!.title,
        call: callNumber({ genres: d!.genres.map((g) => g.name), author: first ? (first.sortName ?? first.name) : null, title: d!.title, year: d!.publicationYear }),
      };
    });
    const got = await titles('callNumber');
    const calls = got.map((t) => printed.find((p) => p.title === t)!.call);
    // Class, then author mark, then year: each call number is at or after the one before it.
    for (let i = 1; i < calls.length; i++) {
      const [c0, m0, y0] = calls[i - 1].split(' ');
      const [c1, m1, y1] = calls[i].split(' ');
      expect([c0, m0].join(' ') <= [c1, m1].join(' ')).toBe(true);
      if (c0 === c1 && m0 === m1 && y0 && y1) expect(Number(y0) <= Number(y1)).toBe(true);
    }
    expect(got).toEqual([
      'Ezra', // FIC LAR 1999
      'Saga One', // FIC LEC 2013
      'Saga Novella', // FIC LEC 2014 (ties go by title)
      'Saga Two',
      'Saga Three',
      'Saga Ten', // FIC LEC 2020
      'Eagle', // FIC NUN 2001 (Ñúñez)
      'An Apple a Day', // FIC PRA 1990 (Classics, first of Mystery and Classics)
      'The Hobbit', // FIC TOL 1937
      'Untitled Notes', // GEN UNT: no genre, author or year
      'Émile', // PHI ROU 1762
      'Ålborg Diaries', // TRA SMI
    ]);
    expect(calls).toContain('GEN UNT');
    expect((await titles('callNumber', 'desc'))[0]).toBe(got.at(-1));
  });

  it("call number: weighs all of a book's genres, as the book page does (a memoir tagged Fiction is BIO)", async () => {
    const small = await createTestDb();
    try {
      await loadFixture(small, {
        books: [
          { title: 'Aardvark Tales', authors: ['Anna Aaron'], genres: ['Fiction'], publicationYear: 2020 },
          { title: "Nobody's Girl", authors: ['Virginia Roberts Giuffre'], genres: ['Memoir', 'Fiction'], publicationYear: 2025 },
          { title: 'Tudors', authors: ['Zed Zola'], genres: ['History', 'Historical Fiction'], publicationYear: 2001 },
        ],
      });
      const got = (await booksRepo.listBookItems(small, { sort: oneKey('callNumber', 'asc'), coverOrder })).map((b) => b.title);
      // BIO GIU 2025, FIC AAR 2020, FIC ZOL 2001.
      expect(got).toEqual(["Nobody's Girl", 'Aardvark Tales', 'Tudors']);
    } finally {
      await small.close();
    }
  });

  it('surprise me: the same seed gives the same order, another seed another; SQL and TypeScript agree', async () => {
    const a = await titles('shuffle', 'asc', 12345);
    expect(await titles('shuffle', 'asc', 12345)).toEqual(a);
    expect(await titles('shuffle', 'asc', 777)).not.toEqual(a);
    const ids = new Map((await booksRepo.listBooks(db)).map((b) => [b.title, b.id]));
    const expected = [...ids.keys()].sort((x, y) => shuffleRank(ids.get(x)!, 12345) - shuffleRank(ids.get(y)!, 12345));
    expect(a).toEqual(expected);
  });

  it('the shuffle hash matches its TypeScript twin across ids and seeds', async () => {
    for (const seed of [1, 99, 2 ** 29 + 17, 2 ** 30 - 1]) {
      const rows = await db.all<{ id: number; r: number }>(
        `WITH RECURSIVE n(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM n WHERE id < 500) SELECT id, ${shuffleSql(seed).replace(/b\.id/g, 'id')} AS r FROM n`,
      );
      for (const { id, r } of rows) expect(r).toBe(shuffleRank(id, seed));
    }
  });
});

describe('a book added after a computed key’s ranks were worked out', () => {
  it('still gets a place (last) rather than breaking the query', async () => {
    const tmp = await createTestDb();
    await loadFixture(tmp, crafted);
    const { id } = await booksRepo.createBook(tmp, { title: 'Zzz Late Arrival' });
    const spy = jest.spyOn(sortKeyRegistry.colour, 'rank').mockImplementation(async (d: Db) => {
      const rows = await d.all<{ id: number }>('SELECT id FROM books WHERE id <> ?', [id]);
      return new Map(rows.map((r, i) => [r.id, i % 8]));
    });
    try {
      const got = (await booksRepo.listBookItems(tmp, { sort: oneKey('colour') })).map((b) => b.title);
      expect(got.at(-1)).toBe('Zzz Late Arrival');
    } finally {
      spy.mockRestore();
      await tmp.close();
    }
  });
});

describe('queries stay bounded', () => {
  it('a four-level sort with computed keys is still two queries for the rows plus one per computed key', async () => {
    const spy = jest.spyOn(db, 'all');
    await booksRepo.listBookItems(db, { sort: { levels: [{ key: 'callNumber', direction: 'asc' }, { key: 'colour', direction: 'asc' }, { key: 'genre', direction: 'asc' }, { key: 'author', direction: 'asc' }] } });
    expect(spy).toHaveBeenCalledTimes(4);
    spy.mockRestore();
  });
});
