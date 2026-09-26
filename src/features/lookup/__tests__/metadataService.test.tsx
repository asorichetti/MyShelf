import { renderHook } from '@testing-library/react-native';

import { apiCacheRepo, settingsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { googleBooksRoutes } from '@/services/metadata/__fixtures__/googleBooksRoutes';
import { OL_BOOKS, openLibraryRoutes } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { getLookupServices, useMetadataService } from '../metadataService';

import type { ReactNode } from 'react';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.close();
});

function mockFetch() {
  const fixtures = createFixtureFetch(openLibraryRoutes, googleBooksRoutes);
  const spy = jest.spyOn(global, 'fetch').mockImplementation((url, init) => fixtures.fetch(String(url), init as never));
  return { fixtures, spy };
}

describe('app metadata wiring', () => {
  it('caches responses in api_cache, honours the Google Books setting and identifies the app', async () => {
    await settingsRepo.setSetting(db, 'googleBooksEnabled', false);
    const { fixtures, spy } = mockFetch();
    const { metadata } = getLookupServices(db);
    const first = await metadata.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(first.candidates[0].title).toBe('The Colour of Magic');
    expect(fixtures.calls.some((u) => u.includes('googleapis'))).toBe(false);
    expect((await apiCacheRepo.stats(db)).entries).toBe(3);
    const headers = (spy.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers['User-Agent']).toMatch(/^MyShelf\/\S+ \(\+https:\/\/github\.com\/asorichetti\/MyShelf\)$/);

    const calls = fixtures.calls.length;
    await metadata.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(fixtures.calls).toHaveLength(calls);
  });

  it('builds one service per database', () => {
    function wrapper({ children }: { children: ReactNode }) {
      return <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;
    }
    const { result, rerender } = renderHook(() => useMetadataService(), { wrapper });
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
    expect(getLookupServices(db).metadata).toBe(first);
  });
});
