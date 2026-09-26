/**
 * @jest-environment node
 */
import { booksRepo, type Db } from '@/db';
import { sortableTitle } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { oneKey } from '@/testing/sorts';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterAll(() => db.close());

const titles = async (options: booksRepo.ListBookItemsOptions = {}) => (await booksRepo.listBookItems(db, options)).map((b) => b.title);

describe('listBookItems sorting (demo fixture)', () => {
  it('title: A-Z ignoring a leading The/A/An, and matches sortableTitle()', async () => {
    const got = await titles({ sort: oneKey('title') });
    expect(got).toEqual([
      'The Colour of Magic',
      'Dune',
      'The Farthest Shore',
      'Good Omens',
      'The Hound of the Baskervilles',
      'The Left Hand of Darkness',
      'The Light Fantastic',
      'Mort',
      'The Murder of Roger Ackroyd',
      'Murder on the Orient Express',
      'Pride and Prejudice',
      'A Wizard of Earthsea',
    ]);
    const byDomain = [...got].sort((a, b) => sortableTitle(a).localeCompare(sortableTitle(b), 'en', { sensitivity: 'base' }));
    expect(got).toEqual(byDomain);
    expect(await titles({ sort: oneKey('title', 'desc') })).toEqual([...got].reverse());
  });

  it('author: by the first author’s sort name, then title', async () => {
    const items = await booksRepo.listBookItems(db, { sort: oneKey('author') });
    expect(items.map((b) => b.authors[0])).toEqual([
      'Jane Austen',
      'Agatha Christie',
      'Agatha Christie',
      'Arthur Conan Doyle',
      'Frank Herbert',
      'Ursula K. Le Guin',
      'Ursula K. Le Guin',
      'Ursula K. Le Guin',
      'Terry Pratchett',
      'Terry Pratchett',
      'Terry Pratchett',
      'Terry Pratchett',
    ]);
    // "Murder of…" files before "Murder on…" once the leading "The" is ignored.
    expect(items.slice(1, 3).map((b) => b.title)).toEqual(['The Murder of Roger Ackroyd', 'Murder on the Orient Express']);
    const desc = await booksRepo.listBookItems(db, { sort: oneKey('author', 'desc') });
    expect(desc[0].authors[0]).toBe('Terry Pratchett');
    expect(desc[desc.length - 1].authors[0]).toBe('Jane Austen');
  });

  it('year: oldest first, newest first when descending', async () => {
    const asc = await booksRepo.listBookItems(db, { sort: oneKey('year') });
    expect(asc.map((b) => b.publicationYear)).toEqual([1813, 1902, 1926, 1934, 1965, 1968, 1969, 1972, 1983, 1986, 1987, 1990]);
    const desc = await booksRepo.listBookItems(db, { sort: oneKey('year', 'desc') });
    expect(desc[0].title).toBe('Good Omens');
  });

  it('added: in insertion order, newest first when descending', async () => {
    const desc = await titles({ sort: oneKey('added', 'desc') });
    expect(desc[0]).toBe('Pride and Prejudice');
    expect(desc[11]).toBe('The Colour of Magic');
  });

  it('books without author or year sort last in both directions', async () => {
    const tmp = await createTestDb();
    await loadFixture(tmp, 'demo');
    await booksRepo.createBook(tmp, { title: 'Anonymous Pamphlet' });
    for (const direction of ['asc', 'desc'] as const) {
      expect((await booksRepo.listBookItems(tmp, { sort: oneKey('author', direction) })).at(-1)!.title).toBe('Anonymous Pamphlet');
      expect((await booksRepo.listBookItems(tmp, { sort: oneKey('year', direction) })).at(-1)!.title).toBe('Anonymous Pamphlet');
    }
    await tmp.close();
  });

  it('pages with limit and offset', async () => {
    const all = await titles();
    expect(await titles({ limit: 5, offset: 5 })).toEqual(all.slice(5, 10));
  });
});

describe('listBookItems rows', () => {
  it('carry authors in credited order, series, cover, year and loan state', async () => {
    const items = await booksRepo.listBookItems(db);
    const omens = items.find((b) => b.title === 'Good Omens')!;
    expect(omens.authors).toEqual(['Terry Pratchett', 'Neil Gaiman']);
    expect(omens.subtitle).toMatch(/Agnes Nutter/);
    const mort = items.find((b) => b.title === 'Mort')!;
    expect(mort).toMatchObject({ seriesName: 'Discworld', seriesPosition: 4, publicationYear: 1987, onLoan: false });
    expect(mort.coverUri).toMatch(/^https:\/\/covers\.openlibrary\.org\//);
    expect(items.find((b) => b.title === 'The Farthest Shore')!.coverUri).toBeNull();
    expect(items.filter((b) => b.onLoan).map((b) => b.title).sort()).toEqual(['Dune', 'The Murder of Roger Ackroyd']);
  });

  it('are loaded with exactly two queries (no N+1)', async () => {
    const spy = jest.spyOn(db, 'all');
    await booksRepo.listBookItems(db);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe('listBookItems search', () => {
  it('matches author names case-insensitively: "prat" finds Pratchett', async () => {
    expect(await titles({ query: 'prat' })).toEqual(['The Colour of Magic', 'Good Omens', 'The Light Fantastic', 'Mort']);
    expect(await titles({ query: 'PRAT' })).toHaveLength(4);
  });

  it('matches titles, subtitles and series names', async () => {
    expect(await titles({ query: 'murder' })).toEqual(['The Murder of Roger Ackroyd', 'Murder on the Orient Express']);
    expect(await titles({ query: 'agnes' })).toEqual(['Good Omens']);
    expect(await titles({ query: 'earthsea' })).toEqual(['The Farthest Shore', 'A Wizard of Earthsea']);
  });

  it('matches ISBN-13 and ISBN-10, with or without hyphens and spaces', async () => {
    expect(await titles({ query: '978-0-441-17271-9' })).toEqual(['Dune']);
    expect(await titles({ query: '0 441 17271 7' })).toEqual(['Dune']);
    expect(await titles({ query: '057504800x' })).toEqual(['Good Omens']);
  });

  it('treats % and _ literally and returns nothing for no match', async () => {
    expect(await titles({ query: '%' })).toEqual([]);
    expect(await titles({ query: 'zzz' })).toEqual([]);
  });

  it('keeps the chosen sort while searching', async () => {
    expect(await titles({ query: 'prat', sort: oneKey('year', 'desc') })).toEqual([
      'Good Omens',
      'Mort',
      'The Light Fantastic',
      'The Colour of Magic',
    ]);
  });
});

describe('getBookDetail', () => {
  it('returns the book with ordered authors, genres, series and open loan', async () => {
    const [dune] = await booksRepo.findBooksByIsbn(db, '9780441172719');
    const d = (await booksRepo.getBookDetail(db, dune.id))!;
    expect(d.title).toBe('Dune');
    expect(d.authors.map((a) => [a.name, a.role, a.position])).toEqual([['Frank Herbert', 'author', 0]]);
    expect(d.genres.map((g) => g.name)).toEqual(['Science Fiction']);
    expect(d.series).toBeNull();
    expect(d.openLoan).toMatchObject({ borrowerName: 'Sam', returnedOn: null });

    const [omens] = await booksRepo.findBooksByIsbn(db, '9780575048003');
    expect((await booksRepo.getBookDetail(db, omens.id))!.authors.map((a) => a.name)).toEqual(['Terry Pratchett', 'Neil Gaiman']);

    const [mort] = await booksRepo.findBooksByIsbn(db, '9780552131063');
    const m = (await booksRepo.getBookDetail(db, mort.id))!;
    expect(m.series).toMatchObject({ name: 'Discworld' });
    expect(m.openLoan).toBeNull();
  });

  it('returns null for an unknown id', async () => {
    expect(await booksRepo.getBookDetail(db, 99999)).toBeNull();
  });
});
