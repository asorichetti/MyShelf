/**
 * @jest-environment node
 */
import { booksRepo, genresRepo, GenreNameTakenError, type Db } from '@/db';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const genre = async (name: string) => (await genresRepo.findGenreByName(db, name))!;
const links = () => db.all<{ book_id: number; genre_id: number; user_edited: number }>('SELECT * FROM book_genres ORDER BY book_id, genre_id');

describe('genre management', () => {
  it('lists genres A-Z with counts, unused ones included', async () => {
    await genresRepo.createGenre(db, 'Poetry');
    expect((await genresRepo.listGenresWithCounts(db)).map((g) => [g.name, g.count])).toEqual([
      ['Classics', 2],
      ['Fantasy', 6],
      ['Mystery', 3],
      ['Poetry', 0],
      ['Science Fiction', 2],
    ]);
  });

  it('renames a genre, and allows a change of case alone', async () => {
    const sf = await genre('Science Fiction');
    expect(await genresRepo.renameGenre(db, sf.id, ' SF ')).toEqual({ id: sf.id, name: 'SF' });
    expect(await genresRepo.renameGenre(db, sf.id, 'sf')).toEqual({ id: sf.id, name: 'sf' });
  });

  it('refuses a name another genre has (ignoring case), naming that genre so a merge can be offered', async () => {
    const classics = await genre('Classics');
    const mystery = await genre('Mystery');
    const error = await genresRepo.renameGenre(db, classics.id, 'mystery').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GenreNameTakenError);
    expect((error as GenreNameTakenError).existing).toEqual(mystery);
    expect(await genresRepo.getGenre(db, classics.id)).toEqual(classics);
  });

  it('rejects a blank name', async () => {
    await expect(genresRepo.renameGenre(db, (await genre('Mystery')).id, '  ')).rejects.toThrow(RangeError);
  });

  it('merges in one transaction without duplicate links, keeping user_edited if either link had it', async () => {
    const classics = await genre('Classics');
    const mystery = await genre('Mystery');
    const [hound] = await booksRepo.findBooksByIsbn(db, '9780141034324');
    // Hound is in both; mark its Classics link as the user's choice.
    await genresRepo.addBookGenre(db, hound.id, classics.id, { userEdited: true });
    const spy = jest.spyOn(db, 'transaction');

    const merged = await genresRepo.mergeGenres(db, classics.id, mystery.id);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(merged).toEqual({ ...mystery, count: 4 });
    expect(await genresRepo.getGenre(db, classics.id)).toBeNull();
    const all = await links();
    const pairs = all.map((l) => `${l.book_id}:${l.genre_id}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(all.find((l) => l.book_id === hound.id && l.genre_id === mystery.id)?.user_edited).toBe(1);
    expect((await genresRepo.listGenresWithCounts(db)).map((g) => [g.name, g.count])).toEqual([
      ['Fantasy', 6],
      ['Mystery', 4],
      ['Science Fiction', 2],
    ]);
  });

  it('does nothing when merging a genre into itself or a missing one', async () => {
    const mystery = await genre('Mystery');
    expect(await genresRepo.mergeGenres(db, mystery.id, mystery.id)).toBeNull();
    expect(await genresRepo.mergeGenres(db, mystery.id, 9999)).toBeNull();
    expect(await genresRepo.getGenre(db, mystery.id)).toEqual(mystery);
  });

  it('deletes a genre by removing its links only', async () => {
    const before = await booksRepo.countBooks(db);
    const sf = await genre('Science Fiction');
    expect(await genresRepo.deleteGenre(db, sf.id)).toBe(true);
    expect(await booksRepo.countBooks(db)).toBe(before);
    expect((await links()).some((l) => l.genre_id === sf.id)).toBe(false);
  });
});
