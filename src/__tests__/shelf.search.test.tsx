import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { settingsRepo, type Db } from '@/db';
import { SEARCH_DEBOUNCE_MS } from '@/features/shelf/useShelf';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp } from '@/testing/renderApp';
import { oneKey } from '@/testing/sorts';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const rowNames = () => screen.getAllByTestId(Testids.home.row).map((r) => r.props.accessibilityLabel as string);

async function openShelf() {
  const r = renderApp(db, '/');
  await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(12));
  return r;
}

describe('Shelf search', () => {
  it('filters as you type and announces the result count', async () => {
    await openShelf();
    fireEvent.changeText(screen.getByTestId(Testids.home.search), 'prat');
    await advance(SEARCH_DEBOUNCE_MS);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(4));
    expect(rowNames().every((n) => n.includes('Terry Pratchett'))).toBe(true);
    const status = screen.getByTestId(Testids.home.resultCount);
    expect(status).toHaveTextContent('4 of 12 books match “prat”');
    expect(status.props['aria-live']).toBe('polite');
  });

  it('shows Booky and a clear action when nothing matches', async () => {
    await openShelf();
    fireEvent.changeText(screen.getByTestId(Testids.home.search), 'zzzz');
    await advance(SEARCH_DEBOUNCE_MS);
    expect(await screen.findByTestId(Testids.home.noMatches)).toBeOnTheScreen();
    expect(screen.getByLabelText('Booky the bookmark, thinking')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.home.resultCount)).toHaveTextContent('No books match “zzzz”');
    await act(async () => fireEvent.press(screen.getByText('Clear search')));
    await advance(SEARCH_DEBOUNCE_MS);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(12));
    expect(screen.getByTestId(Testids.home.search).props.value).toBe('');
  });

  it('clears the search with the clear button', async () => {
    await openShelf();
    fireEvent.changeText(screen.getByTestId(Testids.home.search), 'dune');
    await advance(SEARCH_DEBOUNCE_MS);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(1));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.home.searchClear)));
    await advance(SEARCH_DEBOUNCE_MS);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(12));
  });
});

describe('Shelf sort', () => {
  it('re-orders the list from the Sort sheet and keeps the order after a restart', async () => {
    const first = await openShelf();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.home.sortButton)));
    expect(await screen.findByTestId(Testids.sortSheet.root)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.sortSheet.levelKey)));
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Year published' })));
    await waitFor(() => expect(rowNames()[0]).toMatch(/^Pride and Prejudice/));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.sortSheet.levelDirection)));
    await waitFor(() => expect(rowNames()[0]).toMatch(/^Good Omens/));
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'shelfSort')).toEqual(oneKey('year', 'desc')));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.sortSheet.done)));
    first.unmount();

    await openShelf();
    expect(rowNames()[0]).toMatch(/^Good Omens/);
    expect(screen.getByTestId(Testids.home.sortButton)).toHaveTextContent(/Sort: Year published \(Newest first\)$/);
    expect(screen.getByTestId(Testids.home.sortSummary)).toHaveTextContent('Sorted by Year published (Newest first)');
  });
});
