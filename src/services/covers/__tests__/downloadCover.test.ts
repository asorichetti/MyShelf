import { deleteCoverFile, downloadCover, isLocalCover, isStoredCover, storeCoverFile } from '../index';

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

const COVER_FILE = /^file:\/\/\/data\/docs\/covers\/42-[a-z0-9]+\.jpg$/;

describe('downloadCover (native)', () => {
  it('saves the image to a file of its own, <documents>/covers/<bookId>-<unique>.jpg, and returns its file:// URI', async () => {
    const http = { getBinary: jest.fn(async () => ({ bytes: JPEG, contentType: 'image/jpeg' })) };
    const uri = await downloadCover(42, COVER_URL, { http });
    expect(uri).toMatch(COVER_FILE);
    expect(http.getBinary).toHaveBeenCalledWith(COVER_URL, { signal: undefined });
    expect(fs.__files.get(uri)).toEqual(JPEG);
    expect(isLocalCover(uri)).toBe(true);
  });

  it('never writes over an earlier cover: each download gets a new file', async () => {
    const http = { getBinary: jest.fn(async () => ({ bytes: JPEG, contentType: 'image/jpeg' })) };
    const first = await downloadCover(7, COVER_URL, { http });
    const newer = new Uint8Array([0xff, 0xd8, 1, 2]);
    http.getBinary.mockResolvedValueOnce({ bytes: newer, contentType: 'image/jpeg' });
    const second = await downloadCover(7, COVER_URL, { http });
    expect(second).not.toBe(first);
    expect(fs.__files.get(first)).toEqual(JPEG);
    expect(fs.__files.get(second)).toEqual(newer);
  });

  it('writes nothing when the download fails or is empty', async () => {
    const failing = { getBinary: jest.fn(async () => Promise.reject(new Error('offline'))) };
    await expect(downloadCover(1, COVER_URL, { http: failing })).rejects.toThrow('offline');
    const empty = { getBinary: jest.fn(async () => ({ bytes: new Uint8Array(), contentType: 'image/jpeg' })) };
    await expect(downloadCover(1, COVER_URL, { http: empty })).rejects.toThrow('Empty cover');
    expect(fs.__files.size).toBe(0);
  });

  it('deletes a stored cover file by its URI, and nothing outside the covers folder', async () => {
    const http = { getBinary: async () => ({ bytes: JPEG, contentType: 'image/jpeg' }) };
    const uri = await downloadCover(3, COVER_URL, { http });
    fs.__files.set('file:///cache/picker/abc.jpg', JPEG);
    expect(deleteCoverFile('file:///cache/picker/abc.jpg')).toBe(false);
    expect(fs.__files.has('file:///cache/picker/abc.jpg')).toBe(true);
    expect(deleteCoverFile(uri)).toBe(true);
    expect(fs.__files.has(uri)).toBe(false);
    expect(deleteCoverFile(uri)).toBe(false);
    expect(deleteCoverFile(COVER_URL)).toBe(false);
    expect(deleteCoverFile(null)).toBe(false);
  });

  it('tells local covers from remote ones', () => {
    expect(isLocalCover(COVER_URL)).toBe(false);
    expect(isLocalCover(null)).toBe(false);
  });
});

describe('storeCoverFile (native)', () => {
  it('copies a picked photo into a file of its own in <documents>/covers', () => {
    fs.__files.set('file:///cache/picker/abc.jpg', JPEG);
    const uri = storeCoverFile('file:///cache/picker/abc.jpg', { bookId: 9 });
    expect(uri).toMatch(/^file:\/\/\/data\/docs\/covers\/9-[a-z0-9]+\.jpg$/);
    expect(fs.__files.get(uri)).toEqual(JPEG);
    expect(isStoredCover(uri)).toBe(true);
    expect(isStoredCover('file:///cache/picker/abc.jpg')).toBe(false);

    const newer = new Uint8Array([0xff, 0xd8, 9]);
    fs.__files.set('file:///cache/picker/def.jpg', newer);
    const again = storeCoverFile('file:///cache/picker/def.jpg', { bookId: 9 });
    expect(again).not.toBe(uri);
    // The old file stays until nothing names it (the caller releases it).
    expect(fs.__files.get(uri)).toEqual(JPEG);
    expect(fs.__files.get(again)).toEqual(newer);
    // A book not saved yet has no id to put in the name.
    expect(storeCoverFile('file:///cache/picker/def.jpg')).toMatch(/^file:\/\/\/data\/docs\/covers\/book-[a-z0-9]+\.jpg$/);
  });

  it('a copy that fails leaves the book’s current cover as it was, and no half-written file', () => {
    fs.__files.set('file:///cache/picker/abc.jpg', JPEG);
    const uri = storeCoverFile('file:///cache/picker/abc.jpg', { bookId: 9 });
    const before = new Map(fs.__files);
    expect(() => storeCoverFile('file:///cache/picker/gone.jpg', { bookId: 9 })).toThrow('source missing');
    expect(fs.__files).toEqual(before);
    expect(fs.__files.get(uri)).toEqual(JPEG);
  });

  it('counts covers stored before unique names (covers/<id>.jpg) as stored', () => {
    expect(isStoredCover('file:///data/docs/covers/7.jpg')).toBe(true);
    expect(isStoredCover('file:///data/docs/other/7.jpg')).toBe(false);
    expect(isStoredCover(null)).toBe(false);
  });
});

describe('downloadCover (web)', () => {
  const web = jest.requireActual<typeof import('../downloadCover.web')>('../downloadCover.web');

  it('keeps the remote URL and never downloads', async () => {
    const http = { getBinary: jest.fn() };
    await expect(web.downloadCover(1, COVER_URL, { http })).resolves.toBe(COVER_URL);
    expect(http.getBinary).not.toHaveBeenCalled();
    expect(web.deleteCoverFile(COVER_URL)).toBe(false);
  });

  it('keeps a picked image as it is', () => {
    expect(web.storeCoverFile('data:image/jpeg;base64,xyz', { bookId: 1 })).toBe('data:image/jpeg;base64,xyz');
    expect(web.isStoredCover('data:image/jpeg;base64,xyz')).toBe(true);
  });
});
