import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { booksRepo, settingsRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { BackupScreen } from '@/features/settings/BackupScreen';
import { ExportCsvScreen } from '@/features/settings/ExportCsvScreen';
import { RestoreScreen } from '@/features/settings/RestoreScreen';
import { exportBackup, serializeBackup, type OutgoingFile } from '@/services/backup';
import { pickTextFile } from '@/services/backup/pickFile';
import { shareFile } from '@/services/backup/shareFile';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { pressWhenShown, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

jest.mock('@/services/backup/shareFile', () => ({ shareFile: jest.fn(async () => 'shared') }));
jest.mock('@/services/backup/pickFile', () => ({ pickTextFile: jest.fn() }));
jest.mock('@/features/settings/scratchDatabase', () => ({
  openScratchDatabase: () => jest.requireActual<typeof import('@/db/node')>('@/db/node').openNodeDatabase(),
}));
jest.mock('@/features/covers', () => ({ ...jest.requireActual('@/features/covers'), drainCoverBackfill: jest.fn(async () => 0) }));

const share = shareFile as jest.MockedFunction<typeof shareFile>;
const pick = pickTextFile as jest.MockedFunction<typeof pickTextFile>;
const R = Testids.restore;

let db: Db;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
  await loadFixture(db, 'demo');
  share.mockClear();
  pick.mockReset();
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

describe('Back up your library', () => {
  it('says what is in the library, shares a dated JSON file and records the date', async () => {
    renderApp(db, '/settings/backup', { 'settings/backup': BackupScreen });
    await waitFor(() => expect(screen.getByTestId(Testids.backup.contents)).toHaveTextContent('Right now: 12 books, 2 series, 1 group, 2 borrowers, 3 loans.'));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.backup.export)));
    await waitFor(() => expect(screen.getByTestId(Testids.backup.status)).toHaveTextContent(/is ready/));
    expect(share).toHaveBeenCalledTimes(1);
    const file = share.mock.calls[0][0] as OutgoingFile;
    expect(file.fileName).toMatch(/^myshelf-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(file.mimeType).toBe('application/json');
    expect(JSON.parse(file.text)).toMatchObject({ format: 'myshelf-backup', counts: { books: 12 } });
    expect(await settingsRepo.getSetting(db, 'backup.lastAt')).toMatch(/^\d{4}-/);
    // The screen reloads after the settings change and shows the new date.
    await waitFor(() => expect(screen.getByText(/^Last backup: \d/)).toBeOnTheScreen());
  });

  it('explains when the phone cannot share', async () => {
    share.mockResolvedValueOnce('unavailable');
    renderApp(db, '/settings/backup', { 'settings/backup': BackupScreen });
    await waitFor(() => expect(screen.getByTestId(Testids.backup.contents)).toHaveTextContent(/12 books/));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.backup.export)));
    await waitFor(() => expect(screen.getByTestId(Testids.backup.status)).toHaveTextContent(/can’t share files/));
    expect(await settingsRepo.getSetting(db, 'backup.lastAt')).toBeNull();
  });
});

describe('Restore from a backup', () => {
  async function backupText() {
    const other = await createTestDb();
    await loadFixture(other, 'series');
    const text = serializeBackup(await exportBackup(other, { appVersion: '1.0.0' }));
    await other.close();
    return text;
  }

  it('shows the file, waits for REPLACE, restores, and can undo', async () => {
    pick.mockResolvedValueOnce({ name: 'myshelf-backup-2026-06-01.json', text: await backupText() });
    renderApp(db, '/settings/restore', { 'settings/restore': RestoreScreen });
    await pressWhenShown(R.pick);
    await waitFor(() => expect(screen.getByTestId(R.file)).toHaveTextContent(/myshelf-backup-2026-06-01\.json/));
    const confirm = screen.getByTestId(R.confirm);
    expect(confirm.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId(R.confirmInput), 'replace');
    await act(async () => fireEvent.press(screen.getByTestId(R.confirm)));
    await waitFor(() => expect(screen.getByTestId(R.summary)).toHaveTextContent(/Library restored/));
    const restored = await booksRepo.countBooks(db);
    expect(restored).not.toBe(12);

    await pressWhenShown(R.undo);
    await waitFor(async () => expect(await booksRepo.countBooks(db)).toBe(12));
  });

  it('merges without a typed confirmation', async () => {
    pick.mockResolvedValueOnce({ name: 'b.json', text: await backupText() });
    renderApp(db, '/settings/restore', { 'settings/restore': RestoreScreen });
    await pressWhenShown(R.pick);
    await pressWhenShown(R.modeMerge);
    expect(screen.queryByTestId(R.confirmInput)).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId(R.confirm)));
    await waitFor(() => expect(screen.getByTestId(R.summary)).toHaveTextContent(/Books added/));
    expect(await booksRepo.countBooks(db)).toBeGreaterThan(12);
  });

  it('explains a broken file and changes nothing', async () => {
    pick.mockResolvedValueOnce({ name: 'broken.json', text: '{"format":"myshelf-backup","formatVersion":1,' });
    renderApp(db, '/settings/restore', { 'settings/restore': RestoreScreen });
    await pressWhenShown(R.pick);
    await waitFor(() => expect(screen.getByTestId(R.error)).toHaveTextContent(/may be incomplete/));
    expect(screen.queryByTestId(R.confirm)).toBeNull();
    expect(await booksRepo.countBooks(db)).toBe(12);
  });

  it('does nothing when the picker is cancelled', async () => {
    pick.mockResolvedValueOnce(null);
    renderApp(db, '/settings/restore', { 'settings/restore': RestoreScreen });
    await pressWhenShown(R.pick);
    expect(screen.queryByTestId(R.error)).toBeNull();
    expect(screen.queryByTestId(R.file)).toBeNull();
  });
});

describe('Export as a spreadsheet', () => {
  it('shares a CSV without loans, then with them when asked', async () => {
    renderApp(db, '/settings/export-csv', { 'settings/export-csv': ExportCsvScreen });
    await pressWhenShown(Testids.csvExport.export);
    await waitFor(() => expect(screen.getByTestId(Testids.csvExport.status)).toHaveTextContent(/with 12 books/));
    const plain = share.mock.calls[0][0] as OutgoingFile;
    expect(plain.fileName).toMatch(/^myshelf-books-.*\.csv$/);
    expect(plain.text).not.toContain('On loan to');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.csvExport.includeLoans)));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.csvExport.export)));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect((share.mock.calls[1][0] as OutgoingFile).text).toContain('On loan to');
  });
});
