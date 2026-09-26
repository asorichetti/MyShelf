/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, type Db } from '@/db';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

import { findDuplicates } from '../useDuplicateCheck';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

describe('findDuplicates (P03-10)', () => {
  it('finds the copy with the same ISBN-13', async () => {
    const found = await findDuplicates(db, { isbn13: '9780141439518', isbn10: null, title: 'Pride and Prejudice', authors: ['Jane Austen'] });
    expect(found.map((b) => b.title)).toEqual(['Pride and Prejudice']);
  });

  it('matches an ISBN-10 against the stored book', async () => {
    const saved = await booksRepo.createBook(db, { title: 'Fellowship', isbn10: '0345339703', isbn13: '9780345339706' });
    const found = await findDuplicates(db, { isbn13: null, isbn10: '0345339703', title: 'Anything', authors: [] });
    expect(found.map((b) => b.id)).toEqual([saved.id]);
  });

  it('without an ISBN, matches title and first author ignoring case and a leading article', async () => {
    const found = await findDuplicates(db, { isbn13: null, isbn10: null, title: 'colour of magic', authors: ['TERRY PRATCHETT'] });
    expect(found.map((b) => b.title)).toEqual(['The Colour of Magic']);
  });

  it('finds nothing for a new book, or a namesake by someone else', async () => {
    expect(await findDuplicates(db, { isbn13: '9780552166591', isbn10: null, title: 'The Colour of Magic', authors: ['Terry Pratchett'] })).toEqual([]);
    const other = await booksRepo.createBook(db, { title: 'Mort' });
    await authorsRepo.setBookAuthors(db, other.id, [{ authorId: (await authorsRepo.findOrCreateAuthor(db, 'Someone Else')).id }]);
    expect((await findDuplicates(db, { isbn13: null, isbn10: null, title: 'Mort', authors: ['Terry Pratchett'] })).map((b) => b.title)).toEqual(['Mort']);
  });

  it('lists every copy when there are several', async () => {
    await booksRepo.createBook(db, { title: 'Pride and Prejudice', isbn13: '9780141439518' });
    expect(await findDuplicates(db, { isbn13: '9780141439518', isbn10: null, title: 'x', authors: [] })).toHaveLength(2);
  });
});
