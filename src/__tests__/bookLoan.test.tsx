import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, loansRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { WELCOME_HOME_MS } from '@/features/loans/BookLoanSection';
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
const MORT = '9780552131063';

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
    expect(screen.queryByTestId(Testids.returnLoan.open)).toBeNull();
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
    expect(screen.getByTestId(Testids.returnLoan.open)).toHaveTextContent(/Mark returned/);
    const loan = await loansRepo.getOpenLoanForBook(db, await idOf(LEFT_HAND));
    expect(loan).toMatchObject({ lentOn: '2026-06-15', dueOn: '2026-10-12' });
  });

  it('offers no Lend on a book already out (no second open loan)', async () => {
    await openBook(DUNE);
    expect(screen.queryByTestId(Testids.lend.open)).toBeNull();
    expect(screen.getByTestId(Testids.returnLoan.open)).toBeOnTheScreen();
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

describe('Return flow on book detail (P05-04)', () => {
  it('confirms the day, shows RETURNED with Booky briefly, and Undo re-opens the loan', async () => {
    await openBook(DUNE);
    await press(Testids.returnLoan.open);
    expect(screen.getByTestId(Testids.returnLoan.sheet)).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.returnLoan.date).props.value).toBe('15/06/2026');
    await press(Testids.returnLoan.confirm);

    expect(screen.queryByTestId(Testids.returnLoan.sheet)).toBeNull();
    const welcome = screen.getByTestId(Testids.bookLoan.welcome);
    expect(welcome).toHaveTextContent(/Returned.*Welcome home, “Dune”!/);
    expect(screen.getByLabelText('Booky the bookmark, smiling happily')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent(/Welcome home, “Dune”!/);
    expect(screen.getByTestId(Testids.lend.open)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByTestId(Testids.snackbar.action)));
    await advance(0);
    expect(screen.getByText('On loan · Sam · Due 26 Jun')).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.bookLoan.welcome)).toBeNull();
  });

  it('lets the welcome fade after a few seconds', async () => {
    await openBook(DUNE);
    await press(Testids.returnLoan.open);
    await press(Testids.returnLoan.confirm);
    expect(screen.getByTestId(Testids.bookLoan.welcome)).toBeOnTheScreen();
    await advance(WELCOME_HOME_MS);
    expect(screen.queryByTestId(Testids.bookLoan.welcome)).toBeNull();
    expect(screen.getByTestId(Testids.bookDetail.loan)).toHaveTextContent(/On the shelf, not lent to anyone\./);
  });

  it('refuses a return date before the loan began', async () => {
    await openBook(DUNE);
    await press(Testids.returnLoan.open);
    fireEvent.changeText(screen.getByTestId(Testids.returnLoan.date), '01/06/2026');
    await press(Testids.returnLoan.confirm);
    expect(screen.getByTestId(Testids.returnLoan.error)).toHaveTextContent('It can’t come back before the day it was lent.');
    expect(await loansRepo.getOpenLoanForBook(db, await idOf(DUNE))).not.toBeNull();
    await press(Testids.returnLoan.cancel);
    expect(screen.queryByTestId(Testids.returnLoan.sheet)).toBeNull();
  });
});

describe('Lending history on book detail (P05-07)', () => {
  it('is a collapsed disclosure of past loans', async () => {
    await openBook(MORT);
    const toggle = screen.getByTestId(Testids.bookLoan.historyToggle);
    expect(toggle.props.accessibilityLabel).toBe('Lending history, 1 past loan');
    expect(screen.queryByTestId(Testids.bookLoan.historyRow)).toBeNull();
    await press(Testids.bookLoan.historyToggle);
    expect(screen.getByTestId(Testids.bookLoan.historyRow)).toHaveTextContent(/Sam.*17 Mar 2026 – 14 Apr 2026/);
  });

  it('is hidden for a book that has never come back from a loan', async () => {
    await openBook(DUNE);
    expect(screen.queryByTestId(Testids.bookLoan.history)).toBeNull();
  });

  it('gains the loan once it is returned', async () => {
    await openBook(DUNE);
    await press(Testids.returnLoan.open);
    await press(Testids.returnLoan.confirm);
    expect(screen.getByTestId(Testids.bookLoan.historyToggle).props.accessibilityLabel).toBe('Lending history, 1 past loan');
  });
});
