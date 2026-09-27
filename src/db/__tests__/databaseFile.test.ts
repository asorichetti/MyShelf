import { NoDatabaseFileError, readDatabaseFile } from '@/db/databaseFile';

const mockFile = { exists: true, bytes: jest.fn(async () => new Uint8Array([1, 2, 3])), path: '' };
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((dir: string, name: string) => {
    mockFile.path = `${dir}/${name}`;
    return mockFile;
  }),
}));

const mockConnection = { serializeAsync: jest.fn(), closeAsync: jest.fn(async () => {}) };
const mockOpen = jest.fn();
jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/data/user/0/dev.asorichetti.myshelf/files/SQLite',
  openDatabaseAsync: (...args: unknown[]) => mockOpen(...args),
}));

beforeEach(() => {
  mockFile.exists = true;
  mockFile.bytes.mockClear();
  mockConnection.serializeAsync.mockReset().mockResolvedValue(new Uint8Array([83, 81, 76]));
  mockConnection.closeAsync.mockClear();
  mockOpen.mockReset().mockResolvedValue(mockConnection);
});

describe('readDatabaseFile (Android)', () => {
  it('serialises the database through its own connection, WAL folded in, and closes it', async () => {
    await expect(readDatabaseFile()).resolves.toEqual(new Uint8Array([83, 81, 76]));
    expect(mockFile.path).toBe('file:///data/user/0/dev.asorichetti.myshelf/files/SQLite/myshelf.db');
    expect(mockOpen).toHaveBeenCalledWith('myshelf.db', { useNewConnection: true });
    expect(mockConnection.closeAsync).toHaveBeenCalled();
    expect(mockFile.bytes).not.toHaveBeenCalled();
  });

  it('falls back to the bytes on disk when SQLite cannot read the file', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockConnection.serializeAsync.mockRejectedValue(new Error('file is not a database'));
    await expect(readDatabaseFile()).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(mockConnection.closeAsync).toHaveBeenCalled();
    mockOpen.mockRejectedValue(new Error('unable to open database file'));
    await expect(readDatabaseFile()).resolves.toEqual(new Uint8Array([1, 2, 3]));
    warn.mockRestore();
  });

  it('says so when there is no database file, without creating one', async () => {
    mockFile.exists = false;
    await expect(readDatabaseFile()).rejects.toBeInstanceOf(NoDatabaseFileError);
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
