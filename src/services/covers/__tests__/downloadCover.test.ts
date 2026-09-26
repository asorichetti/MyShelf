import { deleteCover, downloadCover, isLocalCover, isStoredCover, storeCoverFile } from '../index';

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
    copy(target: File) {
      if (!files.has(this.uri)) throw new Error('source missing');
      if (files.has(target.uri)) throw new Error('target exists');
      files.set(target.uri, files.get(this.uri)!);
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

describe('storeCoverFile (native)', () => {
  it('copies a picked photo into <documents>/covers/<bookId>.jpg, replacing an old cover', () => {
    fs.__files.set('file:///cache/picker/abc.jpg', JPEG);
    const uri = storeCoverFile(9, 'file:///cache/picker/abc.jpg');
    expect(uri).toBe('file:///data/docs/covers/9.jpg');
    expect(fs.__files.get(uri)).toEqual(JPEG);
    expect(isStoredCover(9, uri)).toBe(true);
    expect(isStoredCover(9, 'file:///cache/picker/abc.jpg')).toBe(false);

    const newer = new Uint8Array([0xff, 0xd8, 9]);
    fs.__files.set('file:///cache/picker/def.jpg', newer);
    storeCoverFile(9, 'file:///cache/picker/def.jpg');
    expect(fs.__files.get(uri)).toEqual(newer);
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

  it('keeps a picked image as it is', () => {
    expect(web.storeCoverFile(1, 'data:image/jpeg;base64,xyz')).toBe('data:image/jpeg;base64,xyz');
    expect(web.isStoredCover(1, 'data:image/jpeg;base64,xyz')).toBe(true);
  });
});
