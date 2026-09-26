/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, genresRepo, libraryRepo, type Db } from '@/db';
import { draftFromDetail, emptyDraft, validateBookDraft, type BookDraft, type ValidBookDraft } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

function valid(patch: Partial<BookDraft>): ValidBookDraft {
  const r = validateBookDraft({ ...emptyDraft(), ...patch }, { currentYear: 2026 });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

const everything: Partial<BookDraft> = {
  title: 'Good Omens',
  subtitle: 'The Nice and Accurate Prophecies of Agnes Nutter, Witch',
  authors: [
    { name: 'Terry Pratchett', role: 'author', sortName: null },
    { name: 'Neil Gaiman', role: 'author', sortName: null },
  ],
  isbn: '0-575-04800-X',
  publisher: 'Gollancz',
  year: '1990',
  edition: 'First edition',
  format: 'hardcover',
  pages: '288',
  language: 'en',
  genres: ['Fantasy', 'Humour'],
  seriesName: 'Standalones',
  seriesPosition: '2.5',
  summary: 'The world ends next Saturday.',
  notes: 'Slightly foxed.',
};

describe('saveBookDraft', () => {
  it('creates a manual book with every field, its authors, genres and series, and round-trips through the form', async () => {
    const id = await booksRepo.saveBookDraft(db, valid(everything));
    const detail = (await booksRepo.getBookDetail(db, id))!;
    expect(detail).toMatchObject({
      title: 'Good Omens',
      isbn13: '9780575048003',
      isbn10: '057504800X',
      publisher: 'Gollancz',
      publicationYear: 1990,
      edition: 'First edition',
      format: 'hardcover',
      pageCount: 288,
      language: 'en',
      seriesPosition: 2.5,
      summary: 'The world ends next Saturday.',
      notes: 'Slightly foxed.',
      source: 'manual',
    });
    expect(detail.series?.name).toBe('Standalones');
    expect(detail.authors.map((a) => [a.name, a.sortName, a.position])).toEqual([
      ['Terry Pratchett', 'Pratchett, Terry', 0],
      ['Neil Gaiman', 'Gaiman, Neil', 1],
    ]);
    expect(detail.genres.map((g) => [g.name, g.userEdited])).toEqual([
      ['Fantasy', true],
      ['Humour', true],
    ]);
    // Form -> save -> form gives back what was typed (ISBN in its 13-digit form).
    expect(draftFromDetail(detail)).toEqual({ ...emptyDraft(), ...everything, isbn: '9780575048003', authors: detail.authors.map((a) => ({ name: a.name, role: a.role, sortName: a.sortName })) });
  });

  it('edits every field in place, keeping the id and source', async () => {
    const id = await booksRepo.saveBookDraft(db, valid(everything));
    await booksRepo.updateBook(db, id, { source: 'openlibrary' });
    await booksRepo.saveBookDraft(
      db,
      valid({
        title: 'Good Omens (revised)',
        authors: [{ name: 'Neil Gaiman', role: 'author', sortName: null }],
        year: '2006',
        genres: ['Comedy'],
        format: 'paperback',
      }),
      id,
    );
    const d = (await booksRepo.getBookDetail(db, id))!;
    expect(d).toMatchObject({ id, title: 'Good Omens (revised)', publicationYear: 2006, format: 'paperback', subtitle: null, isbn13: null, notes: null, seriesId: null, source: 'openlibrary' });
    expect(d.authors.map((a) => a.name)).toEqual(['Neil Gaiman']);
    expect(d.genres.map((g) => g.name)).toEqual(['Comedy']);
    // Pratchett credited nothing else, so the orphan is gone.
    expect(await authorsRepo.findAuthorByName(db, 'Terry Pratchett')).toBeNull();
    // Removed genres stay as rows (managed in P06-02).
    expect((await genresRepo.listGenres(db)).map((g) => g.name)).toEqual(['Comedy', 'Fantasy', 'Humour']);
  });

  it('reuses existing authors and genres case-insensitively', async () => {
    await booksRepo.saveBookDraft(db, valid({ title: 'Mort', authors: [{ name: 'Terry Pratchett', role: 'author', sortName: null }], genres: ['Fantasy'] }));
    await booksRepo.saveBookDraft(db, valid({ title: 'Guards! Guards!', authors: [{ name: 'terry pratchett', role: 'author', sortName: null }], genres: ['FANTASY'] }));
    const counts = await libraryRepo.countRows(db);
    expect(counts.authors).toBe(1);
    expect(counts.genres).toBe(1);
  });

  it('stores a typed sort name on the author', async () => {
    const id = await booksRepo.saveBookDraft(
      db,
      valid({ title: 'Tehanu', authors: [{ name: 'Ursula K. Le Guin', role: 'author', sortName: 'LeGuin, Ursula' }] }),
    );
    expect((await booksRepo.getBookDetail(db, id))!.authors[0].sortName).toBe('LeGuin, Ursula');
  });

  it('keeps roles and credited order', async () => {
    const id = await booksRepo.saveBookDraft(
      db,
      valid({
        title: 'The BFG',
        authors: [
          { name: 'Quentin Blake', role: 'illustrator', sortName: null },
          { name: 'Roald Dahl', role: 'author', sortName: null },
        ],
      }),
    );
    expect((await booksRepo.getBookDetail(db, id))!.authors.map((a) => `${a.position}:${a.name}:${a.role}`)).toEqual([
      '0:Quentin Blake:illustrator',
      '1:Roald Dahl:author',
    ]);
  });

  it('is all or nothing, and refuses a book that no longer exists', async () => {
    await expect(booksRepo.saveBookDraft(db, valid({ title: 'Ghost' }), 999)).rejects.toThrow(/no longer exists/);
    expect(await booksRepo.countBooks(db)).toBe(0);
    // A blank genre name breaks the genres CHECK after the book and author rows were written.
    await expect(
      booksRepo.saveBookDraft(db, { ...valid({ title: 'Half saved', authors: [{ name: 'A. Writer', role: 'author', sortName: null }] }), genres: [' '] }),
    ).rejects.toThrow();
    expect(await libraryRepo.countRows(db)).toMatchObject({ books: 0, authors: 0, book_authors: 0 });
  });
});
