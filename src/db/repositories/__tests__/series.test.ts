/**
 * @jest-environment node
 */
import { booksRepo, seriesRepo as repo, type Db } from '@/db';
import type { Book } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const titles = (books: Book[]) => books.map((b) => b.title);
const book = (title: string, seriesId: number | null = null, seriesPosition: number | null = null, createdAt?: string) =>
  booksRepo.createBook(db, { title, seriesId, seriesPosition }).then(async (b) => {
    if (createdAt) await db.run('UPDATE books SET created_at = ? WHERE id = ?', [createdAt, b.id]);
    return b;
  });

describe('findSeriesByName / findOrCreateSeries', () => {
  it.each([
    ['The Expanse', 'Expanse'],
    ['Expanse', 'the expanse'],
    ['Discworld', 'DISCWORLD'],
    ['Les Rougon-Macquart', 'Rougon Macquart'],
    ["Ender's Saga", 'Enders Saga'],
    ['Świat Dysku', 'swiat dysku'],
    ['Wheel of Time', '  wheel  of   time '],
  ])('"%s" and "%s" resolve to the same series', async (stored, typed) => {
    const s = await repo.createSeries(db, stored);
    expect(await repo.findSeriesByName(db, typed)).toEqual(s);
    expect(await repo.findOrCreateSeries(db, typed)).toEqual(s);
    expect(await repo.listSeries(db)).toHaveLength(1);
  });

  it('creates a new series when nothing matches', async () => {
    const a = await repo.createSeries(db, 'Discworld');
    const b = await repo.findOrCreateSeries(db, ' Earthsea ');
    expect(b.id).not.toBe(a.id);
    expect(b.name).toBe('Earthsea');
    expect(await repo.listSeries(db)).toHaveLength(2);
  });

  it('prefers the oldest of several near-duplicates', async () => {
    const first = await repo.createSeries(db, 'The Expanse');
    await repo.createSeries(db, 'Expanse');
    expect((await repo.findSeriesByName(db, 'expanse'))!.id).toBe(first.id);
  });

  it('returns null for blank or punctuation-only names', async () => {
    await repo.createSeries(db, 'Discworld');
    expect(await repo.findSeriesByName(db, '   ')).toBeNull();
    expect(await repo.findSeriesByName(db, '--')).toBeNull();
  });
});

describe('rename and total count', () => {
  it('renames, trimming, and the new name shows everywhere', async () => {
    const s = await repo.createSeries(db, 'Disc World');
    const b = await book('Mort', s.id, 4);
    expect(await repo.renameSeries(db, s.id, ' Discworld ')).toEqual({ ...s, name: 'Discworld' });
    expect((await repo.groupBooksBySeries(db))[0].key?.name).toBe('Discworld');
    expect((await booksRepo.getBook(db, b.id))!.seriesId).toBe(s.id);
    expect(await repo.renameSeries(db, 999, 'x')).toBeNull();
  });

  it('refuses a blank name', async () => {
    const s = await repo.createSeries(db, 'Discworld');
    await expect(repo.renameSeries(db, s.id, '  ')).rejects.toThrow(RangeError);
    expect((await repo.getSeries(db, s.id))!.name).toBe('Discworld');
  });

  it.each([[9], [null]])('sets total count to %p', async (total) => {
    const s = await repo.createSeries(db, 'Discworld', 41);
    expect(await repo.setSeriesTotalCount(db, s.id, total)).toEqual({ ...s, totalCount: total });
    expect((await repo.getSeries(db, s.id))!.totalCount).toBe(total);
  });

  it.each([[0], [-3], [2.5], [Number.NaN]])('rejects total count %p', async (total) => {
    const s = await repo.createSeries(db, 'Discworld');
    await expect(repo.setSeriesTotalCount(db, s.id, total)).rejects.toThrow(RangeError);
  });

  it('returns null for a missing series', async () => {
    expect(await repo.setSeriesTotalCount(db, 999, 3)).toBeNull();
  });
});

describe('mergeSeries', () => {
  it('moves books with their positions, deletes the source, keeps the target total', async () => {
    const target = await repo.createSeries(db, 'Discworld', 41);
    const source = await repo.createSeries(db, 'Disc World', 9);
    await book('The Colour of Magic', target.id, 1);
    await book('Equal Rites', source.id, 3);
    await book('Troll Bridge', source.id, 3.5);
    await book('A Discworld Companion', source.id, null);
    await book('Standalone');

    expect(await repo.mergeSeries(db, source.id, target.id)).toEqual(target);
    expect(await repo.getSeries(db, source.id)).toBeNull();
    const merged = await repo.getSeriesWithBooks(db, target.id);
    expect(merged!.series).toEqual(target);
    expect(merged!.books.map((b) => [b.title, b.seriesPosition])).toEqual([
      ['The Colour of Magic', 1],
      ['Equal Rites', 3],
      ['Troll Bridge', 3.5],
      ['A Discworld Companion', null],
    ]);
    expect((await booksRepo.listBooks(db)).find((b) => b.title === 'Standalone')!.seriesId).toBeNull();
  });

  it('takes the source total when the target has none', async () => {
    const target = await repo.createSeries(db, 'Discworld');
    const source = await repo.createSeries(db, 'Disc World', 9);
    expect(await repo.mergeSeries(db, source.id, target.id)).toEqual({ ...target, totalCount: 9 });
    expect((await repo.getSeries(db, target.id))!.totalCount).toBe(9);
  });

  it.each<[string, (a: number, b: number) => [number, number]]>([
    ['same series', (a) => [a, a]],
    ['missing source', (_, b) => [999, b]],
    ['missing target', (a) => [a, 999]],
  ])('does nothing for %s', async (_, ids) => {
    const a = await repo.createSeries(db, 'A');
    const b = await repo.createSeries(db, 'B');
    const x = await book('X', a.id, 1);
    const [src, dst] = ids(a.id, b.id);
    expect(await repo.mergeSeries(db, src, dst)).toBeNull();
    expect(await repo.listSeries(db)).toHaveLength(2);
    expect((await booksRepo.getBook(db, x.id))!.seriesId).toBe(a.id);
  });

  it('rolls back when a step fails', async () => {
    const target = await repo.createSeries(db, 'Discworld');
    const source = await repo.createSeries(db, 'Disc World');
    const b = await book('Mort', source.id, 4);
    await db.exec(`CREATE TRIGGER fail_delete BEFORE DELETE ON series BEGIN SELECT RAISE(ABORT, 'boom'); END;`);
    await expect(repo.mergeSeries(db, source.id, target.id)).rejects.toThrow(/boom/);
    expect((await booksRepo.getBook(db, b.id))!.seriesId).toBe(source.id);
    expect(await repo.getSeries(db, source.id)).not.toBeNull();
  });
});

describe('deleteSeries', () => {
  it('keeps the books, unlinked', async () => {
    const s = await repo.createSeries(db, 'Discworld');
    const b = await book('Mort', s.id, 4);
    expect(await repo.deleteSeries(db, s.id)).toBe(true);
    expect(await booksRepo.getBook(db, b.id)).toMatchObject({ title: 'Mort', seriesId: null });
    expect(await repo.deleteSeries(db, s.id)).toBe(false);
  });
});

describe('getSeriesWithBooks', () => {
  it('orders by position, unnumbered last by title', async () => {
    const s = await repo.createSeries(db, 'Discworld');
    await book('Zebra companion', s.id, null);
    await book('Mort', s.id, 4);
    await book('Apple companion', s.id, null);
    await book('Troll Bridge', s.id, 3.5);
    await book('The Colour of Magic', s.id, 1);
    const got = await repo.getSeriesWithBooks(db, s.id);
    expect(got!.series).toEqual(s);
    expect(titles(got!.books)).toEqual(['The Colour of Magic', 'Troll Bridge', 'Mort', 'Apple companion', 'Zebra companion']);
  });

  it('returns null for a missing series', async () => {
    expect(await repo.getSeriesWithBooks(db, 999)).toBeNull();
  });
});

describe('listSeriesWithStats', () => {
  it('counts owned, max position, total and missing', async () => {
    const disc = await repo.createSeries(db, 'Discworld', 9);
    const expanse = await repo.createSeries(db, 'The Expanse');
    const empty = await repo.createSeries(db, 'Earthsea');
    for (const [t, p] of [['A', 1], ['B', 2], ['C', 3], ['E', 5], ['F', 6], ['F2', 6], ['N', 2.5]] as const) await book(t, disc.id, p);
    await book('Companion', disc.id, null);
    await book('Leviathan Wakes', expanse.id, 1);
    await book('Abaddon', expanse.id, 3);

    const list = await repo.listSeriesWithStats(db);
    expect(list.map((s) => s.name)).toEqual(['Discworld', 'Earthsea', 'The Expanse']);
    const byId = new Map(list.map((s) => [s.id, s]));
    expect(byId.get(disc.id)).toMatchObject({ bookCount: 8, owned: 5, maxPosition: 6, total: 9, totalCount: 9, missing: 4 });
    expect(byId.get(expanse.id)).toMatchObject({ bookCount: 2, owned: 2, maxPosition: 3, total: 3, totalCount: null, missing: 1 });
    expect(byId.get(empty.id)).toMatchObject({ bookCount: 0, owned: 0, maxPosition: null, total: null, missing: 0, lastAddedAt: null });
  });

  it('sorts by most recent addition, empty series last', async () => {
    const a = await repo.createSeries(db, 'Alpha');
    const b = await repo.createSeries(db, 'Beta');
    await repo.createSeries(db, 'Empty');
    await book('a1', a.id, 1, '2026-01-01T00:00:00.000Z');
    await book('b1', b.id, 1, '2026-02-01T00:00:00.000Z');
    await book('a2', a.id, 2, '2026-03-01T00:00:00.000Z');
    expect((await repo.listSeriesWithStats(db, { sort: 'recent' })).map((s) => [s.name, s.lastAddedAt])).toEqual([
      ['Alpha', '2026-03-01T00:00:00.000Z'],
      ['Beta', '2026-02-01T00:00:00.000Z'],
      ['Empty', null],
    ]);
  });
});

describe('seriesGapsFor', () => {
  it.each<[string, number | null, (number | null)[], number[]]>([
    ['unknown total', null, [1, 3, 5], [2, 4]],
    ['known total', 6, [1, 3], [2, 4, 5, 6]],
    ['fractional novella is not a gap-filler', null, [1, 2.5, 3], [2]],
    ['no numbered books', null, [null], []],
  ])('%s', async (_, total, positions, expected) => {
    const s = await repo.createSeries(db, 'S', total);
    for (const [i, p] of positions.entries()) await book(`B${i}`, s.id, p);
    expect(await repo.seriesGapsFor(db, s.id)).toEqual(expected);
  });

  it('returns nothing for a missing series', async () => {
    expect(await repo.seriesGapsFor(db, 999)).toEqual([]);
  });
});
