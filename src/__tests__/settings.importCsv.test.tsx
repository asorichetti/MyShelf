import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { booksRepo, groupsRepo, type Db } from '@/db';
import { drainCoverBackfill } from '@/features/covers';
import { ImportCsvScreen } from '@/features/settings/ImportCsvScreen';
import { pickTextFile } from '@/services/backup/pickFile';
import { createTestDb } from '@/testing/createTestDb';
import { pressWhenShown, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

jest.mock('@/services/backup/pickFile', () => ({ pickTextFile: jest.fn() }));
jest.mock('@/features/covers', () => ({ ...jest.requireActual('@/features/covers'), drainCoverBackfill: jest.fn(async () => 0) }));

const pick = pickTextFile as jest.MockedFunction<typeof pickTextFile>;
const drain = drainCoverBackfill as jest.MockedFunction<typeof drainCoverBackfill>;
const goodreads = readFileSync(join(__dirname, '../services/backup/__fixtures__/goodreads_library_export.csv'), 'utf8');
const C = Testids.csvImport;

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  pick.mockReset();
  drain.mockClear();
});
afterEach(() => db.close());

async function chooseFile(name: string, text: string) {
  pick.mockResolvedValueOnce({ name, text });
  renderApp(db, '/settings/import-csv', { 'settings/import-csv': ImportCsvScreen });
  await pressWhenShown(C.pick);
}

describe('Import books from a spreadsheet', () => {
  it('recognises a Goodreads export, previews 10 rows and imports all 20', async () => {
    await chooseFile('goodreads_library_export.csv', goodreads);
    await waitFor(() => expect(screen.getByTestId(C.preset).props.accessibilityLabel).toBe('This file is a: Goodreads library export'));
    expect(screen.getByText('20 books will be added. The first 10 rows:')).toBeOnTheScreen();
    expect(screen.getAllByTestId(C.previewRow)).toHaveLength(10);
    expect(screen.getAllByTestId(C.previewRow)[3].props.accessibilityLabel).toBe('Line 5: The Name of the Wind by Patrick Rothfuss. Will be added.');
    expect(screen.getByTestId(C.shelvesToggle).props.accessibilityState.checked).toBe(true);

    await act(async () => fireEvent.press(screen.getByTestId(C.confirm)));
    await waitFor(() => expect(screen.getByTestId(C.report)).toHaveTextContent(/Imported 20 books/));
    expect(await booksRepo.countBooks(db)).toBe(20);
    expect((await groupsRepo.listGroups(db)).length).toBe(9);
    // Real covers are then found by the cover backfill, without holding up the import.
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('can leave the shelves out', async () => {
    await chooseFile('goodreads.csv', goodreads);
    await pressWhenShown(C.shelvesToggle);
    await act(async () => fireEvent.press(screen.getByTestId(C.confirm)));
    await waitFor(() => expect(screen.getByTestId(C.report)).toBeOnTheScreen());
    expect(await groupsRepo.listGroups(db)).toEqual([]);
  });

  it('reports skipped rows and still imports the good ones', async () => {
    await chooseFile('mine.csv', 'Title;Author;Pages\nDune;Frank Herbert;412\n;Nobody;1\nMort;Terry Pratchett;many\n');
    await waitFor(() => expect(screen.getByText('2 books will be added; 1 row will be skipped.')).toBeOnTheScreen());
    expect(screen.getByTestId(C.preset).props.accessibilityLabel).toBe('This file is a: Another spreadsheet (match the columns yourself)');
    expect(screen.getAllByTestId(C.previewRow)[1].props.accessibilityLabel).toBe('Line 3: (no title) by Nobody. Skipped: It has no title.');
    expect(screen.getAllByTestId(C.previewRow)[2].props.accessibilityLabel).toMatch(/Will be added\. The page count “many” wasn’t understood\./);
    await act(async () => fireEvent.press(screen.getByTestId(C.confirm)));
    await waitFor(() => expect(screen.getByTestId(C.skipped)).toHaveTextContent(/Line 3: It has no title\./));
    expect(await booksRepo.countBooks(db)).toBe(2);
  });

  it('lets a column be re-mapped by hand', async () => {
    await chooseFile('mine.csv', 'Name,Writer,Code\nDune,Frank Herbert,9780441172719\n');
    await waitFor(() => expect(screen.getAllByTestId(C.mapField)).toHaveLength(2));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Show the 1 column not imported' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Column “Code”: Don’t import' })));
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'ISBN (10 or 13)' })));
    await act(async () => fireEvent.press(screen.getByTestId(C.confirm)));
    await waitFor(() => expect(screen.getByTestId(C.report)).toBeOnTheScreen());
    expect((await booksRepo.listBooks(db))[0]).toMatchObject({ title: 'Dune', isbn13: '9780441172719' });
  });

  it('explains files it cannot read', async () => {
    await chooseFile('backup.json', '{"format":"myshelf-backup"}');
    await waitFor(() => expect(screen.getByTestId(C.error)).toHaveTextContent(/Restore from a backup/));
    expect(screen.queryByTestId(C.preview)).toBeNull();
  });
});
