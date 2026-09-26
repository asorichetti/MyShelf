import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  setToday('2026-06-15');
  db = await createTestDb();
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const routes = { 'book/[id]': stubScreen('book') };

async function openLoans() {
  const r = renderApp(db, '/loans', routes);
  await advance(0);
  await advance(0);
  return r;
}
const titles = () => screen.queryAllByTestId(Testids.loans.rowBook).map((b) => b.props.accessibilityLabel.replace(/^Open /, ''));
const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => fireEvent.press(el));
  await advance(0);
};

describe('Loans tab (P05-05)', () => {
  it('lists what is out, overdue first, with stamps that say it in words', async () => {
    await loadFixture(db, 'demo');
    await openLoans();
    expect(titles()).toEqual(['The Murder of Roger Ackroyd', 'Dune']);
    const stamps = screen.getAllByTestId(Testids.loans.stamp);
    expect(stamps[0]).toHaveTextContent('Overdue · 5 days');
    expect(stamps[1]).toHaveTextContent('Due 26 Jun');
    expect(screen.getByTestId(Testids.loans.tabOut)).toHaveTextContent('Out now · 2');
    expect(screen.getByTestId(Testids.loans.tabOut)).toBeSelected();
    expect(screen.getByText('1 book overdue')).toBeOnTheScreen();
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
  });

  it('badges the Loans tab with the overdue count', async () => {
    await loadFixture(db, 'demo');
    await openLoans();
    const tab = screen.getByTestId(Testids.tabs.loans);
    expect(tab.props.accessibilityLabel).toBe('Loans, 1 overdue');
    expect(within(tab).getByText('1')).toBeOnTheScreen();
  });

  it('History lists returned loans, newest first', async () => {
    await loadFixture(db, 'demo');
    await openLoans();
    await press(screen.getByTestId(Testids.loans.tabHistory));
    expect(screen.getByTestId(Testids.loans.tabHistory)).toBeSelected();
    expect(titles()).toEqual(['Mort']);
    expect(screen.getByTestId(Testids.loans.stamp)).toHaveTextContent('Returned 14 Apr');
    expect(screen.queryByTestId(Testids.loans.rowReturn)).toBeNull();
  });

  it('marks a loan returned from its row; it moves to History and the badge clears', async () => {
    await loadFixture(db, 'demo');
    await openLoans();
    await press(screen.getAllByTestId(Testids.loans.rowReturn)[0]);
    expect(screen.getByTestId(Testids.returnLoan.sheet)).toBeOnTheScreen();
    await press(screen.getByTestId(Testids.returnLoan.confirm));
    await advance(0);
    expect(titles()).toEqual(['Dune']);
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent(/Welcome home, “The Murder of Roger Ackroyd”!/);
    expect(screen.getByTestId(Testids.tabs.loans).props.accessibilityLabel).toBe('Loans');
    await press(screen.getByTestId(Testids.loans.tabHistory));
    expect(titles()).toEqual(['The Murder of Roger Ackroyd', 'Mort']);
  });

  it('filters by borrower', async () => {
    await loadFixture(db, 'demo');
    await openLoans();
    await press(screen.getByTestId(Testids.loans.filterBorrower));
    await press(screen.getByRole('radio', { name: 'Sam' }));
    expect(titles()).toEqual(['Dune']);
    await press(screen.getByTestId(Testids.loans.tabHistory));
    expect(titles()).toEqual(['Mort']);
  });

  it('opens the book from a row', async () => {
    await loadFixture(db, 'demo');
    const r = await openLoans();
    const [dune] = await booksRepo.findBooksByIsbn(db, '9780441172719');
    await press(screen.getAllByTestId(Testids.loans.rowBook)[1]);
    expect(r.getPathname()).toBe(`/book/${dune.id}`);
  });

  it('shows sleepy Booky when every book is home', async () => {
    await openLoans();
    const empty = screen.getByTestId(Testids.loans.empty);
    expect(empty).toHaveTextContent(/Every book is home\. Lovely\./);
    expect(within(empty).getByLabelText(/^Booky the bookmark.*sleepy/)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.loans.filterBorrower)).toBeNull();
    expect(screen.getByTestId(Testids.tabs.loans).props.accessibilityLabel).toBe('Loans');
  });
});
