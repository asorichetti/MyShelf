import { act, renderHook, waitFor } from '@testing-library/react-native';

import { settingsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { noFilters } from '@/domain';
import { defaultShelfPrefs, loadShelfPrefs, PREFS_DEBOUNCE_MS, useShelfPrefs } from '@/features/shelf/useShelfPrefs';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  jest.useRealTimers();
  await db.close();
});

const wrapper = ({ children }: { children: React.ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;

async function renderPrefs() {
  const hook = renderHook(() => useShelfPrefs(), { wrapper });
  await waitFor(() => expect(hook.result.current.prefs).not.toBeNull());
  return hook;
}

describe('useShelfPrefs', () => {
  it('starts from the defaults on a fresh install', async () => {
    const { result } = await renderPrefs();
    expect(result.current.prefs).toEqual(defaultShelfPrefs);
    expect(defaultShelfPrefs).toMatchObject({ groupBy: 'none', viewMode: 'list', sort: { sort: 'title', direction: 'asc' } });
  });

  it('reads what was saved (they survive a restart)', async () => {
    await settingsRepo.setSetting(db, 'shelfGroupBy', 'series');
    await settingsRepo.setSetting(db, 'shelfViewMode', 'spines');
    await settingsRepo.setSetting(db, 'shelfSort', { sort: 'added', direction: 'desc' });
    await settingsRepo.setSetting(db, 'shelfFilters', { ...noFilters, loan: 'onLoan' });
    const { result } = await renderPrefs();
    expect(result.current.prefs).toEqual({ groupBy: 'series', viewMode: 'spines', sort: { sort: 'added', direction: 'desc' }, filters: { ...noFilters, loan: 'onLoan' } });
  });

  it('falls back to defaults for invalid stored values', async () => {
    await db.run("INSERT INTO settings (key, value) VALUES ('shelfGroupBy', '\"colour\"'), ('shelfViewMode', '42'), ('shelfSort', '{\"sort\":\"weight\"}'), ('shelfFilters', 'not json')");
    expect(await loadShelfPrefs(db)).toEqual(defaultShelfPrefs);
  });

  it('saves a sort, grouping or mode at once', async () => {
    const { result } = await renderPrefs();
    act(() => result.current.setViewMode('covers'));
    act(() => result.current.setSort({ sort: 'year', direction: 'desc' }));
    expect(result.current.prefs?.viewMode).toBe('covers');
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'shelfViewMode')).toBe('covers'));
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'shelfSort')).toEqual({ sort: 'year', direction: 'desc' }));
  });

  it('writes filters once, after a short pause (debounced)', async () => {
    const { result } = await renderPrefs();
    jest.useFakeTimers();
    const spy = jest.spyOn(settingsRepo, 'setSetting');
    act(() => result.current.setFilters({ ...noFilters, genreIds: [1] }));
    act(() => result.current.setFilters({ ...noFilters, genreIds: [1, 2] }));
    expect(result.current.prefs?.filters.genreIds).toEqual([1, 2]);
    expect(spy).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(PREFS_DEBOUNCE_MS));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(db, 'shelfFilters', { ...noFilters, genreIds: [1, 2] });
    jest.useRealTimers();
    await waitFor(async () => expect((await settingsRepo.getSetting(db, 'shelfFilters')).genreIds).toEqual([1, 2]));
    spy.mockRestore();
  });

  it('saves a pending change at once when the Shelf goes away', async () => {
    const { result, unmount } = await renderPrefs();
    jest.useFakeTimers();
    act(() => result.current.setFilters({ ...noFilters, loan: 'atHome' }));
    unmount();
    jest.useRealTimers();
    await waitFor(async () => expect((await settingsRepo.getSetting(db, 'shelfFilters')).loan).toBe('atHome'));
  });
});
