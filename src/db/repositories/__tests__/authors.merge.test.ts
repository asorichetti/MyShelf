/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, type Db } from '@/db';
import { authorLetter } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

describe('authors: counts and merge', () => {
  it('lists authors A-Z by sort name with book counts', async () => {
    await loadFixture(db, 'demo');
    const list = await authorsRepo.listAuthorsWithCounts(db);
    expect(list.map((a) => [a.name, a.count])).toEqual([
      ['Jane Austen', 1],
      ['Agatha Christie', 2],
      ['Arthur Conan Doyle', 1],
      ['Neil Gaiman', 1],
      ['Frank Herbert', 1],
      ['Ursula K. Le Guin', 3],
      ['Terry Pratchett', 4],
    ]);
    expect(list.map(authorLetter)).toEqual(['A', 'C', 'D', 'G', 'H', 'L', 'P']);
  });

  it('merges a duplicate into the kept author without duplicate credits', async () => {
    const hobbit = await booksRepo.createBook(db, { title: 'The Hobbit' });
    const lotr = await booksRepo.createBook(db, { title: 'The Fellowship of the Ring' });
    const both = await booksRepo.createBook(db, { title: 'Letters' });
    const kept = await authorsRepo.createAuthor(db, 'J.R.R. Tolkien');
    const dup = await authorsRepo.createAuthor(db, 'J. R. R. Tolkien');
    const editor = await authorsRepo.createAuthor(db, 'Humphrey Carpenter');
    await authorsRepo.setBookAuthors(db, hobbit.id, [{ authorId: kept.id }]);
    await authorsRepo.setBookAuthors(db, lotr.id, [{ authorId: dup.id }]);
    await authorsRepo.setBookAuthors(db, both.id, [{ authorId: editor.id, role: 'editor' }, { authorId: dup.id }, { authorId: kept.id }]);
    const spy = jest.spyOn(db, 'transaction');

    expect(await authorsRepo.mergeAuthors(db, dup.id, kept.id)).toEqual(kept);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(await authorsRepo.getAuthor(db, dup.id)).toBeNull();
    expect((await authorsRepo.listAuthorsForBook(db, lotr.id)).map((a) => a.name)).toEqual(['J.R.R. Tolkien']);
    expect((await authorsRepo.listAuthorsForBook(db, both.id)).map((a) => [a.name, a.role])).toEqual([
      ['Humphrey Carpenter', 'editor'],
      ['J.R.R. Tolkien', 'author'],
    ]);
    const counts = await db.all<{ n: number }>('SELECT COUNT(*) AS n FROM book_authors GROUP BY book_id, author_id HAVING n > 1');
    expect(counts).toEqual([]);
    expect((await authorsRepo.listAuthorsWithCounts(db)).find((a) => a.id === kept.id)?.count).toBe(3);
  });

  it('does nothing for the same or a missing author', async () => {
    const a = await authorsRepo.createAuthor(db, 'Terry Pratchett');
    expect(await authorsRepo.mergeAuthors(db, a.id, a.id)).toBeNull();
    expect(await authorsRepo.mergeAuthors(db, a.id, 999)).toBeNull();
    expect(await authorsRepo.getAuthor(db, a.id)).not.toBeNull();
  });

  it('files authors under a letter, accents removed, "#" otherwise', () => {
    expect(authorLetter({ name: 'Émile Zola', sortName: 'Zola, Émile' })).toBe('Z');
    expect(authorLetter({ name: 'Émile Zola', sortName: null })).toBe('E');
    expect(authorLetter({ name: '50 Cent', sortName: null })).toBe('#');
  });
});
