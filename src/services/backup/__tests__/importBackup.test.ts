/**
 * @jest-environment node
 */
import { backupRepo, booksRepo, groupsRepo, LATEST_VERSION, loansRepo, seriesRepo, settingsRepo, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { setToday, type BackupFile } from '@/domain';
import { BackupError, exportBackup, parseBackup, restoreBackup, serializeBackup, undoRestore } from '@/services/backup';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

import schema1 from '../__fixtures__/backup-schema1.json';

const options = { currentSchemaVersion: LATEST_VERSION };
const NOW = () => new Date('2026-06-20T09:30:00.000Z');
const openScratch = () => openNodeDatabase();

let db: Db;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

async function demoBackup(): Promise<BackupFile> {
  const source = await createTestDb();
  await loadFixture(source, 'demo');
  const backup = parseBackup(serializeBackup(await exportBackup(source, { appVersion: '1', now: NOW })), options);
  await source.close();
  return backup;
}

describe('restore: replace', () => {
  it('replaces the library and keeps a safety copy that Undo puts back', async () => {
    await loadFixture(db, 'series');
    const mine = await backupRepo.dumpTables(db, { stripDeviceCovers: false });
    const result = await restoreBackup(db, await demoBackup(), { mode: 'replace', now: NOW, appVersion: '1' });
    expect(result.safetyCopy).toMatchObject({ bookCount: mine.books.length });
    expect(await booksRepo.countBooks(db)).toBe(12);

    expect(await undoRestore(db, result.safetyCopy!.id)).toBe(true);
    expect(await backupRepo.dumpTables(db, { stripDeviceCovers: false })).toEqual(mine);
    // The copy is used up.
    expect(await backupRepo.latestSnapshotInfo(db)).toBeNull();
    expect(await undoRestore(db, result.safetyCopy!.id)).toBe(false);
  });

  it('keeps this phone’s backup date and reminder state', async () => {
    await settingsRepo.setSetting(db, 'backup.lastAt', '2026-06-19T00:00:00.000Z');
    const backup = await demoBackup();
    backup.tables.settings!.push({ key: 'backup.lastAt', value: '"2020-01-01T00:00:00.000Z"' });
    await restoreBackup(db, backup, { mode: 'replace', now: NOW });
    expect(await settingsRepo.getSetting(db, 'backup.lastAt')).toBe('2026-06-19T00:00:00.000Z');
  });

  it('changes nothing when the database rejects a row half-way', async () => {
    await loadFixture(db, 'demo');
    const before = await backupRepo.dumpTables(db, { stripDeviceCovers: false });
    const backup = await demoBackup();
    // Passes the file checks, but breaks the schema's CHECK (due before lent).
    backup.tables.loans![backup.tables.loans!.length - 1].due_on = '1999-01-01';
    const error = await restoreBackup(db, backup, { mode: 'replace', now: NOW }).catch((e) => e);
    expect(error).toBeInstanceOf(BackupError);
    expect(error.message).toBe('This backup looks damaged: a record has a value MyShelf can’t accept. Nothing was changed.');
    expect(await backupRepo.dumpTables(db, { stripDeviceCovers: false })).toEqual(before);
    expect(await backupRepo.latestSnapshotInfo(db)).toBeNull();
  });

  it('refuses two open loans for one book without touching the library', async () => {
    await loadFixture(db, 'demo');
    const backup = await demoBackup();
    const open = backup.tables.loans!.find((l) => l.returned_on == null)!;
    backup.tables.loans!.push({ ...open, id: 999 });
    await expect(restoreBackup(db, backup, { mode: 'replace', now: NOW })).rejects.toThrow('two records clash');
    expect(await booksRepo.countBooks(db)).toBe(12);
  });
});

describe('restore: an older backup', () => {
  it('brings a schema 1 backup forward through the migrations and restores it exactly', async () => {
    await loadFixture(db, 'demo');
    const backup = validateOld();
    const result = await restoreBackup(db, backup, { mode: 'replace', now: NOW, openScratch });
    expect(result.upgradedFrom).toBe(1);
    const after = await backupRepo.dumpTables(db, { stripDeviceCovers: false });
    for (const table of Object.keys(schema1.tables) as (keyof typeof schema1.tables)[]) {
      // Migration 0007 added the rating: an old backup's books come back not rated.
      const want = table === 'books' ? schema1.tables.books.map((b) => ({ ...b, rating: null })) : schema1.tables[table];
      expect({ table, rows: after[table] }).toEqual({ table, rows: want });
    }
    expect(after.pending_lookups).toEqual([]);
    const tales = (await booksRepo.getBook(db, 12))!;
    expect(tales).toMatchObject({ title: 'Tales from Earthsea', seriesId: 3, seriesPosition: 5.5 });
    expect((await loansRepo.listOpenLoans(db)).map((l) => [l.bookTitle, l.borrowerName])).toEqual([['A Wizard of Earthsea', 'Priya']]);
    expect(await settingsRepo.getSetting(db, 'loanDays')).toBe(14);
  });

  it('restores a schema 6 backup (from before ratings) with every book not rated', async () => {
    const backup = await demoBackup();
    const old = parseBackup(
      JSON.stringify({ ...backup, schemaVersion: 6, tables: { ...backup.tables, books: backup.tables.books!.map(({ rating: _r, ...b }) => b) } }),
      options,
    );
    const result = await restoreBackup(db, old, { mode: 'replace', now: NOW, openScratch });
    expect(result.upgradedFrom).toBe(6);
    expect(await booksRepo.countBooks(db)).toBe(12);
    expect((await booksRepo.listBooks(db)).every((b) => b.rating === null)).toBe(true);
  });

  it('needs a scratch database to do it', async () => {
    await expect(restoreBackup(db, validateOld(), { mode: 'replace', now: NOW })).rejects.toThrow('scratch database');
  });
});

function validateOld(): BackupFile {
  return parseBackup(JSON.stringify(schema1), options);
}

describe('ratings', () => {
  const ratings = async (d: Db) => Object.fromEntries((await booksRepo.listBooks(d)).map((b) => [b.title, b.rating]));

  it('travel in the backup file and come back from a replace', async () => {
    const backup = await demoBackup();
    expect(backup.schemaVersion).toBe(LATEST_VERSION);
    expect(backup.tables.books!.find((b) => b.title === 'Mort')!.rating).toBe(5);
    expect(backup.tables.books!.find((b) => b.title === 'The Light Fantastic')!.rating).toBeNull();
    await restoreBackup(db, backup, { mode: 'replace', now: NOW });
    const source = await createTestDb();
    await loadFixture(source, 'demo');
    expect(await ratings(db)).toEqual(await ratings(source));
    expect((await ratings(db)).Mort).toBe(5);
    await source.close();
  });

  it('come along with merged books', async () => {
    await restoreBackup(db, await demoBackup(), { mode: 'merge', now: NOW });
    expect(await ratings(db)).toMatchObject({ Mort: 5, Dune: 4, 'A Wizard of Earthsea': 3, 'The Light Fantastic': null });
  });
});

describe('restore: merge', () => {
  it('adds new books, skips ones already there and remaps every link', async () => {
    await loadFixture(db, 'demo');
    // Make a clash on purpose: the Earthsea series and Le Guin already exist in the demo.
    const result = await restoreBackup(db, validateOld(), { mode: 'merge', now: NOW, openScratch });
    // "The Farthest Shore" (no ISBN) is already on the demo shelf; the other two are new.
    expect(result.merge).toEqual({ booksAdded: 2, booksSkipped: 1, loansAdded: 1 });
    expect(await booksRepo.countBooks(db)).toBe(14);

    const earthsea = (await seriesRepo.findSeriesByName(db, 'Earthsea'))!;
    const [wizard] = await booksRepo.findBooksByIsbn(db, '9780547773742');
    expect(wizard.id).not.toBe(10);
    expect(wizard.seriesId).toBe(earthsea.id);
    const detail = (await booksRepo.getBookDetail(db, wizard.id))!;
    expect(detail.authors.map((a) => a.name)).toEqual(['Ursula K. Le Guin']);
    expect(detail.genres.map((g) => g.name)).toEqual(['Fantasy']);
    // Only one Le Guin and one Earthsea: matched by name, not duplicated.
    expect((await seriesRepo.listSeries(db)).filter((s) => s.name === 'Earthsea')).toHaveLength(1);
    const bedside = (await groupsRepo.listGroups(db)).find((g) => g.name === 'Bedside')!;
    expect((await groupsRepo.listBooksInGroup(db, bedside.id)).map((b) => b.title)).toEqual(['Tales from Earthsea', 'A Wizard of Earthsea']);
    const priyaLoans = (await loansRepo.listOpenLoans(db)).filter((l) => l.bookId === wizard.id);
    expect(priyaLoans.map((l) => l.borrowerName)).toEqual(['Priya']);
    // Settings are not merged.
    expect(await settingsRepo.getSetting(db, 'loanDays')).toBe(28);
  });

  it('puts books merged into a group that already exists after the books already in it', async () => {
    const fill = async (target: Db, titles: string[]) => {
      const group = await groupsRepo.createGroup(target, { name: 'Favourites' });
      for (const title of titles) await groupsRepo.addBookToGroup(target, group.id, (await booksRepo.createBook(target, { title })).id);
      return group.id;
    };
    const mine = await fill(db, ['Mine one', 'Mine two']);
    const source = await createTestDb();
    await fill(source, ['Theirs one', 'Theirs two']);
    const backup = parseBackup(serializeBackup(await exportBackup(source, { appVersion: '1', now: NOW })), options);
    await source.close();

    await restoreBackup(db, backup, { mode: 'merge', now: NOW });
    expect((await groupsRepo.listBooksInGroup(db, mine)).map((b) => b.title)).toEqual(['Mine one', 'Mine two', 'Theirs one', 'Theirs two']);
    expect(await groupsRepo.listGroups(db)).toHaveLength(1);
  });

  it('merging the same backup twice adds nothing the second time', async () => {
    const backup = await demoBackup();
    await restoreBackup(db, backup, { mode: 'merge', now: NOW });
    const second = await restoreBackup(db, backup, { mode: 'merge', now: NOW });
    expect(second.merge).toEqual({ booksAdded: 0, booksSkipped: 12, loansAdded: 0 });
    expect(await booksRepo.countBooks(db)).toBe(12);
  });
});
