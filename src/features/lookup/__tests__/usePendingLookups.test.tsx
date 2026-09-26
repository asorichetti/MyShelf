import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { BookyProvider, useBooky } from '@/components/booky';
import { pendingLookupsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { HttpError, OfflineError } from '@/services/http';
import type { MetadataResult } from '@/services/metadata';
import { googleBooksRoutes } from '@/services/metadata/__fixtures__/googleBooksRoutes';
import { OL_BOOKS, openLibraryRoutes } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { makeCandidate } from '@/services/metadata/candidate';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { usePendingLookups, type UsePendingLookupsOptions } from '../usePendingLookups';

import type { ReactNode } from 'react';

const A = OL_BOOKS.colourOfMagic;
const B = OL_BOOKS.theMartian;

let db: Db;
let appStateHandlers: ((state: AppStateStatus) => void)[];

beforeEach(async () => {
  db = await createTestDb();
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandlers.push(handler as (state: AppStateStatus) => void);
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.close();
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StaticDatabaseProvider db={db}>
      <BookyProvider>{children}</BookyProvider>
    </StaticDatabaseProvider>
  );
}

function renderLookups(options: UsePendingLookupsOptions = {}) {
  return renderHook(() => ({ lookups: usePendingLookups(options), booky: useBooky() }), { wrapper });
}

async function foreground() {
  await act(async () => {
    for (const handler of appStateHandlers) handler('active');
  });
}

const found = (isbn13: string): MetadataResult => ({
  candidates: [makeCandidate({ title: `Book ${isbn13}`, isbn13, source: 'openlibrary', sourceId: isbn13 })],
  warnings: [],
});

describe('usePendingLookups', () => {
  it('queues an offline lookup once, with a sleepy Booky', async () => {
    const lookup = jest.fn();
    const { result } = renderLookups({ lookup });
    let first = false;
    let second = true;
    await act(async () => {
      first = await result.current.lookups.queue(A);
      second = await result.current.lookups.queue(A);
    });
    expect([first, second]).toEqual([true, false]);
    expect(result.current.lookups.pending.map((p) => p.isbn13)).toEqual([A]);
    expect(await pendingLookupsRepo.list(db)).toHaveLength(1);
    expect(result.current.booky.tip).toMatchObject({ tip: { expression: 'sleepy' }, text: 'Saved — I’ll look this up when you’re back online.' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('retries on returning to the foreground, one at a time, and announces the results', async () => {
    await pendingLookupsRepo.enqueue(db, A);
    await pendingLookupsRepo.enqueue(db, B);
    let inFlight = 0;
    let maxInFlight = 0;
    let online = false;
    const lookup = jest.fn(async (isbn13: string) => {
      if (!online) throw new OfflineError(isbn13);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return found(isbn13);
    });
    const { result } = renderLookups({ lookup });
    // Started offline: the mount-time retry stopped at the first OfflineError.
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.lookups.retrying).toBe(false));
    expect(result.current.lookups.pending).toHaveLength(2);
    expect((await pendingLookupsRepo.get(db, A))?.attempts).toBe(0);

    online = true;
    await foreground();
    await waitFor(() => expect(result.current.lookups.results).toHaveLength(2));
    expect(maxInFlight).toBe(1);
    expect(result.current.lookups.results.map((r) => r.isbn13).sort()).toEqual([A, B].sort());
    expect(result.current.lookups.pending).toEqual([]);
    expect(await pendingLookupsRepo.list(db)).toEqual([]);
    await waitFor(() => expect(result.current.booky.tip).toMatchObject({ tip: { expression: 'excited' }, text: expect.stringContaining('2 books') }));

    act(() => result.current.lookups.dismissResult(A));
    expect(result.current.lookups.results.map((r) => r.isbn13)).toEqual([B]);
  });

  it('succeeds against the real providers once back online', async () => {
    await pendingLookupsRepo.enqueue(db, A);
    const fixtures = createFixtureFetch(openLibraryRoutes, googleBooksRoutes);
    jest.spyOn(global, 'fetch').mockImplementation((url, init) => fixtures.fetch(String(url), init as never));
    const { result } = renderLookups();
    await waitFor(() => expect(result.current.lookups.results).toHaveLength(1), { timeout: 5000 });
    expect(result.current.lookups.results[0].candidates[0]).toMatchObject({ title: 'The Colour of Magic', authors: ['Terry Pratchett'] });
    expect(fixtures.unmocked).toEqual([]);
  });

  it('caps attempts at five and then gives up with a friendly message', async () => {
    await pendingLookupsRepo.enqueue(db, A);
    const lookup = jest.fn(async () => Promise.reject(new HttpError(503, 'https://openlibrary.org')));
    const { result } = renderLookups({ lookup });
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
    for (let i = 2; i <= 5; i++) {
      await waitFor(() => expect(result.current.lookups.retrying).toBe(false));
      await foreground();
      await waitFor(() => expect(lookup).toHaveBeenCalledTimes(i));
    }
    await waitFor(() => expect(result.current.lookups.failed.map((f) => f.isbn13)).toEqual([A]));
    expect(result.current.lookups.pending).toEqual([]);
    expect(await pendingLookupsRepo.get(db, A)).toMatchObject({ attempts: 5, lastError: 'HTTP 503 for https://openlibrary.org' });
    await waitFor(() =>
      expect(result.current.booky.tip).toMatchObject({
        tip: { expression: 'concerned' },
        text: 'I couldn’t find details for 1 book. You can add it by hand.',
      }),
    );

    await foreground();
    expect(lookup).toHaveBeenCalledTimes(5);
  });

  it('gives up at once when no provider knows the ISBN', async () => {
    await pendingLookupsRepo.enqueue(db, A);
    const lookup = jest.fn(async () => ({ candidates: [], warnings: [] }));
    const { result } = renderLookups({ lookup });
    await waitFor(() => expect(result.current.lookups.failed).toHaveLength(1));
    expect(await pendingLookupsRepo.get(db, A)).toMatchObject({ attempts: 5, lastError: 'not-found' });
    await waitFor(() => expect(result.current.booky.tip?.tip.expression).toBe('concerned'));
  });

  it('removes a queued lookup', async () => {
    const lookup = jest.fn(async () => Promise.reject(new OfflineError('x')));
    const { result } = renderLookups({ lookup });
    await act(async () => {
      await result.current.lookups.queue(A);
    });
    await act(async () => {
      await result.current.lookups.remove(A);
    });
    expect(result.current.lookups.pending).toEqual([]);
    expect(await pendingLookupsRepo.list(db)).toEqual([]);
  });

  it('does nothing on mount when the queue is empty', async () => {
    const lookup = jest.fn();
    const { result } = renderLookups({ lookup });
    await act(async () => {
      await result.current.lookups.retryNow();
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(result.current.booky.tip).toBeNull();
  });
  describe('cover backfill (P02-15)', () => {
    it('starts on mount with an empty queue, and after each online retry', async () => {
      const backfillCovers = jest.fn(async () => undefined);
      await renderLookups({ lookup: jest.fn(async () => found(A)), backfillCovers });
      await waitFor(() => expect(backfillCovers).toHaveBeenCalledTimes(1));
      await pendingLookupsRepo.enqueue(db, A);
      await foreground();
      await waitFor(() => expect(backfillCovers).toHaveBeenCalledTimes(2));
    });

    it('does not start while still offline', async () => {
      await pendingLookupsRepo.enqueue(db, A);
      const lookup = jest.fn(async () => Promise.reject(new OfflineError('https://openlibrary.org')));
      const backfillCovers = jest.fn(async () => undefined);
      const { result } = renderLookups({ lookup, backfillCovers });
      await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(result.current.lookups.retrying).toBe(false));
      expect(backfillCovers).not.toHaveBeenCalled();
    });

    it('runs one backfill at a time and cancels it on unmount', async () => {
      let signal: AbortSignal | undefined;
      const backfillCovers = jest.fn((s: AbortSignal) => {
        signal = s;
        return new Promise<void>(() => undefined); // still running
      });
      const { unmount } = renderLookups({ backfillCovers });
      await waitFor(() => expect(backfillCovers).toHaveBeenCalledTimes(1));
      await foreground();
      expect(backfillCovers).toHaveBeenCalledTimes(1);
      unmount();
      expect(signal?.aborted).toBe(true);
    });

    it('can be turned off', async () => {
      const lookup = jest.fn();
      const { result } = renderLookups({ lookup, backfillCovers: null });
      await act(async () => {
        await result.current.lookups.retryNow();
      });
      expect(lookup).not.toHaveBeenCalled();
    });
  });
});
