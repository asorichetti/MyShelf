import { act, renderHook } from '@testing-library/react-native';

import { booksRepo, loansRepo, settingsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { setToday } from '@/domain';
import { subscribe } from '@/features/events';
import { lendToBorrower, loanIssueMessage, useLend } from '@/features/loans/useLend';
import { createTestDb } from '@/testing/createTestDb';
import { AppTestProviders } from '@/testing/render';

import type { ReactNode } from 'react';

let db: Db;
let bookId: number;
beforeEach(async () => {
  setToday('2026-06-15');
  db = await createTestDb();
  bookId = (await booksRepo.createBook(db, { title: 'Dune' })).id;
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const TODAY = '2026-06-15';
const newSam = { kind: 'new' as const, name: 'Sam', contact: ' sam@example.org ' };

describe('lendToBorrower', () => {
  it('creates the new borrower and the loan together', async () => {
    const out = await lendToBorrower(db, { bookId, borrower: newSam, lentOn: TODAY, dueOn: '2026-06-29', note: '  For the train ' }, TODAY);
    expect(out).toMatchObject({ status: 'lent', borrowerName: 'Sam', loan: { bookId, lentOn: TODAY, dueOn: '2026-06-29', note: 'For the train' } });
    expect(await loansRepo.listBorrowers(db)).toEqual([expect.objectContaining({ name: 'Sam', contact: 'sam@example.org' })]);
  });

  it('lends to an existing borrower with no due date', async () => {
    const sam = await loansRepo.createBorrower(db, 'Sam');
    const out = await lendToBorrower(db, { bookId, borrower: { kind: 'existing', borrower: sam }, lentOn: '2026-06-01', dueOn: null }, TODAY);
    expect(out).toMatchObject({ status: 'lent', loan: { borrowerId: sam.id, dueOn: null, note: null } });
  });

  it.each([
    ['a lent date in the future', { lentOn: '2026-06-16', dueOn: null }, [{ field: 'lentOn', code: 'lent-in-future' }]],
    ['a due date before the lent date', { lentOn: '2026-06-10', dueOn: '2026-06-09' }, [{ field: 'dueOn', code: 'due-before-lent' }]],
    ['half-typed dates', { lentOn: '12/13/2026', dueOn: 'soon' }, [{ field: 'lentOn', code: 'invalid-date' }, { field: 'dueOn', code: 'invalid-date' }]],
  ])('refuses %s without writing anything', async (_, dates, issues) => {
    const out = await lendToBorrower(db, { bookId, borrower: newSam, ...dates }, TODAY);
    expect(out).toEqual({ status: 'invalid', issues });
    expect(await loansRepo.listBorrowers(db)).toEqual([]);
  });

  it('cannot open a second loan: it reports the current one and leaves no stray borrower', async () => {
    const priya = await loansRepo.createBorrower(db, 'Priya');
    await loansRepo.lendBook(db, { bookId, borrowerId: priya.id, lentOn: '2026-06-01', dueOn: '2026-06-20' });
    const out = await lendToBorrower(db, { bookId, borrower: newSam, lentOn: TODAY, dueOn: null }, TODAY);
    expect(out).toMatchObject({ status: 'already-on-loan', current: { borrowerName: 'Priya', dueOn: '2026-06-20' } });
    expect((await loansRepo.listBorrowers(db)).map((b) => b.name)).toEqual(['Priya']);
  });

  it('reports a borrower or book that has gone meanwhile', async () => {
    const ghost = { kind: 'existing' as const, borrower: { id: 999, name: 'Ghost', contact: null } };
    expect(await lendToBorrower(db, { bookId, borrower: ghost, lentOn: TODAY, dueOn: null }, TODAY)).toEqual({ status: 'borrower-missing' });
    expect(await lendToBorrower(db, { bookId: 999, borrower: newSam, lentOn: TODAY, dueOn: null }, TODAY)).toEqual({ status: 'book-missing' });
    expect(await loansRepo.listBorrowers(db)).toEqual([]);
  });
});

describe('loanIssueMessage', () => {
  it('explains every date problem in plain words', () => {
    expect(loanIssueMessage({ field: 'lentOn', code: 'lent-in-future' })).toBe('The day you lent it can’t be in the future.');
    expect(loanIssueMessage({ field: 'dueOn', code: 'due-before-lent' })).toBe('The due date can’t be before the day you lent it.');
    expect(loanIssueMessage({ field: 'dueOn', code: 'invalid-date' })).toMatch(/No due date/);
    expect(loanIssueMessage({ field: 'returnedOn', code: 'returned-in-future' })).toMatch(/future/);
    expect(loanIssueMessage({ field: 'returnedOn', code: 'returned-before-lent' })).toMatch(/before the day it was lent/);
  });
});

describe('useLend', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppTestProviders>
      <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>
    </AppTestProviders>
  );

  it('reads the loan length setting and lends with today from the app clock', async () => {
    await settingsRepo.setSetting(db, 'loanDays', 14);
    const events: string[] = [];
    const off = subscribe('loans-changed', (e) => events.push(e));
    const { result } = renderHook(() => useLend(), { wrapper });
    await act(async () => {});
    expect(result.current.loanDays).toBe(14);
    let out: Awaited<ReturnType<typeof result.current.lend>> | undefined;
    await act(async () => {
      out = await result.current.lend({ bookId, borrower: newSam, lentOn: '2026-06-16', dueOn: null });
    });
    // setToday froze today at 15 June, so the 16th is in the future.
    expect(out).toMatchObject({ status: 'invalid' });
    expect(events).toEqual([]);
    await act(async () => {
      out = await result.current.lend({ bookId, borrower: newSam, lentOn: TODAY, dueOn: null });
    });
    expect(out).toMatchObject({ status: 'lent' });
    expect(events).toEqual(['loans-changed']);
    expect((await result.current.searchBorrowers('s')).map((b) => b.name)).toEqual(['Sam']);
    expect((await result.current.findBorrowerByName('SAM'))?.name).toBe('Sam');
    off();
  });

  it('falls back to 28 days when the setting is unusable', async () => {
    await settingsRepo.setSetting(db, 'loanDays', -3);
    const { result } = renderHook(() => useLend(), { wrapper });
    await act(async () => {});
    expect(result.current.loanDays).toBe(28);
  });
});
