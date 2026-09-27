import { act, renderHook } from '@testing-library/react-native';

import { StaticDatabaseProvider, type Db } from '@/db';
import { textBounds, type OcrResult } from '@/domain';
import { OfflineError } from '@/services/http';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';

import { clearSessions, getSession, type ScanSession } from '../sessionStore';
import { ocrWords, scanMessages, typedFromQuery, useScanSession } from '../useScanSession';

import type { ReactNode } from 'react';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('../haptics', () => ({ tick: jest.fn() }));
jest.mock('../tempPhoto', () => ({ discardPhoto: jest.fn() }));

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
  it('a barcode held in view is read once, however long it stays there (Scan several)', async () => {
    const { result, onFound, lookup } = render();
    let now = 1_000_000;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    // The camera reports the code about every half second while the book stays in front of it.
    for (let i = 0; i < 20; i++) {
      act(() => result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.colourOfMagic }));
      await settle();
      now += 500;
    }
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(onFound).toHaveBeenCalledTimes(1);
    // Taken away for longer than the window and shown again: a second copy, on purpose.
    now += 3500;
    act(() => result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.colourOfMagic }));
    await settle();
    expect(onFound).toHaveBeenCalledTimes(2);
    clock.mockRestore();
    jest.requireMock('../haptics').tick.mockClear();
  });

  it('a barcode still in view after a slow lookup is not read again', async () => {
    const { result, onFound, lookup } = render();
    let now = 1_000_000;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    const { service: real } = createFixtureMetadata();
    // The camera is paused while the lookup runs; this one takes five seconds.
    lookup.mockImplementation(async (...args) => {
      now += 5000;
      return real.lookupIsbn(...args);
    });
    act(() => result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.colourOfMagic }));
    await settle();
    now += 300;
    act(() => result.current.onBarcode({ type: 'ean13', data: OL_BOOKS.colourOfMagic }));
    await settle();
    expect(onFound).toHaveBeenCalledTimes(1);
    clock.mockRestore();
    jest.requireMock('../haptics').tick.mockClear();
  });

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
    // "the" and "of": the typed words are English, which the search and the picker prefer.
    const english = { code: 'en', detected: true };
    expect(search).toHaveBeenCalledWith({ text: 'the colour of magic terry pratchett', language: english }, expect.anything());
    const session = onFound.mock.calls[0][0];
    expect(session.source).toBe('cover');
    expect(session.guess).toEqual({ text: 'the colour of magic terry pratchett' });
    expect(session.language).toEqual(english);
    expect(session.candidates.length).toBeGreaterThan(1);
  });

  it('falls back through the author, then the other queries, and keeps the best guess when none finds anything', async () => {
    const { result } = render();
    const search = jest.spyOn(metadata.service, 'search').mockResolvedValue({ candidates: [], warnings: [] });
    act(() => result.current.submitCoverText('Mort\nTerry Pratchett'));
    await settle();
    // Nothing in "Mort, Terry Pratchett" says which language: the app's is preferred, as a weaker hint.
    const language = { code: 'en', detected: false };
    expect(search.mock.calls.map((c) => c[0])).toEqual([
      { title: 'mort', author: 'terry pratchett', language },
      { author: 'terry pratchett', language },
      { title: 'mort', language },
      { text: 'mort terry pratchett', language },
    ]);
    expect(result.current.state).toEqual({
      phase: 'not-found',
      kind: 'cover',
      isbn13: null,
      guess: { title: 'mort', author: 'terry pratchett' },
      typed: 'Mort\nTerry Pratchett',
    });
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

describe('useScanSession: cover photos (P03-05)', () => {
  const photo = 'file:///cache/ImagePicker/cover.jpg';
  const line = (text: string, y: number, height: number) => {
    const frame = { x: 100, y, width: 800, height };
    return { text, frame, lines: [{ text, frame }] };
  };
  const discard = () => jest.requireMock<{ discardPhoto: jest.Mock }>('../tempPhoto').discardPhoto;
  beforeEach(() => discard().mockClear());

  it('searches what was read and keeps the photo with the session', async () => {
    const { result, onFound } = render();
    // A real capture of Practical Magic, against the recorded Open Library search.
    const ocr = (jest.requireActual('@/domain/__fixtures__/ocr/real-practical-magic.json') as { result: OcrResult }).result;
    act(() => result.current.submitOcr(ocr, photo));
    await settle();
    const session = onFound.mock.calls[0][0];
    expect(session).toMatchObject({ source: 'cover', photoUri: photo, guess: { title: 'practical magic', author: 'alice hoffman' } });
    // Where the words are: the cover, to crop the photo to if it becomes the cover (P03-14).
    expect(session.photoFocus).toEqual(textBounds(ocr));
    expect(session.photoFocus!.width).toBeGreaterThan(0);
    expect(session.candidates[0]).toMatchObject({ title: 'Practical Magic', authors: ['Alice Hoffman'] });
    expect(discard()).not.toHaveBeenCalled();
  });

  it('no words at all: asks to fill the frame, and deletes the photo', () => {
    const { result } = render();
    act(() => result.current.submitOcr({ blocks: [] }, photo));
    expect(result.current.state).toEqual({ phase: 'error', reason: 'invalid', message: scanMessages.noCoverWords, typed: '' });
    expect(discard()).toHaveBeenCalledWith(photo);
  });

  it('words but no title: offers them to correct, largest first', () => {
    const { result } = render();
    act(() => result.current.submitOcr({ blocks: [line('£8.99', 1500, 30), line('WINNER OF THE BOOKER PRIZE', 100, 40)] }, photo));
    expect(result.current.state).toEqual({ phase: 'error', reason: 'invalid', message: scanMessages.noCoverRead, typed: 'WINNER OF THE BOOKER PRIZE' });
  });

  it('nothing found: offers the words read, as title and author lines, and deletes the photo', async () => {
    const { result } = render();
    jest.spyOn(metadata.service, 'search').mockResolvedValue({ candidates: [], warnings: [] });
    act(() => result.current.submitOcr({ blocks: [line('TERRY PRATCHETT', 80, 60), line('MORT', 400, 200)] }, photo));
    await settle();
    expect(result.current.state).toMatchObject({ phase: 'not-found', kind: 'cover', typed: 'Mort\nTerry Pratchett' });
    expect(discard()).toHaveBeenCalledWith(photo);
  });
});

describe('typed words from a cover', () => {
  it('turns a query into title and author lines', () => {
    expect(typedFromQuery({ title: 'the colour of magic', author: 'terry pratchett' })).toBe('The Colour Of Magic\nTerry Pratchett');
    expect(typedFromQuery({ text: 'dune frank herbert' })).toBe('Dune Frank Herbert');
    expect(typedFromQuery({ author: 'ali hazelwood' })).toBe('Ali Hazelwood');
  });

  it('keeps at most four lines with words, largest first', () => {
    const l = (text: string, height: number) => ({ text, frame: { x: 0, y: 0, width: 10, height }, lines: [] });
    expect(ocrWords({ blocks: [l('a', 90), l('SMALL', 10), l('BIG ONE', 80), l('~ 7', 70), l('MID', 50), l('LOW', 40), l('TINY', 20)] })).toBe('BIG ONE\nMID\nLOW\nTINY');
  });
});

describe('useScanSession: after the scanner has gone (P09-04)', () => {
  it('a cover read that finishes after unmounting starts no search and opens nothing', async () => {
    const search = jest.spyOn(metadata.service, 'search');
    const { result, onFound, unmount } = render();
    const submit = result.current.submitCoverText;
    unmount();
    act(() => submit('The Colour of Magic Terry Pratchett'));
    await settle();
    expect(search).not.toHaveBeenCalled();
    expect(onFound).not.toHaveBeenCalled();
  });
});
