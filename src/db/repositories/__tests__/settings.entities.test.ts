/**
 * @jest-environment node
 */
import { genresRepo, seriesRepo, settingsRepo, type Db } from '@/db';
import { noFilters } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const filterOn = (genreIds: number[]) => settingsRepo.setSetting(db, 'shelfFilters', { ...noFilters, genreIds, formats: ['paperback'], languages: [] });
const genreFilter = async () => (await settingsRepo.getSetting(db, 'shelfFilters')).genreIds;
const seen = async () => (await settingsRepo.getAllSettings(db))['booky.seen'];

describe('settings that name a genre', () => {
  it('forget a deleted genre, so a new genre that takes its id is not filtered on', async () => {
    const fantasy = await genresRepo.createGenre(db, 'Fantasy');
    const horror = await genresRepo.createGenre(db, 'Horror');
    await filterOn([fantasy.id, horror.id]);
    await genresRepo.deleteGenre(db, horror.id);
    expect(await genreFilter()).toEqual([fantasy.id]);
    // SQLite gives the next genre the highest id plus one: the deleted genre's.
    const poetry = await genresRepo.createGenre(db, 'Poetry');
    expect(poetry.id).toBe(horror.id);
    expect(await genreFilter()).toEqual([fantasy.id]);
    // The rest of the filters stay as they were.
    expect((await settingsRepo.getSetting(db, 'shelfFilters')).formats).toEqual(['paperback']);
  });

  it('follow a merged genre to the genre it was merged into', async () => {
    const scifi = await genresRepo.createGenre(db, 'Sci-fi');
    const sf = await genresRepo.createGenre(db, 'Science Fiction');
    const poetry = await genresRepo.createGenre(db, 'Poetry');
    await filterOn([scifi.id, poetry.id]);
    await genresRepo.mergeGenres(db, scifi.id, sf.id);
    expect(await genreFilter()).toEqual([sf.id, poetry.id]);
    await filterOn([poetry.id, sf.id]);
    await genresRepo.mergeGenres(db, poetry.id, sf.id);
    expect(await genreFilter()).toEqual([sf.id]);
  });

  it('drop genres that no longer exist when read (a filter saved before this was fixed)', async () => {
    const fantasy = await genresRepo.createGenre(db, 'Fantasy');
    await filterOn([fantasy.id, 404, 405]);
    expect(await genreFilter()).toEqual([fantasy.id]);
    expect((await settingsRepo.getAllSettings(db)).shelfFilters.genreIds).toEqual([fantasy.id]);
  });
});

describe('settings that name a series', () => {
  it('forget a deleted or merged series in Booky’s memory, so a new series that takes its id gets its tips', async () => {
    const a = await seriesRepo.createSeries(db, 'Discworld');
    const b = await seriesRepo.createSeries(db, 'Earthsea');
    const c = await seriesRepo.createSeries(db, 'Dune');
    await settingsRepo.setSetting(db, 'booky.seen', ['welcome', `series-gap:${a.id}`, `series-gap:${c.id}`, `series-gap:${b.id}@2026-09-01`, 'loan-overdue:3', 'lookup-arrived:3']);
    await seriesRepo.deleteSeries(db, c.id);
    await seriesRepo.mergeSeries(db, b.id, a.id);
    expect(await seen()).toEqual(['welcome', `series-gap:${a.id}`, 'loan-overdue:3', 'lookup-arrived:3']);
    const next = await seriesRepo.createSeries(db, 'Foundation');
    // SQLite gives it the highest id plus one: one of the deleted series' ids.
    expect([b.id, c.id]).toContain(next.id);
    expect(await seen()).not.toContain(`series-gap:${next.id}`);
  });

  it('drop series that no longer exist when read', async () => {
    const a = await seriesRepo.createSeries(db, 'Discworld');
    await settingsRepo.setSetting(db, 'booky.seen', [`series-gap:${a.id}`, 'series-gap:77', 'series-complete:78', 'welcome']);
    expect(await seen()).toEqual([`series-gap:${a.id}`, 'welcome']);
    expect(await settingsRepo.getSetting(db, 'booky.seen')).toEqual([`series-gap:${a.id}`, 'welcome']);
  });
});
