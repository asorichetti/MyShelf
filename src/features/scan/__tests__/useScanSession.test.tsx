import { act, renderHook } from '@testing-library/react-native';

import { StaticDatabaseProvider, type Db } from '@/db';
import { OfflineError } from '@/services/http';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';

import { clearSessions, getSession, type ScanSession } from '../sessionStore';
import { scanMessages, useScanSession } from '../useScanSession';

import type { ReactNode } from 'react';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('../haptics', () => ({ tick: jest.fn() }));

let db: Db;
let metadata: FixtureMetadata;
beforeEach(async () => {
  db = await createTestDb();
  metadata = createFixtureMetadata();
  clearSessions();
});
afterEach(() => db.close());

function wrapper({ children }: { children: ReactNode }) {
  return <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;
}

function render() {
  const onFound = jest.fn<void, [ScanSession]>();
  const lookup = jest.spyOn(metadata.service, 'lookupIsbn');
  const utils = renderHook(() => useScanSession({ service: metadata.service, onFound }), { wrapper });
  return { onFound, lookup, ...utils };
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('useScanSession: barcodes (P03-03)', () => {
  it('a valid ISBN triggers exactly one lookup, even when the camera reports it many times', async () => {
    const { result, onFound, lookup } = render();
    const { tick } = jest.requireMock('../haptics');
    act(() => {
      result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.colourOfMagic });
      result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.colourOfMagic });
    });
    await settle();
    act(() => result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.colourOfMagic }));
    await settle();
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(onFound).toHaveBeenCalledTimes(1);
    const session = onFound.mock.calls[0][0];
    expect(session).toMatchObject({ source: 'barcode', isbn13: OL_BOOKS.colourOfMagic });
    expect(session.candidates[0].title).toBe('The Colour of Magic');
    expect(getSession(session.id)).toBe(session);
    expect(result.current.lastFound?.title).toBe('The Colour of Magic');
  });

  it('reads an ISBN-10 book printed as EAN-13', async () => {
    const { result, lookup } = render();
    act(() => result.current.onBarcode({ type: 'ean13', data: '9780345339706' }));
    await settle();
    expect(lookup).toHaveBeenCalledWith('9780345339706', expect.anything());
  });

  it('accepts a 979-10 ISBN (and says when no catalogue knows it)', async () => {
    const { result, lookup, onFound } = render();
    act(() => result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.unknown }));
    await settle();
    expect(lookup).toHaveBeenCalledWith(OL_BOOKS.unknown, expect.anything());
    expect(result.current.state).toEqual({ phase: 'not-found', kind: 'isbn', isbn13: OL_BOOKS.unknown, guess: null });
    expect(onFound).not.toHaveBeenCalled();
  });

  it('a product barcode shows the not-a-book message and looks nothing up; unreadable reads are ignored', async () => {
    const { result, lookup } = render();
    act(() => result.current.onBarcode({ type: 'upc_a', data: '036000291452' }));
    expect(result.current.state).toEqual({ phase: 'not-book', data: '036000291452' });
    act(() => result.current.resume());
    act(() => result.current.onBarcode({ type: 'ean13', data: '9780552166592' }));
    expect(result.current.state).toEqual({ phase: 'ready' });
    expect(lookup).not.toHaveBeenCalled();
    expect(scanMessages.notBook).toMatch(/978/);
  });

  it('pauses while a lookup runs', async () => {
    const { result } = render();
    jest.spyOn(metadata.service, 'lookupIsbn').mockReturnValue(new Promise(() => {}));
    act(() => result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.colourOfMagic }));
    expect(result.current.paused).toBe(true);
    expect(result.current.state).toEqual({ phase: 'looking-up', kind: 'isbn', label: 'Looking up 978-0-552-16659-1…' });
  });
});

describe('useScanSession: typed input (P03-07)', () => {
  it('looks up a typed ISBN, and explains a bad one', async () => {
    const { result, onFound } = render();
    act(() => result.current.submitIsbn('0-345-33970-3'));
    await settle();
    expect(onFound.mock.calls[0][0]).toMatchObject({ source: 'isbn', isbn13: '9780345339706' });
    act(() => result.current.submitIsbn('12345'));
    expect(result.current.state).toMatchObject({ phase: 'error', reason: 'invalid', message: scanMessages.invalidIsbn });
  });

  it('searches typed cover text the way OCR output would be', async () => {
    const { result, onFound } = render();
    const search = jest.spyOn(metadata.service, 'search');
    act(() => result.current.submitCoverText('THE COLOUR OF MAGIC TERRY PRATCHETT'));
    await settle();
    expect(search).toHaveBeenCalledWith({ text: 'the colour of magic terry pratchett' }, expect.anything());
    const session = onFound.mock.calls[0][0];
    expect(session.source).toBe('cover');
    expect(session.guess).toEqual({ text: 'the colour of magic terry pratchett' });
    expect(session.candidates.length).toBeGreaterThan(1);
  });

  it('tries the next query when one finds nothing, and keeps the best guess when none does', async () => {
    const { result } = render();
    const search = jest.spyOn(metadata.service, 'search').mockResolvedValue({ candidates: [], warnings: [] });
    act(() => result.current.submitCoverText('Mort\nTerry Pratchett'));
    await settle();
    expect(search.mock.calls.map((c) => c[0])).toEqual([{ title: 'mort', author: 'terry pratchett' }, { title: 'mort' }, { text: 'mort terry pratchett' }]);
    expect(result.current.state).toEqual({ phase: 'not-found', kind: 'cover', isbn13: null, guess: { title: 'mort', author: 'terry pratchett' } });
  });
});

describe('useScanSession: results (P03-04)', () => {
  it('offline: keeps scanning and says it will look the ISBN up later', async () => {
    const { result, onFound } = render();
    jest.spyOn(metadata.service, 'lookupIsbn').mockRejectedValue(new OfflineError('https://openlibrary.org'));
    act(() => result.current.submitIsbn(OL_BOOKS.colourOfMagic));
    await settle();
    expect(result.current.state).toEqual({ phase: 'ready' });
    expect(result.current.notice).toEqual({ expression: 'sleepy', message: scanMessages.queued });
    expect(onFound).not.toHaveBeenCalled();
  });

  it('cancel aborts the lookup and returns to scanning', async () => {
    const { result } = render();
    let signal: AbortSignal | undefined;
    jest.spyOn(metadata.service, 'lookupIsbn').mockImplementation((_i, o) => {
      signal = o?.signal;
      return new Promise(() => {});
    });
    act(() => result.current.submitIsbn(OL_BOOKS.colourOfMagic));
    act(() => result.current.cancel());
    expect(signal?.aborted).toBe(true);
    expect(result.current.state).toEqual({ phase: 'ready' });
    expect(result.current.paused).toBe(false);
  });

  it('an unexpected failure shows a gentle error', async () => {
    const { result } = render();
    jest.spyOn(metadata.service, 'lookupIsbn').mockRejectedValue(new Error('boom'));
    act(() => result.current.submitIsbn(OL_BOOKS.colourOfMagic));
    await settle();
    expect(result.current.state).toEqual({ phase: 'error', reason: 'failed', message: scanMessages.failed });
  });

  it('without onFound, opens the edition picker', async () => {
    const { router } = jest.requireMock('expo-router');
    const { result } = renderHook(() => useScanSession({ service: metadata.service }), { wrapper });
    act(() => result.current.submitIsbn(OL_BOOKS.theMartian));
    await settle();
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/scan/pick', params: { session: expect.any(String) } });
  });
});
