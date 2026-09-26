import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { AddBookScreen, EditBookScreen } from '@/features/book/BookFormScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const routes = { 'book/new': AddBookScreen, 'book/[id]': BookDetailScreen, 'book/[id]/edit': EditBookScreen };

async function press(testID: string) {
  await act(async () => fireEvent.press(screen.getByTestId(testID)));
  await advance(0);
}

async function openAddForm() {
  await loadFixture(db, 'empty');
  const r = renderApp(db, '/', routes);
  await advance(0);
  await press(Testids.home.addButton);
  expect(r.getPathname()).toBe('/book/new');
  return r;
}

describe('Adding a book by hand', () => {
  it('saves, shows the book with a Saved snackbar, and lists it on the Shelf', async () => {
    const r = await openAddForm();
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.title), 'The Hobbit');
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.authorInput), 'J. R. R. Tolkien');
    fireEvent(screen.getByTestId(Testids.bookForm.authorInput), 'submitEditing');
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.year), '1937');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Add genre Fantasy' })));
    await press(Testids.bookForm.save);

    const [book] = await booksRepo.listBooks(db);
    expect(r.getPathname()).toBe(`/book/${book.id}`);
    expect(screen.getByTestId(Testids.bookDetail.title)).toHaveTextContent('The Hobbit');
    expect(screen.getByTestId(Testids.bookDetail.authors)).toHaveTextContent('J. R. R. Tolkien');
    expect(screen.getByTestId(Testids.bookDetail.callNumber)).toHaveTextContent('FIC TOL 1937');
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent('Saved “The Hobbit” to your shelf');

    await press(Testids.bookDetail.back);
    expect(r.getPathname()).toBe('/');
    expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(1);
  });

  it('keeps an invalid ISBN from saving and says why', async () => {
    const r = await openAddForm();
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.title), 'Mystery');
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.isbn), '9780000000000');
    await press(Testids.bookForm.save);
    expect(r.getPathname()).toBe('/book/new');
    expect(screen.getByTestId(Testids.bookForm.error)).toHaveTextContent(/Please check the ISBN field/);
    expect(screen.getByText('That ISBN doesn’t look right — check the last digit.')).toBeOnTheScreen();
    expect(await booksRepo.countBooks(db)).toBe(0);
  });
});

describe('Unsaved changes', () => {
  it('asks before discarding, and Keep editing stays on the form', async () => {
    const r = await openAddForm();
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.title), 'Half typed');
    await press(Testids.bookForm.cancel);
    expect(screen.getByTestId(Testids.dialog.root)).toBeOnTheScreen();
    expect(screen.getByText('Discard your changes?')).toBeOnTheScreen();
    await press(Testids.dialog.cancel);
    expect(screen.queryByTestId(Testids.dialog.root)).toBeNull();
    expect(r.getPathname()).toBe('/book/new');
    expect(screen.getByTestId(Testids.bookForm.title).props.value).toBe('Half typed');

    await press(Testids.bookForm.cancel);
    await press(Testids.dialog.confirm);
    expect(r.getPathname()).toBe('/');
    expect(await booksRepo.countBooks(db)).toBe(0);
  });

  it('lets a clean form go without asking', async () => {
    const r = await openAddForm();
    await press(Testids.bookForm.cancel);
    expect(screen.queryByTestId(Testids.dialog.root)).toBeNull();
    expect(r.getPathname()).toBe('/');
  });
});

describe('Editing a book', () => {
  it('changes a field and returns to the updated detail page', async () => {
    await loadFixture(db, 'demo');
    const [mort] = await booksRepo.findBooksByIsbn(db, '9780552131063');
    const r = renderApp(db, `/book/${mort.id}`, routes);
    await advance(0);
    await press(Testids.bookDetail.edit);
    expect(r.getPathname()).toBe(`/book/${mort.id}/edit`);
    expect(screen.getByTestId(Testids.bookForm.year).props.value).toBe('1987');
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.year), '1988');
    await press(Testids.bookForm.save);
    expect(r.getPathname()).toBe(`/book/${mort.id}`);
    expect(screen.getByTestId(Testids.bookDetail.callNumber)).toHaveTextContent('FIC PRA 1988');
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent('Saved your changes');
  });

  it('shows the missing-book state for an unknown id', async () => {
    renderApp(db, '/book/4242/edit', routes);
    await advance(0);
    expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
  });
});
