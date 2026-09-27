import { createHttpClient, createRateLimiter, NotFoundError, OfflineError, withQuery } from '@/services/http';
import { SEARCH_FIELDS } from '@/services/metadata/openLibrary';

import bundle from '../../../generated/e2eApiFixtures.json';
import { e2eApiFetch, getE2eApiState, isMockApiBuilt, resetE2eApiForTests, setE2eApiState } from '../mockApi';
import { canonicalUrl, createMockApiFetch, fromBase64, type MockApiBundle } from '../mockApiFetch';

// An in-memory stand-in for the app's mockFiles folder.
const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///docs' },
  File: class {
    private readonly path: string;
    constructor(dir: string, name: string) {
      this.path = `${dir}/${name}`;
    }
    get exists() {
      return mockFiles.has(this.path);
    }
    create() {
      mockFiles.set(this.path, '');
    }
    write(text: string) {
      mockFiles.set(this.path, text);
    }
    textSync() {
      return mockFiles.get(this.path) ?? '';
    }
  },
}));

const recorded = bundle as MockApiBundle;
const OL = 'https://openlibrary.org';
const signal = () => new AbortController().signal;
const client = (fetch: ReturnType<typeof createMockApiFetch>) =>
  createHttpClient({ fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });

describe('createMockApiFetch', () => {
  it('answers the app’s own search URL from the recorded search, whatever the parameter order', async () => {
    const fetch = createMockApiFetch(recorded);
    // The provider's order (title, author, fields, limit) is not the index's canonical one.
    const url = withQuery(`${OL}/search.json`, { title: 'the colour of magic', author: 'pratchett', fields: SEARCH_FIELDS, limit: 10 });
    const body = await client(fetch).getJson<{ docs: { title: string }[] }>(url);
    expect(body.docs[0].title).toMatch(/Colour of Magic/);
  });

  it('keeps a deliberate 404 a 404', async () => {
    await expect(client(createMockApiFetch(recorded)).getJson(`${OL}/isbn/9791099999993.json`)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses and reports a request no fixture answers, so a gap shows (like the web network/unmocked rule)', async () => {
    const unmocked: string[] = [];
    const fetch = createMockApiFetch(recorded, { onUnmocked: (u) => unmocked.push(u) });
    await expect(client(fetch).getJson(`${OL}/isbn/9780000000019.json`)).rejects.toBeInstanceOf(OfflineError);
    await expect(fetch('https://example.com/', { signal: signal() })).rejects.toThrow(/no recorded response/);
    expect(unmocked).toEqual([`${OL}/isbn/9780000000019.json`, 'https://example.com/']);
  });

  it('answers covers with the synthetic test covers, and a deliberately missing one as Open Library does', async () => {
    const http = client(createMockApiFetch(recorded));
    const cover = await http.getBinary('https://covers.openlibrary.org/b/id/7892565-L.jpg');
    expect(cover.contentType).toBe('image/jpeg');
    expect([...cover.bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect(cover.bytes).toEqual(fromBase64(recorded.covers.cover));
    const padded = await http.getBinary(`https://covers.openlibrary.org/b/id/${recorded.covers.paddedIds[0]}-L.jpg`);
    expect(padded.bytes).toEqual(fromBase64(recorded.covers.padded));
    const missing = `https://covers.openlibrary.org/b/id/${recorded.covers.expectedMissingMarker}-L.jpg`;
    expect((await http.getBinary(missing)).contentType).toBe('image/gif');
    await expect(http.getBinary(`${missing}?default=false`)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('fails every request as with no network while the simulated network is off', async () => {
    let offline = true;
    const http = client(createMockApiFetch(recorded, { offline: () => offline }));
    await expect(http.getJson(`${OL}/works/OL453657W.json`)).rejects.toBeInstanceOf(OfflineError);
    offline = false;
    await expect(http.getJson(`${OL}/works/OL453657W.json`)).resolves.toMatchObject({ key: '/works/OL453657W' });
  });

  it('honours an aborted request', async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(createMockApiFetch(recorded)(`${OL}/works/OL453657W.json`, { signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('canonicalUrl', () => {
  it('sorts and re-encodes the query and lowercases the host', () => {
    expect(canonicalUrl('HTTPS://OpenLibrary.org:443/search.json?q=a+b&author=x%20y')).toBe('https://openlibrary.org/search.json?author=x%20y&q=a%20b');
    expect(canonicalUrl('https://openlibrary.org')).toBe('https://openlibrary.org/');
  });
});

describe('the E2E switch', () => {
  const saved = { e2e: process.env.EXPO_PUBLIC_E2E, mock: process.env.EXPO_PUBLIC_E2E_MOCK_API };
  const realFetch = global.fetch;
  const restore = (name: string, value: string | undefined) => (value === undefined ? delete process.env[name] : (process.env[name] = value));
  beforeEach(() => {
    mockFiles.clear();
    resetE2eApiForTests();
  });
  afterEach(() => {
    // Set and delete keys only: the transformed code reads the same process.env object throughout.
    restore('EXPO_PUBLIC_E2E', saved.e2e);
    restore('EXPO_PUBLIC_E2E_MOCK_API', saved.mock);
    global.fetch = realFetch;
  });

  it('is not in a build without EXPO_PUBLIC_E2E_MOCK_API=1: the HTTP client keeps the global fetch', () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    delete process.env.EXPO_PUBLIC_E2E_MOCK_API;
    expect(isMockApiBuilt()).toBe(false);
    expect(e2eApiFetch()).toBeUndefined();
    setE2eApiState({ api: 'live' });
    expect(mockFiles.size).toBe(0);
  });

  describe('in the E2E APK', () => {
    let log: jest.SpyInstance;
    beforeEach(() => {
      process.env.EXPO_PUBLIC_E2E = '1';
      process.env.EXPO_PUBLIC_E2E_MOCK_API = '1';
      log = jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => log.mockRestore());

    it('answers from the recorded responses by default', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('the network was used')));
      expect(getE2eApiState()).toEqual({ api: 'mock', network: 'online' });
      const http = createHttpClient({ fetch: e2eApiFetch(), limiter: createRateLimiter({ minIntervalMs: 0 }) });
      await expect(http.getJson(`${OL}/works/OL453657W.json`)).resolves.toMatchObject({ key: '/works/OL453657W' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('sends a live flow’s requests to the real services, and remembers the switch across a cold start', async () => {
      global.fetch = jest.fn(() => Promise.resolve(new Response('{"live":true}', { status: 200 })));
      setE2eApiState({ api: 'live' });
      resetE2eApiForTests(); // a cold start: only the file is left
      expect(getE2eApiState()).toEqual({ api: 'live', network: 'online' });
      const http = createHttpClient({ fetch: e2eApiFetch(), limiter: createRateLimiter({ minIntervalMs: 0 }) });
      await expect(http.getJson(`${OL}/works/OL453657W.json`)).resolves.toEqual({ live: true });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('logs an unmocked request for the suite to find', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const http = createHttpClient({ fetch: e2eApiFetch(), limiter: createRateLimiter({ minIntervalMs: 0 }) });
      await expect(http.getJson(`${OL}/works/OL1W.json`)).rejects.toBeInstanceOf(OfflineError);
      expect(error).toHaveBeenCalledWith(`[e2e-mock-api] unmocked ${OL}/works/OL1W.json`);
      error.mockRestore();
    });
  });
});
