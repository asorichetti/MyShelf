import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { settingsRepo, type Db } from '@/db';
import { PREFS_DEBOUNCE_MS } from '@/features/shelf/useShelfPrefs';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const routes = {
  'book/[id]': stubScreen('book'),
  'genres/index': stubScreen('genres'),
  'genres/[id]': stubScreen('genre'),
  'series/index': stubScreen('series'),
  'series/[id]': stubScreen('series-detail'),
  'authors/index': stubScreen('authors'),
  'group/[id]': stubScreen('group'),
};

const headers = () => screen.queryAllByTestId(Testids.shelfView.sectionHeader).map((h) => within(h).getByRole('heading').props.accessibilityLabel as string);

async function openShelf() {
  const r = renderApp(db, '/', routes);
  await waitFor(() => expect(screen.getAllByTestId(Testids.home.row).length).toBeGreaterThanOrEqual(12));
  return r;
}

async function groupBy(id: string) {
  await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.groupByButton)));
  await act(async () => fireEvent.press(screen.getByTestId(id)));
}

describe('Shelf group by', () => {
  it('groups by genre with brass section headers and counts matching demo', async () => {
    await openShelf();
    expect(headers()).toEqual([]);
    await groupBy(Testids.shelfView.groupByGenre);
    // The list is virtualized: the first screenful of sections is rendered (all four are checked in shelfSections.test.ts).
    await waitFor(() => expect(headers().slice(0, 3)).toEqual(['Classics, 2 books', 'Fantasy, 6 books', 'Mystery, 3 books']));
    expect(screen.getByText('Fantasy · 6')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Genre' })).toBeChecked();
    // One h1 still, section headers are h2.
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
    expect(screen.getByTestId(Testids.home.resultCount)).toHaveTextContent('Showing all 12 books');
  });

  it('opens a section’s own page from its header', async () => {
    const r = await openShelf();
    await groupBy(Testids.shelfView.groupByGenre);
    await waitFor(() => expect(headers().length).toBeGreaterThanOrEqual(3));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Open Mystery' })));
    expect(r.getPathname()).toMatch(/^\/genres\/\d+$/);
  });

  it('groups by series, author and my groups', async () => {
    await openShelf();
    await groupBy(Testids.shelfView.groupBySeries);
    await waitFor(() => expect(headers()).toEqual(['Discworld, 3 books', 'Earthsea, 2 books', 'Not in a series, 7 books']));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.groupByAuthor)));
    await waitFor(() => expect(headers()[0]).toBe('Jane Austen, 1 book'));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.groupByGroup)));
    await waitFor(() => expect(headers()).toEqual(['Holiday reads, 3 books', 'Not in a group, 9 books']));
  });

  it('groups by rating, best first, unrated last, with no page to open', async () => {
    await openShelf();
    await groupBy(Testids.shelfView.groupByRating);
    await waitFor(() => expect(headers()).toEqual(['5 stars, 3 books', '4 stars, 2 books', '3 stars, 2 books', 'Not rated, 5 books']));
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull();
  });

  it('sorts by rating and filters by a minimum rating, and remembers both', async () => {
    const first = await openShelf();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.home.sortButton)));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.sortSheet.levelKey)));
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Rating' })));
    const names = () => screen.getAllByTestId(Testids.home.row).map((r) => r.props.accessibilityLabel as string);
    await waitFor(() => expect(names()[0]).toBe('Good Omens, by Terry Pratchett and Neil Gaiman, 1990, rated 5 out of 5'));
    expect(screen.getByTestId(Testids.home.sortButton)).toHaveTextContent(/Sort: Rating$/);
    expect(screen.getByTestId(Testids.sortSheet.levelDirection)).toHaveTextContent(/Highest first$/);
    expect(names().slice(0, 7).map((n) => /rated (\d)/.exec(n)?.[1])).toEqual(['5', '5', '5', '4', '4', '3', '3']);
    expect(names().slice(7).every((n) => !n.includes('rated'))).toBe(true);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.sortSheet.levelDirection)));
    await waitFor(() => expect(names()[0]).toMatch(/rated 3 out of 5/));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.sortSheet.done)));
    expect(names()[names().length - 1]).not.toMatch(/rated/);

    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.filterButton)));
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: '4 stars and up' })));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.filterDone)));
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(5));
    expect(screen.getByText('4 stars and up')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.home.resultCount)).toHaveTextContent('5 of 12 books match your filters');
    await advance(PREFS_DEBOUNCE_MS);
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'shelfFilters')).toMatchObject({ minRating: 4 }));
    expect(await settingsRepo.getSetting(db, 'shelfSort')).toEqual({ levels: [{ key: 'rating', direction: 'asc' }] });
    first.unmount();
    renderApp(db, '/', routes);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(5));
    expect(names()[0]).toMatch(/rated 4 out of 5/);
  });

  it('remembers the grouping and display mode', async () => {
    const first = await openShelf();
    await groupBy(Testids.shelfView.groupBySeries);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.modeSpines)));
    await advance(PREFS_DEBOUNCE_MS);
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'shelfGroupBy')).toBe('series'));
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'shelfViewMode')).toBe('spines'));
    first.unmount();
    renderApp(db, '/', routes);
    await waitFor(() => expect(headers()).toHaveLength(3));
    expect(screen.getAllByTestId(Testids.shelfView.spine).length).toBeGreaterThan(0);
  });

  it('opens each browse index, and hides the chips while searching', async () => {
    const r = await openShelf();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Browse authors' })));
    expect(r.getPathname()).toBe('/authors');
    act(() => router.back());
    await waitFor(() => expect(screen.getByTestId(Testids.shelfView.browse)).toBeOnTheScreen());
    fireEvent.changeText(screen.getByTestId(Testids.home.search), 'dune');
    expect(screen.queryByTestId(Testids.shelfView.browse)).toBeNull();
  });

  it('selects books with a long press and deletes them with Undo', async () => {
    await openShelf();
    await act(async () => fireEvent(screen.getByRole('button', { name: /^Mort, / }), 'longPress'));
    expect(screen.getByTestId(Testids.selection.count)).toHaveTextContent('1 book selected');
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: /^Dune, / })));
    expect(screen.getByTestId(Testids.selection.count)).toHaveTextContent('2 books selected');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.selection.delete)));
    expect(screen.getByText('Remove 2 books?')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.dialog.confirm)));
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(10));
    expect(screen.queryByTestId(Testids.selection.bar)).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.snackbar.action)));
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row).length).toBeGreaterThanOrEqual(12));
  });

  it('filters, shows removable chips and clears them', async () => {
    await openShelf();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.filterButton)));
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Mystery, 3 books' })));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.filterLoanOnLoan)));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.filterDone)));
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(1));
    expect(screen.getByRole('button', { name: /^The Murder of Roger Ackroyd/ })).toBeOnTheScreen();
    expect(screen.getAllByTestId(Testids.shelfView.filterChip)).toHaveLength(2);
    expect(screen.getByTestId(Testids.home.resultCount)).toHaveTextContent('1 of 12 books match your filters');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.shelfView.filterClear)));
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row).length).toBeGreaterThanOrEqual(12));
    expect(screen.queryAllByTestId(Testids.shelfView.filterChip)).toHaveLength(0);
  });
});
