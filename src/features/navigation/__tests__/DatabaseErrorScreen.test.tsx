import { act, fireEvent, screen } from '@testing-library/react-native';

import { NoDatabaseFileError } from '@/db/databaseFile';
import { DatabaseErrorScreen } from '@/features/navigation/DatabaseErrorScreen';
import { databaseFileName } from '@/features/navigation/useDatabaseFileExport';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const mockRead = jest.fn<Promise<Uint8Array>, []>();
const mockShare = jest.fn();
jest.mock('@/db/databaseFile', () => {
  const actual = jest.requireActual('@/db/databaseFile.web');
  return { NoDatabaseFileError: actual.NoDatabaseFileError, readDatabaseFile: () => mockRead() };
});
jest.mock('@/services/backup/shareFile', () => ({ shareBinaryFile: (...args: unknown[]) => mockShare(...args) }));

const T = Testids.dbError;
const bytes = new Uint8Array([0x53, 0x51, 0x4c]);

beforeEach(() => {
  mockRead.mockReset().mockResolvedValue(bytes);
  mockShare.mockReset().mockResolvedValue('shared');
});

async function renderScreen() {
  const onRetry = jest.fn();
  const view = renderWithTheme(<DatabaseErrorScreen error={new Error('file is not a database')} onRetry={onRetry} />);
  await act(async () => {});
  return { onRetry, ...view };
}

const press = (id: string) => act(async () => fireEvent.press(screen.getByTestId(id)));

describe('DatabaseErrorScreen: save a copy of the library file', () => {
  it('names the file by the date', () => {
    expect(databaseFileName(new Date(2026, 5, 15, 23, 30))).toBe('myshelf-library-2026-06-15.db');
  });

  it('offers Try again and the copy', async () => {
    const { onRetry } = await renderScreen();
    expect(screen.getByText('file is not a database')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save a copy of the library file' })).toBeOnTheScreen();
    await press(T.retry);
    expect(onRetry).toHaveBeenCalled();
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('shares the raw database file and says it is ready', async () => {
    await renderScreen();
    await press(T.export);
    expect(mockShare).toHaveBeenCalledWith({
      fileName: expect.stringMatching(/^myshelf-library-\d{4}-\d{2}-\d{2}\.db$/),
      mimeType: 'application/vnd.sqlite3',
      bytes,
      dialogTitle: 'Save your library file',
    });
    expect(screen.getByTestId(T.exportStatus)).toHaveTextContent(/myshelf-library-.+\.db is ready\. Keep it somewhere safe\.$/);
    expect(screen.getByTestId(T.exportStatus).props.role).toBe('status');
  });

  it('says Downloaded on the web', async () => {
    mockShare.mockResolvedValue('downloaded');
    await renderScreen();
    await press(T.export);
    expect(screen.getByTestId(T.exportStatus)).toHaveTextContent(/Downloaded myshelf-library-.+\.db\.$/);
  });

  it.each([
    ['there is no file', () => mockRead.mockRejectedValue(new NoDatabaseFileError()), "There's no library file on this device yet, so there's nothing to save."],
    ['the device cannot share', () => mockShare.mockResolvedValue('unavailable'), "This device can't share files, so the copy couldn't be saved."],
    ['reading fails', () => mockRead.mockRejectedValue(new Error('disk I/O error')), "I couldn't save a copy of the library file."],
  ])('explains when %s', async (_, arrange, message) => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    arrange();
    await renderScreen();
    await press(T.export);
    expect(screen.getByTestId(T.exportStatus)).toHaveTextContent(message, { exact: false });
    expect(screen.getByTestId(T.exportStatus).props.role).toBe('alert');
    error.mockRestore();
  });

  it('finishes quietly when the screen has gone before the copy is ready', async () => {
    let finish!: (b: Uint8Array) => void;
    mockRead.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const error = jest.spyOn(console, 'error');
    const { unmount } = await renderScreen();
    await press(T.export);
    unmount();
    await act(async () => finish(bytes));
    expect(mockShare).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
