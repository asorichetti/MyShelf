import { deleteCover, downloadCover, isLocalCover } from '../index';

// An in-memory stand-in for expo-file-system's File/Directory/Paths API.
jest.mock('expo-file-system', () => {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/').replace(/\/+/g, '/').replace('file:/', 'file:///');
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {
      dirs.add(this.uri);
    }
    get exists() {
      return dirs.has(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {
      if (![...dirs].some((d) => this.uri.startsWith(`${d}/`))) throw new Error('parent directory missing');
      files.set(this.uri, new Uint8Array());
    }
    write(bytes: Uint8Array) {
      if (!files.has(this.uri)) throw new Error('file missing');
      files.set(this.uri, bytes);
    }
    get exists() {
      return files.has(this.uri);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  return { __esModule: true, Directory, File, Paths: { document: new Directory('file:///data/docs') }, __files: files };
});

const fs = jest.requireMock<{ __files: Map<string, Uint8Array> }>('expo-file-system');
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const COVER_URL = 'https://covers.openlibrary.org/b/id/14647238-L.jpg';

beforeEach(() => fs.__files.clear());

describe('downloadCover (native)', () => {
  it('saves the image to <documents>/covers/<bookId>.jpg and returns its file:// URI', async () => {
    const http = { getBinary: jest.fn(async () => ({ bytes: JPEG, contentType: 'image/jpeg' })) };
    const uri = await downloadCover(42, COVER_URL, { http });
    expect(uri).toBe('file:///data/docs/covers/42.jpg');
    expect(http.getBinary).toHaveBeenCalledWith(COVER_URL, { signal: undefined });
    expect(fs.__files.get(uri)).toEqual(JPEG);
    expect(isLocalCover(uri)).toBe(true);
  });

  it('replaces an earlier cover for the same book', async () => {
    const http = { getBinary: jest.fn(async () => ({ bytes: JPEG, contentType: 'image/jpeg' })) };
    await downloadCover(7, COVER_URL, { http });
    const newer = new Uint8Array([0xff, 0xd8, 1, 2]);
    http.getBinary.mockResolvedValueOnce({ bytes: newer, contentType: 'image/jpeg' });
    await downloadCover(7, COVER_URL, { http });
    expect(fs.__files.get('file:///data/docs/covers/7.jpg')).toEqual(newer);
    expect(fs.__files.size).toBe(1);
  });

  it('writes nothing when the download fails or is empty', async () => {
    const failing = { getBinary: jest.fn(async () => Promise.reject(new Error('offline'))) };
    await expect(downloadCover(1, COVER_URL, { http: failing })).rejects.toThrow('offline');
    const empty = { getBinary: jest.fn(async () => ({ bytes: new Uint8Array(), contentType: 'image/jpeg' })) };
    await expect(downloadCover(1, COVER_URL, { http: empty })).rejects.toThrow('Empty cover');
    expect(fs.__files.size).toBe(0);
  });

  it("deletes a book's cover file", async () => {
    const http = { getBinary: async () => ({ bytes: JPEG, contentType: 'image/jpeg' }) };
    await downloadCover(3, COVER_URL, { http });
    expect(deleteCover(3)).toBe(true);
    expect(fs.__files.has('file:///data/docs/covers/3.jpg')).toBe(false);
    expect(deleteCover(3)).toBe(false);
  });

  it('tells local covers from remote ones', () => {
    expect(isLocalCover(COVER_URL)).toBe(false);
    expect(isLocalCover(null)).toBe(false);
  });
});

describe('downloadCover (web)', () => {
  const web = jest.requireActual<typeof import('../downloadCover.web')>('../downloadCover.web');

  it('keeps the remote URL and never downloads', async () => {
    const http = { getBinary: jest.fn() };
    await expect(web.downloadCover(1, COVER_URL, { http })).resolves.toBe(COVER_URL);
    expect(http.getBinary).not.toHaveBeenCalled();
    expect(web.deleteCover(1)).toBe(false);
  });
});
