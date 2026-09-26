/**
 * @jest-environment node
 */
import { booksRepo, genresRepo, type Db } from '@/db';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

describe('genres', () => {
  it('are de-duplicated case-insensitively, keeping the first spelling', async () => {
    const a = await genresRepo.findOrCreateGenre(db, 'Science Fiction');
    const b = await genresRepo.findOrCreateGenre(db, 'science fiction');
    const c = await genresRepo.findOrCreateGenre(db, '  SCIENCE FICTION ');
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
    expect((await genresRepo.listGenres(db)).map((g) => g.name)).toEqual(['Science Fiction']);
  });

  it('marks the user’s choices as user-edited', async () => {
    const book = await booksRepo.createBook(db, { title: 'Dune' });
    const g = await genresRepo.findOrCreateGenre(db, 'Science Fiction');
    await genresRepo.setBookGenres(db, book.id, [g.id], { userEdited: true });
    expect(await genresRepo.listGenresForBook(db, book.id)).toEqual([{ id: g.id, name: 'Science Fiction', userEdited: true }]);
  });

  it('stay when removed from their last book (genres are managed separately)', async () => {
    const book = await booksRepo.createBook(db, { title: 'Dune' });
    const g = await genresRepo.findOrCreateGenre(db, 'Science Fiction');
    await genresRepo.setBookGenres(db, book.id, [g.id], { userEdited: true });
    await genresRepo.setBookGenres(db, book.id, [], { userEdited: true });
    expect(await genresRepo.listGenresForBook(db, book.id)).toEqual([]);
    expect(await genresRepo.getGenre(db, g.id)).toEqual({ id: g.id, name: 'Science Fiction' });
    await booksRepo.deleteBook(db, book.id);
    expect(await genresRepo.getGenre(db, g.id)).not.toBeNull();
  });
});
