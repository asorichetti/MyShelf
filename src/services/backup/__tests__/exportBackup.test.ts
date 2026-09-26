/**
 * @jest-environment node
 */
import { backupRepo, booksRepo, genresRepo, groupsRepo, LATEST_VERSION, libraryRepo, loansRepo, pendingLookupsRepo, settingsRepo, type Db } from '@/db';
import { backupFileName, backupTableNames, BACKUP_FORMAT, setToday } from '@/domain';
import { exportBackup, parseBackup, restoreBackup, serializeBackup } from '@/services/backup';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const NOW = () => new Date('2026-06-20T09:30:00.000Z');
const options = { currentSchemaVersion: LATEST_VERSION };

/** The demo library plus one of everything the fixture lacks: a pending lookup, a device setting, a hand-kept genre, a half-position, a group order. */
async function enrich(target: Db) {
  const books = await booksRepo.listBooks(target);
  await pendingLookupsRepo.enqueue(target, '9780441172719');
  await pendingLookupsRepo.recordFailure(target, '9780441172719', 'offline');
  await settingsRepo.setSetting(target, 'loanDays', 21);
  await settingsRepo.setSetting(target, 'dateFormat', 'iso');
  await settingsRepo.setSetting(target, 'backup.lastAt', '2026-06-01T00:00:00.000Z');
  const genre = await genresRepo.findOrCreateGenre(target, 'Comfort reads');
  await genresRepo.addBookGenre(target, books[0].id, genre.id, { userEdited: true });
  await booksRepo.updateBook(target, books[1].id, { seriesPosition: 2.5, coverUri: 'file:///data/user/0/app/files/covers/2.jpg', notes: 'Line one\nLine “two”, with commas' });
  const group = await groupsRepo.createGroup(target, { name: 'Signed', colour: 'rose', icon: 'pen' });
  await groupsRepo.addBooksToGroup(target, group.id, [books[3].id, books[2].id]);
}

describe('exportBackup', () => {
  it('writes the format header, schema version, counts and every backed-up table', async () => {
    const backup = await exportBackup(db, { appVersion: '1.2.3', now: NOW });
    expect(backup).toMatchObject({ format: BACKUP_FORMAT, formatVersion: 1, schemaVersion: LATEST_VERSION, appVersion: '1.2.3', exportedAt: '2026-06-20T09:30:00.000Z' });
    expect(Object.keys(backup.tables).sort()).toEqual([...backupTableNames].sort());
    expect(backup.counts).toMatchObject({ books: 12, loans: 3, groups: 1, borrowers: 2, series: 2 });
    expect(backup.tables).not.toHaveProperty('api_cache');
    expect(backup.tables).not.toHaveProperty('cover_attempts');
  });

  it('leaves this phone’s own settings and stored cover files out', async () => {
    await enrich(db);
    const backup = await exportBackup(db, { appVersion: '1', now: NOW });
    const keys = backup.tables.settings!.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['loanDays', 'dateFormat']));
    expect(keys).not.toContain('backup.lastAt');
    expect(backup.tables.books!.some((b) => String(b.cover_uri).startsWith('file:'))).toBe(false);
    expect(backup.tables.books!.filter((b) => String(b.cover_uri).startsWith('https://')).length).toBe(10);
    // The safety copy keeps them, since it is only ever restored on this phone.
    const safety = await exportBackup(db, { appVersion: '1', now: NOW, keepDeviceCovers: true });
    expect(safety.tables.books!.some((b) => String(b.cover_uri).startsWith('file:'))).toBe(true);
  });

  it('names the file after the day', () => {
    expect(backupFileName(new Date(2026, 9, 2))).toBe('myshelf-backup-2026-10-02.json');
  });
});

describe('backup round trip (export → erase → restore)', () => {
  it('returns an identical database, row by row, in every table', async () => {
    await enrich(db);
    const before = await backupRepo.dumpTables(db, { stripDeviceCovers: false });
    const text = serializeBackup(await exportBackup(db, { appVersion: '1', now: NOW }));

    await libraryRepo.eraseLibrary(db, { resetSettings: true });
    expect(await booksRepo.countBooks(db)).toBe(0);

    const result = await restoreBackup(db, parseBackup(text, options), { mode: 'replace', now: NOW });
    expect(result.counts.books).toBe(12);
    const after = await backupRepo.dumpTables(db, { stripDeviceCovers: false });

    // The one deliberate difference: a cover file on the phone is not in the backup.
    const coverFile = before.books.find((b) => String(b.cover_uri).startsWith('file:'))!;
    coverFile.cover_uri = null;
    for (const table of backupTableNames) {
      expect({ table, rows: after[table] }).toEqual({ table, rows: before[table] });
    }
    // Loans, groups, series positions and genres survive, not just counts.
    expect(after.loans.filter((l) => l.returned_on == null)).toHaveLength(2);
    expect(after.books.some((b) => b.series_position === 2.5)).toBe(true);
    expect(after.book_genres.some((g) => g.user_edited === 1)).toBe(true);
    expect(after.group_books.map((g) => g.position)).toEqual(before.group_books.map((g) => g.position));
    expect(await settingsRepo.getSetting(db, 'loanDays')).toBe(21);
    expect(await settingsRepo.getSetting(db, 'dateFormat')).toBe('iso');
  });

  it('restores onto a new phone (a fresh database) identically', async () => {
    await enrich(db);
    const text = serializeBackup(await exportBackup(db, { appVersion: '1', now: NOW }));
    const phone = await createTestDb();
    await restoreBackup(phone, parseBackup(text, options), { mode: 'replace', now: NOW });
    const original = await backupRepo.dumpTables(db);
    const restored = await backupRepo.dumpTables(phone);
    expect(restored).toEqual(original);
    // And the app's own queries agree.
    const withoutPhoneCovers = (await booksRepo.listBookItems(db)).map((b) => ({ ...b, coverUri: b.coverUri?.startsWith('file:') ? null : b.coverUri }));
    expect(await booksRepo.listBookItems(phone)).toEqual(withoutPhoneCovers);
    const loansWithoutPhoneCovers = (await loansRepo.listOpenLoans(db)).map((l) => ({ ...l, bookCoverUri: l.bookCoverUri?.startsWith('file:') ? null : l.bookCoverUri }));
    expect(await loansRepo.listOpenLoans(phone)).toEqual(loansWithoutPhoneCovers);
    await phone.close();
  });

  it('round-trips an empty library', async () => {
    await libraryRepo.eraseLibrary(db);
    const text = serializeBackup(await exportBackup(db, { appVersion: '1', now: NOW }));
    await loadFixture(db, 'demo');
    await restoreBackup(db, parseBackup(text, options), { mode: 'replace', now: NOW });
    expect(await booksRepo.countBooks(db)).toBe(0);
  });

  it('exports a restored backup to the same tables again (stable)', async () => {
    const first = await exportBackup(db, { appVersion: '1', now: NOW });
    const other = await createTestDb();
    await restoreBackup(other, first, { mode: 'replace', now: NOW });
    const second = await exportBackup(other, { appVersion: '1', now: NOW });
    expect(second.tables).toEqual(first.tables);
    await other.close();
  });
});
