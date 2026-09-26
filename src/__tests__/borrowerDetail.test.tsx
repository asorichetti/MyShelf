import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, loansRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { BorrowerScreen } from '@/features/loans/BorrowerScreen';
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

const routes = { 'borrower/[id]': BorrowerScreen, 'book/[id]': stubScreen('book') };
const borrowerId = async (name: string) => (await loansRepo.listBorrowers(db)).find((b) => b.name === name)!.id;

async function openBorrower(id: number | string) {
  const r = renderApp(db, `/borrower/${id}`, routes);
  await advance(0);
  await advance(0);
  return r;
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await advance(0);
};
const titlesIn = (id: string) =>
  screen
    .getByTestId(id)
    .findAll((n) => n.props.testID === Testids.loans.rowBook && typeof n.type !== 'string')
    .map((n) => n.props.accessibilityLabel.replace(/^Open /, ''))
    .filter((t, i, a) => a.indexOf(t) === i);

describe('Borrower detail (P05-06)', () => {
  it('shows Sam with what they have now and what they borrowed before (demo)', async () => {
    await openBorrower(await borrowerId('Sam'));
    expect(screen.getByTestId(Testids.borrower.name)).toHaveTextContent('Sam');
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
    expect(screen.getByTestId(Testids.borrower.stats)).toHaveTextContent('Has 1 book now · borrowed 2 times since 17 Mar 2026');
    expect(titlesIn(Testids.borrower.current)).toEqual(['Dune']);
    expect(titlesIn(Testids.borrower.past)).toEqual(['Mort']);
  });

  it('blocks deleting while books are out, and says why', async () => {
    await openBorrower(await borrowerId('Priya'));
    await press(Testids.borrower.delete);
    const blocked = screen.getByTestId(Testids.borrower.blocked);
    expect(blocked).toHaveTextContent('Priya still has 1 book of yours. Mark it returned first, then you can remove Priya.');
    expect(blocked.props.role).toBe('alert');
    expect(screen.queryByTestId(Testids.dialog.root)).toBeNull();
    expect(await loansRepo.getBorrower(db, await borrowerId('Priya'))).not.toBeNull();
  });

  it('returns a book from the borrower page', async () => {
    await openBorrower(await borrowerId('Sam'));
    await press(Testids.loans.rowReturn);
    await press(Testids.returnLoan.confirm);
    await advance(0);
    expect(titlesIn(Testids.borrower.current)).toEqual([]);
    expect(titlesIn(Testids.borrower.past)).toEqual(['Dune', 'Mort']);
  });

  it('deletes a borrower with only past loans after confirming, clearing their history', async () => {
    const sam = await borrowerId('Sam');
    const dune = (await loansRepo.listLoansForBorrower(db, sam)).find((l) => l.returnedOn == null)!;
    await loansRepo.returnLoan(db, dune.id, '2026-06-15');
    const r = await openBorrower(sam);
    await press(Testids.borrower.delete);
    expect(screen.getByTestId(Testids.dialog.root)).toHaveTextContent(/Remove Sam\?.*clears their lending history \(2 past loans\)/);
    await press(Testids.dialog.confirm);
    expect(await loansRepo.getBorrower(db, sam)).toBeNull();
    expect(await loansRepo.listLoansForBorrower(db, sam)).toEqual([]);
    expect(await booksRepo.countBooks(db)).toBe(12);
    expect(r.getPathname()).toBe('/loans');
  });

  it('edits the name and contact, refusing a name another borrower has', async () => {
    const sam = await borrowerId('Sam');
    await openBorrower(sam);
    await press(Testids.borrower.edit);
    fireEvent.changeText(screen.getByTestId(Testids.borrower.editName), 'priya');
    await press(Testids.borrower.editSave);
    expect(screen.getByText('Priya is already a borrower. Pick a different name.')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId(Testids.borrower.editName), 'Samantha');
    fireEvent.changeText(screen.getByTestId(Testids.borrower.editContact), 'Flat 2, over the bakery');
    await press(Testids.borrower.editSave);
    expect(screen.queryByTestId(Testids.borrower.editSheet)).toBeNull();
    expect(screen.getByTestId(Testids.borrower.name)).toHaveTextContent('Samantha');
    expect(screen.getByTestId(Testids.borrower.contact)).toHaveTextContent('Flat 2, over the bakery');
    expect(await loansRepo.getBorrower(db, sam)).toEqual({ id: sam, name: 'Samantha', contact: 'Flat 2, over the bakery' });
  });

  it.each(['9999', 'abc'])('shows the error state for an unknown borrower (%s)', async (id) => {
    const r = await openBorrower(id);
    expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
    expect(screen.getByText('Borrower not found')).toBeOnTheScreen();
    await press(Testids.borrower.missingBack);
    expect(r.getPathname()).toBe('/loans');
  });
});
