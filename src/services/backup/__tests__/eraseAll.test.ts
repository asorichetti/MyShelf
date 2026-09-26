/**
 * @jest-environment node
 */
import { apiCacheRepo, backupRepo, booksRepo, libraryRepo, pendingLookupsRepo, settingsRepo, type Db } from '@/db';
import { eraseAll, exportBackup, restoreBackup } from '@/services/backup';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
  await pendingLookupsRepo.enqueue(db, '9780441172719');
  await apiCacheRepo.putEntry(db, 'https://openlibrary.org/isbn/1.json', '{}');
  await settingsRepo.setSetting(db, 'loanDays', 14);
  await settingsRepo.setSetting(db, 'booky.seen', ['series-gap:1']);
  // A restore leaves a safety copy behind; erasing must not keep one.
  await restoreBackup(db, await exportBackup(db, { appVersion: '1' }), { mode: 'replace' });
});
afterEach(() => db.close());


describe('eraseAll', () => {
  it('removes every book and everything around them, and keeps settings', async () => {
    const deleteCoverFiles = jest.fn(() => 3);
    const result = await eraseAll(db, { deleteCoverFiles });
    expect(result).toEqual({ coverFilesDeleted: 3 });
    expect(deleteCoverFiles).toHaveBeenCalledTimes(1);
    const counts = await backupRepo.countTables(db);
    for (const [table, n] of Object.entries(counts)) if (table !== 'settings') expect({ table, n }).toEqual({ table, n: 0 });
    expect(await libraryRepo.countRows(db)).toEqual(Object.fromEntries(Object.keys(await libraryRepo.countRows(db)).map((k) => [k, 0])));
    expect(await pendingLookupsRepo.list(db)).toEqual([]);
    expect(await apiCacheRepo.stats(db)).toEqual({ entries: 0, bytes: 0 });
    expect(await backupRepo.latestSnapshotInfo(db)).toBeNull();
    expect(await settingsRepo.getSetting(db, 'loanDays')).toBe(14);
    // Settings that named deleted rows start afresh.
    expect(await settingsRepo.getSetting(db, 'booky.seen')).toEqual([]);
  });

  it('also resets settings when asked', async () => {
    await eraseAll(db, { resetSettings: true });
    expect(await settingsRepo.getSetting(db, 'loanDays')).toBe(28);
    expect(await db.all('SELECT * FROM settings')).toEqual([]);
  });

  it('still succeeds when a cover file cannot be deleted', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(
      eraseAll(db, {
        deleteCoverFiles: () => {
          throw new Error('busy');
        },
      }),
    ).resolves.toEqual({ coverFilesDeleted: 0 });
    expect(await booksRepo.countBooks(db)).toBe(0);
    warn.mockRestore();
  });
});
