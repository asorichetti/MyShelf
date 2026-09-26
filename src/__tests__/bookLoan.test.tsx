import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, loansRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  setToday('2026-06-15');
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const routes = { 'book/[id]': BookDetailScreen, 'book/[id]/edit': stubScreen('edit'), 'borrower/[id]': stubScreen('borrower') };
const idOf = async (isbn: string) => (await booksRepo.findBooksByIsbn(db, isbn))[0].id;
const LEFT_HAND = '9780441478125';
const DUNE = '9780441172719';

async function openBook(isbn: string) {
  const r = renderApp(db, `/book/${await idOf(isbn)}`, routes);
  await advance(0);
  return r;
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await advance(0);
};

describe('Lend flow on book detail (P05-03)', () => {
  it('lends a book at home to a new borrower and stamps it', async () => {
    await openBook(LEFT_HAND);
    expect(screen.getByTestId(Testids.bookDetail.loan)).toHaveTextContent(/On the shelf, not lent to anyone\./);
    await press(Testids.lend.open);
    expect(screen.getByTestId(Testids.lend.sheet)).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId(Testids.lend.borrowerSearch), 'Alex');
    await advance(200);
    await press(Testids.lend.borrowerCreate);
    fireEvent.changeText(screen.getByTestId(Testids.lend.dueOn), '12/10/2026');
    await press(Testids.lend.save);

    expect(screen.queryByTestId(Testids.lend.sheet)).toBeNull();
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent('Lent to Alex');
    expect(screen.getByText('On loan · Alex · Due 12 Oct')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.bookLoan.stamp).props.accessibilityLabel).toBe('On loan · Alex. Due back on 12 Oct 2026');
    expect(screen.getByTestId(Testids.bookLoan.summary)).toHaveTextContent('Lent to Alex on 15 Jun 2026. Due back on 12 Oct 2026.');
    expect(screen.queryByTestId(Testids.lend.open)).toBeNull();
    const loan = await loansRepo.getOpenLoanForBook(db, await idOf(LEFT_HAND));
    expect(loan).toMatchObject({ lentOn: '2026-06-15', dueOn: '2026-10-12' });
  });

  it('offers no Lend on a book already out (no second open loan)', async () => {
    await openBook(DUNE);
    expect(screen.queryByTestId(Testids.lend.open)).toBeNull();
    expect(screen.getByTestId(Testids.bookLoan.stamp)).toBeOnTheScreen();
  });

  it('shows the current loan when the book went out meanwhile', async () => {
    await openBook(LEFT_HAND);
    await press(Testids.lend.open);
    await advance(200);
    await act(async () => fireEvent.press(screen.getAllByTestId(Testids.lend.borrowerOption)[0]));
    // Someone else lends it from another screen while the sheet is open.
    const priya = (await loansRepo.listBorrowers(db)).find((b) => b.name === 'Priya')!;
    await loansRepo.lendBook(db, { bookId: await idOf(LEFT_HAND), borrowerId: priya.id, lentOn: '2026-06-14' });
    await press(Testids.lend.save);
    expect(screen.queryByTestId(Testids.lend.sheet)).toBeNull();
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent('“The Left Hand of Darkness” is already on loan to Priya.');
    expect(screen.getByTestId(Testids.bookLoan.summary)).toHaveTextContent(/^Lent to Priya on 14 Jun 2026\. No due date\.$/);
  });
});
