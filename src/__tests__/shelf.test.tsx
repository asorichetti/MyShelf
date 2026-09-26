import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import { emit } from '@/features/events';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const routes = { 'book/[id]': stubScreen('book'), 'book/new': stubScreen('new') };

describe('Shelf screen', () => {
  it('lists the demo library as 12 catalogue-card rows', async () => {
    await loadFixture(db, 'demo');
    renderApp(db, '/', routes);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(12));
    expect(screen.getByTestId(Testids.home.bookCount)).toHaveTextContent('12 books catalogued');
    expect(screen.getByRole('button', { name: 'Mort, by Terry Pratchett, 1987' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dune, by Frank Herbert, 1965, on loan to Sam' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'The Murder of Roger Ackroyd, by Agatha Christie, 1926, on loan to Priya, overdue' })).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.home.resultCount)).toHaveTextContent('Showing all 12 books');
    expect(screen.queryByTestId(Testids.emptyState.root)).toBeNull();
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
  });

  it('opens a book when its row is tapped', async () => {
    await loadFixture(db, 'demo');
    const r = renderApp(db, '/', routes);
    const row = await screen.findByRole('button', { name: /^Mort, / });
    await act(async () => fireEvent.press(row));
    const [mort] = await booksRepo.findBooksByIsbn(db, '9780552131063');
    expect(r.getPathname()).toBe(`/book/${mort.id}`);
  });

  it('adds a book from the floating button', async () => {
    await loadFixture(db, 'demo');
    const r = renderApp(db, '/', routes);
    await screen.findAllByTestId(Testids.home.row);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Add book' })));
    expect(r.getPathname()).toBe('/book/new');
  });

  it('shows the empty state, with Booky, a scan action and an add-manually action', async () => {
    await loadFixture(db, 'empty');
    const r = renderApp(db, '/', routes);
    expect(await screen.findByTestId(Testids.emptyState.root)).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.booky.avatar)).toBeOnTheScreen();
    expect(screen.getByText('Your shelf is empty')).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.home.search)).toBeNull();
    expect(screen.queryAllByTestId(Testids.home.row)).toHaveLength(0);
    // One "add" control at a time: the empty state's, not the floating button.
    expect(screen.getAllByTestId(Testids.home.addButton)).toHaveLength(1);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Add manually' })));
    expect(r.getPathname()).toBe('/book/new');
  });

  it('refreshes when the library changes, with no manual reload', async () => {
    await loadFixture(db, 'demo');
    renderApp(db, '/', routes);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(12));
    await act(async () => {
      await booksRepo.createBook(db, { title: 'Aardvark Adventures' });
      emit('library-changed');
    });
    await advance(0);
    expect(screen.getByTestId(Testids.home.bookCount)).toHaveTextContent('13 books catalogued');
    // Sorted by title, the new book is the first row (FlatList renders the rest in batches).
    expect(screen.getAllByTestId(Testids.home.row)[0].props.accessibilityLabel).toBe('Aardvark Adventures');
  });
});
