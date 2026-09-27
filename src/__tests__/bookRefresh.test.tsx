import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, genresRepo, type Db } from '@/db';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
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
});
afterEach(() => db.close());

const routes = { 'book/[id]': BookDetailScreen, 'book/[id]/refresh': RefreshScreen };
const rf = Testids.refresh;

async function press(el: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(el);
  });
  await advance(0);
}

async function farthestShore() {
  await loadFixture(db, 'demo');
  const [book] = (await booksRepo.listBooks(db)).filter((b) => b.title === 'The Farthest Shore');
  return book;
}

function rows() {
  return screen.getAllByTestId(rf.fieldToggle).map((el) => ({ label: el.props.accessibilityLabel as string, checked: el.props.accessibilityState?.checked as boolean }));
}

describe('Refresh details', () => {
  it('opens from the book’s menu and lists changes, additions ticked and replacements not', async () => {
    const book = await farthestShore();
    const r = renderApp(db, `/book/${book.id}`, routes);
    await advance(0);
    await press(screen.getByTestId(Testids.bookDetail.more));
    await press(screen.getByTestId(rf.open));
    expect(r.getPathname()).toBe(`/book/${book.id}/refresh`);
    await advance(0);
    const list = rows();
    const find = (prefix: string) => list.find((x) => x.label.startsWith(prefix));
    expect(find('Summary: add A young prince')).toMatchObject({ checked: true });
    expect(find('Cover: add')).toMatchObject({ checked: true });
    expect(find('Pages: 223 → 214')).toMatchObject({ checked: false });
    expect(find('Year: 1972 → 1974')).toMatchObject({ checked: false });
    expect(find('Title')).toBeUndefined();
  });

  it('changes only the ticked fields (summary only)', async () => {
    const book = await farthestShore();
    const before = await booksRepo.getBookDetail(db, book.id);
    const r = renderApp(db, `/book/${book.id}/refresh`, routes);
    await advance(0);
    for (const el of screen.getAllByTestId(rf.fieldToggle)) {
      const label = el.props.accessibilityLabel as string;
      if (el.props.accessibilityState?.checked && !label.startsWith('Summary')) await press(el);
    }
    expect(screen.getByTestId(rf.apply)).toHaveTextContent('Update 1 detail');
    await press(screen.getByTestId(rf.apply));
    await advance(0);

    const after = await booksRepo.getBookDetail(db, book.id);
    expect(after?.summary).toMatch(/^A young prince joins forces with a master wizard/);
    expect({ ...after, summary: null, updatedAt: null }).toEqual({ ...before, summary: null, updatedAt: null });
    expect(attachCoverFromCandidate).not.toHaveBeenCalled();
    expect(r.getPathname()).not.toContain('/refresh');
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent('Updated 1 detail');
  });

  it('never removes a user-edited genre, and marks looked-up genres as not the user’s', async () => {
    const book = await farthestShore();
    const mine = await genresRepo.findOrCreateGenre(db, 'Sea stories');
    await genresRepo.setBookGenres(db, book.id, [mine.id], { userEdited: true });
    renderApp(db, `/book/${book.id}/refresh`, routes);
    await advance(0);
    const genres = screen.getAllByTestId(rf.fieldToggle).find((el) => (el.props.accessibilityLabel as string).startsWith('Genres'))!;
    expect(genres.props.accessibilityLabel).toMatch(/^Genres: Sea stories → Sea stories, Fantasy/);
    if (!genres.props.accessibilityState?.checked) await press(genres);
    await press(screen.getByTestId(rf.apply));
    await advance(0);

    const after = await booksRepo.getBookDetail(db, book.id);
    const flags = Object.fromEntries(after!.genres.map((g) => [g.name, g.userEdited]));
    expect(flags['Sea stories']).toBe(true);
    expect(flags.Fantasy).toBe(false);
  });

  it('stores the real cover when the cover is ticked', async () => {
    const book = await farthestShore();
    renderApp(db, `/book/${book.id}/refresh`, routes);
    await advance(0);
    await press(screen.getByTestId(rf.apply));
    await advance(0);
    expect(attachCoverFromCandidate).toHaveBeenCalledWith(db, book.id, expect.objectContaining({ sourceId: 'OL17852114M' }));
  });

  it('a double tap on Update applies the changes once', async () => {
    const book = await farthestShore();
    renderApp(db, `/book/${book.id}/refresh`, routes);
    await advance(0);
    await act(async () => {
      fireEvent.press(screen.getByTestId(rf.apply));
      fireEvent.press(screen.getByTestId(rf.apply));
    });
    await advance(0);
    expect(attachCoverFromCandidate).toHaveBeenCalledTimes(1);
  });

  it('says so when the catalogues have nothing new', async () => {
    await loadFixture(db, 'empty');
    const saved = await booksRepo.createBook(db, { title: 'Unknown', isbn13: '9791099999993' });
    renderApp(db, `/book/${saved.id}/refresh`, routes);
    await advance(0);
    expect(screen.getByText('No catalogue knows this one')).toBeOnTheScreen();
  });
});
