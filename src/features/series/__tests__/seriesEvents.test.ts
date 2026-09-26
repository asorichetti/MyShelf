/**
 * @jest-environment node
 */
import { subscribeBooky, type BookyEmission } from '@/components/booky';
import { initialEngineState, markDismissed, markShown, selectTip, type BookyEvent, type EngineState } from '@/components/booky/engine';
import { booksRepo, seriesRepo, type Db } from '@/db';
import type { SeriesMilestone } from '@/domain';
import { announceSeriesChanges, beginSeriesSave, milestoneEvent, subscribeSeriesMilestones } from '@/features/series/seriesEvents';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
let heard: SeriesMilestone[];
let events: BookyEvent[];
let off: (() => void)[];
beforeEach(async () => {
  db = await createTestDb();
  heard = [];
  events = [];
  off = [subscribeSeriesMilestones((m) => heard.push(m)), subscribeBooky((e: BookyEmission) => events.push(...(Array.isArray(e) ? e : [e as BookyEvent])))];
});
afterEach(async () => {
  off.forEach((o) => o());
  await db.close();
});

/** What Booky says about the events heard so far, given a starting state (each tip dismissed before the next). */
function booky(start: Partial<EngineState> = {}): string[] {
  let state = initialEngineState('2026-06-15', start);
  const said: string[] = [];
  for (const [i, event] of events.entries()) {
    const tip = selectTip(state, event, i * 60_000);
    if (!tip) continue;
    said.push(tip.text);
    state = markDismissed(markShown(state, tip, i * 60_000));
  }
  return said;
}

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

  it('goes to Booky as a series-gap event keyed by the series', async () => {
    await addToSeries('One', 'Discworld', 1);
    await addToSeries('Three', 'Discworld', 3);
    const disc = (await seriesRepo.findSeriesByName(db, 'Discworld'))!;
    expect(events).toEqual([milestoneEvent(heard[0])]);
    expect(events[0]).toMatchObject({ type: 'series-gap', key: disc.id, vars: { seriesId: disc.id } });
    expect(booky()).toEqual(['You have #1 and #3 of Discworld — #2 is missing.']);
  });

  it('shows once per series (Booky remembers it)', async () => {
    await addToSeries('One', 'Discworld', 1);
    await addToSeries('Three', 'Discworld', 3);
    await addToSeries('Five', 'Discworld', 5);
    expect(heard.filter((m) => m.type === 'series-gap')).toHaveLength(2);
    // Another series still gets its own tip.
    await addToSeries('A Wizard of Earthsea', 'Earthsea', 1);
    await addToSeries('The Farthest Shore', 'Earthsea', 3);
    expect(booky()).toEqual(['You have #1 and #3 of Discworld — #2 is missing.', 'You have #1 and #3 of Earthsea — #2 is missing.']);
  });

  it('respects a muted tip and Booky’s Quiet and Off modes', async () => {
    await addToSeries('One', 'Discworld', 1);
    await addToSeries('Three', 'Discworld', 3);
    expect(booky({ muted: ['series-gap'] })).toEqual([]);
    const disc = (await seriesRepo.findSeriesByName(db, 'Discworld'))!;
    expect(booky({ muted: [`series-gap:${disc.id}`] })).toEqual([]);
    expect(booky({ mode: 'quiet' })).toEqual([]);
    expect(booky({ mode: 'off' })).toEqual([]);
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
