/**
 * @jest-environment node
 */
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { makeCandidate } from '@/services/metadata/candidate';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata } from '@/testing/fixtureMetadata';

import { authorsRepo, booksRepo, genresRepo, type Db } from '../../index';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

async function colourOfMagic() {
  const { service } = createFixtureMetadata();
  return (await service.lookupIsbn(OL_BOOKS.colourOfMagic)).candidates[0];
}

const count = async (table: string) => (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

describe('booksRepo.createBookFromCandidate', () => {
  it('creates the book, its authors and its looked-up genres once, with the source recorded', async () => {
    const candidate = await colourOfMagic();
    const id = await booksRepo.createBookFromCandidate(db, candidate);
    const book = await booksRepo.getBookDetail(db, id);
    expect(book).toMatchObject({
      title: 'The Colour of Magic',
      isbn13: '9780552166591',
      isbn10: '0552166596',
      publisher: 'Corgi Books',
      publicationYear: 1985,
      source: 'openlibrary',
      sourceId: 'OL28477029M',
      coverUri: null,
      series: null,
    });
    expect(book!.summary!.length).toBeLessThanOrEqual(600);
    expect(book!.authors.map((a) => a.name)).toEqual(['Terry Pratchett']);
    expect(book!.genres.length).toBeGreaterThan(0);
    expect(book!.genres.every((g) => !g.userEdited)).toBe(true);
    expect(book!.genres.map((g) => g.name)).toContain('Fantasy');
    expect(await count('books')).toBe(1);
    expect(await count('authors')).toBe(1);
  });

  it('reuses existing authors and genres by name', async () => {
    const pratchett = await authorsRepo.findOrCreateAuthor(db, 'terry pratchett');
    const fantasy = await genresRepo.findOrCreateGenre(db, 'Fantasy');
    const id = await booksRepo.createBookFromCandidate(db, await colourOfMagic());
    const book = await booksRepo.getBookDetail(db, id);
    expect(book!.authors[0].id).toBe(pratchett.id);
    expect(book!.genres.find((g) => g.name.toLowerCase() === 'fantasy')?.id).toBe(fantasy.id);
    expect(await count('authors')).toBe(1);
  });

  it('adds a second copy as a second row', async () => {
    const candidate = await colourOfMagic();
    const a = await booksRepo.createBookFromCandidate(db, candidate);
    const b = await booksRepo.createBookFromCandidate(db, candidate);
    expect(a).not.toBe(b);
    expect(await booksRepo.findBooksByIsbn(db, '9780552166591')).toHaveLength(2);
  });

  it('derives the ISBN-13 from an ISBN-10, drops bad values, and applies overrides', async () => {
    const id = await booksRepo.createBookFromCandidate(
      db,
      makeCandidate({ title: ' Fellowship ', source: 'googlebooks', sourceId: 'vol1', isbn10: '0345339703', language: 'english', pageCount: 0, authors: ['A', 'a'] }),
      { notes: ' signed ' },
    );
    const book = await booksRepo.getBookDetail(db, id);
    expect(book).toMatchObject({ title: 'Fellowship', isbn13: '9780345339706', isbn10: '0345339703', language: null, pageCount: null, notes: 'signed', source: 'googlebooks' });
    expect(book!.authors.map((a) => a.name)).toEqual(['A']);
  });

  it('rolls everything back when a step fails', async () => {
    const candidate = await colourOfMagic();
    const spy = jest.spyOn(genresRepo, 'setBookGenres').mockRejectedValueOnce(new Error('disk full'));
    await expect(booksRepo.createBookFromCandidate(db, candidate)).rejects.toThrow('disk full');
    spy.mockRestore();
    expect(await count('books')).toBe(0);
    expect(await count('book_authors')).toBe(0);
  });
});
