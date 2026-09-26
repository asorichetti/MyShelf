import { act, renderHook } from '@testing-library/react-native';

import { loansRepo, StaticDatabaseProvider, type Db } from '@/db';
import { setToday, type LoanWithDetails } from '@/domain';
import { emit } from '@/features/events';
import { sortOutNow, useLoans, useOverdueCount } from '@/features/loans/useLoans';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { AppTestProviders } from '@/testing/render';

import type { ReactNode } from 'react';

const loan = (id: number, dueOn: string | null, lentOn = '2026-06-01'): LoanWithDetails => ({
  id,
  bookId: id,
  borrowerId: 1,
  bookTitle: `Book ${id}`,
  borrowerName: 'Sam',
  lentOn,
  dueOn,
  returnedOn: null,
  note: null,
});

describe('sortOutNow', () => {
  it('puts overdue first (most overdue on top), then soonest due, undated last', () => {
    const list = [loan(1, null), loan(2, '2026-07-01'), loan(3, '2026-06-10'), loan(4, '2026-06-16'), loan(5, '2026-06-01'), loan(6, null, '2026-05-01')];
    expect(sortOutNow(list, '2026-06-15').map((l) => l.id)).toEqual([5, 3, 4, 2, 6, 1]);
  });
});

describe('useLoans / useOverdueCount', () => {
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
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppTestProviders>
      <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>
    </AppTestProviders>
  );

  it('loads out-now (overdue first) and history, and counts overdue loans', async () => {
    const { result } = renderHook(() => ({ loans: useLoans(), badge: useOverdueCount() }), { wrapper });
    await act(async () => {});
    expect(result.current.loans.out?.map((l) => l.bookTitle)).toEqual(['The Murder of Roger Ackroyd', 'Dune']);
    expect(result.current.loans.history?.map((l) => l.bookTitle)).toEqual(['Mort']);
    expect(result.current.loans.overdueCount).toBe(1);
    expect(result.current.badge).toBe(1);
  });

  it('reloads when loans change', async () => {
    const { result } = renderHook(() => ({ loans: useLoans(), badge: useOverdueCount() }), { wrapper });
    await act(async () => {});
    const overdue = result.current.loans.out![0];
    await loansRepo.returnLoan(db, overdue.id, '2026-06-15');
    await act(async () => emit('loans-changed'));
    await act(async () => {});
    expect(result.current.loans.out?.map((l) => l.bookTitle)).toEqual(['Dune']);
    expect(result.current.loans.history?.map((l) => l.bookTitle)).toEqual(['The Murder of Roger Ackroyd', 'Mort']);
    expect(result.current.badge).toBe(0);
  });
});
