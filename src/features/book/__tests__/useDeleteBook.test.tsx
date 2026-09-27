import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { UNDO_WINDOW_MS } from '@/features/book/useDeleteBook';
import { deleteCoverFile } from '@/services/covers';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

jest.mock('@/services/covers', () => ({
  ...jest.requireActual('@/services/covers'),
  deleteCoverFile: jest.fn(() => true),
  isStoredCover: jest.fn(() => true),
}));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
  jest.mocked(deleteCoverFile).mockClear();
});
afterEach(() => db.close());

async function press(testID: string) {
  await act(async () => fireEvent.press(screen.getByTestId(testID)));
  await advance(0);
}

/** Shelf -> the book's detail page -> More -> Delete book. */
async function askToDelete(title: string) {
  const r = renderApp(db, '/', { 'book/[id]': BookDetailScreen });
  await advance(0);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${title}, `) })));
  await advance(0);
  await press(Testids.bookDetail.more);
  await press(Testids.bookDetail.delete);
  return r;
}

const bookCount = () => screen.getByTestId(Testids.home.bookCount);

describe('Deleting a book', () => {
  it('asks first, with Booky and the book’s title', async () => {
    await askToDelete('Mort');
    expect(screen.getByTestId(Testids.dialog.root)).toBeOnTheScreen();
    expect(screen.getByText('Remove “Mort” from your shelf? Loan history for it will be removed too.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Booky the bookmark, looking concerned')).toBeOnTheScreen();
    expect(screen.queryByText(/on loan to/)).toBeNull();
    await press(Testids.dialog.cancel);
    expect(screen.queryByTestId(Testids.dialog.root)).toBeNull();
    expect(await booksRepo.countBooks(db)).toBe(12);
  });

  it('warns when the book is out on loan', async () => {
    await askToDelete('Dune');
    expect(screen.getByText('It’s on loan to Sam right now, and that loan will be forgotten too.')).toBeOnTheScreen();
  });

  it('removes the book, returns to the Shelf and offers Undo, which puts it back', async () => {
    const r = await askToDelete('Dune');
    await press(Testids.dialog.confirm);
    expect(r.getPathname()).toBe('/');
    expect(bookCount()).toHaveTextContent('11 books catalogued');
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent(/^Removed “Dune” from your shelf/);

    await press(Testids.snackbar.action);
    await advance(0);
    expect(bookCount()).toHaveTextContent('12 books catalogued');
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent('“Dune” is back on your shelf');
    const [dune] = await booksRepo.findBooksByIsbn(db, '9780441172719');
    expect((await booksRepo.getBookDetail(db, dune.id))!.openLoan?.borrowerName).toBe('Sam');
  });

  it('stops offering Undo after six seconds', async () => {
    await askToDelete('Mort');
    await press(Testids.dialog.confirm);
    await advance(UNDO_WINDOW_MS - 100);
    expect(screen.getByTestId(Testids.snackbar.action)).toBeOnTheScreen();
    await advance(200);
    expect(screen.queryByTestId(Testids.snackbar.root)).toBeNull();
    expect(await booksRepo.countBooks(db)).toBe(11);
  });

  it('deletes a downloaded cover only once Undo has gone, never on the first tap', async () => {
    const [mort] = await booksRepo.findBooksByIsbn(db, '9780552131063');
    await booksRepo.updateBook(db, mort.id, { coverUri: 'file:///covers/mort.jpg' });
    await askToDelete('Mort');
    await press(Testids.dialog.confirm);
    expect(deleteCoverFile).not.toHaveBeenCalled();
    await advance(UNDO_WINDOW_MS);
    expect(deleteCoverFile).toHaveBeenCalledWith('file:///covers/mort.jpg');
  });

  it('keeps the cover file when Undo is used', async () => {
    const [mort] = await booksRepo.findBooksByIsbn(db, '9780552131063');
    await booksRepo.updateBook(db, mort.id, { coverUri: 'file:///covers/mort.jpg' });
    await askToDelete('Mort');
    await press(Testids.dialog.confirm);
    await press(Testids.snackbar.action);
    await advance(UNDO_WINDOW_MS);
    expect(deleteCoverFile).not.toHaveBeenCalled();
    expect((await booksRepo.getBook(db, mort.id))!.coverUri).toBe('file:///covers/mort.jpg');
  });

  it('leaves a cover file another book still names (a restore or an Undo put them back that way)', async () => {
    const newest = (await booksRepo.listBooks(db)).reduce((a, b) => (b.id > a.id ? b : a));
    await booksRepo.updateBook(db, newest.id, { coverUri: 'file:///covers/shared.jpg' });
    await askToDelete(newest.title);
    await press(Testids.dialog.confirm);
    await db.run('INSERT INTO books (title, cover_uri) VALUES (?, ?)', ['Added meanwhile', 'file:///covers/shared.jpg']);
    await advance(UNDO_WINDOW_MS);
    await advance(0);
    expect(deleteCoverFile).not.toHaveBeenCalled();
  });

  it('leaves a cover file the safety copy of a restore still names', async () => {
    const [mort] = await booksRepo.findBooksByIsbn(db, '9780552131063');
    await booksRepo.updateBook(db, mort.id, { coverUri: 'file:///covers/mort-1.jpg' });
    await db.run("INSERT INTO backup_snapshots (reason, created_at, book_count, body) VALUES ('before-restore', 'x', 1, ?)", [
      JSON.stringify({ tables: { books: [{ id: 99, cover_uri: 'file:///covers/mort-1.jpg' }] } }),
    ]);
    await askToDelete('Mort');
    await press(Testids.dialog.confirm);
    await advance(UNDO_WINDOW_MS);
    await advance(0);
    expect(deleteCoverFile).not.toHaveBeenCalled();
  });
});
