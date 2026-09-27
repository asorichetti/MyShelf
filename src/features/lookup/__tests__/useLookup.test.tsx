import { act, renderHook } from '@testing-library/react-native';

import { StaticDatabaseProvider, type Db } from '@/db';
import { OfflineError } from '@/services/http';
import type { MetadataService } from '@/services/metadata';
import { gbIsbnUrl } from '@/services/metadata/__fixtures__/googleBooksRoutes';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata } from '@/testing/fixtureMetadata';

import { lookupMessages, useLookup } from '../useLookup';

import type { ReactNode } from 'react';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

function wrapper({ children }: { children: ReactNode }) {
  return <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;
}

function render(service: MetadataService) {
  return renderHook(() => useLookup({ service }), { wrapper });
}

describe('useLookup', () => {
  it('looks up an ISBN and returns the merged candidate', async () => {
    const { service, fixtures } = createFixtureMetadata();
    const { result } = render(service);
    await act(() => result.current.lookupIsbn('978-0-552-16659-1'));
    expect(fixtures.unmocked).toEqual([]);
    const state = result.current.state;
    expect(state.status).toBe('results');
    if (state.status !== 'results') return;
    expect(state.mode).toBe('isbn');
    expect(state.candidates).toHaveLength(1);
    expect(state.candidates[0]).toMatchObject({ title: 'The Colour of Magic', source: 'openlibrary' });
  });

  it('searches free text, lower-cased, and ranks the work first', async () => {
    const { service, fixtures } = createFixtureMetadata();
    const { result } = render(service);
    await act(() => result.current.search('  Colour of Magic   Pratchett '));
    expect(fixtures.unmocked).toEqual([]);
    const state = result.current.state;
    expect(state.status).toBe('results');
    if (state.status !== 'results') return;
    expect(state.query).toBe('Colour of Magic Pratchett');
    expect(state.candidates[0].title).toBe('The Colour of Magic');
  });

  it('prefers the language of the words typed, else the app\'s', async () => {
    const { service } = createFixtureMetadata();
    const search = jest.spyOn(service, 'search').mockResolvedValue({ candidates: [], warnings: [] });
    const { result } = render(service);
    await act(() => result.current.search('Cien años de soledad'));
    expect(search).toHaveBeenLastCalledWith({ text: 'cien años de soledad', language: { code: 'es', detected: true } }, expect.anything());
    await act(() => result.current.search('Mort Pratchett'));
    expect(search).toHaveBeenLastCalledWith({ text: 'mort pratchett', language: { code: 'en', detected: false } }, expect.anything());
  });

  it('treats an ISBN typed into the search box as an ISBN lookup', async () => {
    const { service } = createFixtureMetadata();
    const { result } = render(service);
    await act(() => result.current.search(OL_BOOKS.theMartian));
    expect(result.current.state).toMatchObject({ status: 'results', mode: 'isbn' });
  });

  it('reports an unknown ISBN as empty', async () => {
    const { service } = createFixtureMetadata();
    const { result } = render(service);
    await act(() => result.current.lookupIsbn(OL_BOOKS.unknown));
    expect(result.current.state).toMatchObject({ status: 'empty', mode: 'isbn', query: OL_BOOKS.unknown });
  });

  it('explains a bad ISBN without asking the network', async () => {
    const { service, fixtures } = createFixtureMetadata();
    const { result } = render(service);
    await act(() => result.current.lookupIsbn('9780000000000'));
    expect(result.current.state).toMatchObject({ status: 'error', reason: 'invalid', message: lookupMessages.invalid });
    await act(() => result.current.lookupIsbn('  '));
    expect(result.current.state).toMatchObject({ status: 'error', reason: 'invalid', message: lookupMessages.empty });
    await act(() => result.current.search(''));
    expect(result.current.state).toMatchObject({ status: 'error', message: lookupMessages.emptySearch });
    expect(fixtures.calls).toEqual([]);
  });

  it('keeps Open Library results when Google Books fails, with a warning', async () => {
    const { service } = createFixtureMetadata({ [gbIsbnUrl(OL_BOOKS.colourOfMagic)]: { status: 500, body: { error: 'x' } } });
    const { result } = render(service);
    await act(() => result.current.lookupIsbn(OL_BOOKS.colourOfMagic));
    const state = result.current.state;
    expect(state.status).toBe('results');
    if (state.status !== 'results') return;
    expect(state.candidates[0].source).toBe('openlibrary');
    expect(state.warnings).toEqual([expect.objectContaining({ provider: 'googlebooks', reason: 'failed' })]);
  });

  it('says it is offline when neither catalogue answers', async () => {
    const { service } = createFixtureMetadata();
    jest.spyOn(service, 'lookupIsbn').mockRejectedValue(new OfflineError('https://openlibrary.org'));
    const { result } = render(service);
    await act(() => result.current.lookupIsbn(OL_BOOKS.colourOfMagic));
    expect(result.current.state).toMatchObject({ status: 'error', reason: 'offline', message: lookupMessages.offline });
  });

  it('cancelling mid-lookup aborts the request and goes back to idle', async () => {
    const { service } = createFixtureMetadata();
    let seen: AbortSignal | undefined;
    jest.spyOn(service, 'lookupIsbn').mockImplementation(
      (_isbn, { signal } = {}) =>
        new Promise((_resolve, reject) => {
          seen = signal;
          signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    );
    const { result } = render(service);
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.lookupIsbn(OL_BOOKS.colourOfMagic);
    });
    expect(result.current.state).toMatchObject({ status: 'loading', mode: 'isbn' });
    act(() => result.current.cancel());
    await act(async () => pending);
    expect(seen?.aborted).toBe(true);
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('aborts a lookup in progress when the screen goes away', async () => {
    const { service } = createFixtureMetadata();
    let seen: AbortSignal | undefined;
    jest.spyOn(service, 'search').mockImplementation((_q, { signal } = {}) => {
      seen = signal;
      return new Promise(() => {});
    });
    const { result, unmount } = render(service);
    act(() => {
      void result.current.search('dune');
    });
    unmount();
    expect(seen?.aborted).toBe(true);
  });
});
