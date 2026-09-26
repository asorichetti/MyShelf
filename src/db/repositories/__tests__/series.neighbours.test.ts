/**
 * @jest-environment node
 */
import { booksRepo, seriesRepo as repo, type Db } from '@/db';
import type { SeriesNeighbour, Book } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const book = (title: string, seriesId: number | null, seriesPosition: number | null) => booksRepo.createBook(db, { title, seriesId, seriesPosition });
const describeN = (n: SeriesNeighbour<Book> | null) => (n == null ? null : n.kind === 'owned' ? n.book.title : `#${n.position} missing`);

describe('neighbours', () => {
  it('returns the series, progress and the books either side', async () => {
    const disc = await repo.createSeries(db, 'Discworld');
    await book('The Colour of Magic', disc.id, 1);
    const tlf = await book('The Light Fantastic', disc.id, 2);
    await book('Mort', disc.id, 4);
    const place = (await repo.neighbours(db, tlf.id))!;
    expect(place.series).toEqual(disc);
    expect(place.position).toBe(2);
    expect(place.bookCount).toBe(3);
    expect(place.progress).toMatchObject({ owned: 3, total: 4, gaps: [3] });
    expect(describeN(place.neighbours.previous)).toBe('The Colour of Magic');
    expect(describeN(place.neighbours.next)).toBe('#3 missing');
    // Full books come back, not just ids.
    expect(place.neighbours.previous).toMatchObject({ kind: 'owned', book: { title: 'The Colour of Magic', seriesPosition: 1, seriesId: disc.id } });
  });

  it('handles the first and last books', async () => {
    const s = await repo.createSeries(db, 'Earthsea', 3);
    const first = await book('A Wizard of Earthsea', s.id, 1);
    const last = await book('The Farthest Shore', s.id, 3);
    const a = (await repo.neighbours(db, first.id))!;
    expect([describeN(a.neighbours.previous), describeN(a.neighbours.next)]).toEqual([null, '#2 missing']);
    const b = (await repo.neighbours(db, last.id))!;
    expect([describeN(b.neighbours.previous), describeN(b.neighbours.next)]).toEqual(['#2 missing', null]);
  });

  it('orders fractional positions correctly', async () => {
    const s = await repo.createSeries(db, 'Mistborn');
    await book('Two', s.id, 2);
    const novella = await book('Two and a half', s.id, 2.5);
    await book('Three', s.id, 3);
    const place = (await repo.neighbours(db, novella.id))!;
    expect([describeN(place.neighbours.previous), describeN(place.neighbours.next)]).toEqual(['Two', 'Three']);
  });

  it('is null for a book in no series, or no book', async () => {
    const loose = await book('Standalone', null, null);
    expect(await repo.neighbours(db, loose.id)).toBeNull();
    expect(await repo.neighbours(db, 999)).toBeNull();
  });
});

describe('seriesStates', () => {
  it('snapshots each series once, skipping missing ids', async () => {
    const s = await repo.createSeries(db, 'Discworld', 9);
    await book('Mort', s.id, 4);
    await book('Unnumbered', s.id, null);
    const states = await repo.seriesStates(db, [s.id, s.id, 404]);
    expect([...states.keys()]).toEqual([s.id]);
    expect(states.get(s.id)).toEqual({ id: s.id, name: 'Discworld', totalCount: 9, positions: expect.arrayContaining([4, null]) });
  });
});

describe('listSeriesWithStats gaps', () => {
  it('lists the missing positions', async () => {
    const s = await repo.createSeries(db, 'Discworld', 5);
    await book('One', s.id, 1);
    await book('Four', s.id, 4);
    const [summary] = await repo.listSeriesWithStats(db);
    expect(summary.gaps).toEqual([2, 3, 5]);
  });
});
