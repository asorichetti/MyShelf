/**
 * P09-04: a save or lookup that finishes after its screen has gone does not
 * navigate (which would pop another screen), move focus or start new work.
 */
import { router } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import * as bookLookups from '@/db/repositories/bookLookups';
import * as books from '@/db/repositories/books';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { EditBookScreen } from '@/features/book/BookFormScreen';
import { attachCoverFromCandidate } from '@/features/covers';
import { RefreshScreen } from '@/features/lookup/RefreshScreen';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let mockMetadata: FixtureMetadata;
jest.mock('@/features/lookup/metadataService', () => ({
  useMetadataService: () => mockMetadata.service,
  getLookupServices: () => ({ http: mockMetadata.http, metadata: mockMetadata.service }),
}));
jest.mock('@/features/covers', () => ({
  ...jest.requireActual('@/features/covers'),
  attachCoverFromCandidate: jest.fn(async () => ({ status: 'none', tried: [] })),
  backfillCoversNow: jest.fn(async () => ({ checked: 0, attached: 0, none: 0, failed: 0, offline: false })),
}));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  mockMetadata = createFixtureMetadata();
  jest.mocked(attachCoverFromCandidate).mockClear();
  await loadFixture(db, 'demo');
});
afterEach(() => {
  jest.restoreAllMocks();
  db.close();
});

const routes = { 'book/[id]': BookDetailScreen, 'book/[id]/refresh': RefreshScreen, 'book/[id]/edit': EditBookScreen };

async function bookId(title: string) {
  return (await booksRepo.listBooks(db)).find((b) => b.title === title)!.id;
}

/** Holds the next call to `fn` until `release()`. */
function hold(name: 'refreshBook' | 'saveBookDraft') {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  // refreshBook lives in bookLookups (booksRepo re-exports both modules).
  const mod = (name === 'refreshBook' ? bookLookups : books) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  const real = mod[name]!;
  jest.spyOn(mod, name).mockImplementation((async (...args: unknown[]) => {
    await gate;
    return real(...args);
  }) as never);
  return () => act(async () => release());
}

async function press(el: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(el);
  });
}

describe('unmount guards', () => {
  it('a refresh saved after leaving its screen does not pop the book as well', async () => {
    const id = await bookId('The Farthest Shore');
    const r = renderApp(db, `/book/${id}`, routes);
    await advance(0);
    act(() => router.push(`/book/${id}/refresh`));
    await advance(0);
    expect(r.getPathname()).toBe(`/book/${id}/refresh`);
    const release = hold('refreshBook');
    await press(screen.getByTestId(Testids.refresh.apply));
    // The user goes back while the save is still running.
    act(() => router.back());
    await advance(0);
    expect(r.getPathname()).toBe(`/book/${id}`);
    await release();
    await advance(0);
    expect(r.getPathname()).toBe(`/book/${id}`);
    // The save still happened, and says so.
    expect((await booksRepo.getBookDetail(db, id))?.summary).toMatch(/^A young prince/);
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent(/^Updated/);
  });

  it('an edit saved after leaving the form does not go back again', async () => {
    const id = await bookId('Dune');
    const r = renderApp(db, `/book/${id}`, routes);
    await advance(0);
    act(() => router.push(`/book/${id}/edit`));
    await advance(0);
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.title), 'Dune Messiah');
    const release = hold('saveBookDraft');
    await press(screen.getByTestId(Testids.bookForm.save));
    act(() => router.back());
    await advance(0);
    expect(r.getPathname()).toBe(`/book/${id}`);
    await release();
    await advance(0);
    expect(r.getPathname()).toBe(`/book/${id}`);
    expect((await booksRepo.getBook(db, id))?.title).toBe('Dune Messiah');
  });

  it('still goes back when the screen is there to leave', async () => {
    const id = await bookId('Dune');
    const r = renderApp(db, `/book/${id}`, routes);
    await advance(0);
    act(() => router.push(`/book/${id}/edit`));
    await advance(0);
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.title), 'Dune (Deluxe)');
    await press(screen.getByTestId(Testids.bookForm.save));
    await advance(0);
    expect(r.getPathname()).toBe(`/book/${id}`);
  });
});
