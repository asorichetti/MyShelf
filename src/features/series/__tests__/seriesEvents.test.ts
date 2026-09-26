/**
 * @jest-environment node
 */
import { booksRepo, seriesRepo, settingsRepo, type Db } from '@/db';
import type { SeriesMilestone } from '@/domain';
import { announceSeriesChanges, beginSeriesSave, gapTipId, subscribeSeriesMilestones } from '@/features/series/seriesEvents';
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

/** Saves a book into a series the way the form does: probe, write, finish. */
async function addToSeries(title: string, series: string, position: number | null) {
  const probe = await beginSeriesSave(db, { seriesNames: [series] });
  const s = await seriesRepo.findOrCreateSeries(db, series);
  const book = await booksRepo.createBook(db, { title, seriesId: s.id, seriesPosition: position });
  return probe.finish(book.id);
}

describe('series gap tip', () => {
  it('publishes "You have #1 and #3 … #2 is missing." when a save creates a gap', async () => {
    await addToSeries('The Colour of Magic', 'Discworld', 1);
    expect(heard).toEqual([]);
    const published = await addToSeries('Equal Rites', 'Discworld', 3);
    expect(published).toHaveLength(1);
    expect(heard).toEqual([expect.objectContaining({ type: 'series-gap', seriesName: 'Discworld', message: 'You have #1 and #3 of Discworld — #2 is missing.' })]);
  });

  it('shows once per series, remembered in settings', async () => {
    await addToSeries('One', 'Discworld', 1);
    await addToSeries('Three', 'Discworld', 3);
    await addToSeries('Five', 'Discworld', 5);
    expect(heard.filter((m) => m.type === 'series-gap')).toHaveLength(1);
    const disc = (await seriesRepo.findSeriesByName(db, 'Discworld'))!;
    expect(await settingsRepo.getSetting(db, 'series.gapTipSeriesIds')).toEqual([disc.id]);
    // Another series still gets its own tip.
    await addToSeries('A Wizard of Earthsea', 'Earthsea', 1);
    await addToSeries('The Farthest Shore', 'Earthsea', 3);
    expect(heard.filter((m) => m.type === 'series-gap').map((m) => m.seriesName)).toEqual(['Discworld', 'Earthsea']);
  });

  it('respects a muted tip and Booky’s Quiet and Off modes', async () => {
    await addToSeries('One', 'Discworld', 1);
    const disc = (await seriesRepo.findSeriesByName(db, 'Discworld'))!;
    await settingsRepo.setSetting(db, 'mutedTips', [gapTipId(disc.id)]);
    await addToSeries('Three', 'Discworld', 3);
    await settingsRepo.setSetting(db, 'bookyMode', 'quiet');
    await addToSeries('A', 'Earthsea', 2);
    await settingsRepo.setSetting(db, 'bookyMode', 'off');
    await addToSeries('B', 'Expanse', 2);
    expect(heard).toEqual([]);
    expect(gapTipId(12)).toBe('series-gap:12');
  });

  it('notices a book moving between series', async () => {
    await addToSeries('One', 'Discworld', 1);
    const two = await booksRepo.createBook(db, { title: 'Two', seriesId: (await seriesRepo.findSeriesByName(db, 'Discworld'))!.id, seriesPosition: 2 });
    const probe = await beginSeriesSave(db, { bookId: two.id, seriesNames: ['Discworld'] });
    await booksRepo.updateBook(db, two.id, { seriesPosition: 4 });
    await probe.finish(two.id);
    expect(heard).toEqual([expect.objectContaining({ type: 'series-gap', gaps: [2, 3] })]);
  });

  it('never throws into a save', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const probe = await beginSeriesSave(db, { seriesNames: ['Discworld'] });
    await db.close();
    await expect(probe.finish(1)).resolves.toEqual([]);
    expect(error).toHaveBeenCalledWith('Could not check the series after saving', expect.anything());
    error.mockRestore();
    db = await createTestDb();
  });

  it('can be driven directly with a snapshot', async () => {
    const s = await seriesRepo.createSeries(db, 'Earthsea');
    const before = await seriesRepo.seriesStates(db, [s.id]);
    await booksRepo.createBook(db, { title: 'The Farthest Shore', seriesId: s.id, seriesPosition: 3 });
    expect(await announceSeriesChanges(db, before)).toEqual([expect.objectContaining({ type: 'series-gap', gaps: [1, 2] })]);
  });
});
