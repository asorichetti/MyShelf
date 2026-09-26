/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, type Db } from '@/db';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const names = async (prefix: string) => (await authorsRepo.searchAuthors(db, prefix)).map((a) => a.name);

describe('searchAuthors', () => {
  it('matches the start of the name or of any word, ignoring case', async () => {
    expect(await names('prat')).toEqual(['Terry Pratchett']);
    expect(await names('TER')).toEqual(['Terry Pratchett']);
    expect(await names('le')).toEqual(['Ursula K. Le Guin']);
    expect(await names('a')).toEqual(['Agatha Christie', 'Arthur Conan Doyle', 'Jane Austen']);
  });

  it('ranks names that start with the prefix first and respects the limit', async () => {
    expect((await authorsRepo.searchAuthors(db, 'a', 1)).map((a) => a.name)).toEqual(['Agatha Christie']);
  });

  it('returns nothing for blanks and treats wildcards literally', async () => {
    expect(await names('  ')).toEqual([]);
    expect(await names('%')).toEqual([]);
    expect(await names('_')).toEqual([]);
  });
});

describe('author rows', () => {
  it('reuse one row for the same name in any case', async () => {
    const a = await authorsRepo.findOrCreateAuthor(db, 'TERRY PRATCHETT');
    expect(a.name).toBe('Terry Pratchett');
  });

  it('are deleted once their last book is gone', async () => {
    const [dune] = await booksRepo.findBooksByIsbn(db, '9780441172719');
    await booksRepo.deleteBook(db, dune.id);
    expect(await authorsRepo.deleteOrphanAuthors(db)).toBe(1);
    expect(await authorsRepo.findAuthorByName(db, 'Frank Herbert')).toBeNull();
    // Authors with other books stay.
    expect(await authorsRepo.deleteOrphanAuthors(db)).toBe(0);
    expect(await authorsRepo.findAuthorByName(db, 'Terry Pratchett')).not.toBeNull();
  });
});
