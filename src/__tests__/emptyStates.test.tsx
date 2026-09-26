import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { booksRepo, groupsRepo, type Db } from '@/db';
import { AuthorsScreen } from '@/features/authors/AuthorsScreen';
import { GenresScreen } from '@/features/genres/GenresScreen';
import { GroupDetailScreen } from '@/features/groups/GroupDetailScreen';
import { ScanReviewScreen } from '@/features/scan/ScanReviewScreen';
import { SeriesListScreen } from '@/features/series/SeriesListScreen';
import { SEARCH_DEBOUNCE_MS } from '@/features/shelf/useShelf';
import { createTestDb } from '@/testing/createTestDb';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

/**
 * P07-04: every list that can be empty says so with Booky (an expression
 * that fits) and one clear action.
 */

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const routes = {
  'genres/index': GenresScreen,
  'authors/index': AuthorsScreen,
  'series/index': SeriesListScreen,
  'group/[id]': GroupDetailScreen,
  'scan/review': ScanReviewScreen,
  'book/new': stubScreen('book/new'),
  'scan/pick': stubScreen('scan/pick'),
};

/** The empty state's Booky (by expression) and its buttons. */
async function expectEmpty(testID: string, expression: RegExp, actions: string[]) {
  const empty = await screen.findByTestId(testID);
  const booky = within(empty).getByRole('img');
  expect(booky.props.accessibilityLabel).toMatch(expression);
  expect(within(empty).queryAllByRole('button').map((b) => b.props.accessibilityLabel ?? '')).toEqual(actions);
  return empty;
}

describe('empty states', () => {
  it('Shelf: happy Booky, scan (and add by hand)', async () => {
    renderApp(db, '/', routes);
    await expectEmpty(Testids.emptyState.root, /smiling happily/, ['Scan a book', 'Add manually']);
  });

  it('Shelf search with no matches: thinking Booky, clear the search', async () => {
    await booksRepo.createBook(db, { title: 'Dune' });
    renderApp(db, '/', routes);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(1));
    fireEvent.changeText(screen.getByTestId(Testids.home.search), 'zzzz');
    await advance(SEARCH_DEBOUNCE_MS);
    await expectEmpty(Testids.home.noMatches, /thinking/, ['Clear search']);
  });

  it('Loans out and history: sleepy Booky, one way on', async () => {
    const r = renderApp(db, '/loans', routes);
    await expectEmpty(Testids.emptyState.root, /sleepy/, ['Go to your shelf']);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.loans.tabHistory)));
    await expectEmpty(Testids.emptyState.root, /sleepy/, ['See what’s out']);
    await act(async () => fireEvent.press(screen.getByText('See what’s out')));
    expect(screen.getByTestId(Testids.loans.tabOut).props.accessibilityState).toMatchObject({ selected: true });
    await act(async () => fireEvent.press(screen.getByText('Go to your shelf')));
    expect(r.getPathname()).toBe('/');
  });

  it('Groups: happy Booky, new group', async () => {
    renderApp(db, '/groups', routes);
    await expectEmpty(Testids.emptyState.root, /smiling happily/, ['New group']);
  });

  it('A group with no books: happy Booky, add books', async () => {
    const group = await groupsRepo.createGroup(db, { name: 'Favourites' });
    renderApp(db, `/group/${group.id}`, routes);
    await expectEmpty(Testids.emptyState.root, /smiling happily/, ['Add books']);
  });

  it.each([
    ['Series', '/series', Testids.seriesList.empty],
    ['Genres', '/genres', Testids.emptyState.root],
    ['Authors', '/authors', Testids.emptyState.root],
  ])('%s: sleepy Booky, add a book', async (_, url, testID) => {
    const r = renderApp(db, url, routes);
    await expectEmpty(testID, /sleepy/, ['Add a book']);
    await act(async () => fireEvent.press(screen.getByText('Add a book')));
    expect(r.getPathname()).toBe('/book/new');
  });

  it('Scan review tray: sleepy Booky, back to scanning', async () => {
    renderApp(db, '/scan/review', routes);
    await expectEmpty(Testids.emptyState.root, /sleepy/, ['Back to scanning']);
  });
});
