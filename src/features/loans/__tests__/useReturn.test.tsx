import { act, renderHook } from '@testing-library/react-native';

import { useSnackbar } from '@/components/ui';
import { booksRepo, loansRepo, StaticDatabaseProvider, type Db } from '@/db';
import { setToday } from '@/domain';
import { subscribe } from '@/features/events';
import { markReturned, undoReturn, useReturn } from '@/features/loans/useReturn';
import { createTestDb } from '@/testing/createTestDb';
import { AppTestProviders } from '@/testing/render';

import type { ReactNode } from 'react';

let db: Db;
let bookId: number;
let samId: number;
beforeEach(async () => {
  setToday('2026-06-15');
  db = await createTestDb();
  bookId = (await booksRepo.createBook(db, { title: 'Dune' })).id;
  samId = (await loansRepo.createBorrower(db, 'Sam')).id;
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const lend = (lentOn = '2026-06-01', dueOn: string | null = lentOn === '2026-06-01' ? '2026-06-10' : null) =>
  loansRepo.lendBook(db, { bookId, borrowerId: samId, lentOn, dueOn });

describe('markReturned', () => {
  it('returns the loan on the given day', async () => {
    const loan = await lend();
    expect(await markReturned(db, loan.id, '2026-06-14', '2026-06-15')).toMatchObject({ status: 'returned', loan: { returnedOn: '2026-06-14' } });
    expect(await loansRepo.getOpenLoanForBook(db, bookId)).toBeNull();
  });

  it.each([
    ['in the future', '2026-06-16', 'returned-in-future'],
    ['before it was lent', '2026-05-31', 'returned-before-lent'],
    ['not a date', '32/06/2026', 'invalid-date'],
  ])('refuses a return %s', async (_, day, code) => {
    const loan = await lend();
    expect(await markReturned(db, loan.id, day, '2026-06-15')).toEqual({ status: 'invalid', issues: [{ field: 'returnedOn', code }] });
    expect((await loansRepo.getLoan(db, loan.id))?.returnedOn).toBeNull();
  });

  it('is a no-op for a loan already returned or gone', async () => {
    const loan = await lend();
    await markReturned(db, loan.id, '2026-06-14', '2026-06-15');
    expect(await markReturned(db, loan.id, '2026-06-15', '2026-06-15')).toEqual({ status: 'not-open' });
    expect(await markReturned(db, 999, '2026-06-15', '2026-06-15')).toEqual({ status: 'not-open' });
  });
});

describe('undoReturn', () => {
  it('re-opens the loan', async () => {
    const loan = await lend();
    await markReturned(db, loan.id, '2026-06-14', '2026-06-15');
    expect(await undoReturn(db, loan.id)).toBe('reopened');
    expect((await loansRepo.getOpenLoanForBook(db, bookId))?.id).toBe(loan.id);
  });

  it('only if no other open loan exists for the book', async () => {
    const loan = await lend();
    await markReturned(db, loan.id, '2026-06-14', '2026-06-15');
    await lend('2026-06-15');
    expect(await undoReturn(db, loan.id)).toBe('lent-again');
    expect((await loansRepo.getLoan(db, loan.id))?.returnedOn).toBe('2026-06-14');
  });
});

describe('useReturn', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppTestProviders>
      <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>
    </AppTestProviders>
  );
  const render = () =>
    renderHook(
      () => ({ ...useReturn(), snackbar: useSnackbar() }),
      { wrapper },
    );

  it('says "Welcome home" with Undo, and Undo puts the loan back out', async () => {
    const loan = await lend();
    const events: string[] = [];
    const off = subscribe('loans-changed', (e) => events.push(e));
    const { result } = render();
    let problem: string | null = 'unset';
    await act(async () => {
      problem = await result.current.returnLoan({ id: loan.id, bookTitle: 'Dune' }, '2026-06-15');
    });
    expect(problem).toBeNull();
    expect(events).toHaveLength(1);
    const snack = result.current.snackbar.snack!;
    expect(snack.message).toBe('Welcome home, “Dune”!');
    expect(snack.action?.label).toBe('Undo');
    await act(async () => snack.action!.onPress());
    await act(async () => {});
    expect((await loansRepo.getOpenLoanForBook(db, bookId))?.id).toBe(loan.id);
    expect(events).toHaveLength(2);
    off();
  });

  it('explains when Undo cannot re-open because the book went out again', async () => {
    const loan = await lend();
    const { result } = render();
    await act(async () => {
      await result.current.returnLoan({ id: loan.id, bookTitle: 'Dune' }, '2026-06-15');
    });
    const undo = result.current.snackbar.snack!.action!;
    await lend('2026-06-15');
    await act(async () => undo.onPress());
    await act(async () => {});
    expect(result.current.snackbar.snack?.message).toBe('“Dune” has gone out on a new loan since, so I kept this one closed.');
  });

  it('returns a message for a bad date and changes nothing', async () => {
    const loan = await lend();
    const { result } = render();
    let problem: string | null = null;
    await act(async () => {
      problem = await result.current.returnLoan({ id: loan.id, bookTitle: 'Dune' }, '2026-06-20');
    });
    expect(problem).toBe('The return date can’t be in the future.');
    expect(result.current.snackbar.snack).toBeNull();
  });
});
