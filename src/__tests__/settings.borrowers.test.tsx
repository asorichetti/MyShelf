import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { loansRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { LoansScreen } from '@/features/loans/LoansScreen';
import { BorrowersScreen } from '@/features/settings/BorrowersScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

const B = Testids.borrowers;
let db: Db;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const routes = { 'settings/borrowers': BorrowersScreen, 'borrower/[id]': stubScreen('borrower') };
const rows = () => screen.getAllByTestId(B.row).map((r) => r.props.accessibilityLabel as string);

async function open() {
  renderApp(db, '/settings/borrowers', routes);
  await waitFor(() => expect(screen.getAllByTestId(B.row)).toHaveLength(2));
}

describe('Settings → Borrowers', () => {
  it('lists borrowers with their loan counts under one h1', async () => {
    await open();
    expect(rows()).toEqual(['Sam, has 1 book now · 2 loans in all', 'Priya, has 1 book now · 1 loan in all']);
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1).map((h) => h.props.children)).toEqual(['Borrowers']);
  });

  it('refuses to remove someone who still has a book, and says why', async () => {
    await open();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Remove Priya' })));
    expect(screen.getByText(/Priya still has 1 book of yours/)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.dialog.root)).toBeNull();
  });

  it('removes someone with only returned loans, after asking', async () => {
    const [dune] = (await loansRepo.listOpenLoans(db)).filter((l) => l.borrowerName === 'Priya');
    await loansRepo.returnLoan(db, dune.id, '2026-06-20');
    await open();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Remove Priya' })));
    expect(screen.getByText('Remove Priya?')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.dialog.confirm)));
    await waitFor(() => expect(rows()).toEqual(['Sam, has 1 book now · 2 loans in all']));
    expect((await loansRepo.listBorrowers(db)).map((b) => b.name)).toEqual(['Sam']);
  });

  it('renames a borrower, and the Loans tab shows the new name', async () => {
    await open();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Edit Sam' })));
    fireEvent.changeText(screen.getByTestId(Testids.borrower.editName), 'Samira');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.borrower.editSave)));
    await waitFor(() => expect(rows()[0]).toBe('Samira, has 1 book now · 2 loans in all'));
    screen.unmount();
    renderApp(db, '/loans', { loans: LoansScreen });
    expect(await screen.findByText(/Samira/)).toBeOnTheScreen();
  });

  it('opens a borrower’s page', async () => {
    await open();
    await act(async () => fireEvent.press(screen.getAllByTestId(B.row)[0]));
    expect(await screen.findByText('stub:borrower')).toBeOnTheScreen();
  });
});
