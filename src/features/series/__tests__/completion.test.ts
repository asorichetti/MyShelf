/**
 * @jest-environment node
 */
import { booksRepo, seriesRepo, settingsRepo, type Db } from '@/db';
import type { SeriesMilestone } from '@/domain';
import { beginSeriesSave, subscribeSeriesMilestones } from '@/features/series/seriesEvents';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
let heard: SeriesMilestone[];
let off: () => void;
beforeEach(async () => {
  db = await createTestDb();
  heard = [];
  off = subscribeSeriesMilestones((m) => heard.push(m));
});
afterEach(async () => {
  off();
  await db.close();
});

async function earthsea(positions: number[], total: number | null = 3) {
  const s = await seriesRepo.createSeries(db, 'Earthsea', total);
  for (const p of positions) await booksRepo.createBook(db, { title: `Earthsea ${p}`, seriesId: s.id, seriesPosition: p });
  return s;
}

async function save(seriesId: number, write: () => Promise<unknown>, bookId?: number) {
  const probe = await beginSeriesSave(db, { seriesIds: [seriesId], bookId });
  await write();
  return probe.finish(bookId);
}

describe('series completion', () => {
  it('celebrates the save that makes owned = total with no gaps', async () => {
    const s = await earthsea([1, 3]);
    await save(s.id, () => booksRepo.createBook(db, { title: 'The Tombs of Atuan', seriesId: s.id, seriesPosition: 2 }));
    expect(heard).toEqual([{ type: 'series-complete', seriesId: s.id, seriesName: 'Earthsea', total: 3, message: 'Series complete! All 3 Earthsea books.' }]);
  });

  it('does not celebrate again for edits that keep it complete', async () => {
    const s = await earthsea([1, 2, 3]);
    const [first] = await seriesRepo.listBooksInSeries(db, s.id);
    await save(s.id, () => booksRepo.updateBook(db, first.id, { title: 'A Wizard of Earthsea' }), first.id);
    await save(s.id, () => booksRepo.createBook(db, { title: 'Tales from Earthsea', seriesId: s.id, seriesPosition: 2.5 }));
    expect(heard).toEqual([]);
  });

  it('fires again after the series was broken and completed anew', async () => {
    const s = await earthsea([1, 2, 3]);
    const books = await seriesRepo.listBooksInSeries(db, s.id);
    await save(s.id, () => seriesRepo.setBookSeries(db, books[1].id, null), books[1].id);
    await save(s.id, () => seriesRepo.setBookSeries(db, books[1].id, s.id, 2), books[1].id);
    expect(heard.filter((m) => m.type === 'series-complete')).toHaveLength(1);
  });

  it('celebrates when setting the total completes the series', async () => {
    const s = await earthsea([1, 2], null);
    await save(s.id, () => seriesRepo.setSeriesTotalCount(db, s.id, 2));
    expect(heard).toEqual([expect.objectContaining({ type: 'series-complete', total: 2 })]);
  });

  it('needs a total: a gap-free run with no total is not "complete"', async () => {
    const s = await earthsea([1], null);
    await save(s.id, () => booksRepo.createBook(db, { title: 'Two', seriesId: s.id, seriesPosition: 2 }));
    expect(heard).toEqual([]);
  });

  it('still celebrates in Quiet mode, but not with Booky off', async () => {
    await settingsRepo.setSetting(db, 'bookyMode', 'quiet');
    const s = await earthsea([1, 2]);
    await save(s.id, () => booksRepo.createBook(db, { title: 'Three', seriesId: s.id, seriesPosition: 3 }));
    expect(heard).toHaveLength(1);
    await settingsRepo.setSetting(db, 'bookyMode', 'off');
    const t = await seriesRepo.createSeries(db, 'Solo', 1);
    await save(t.id, () => booksRepo.createBook(db, { title: 'Only', seriesId: t.id, seriesPosition: 1 }));
    expect(heard).toHaveLength(1);
  });
});
