import { useCallback, useEffect, useState } from 'react';

import { loansRepo, useDatabase, type Db } from '@/db';
import type { Borrower, LoanWithDetails } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';

export interface BorrowerDetail {
  borrower: Borrower;
  /** Books they have now, soonest due first. */
  current: LoanWithDetails[];
  /** Returned loans, newest first. */
  past: LoanWithDetails[];
}

export type BorrowerState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; detail: BorrowerDetail };

/** A borrower with their current and past loans; null when there is no such borrower. */
export async function loadBorrowerDetail(db: Db, id: number): Promise<BorrowerDetail | null> {
  const borrower = await loansRepo.getBorrower(db, id);
  if (!borrower) return null;
  const loans = await loansRepo.listLoansForBorrower(db, id);
  const current = loans.filter((l) => l.returnedOn == null).sort((a, b) => (a.dueOn ?? '9999') .localeCompare(b.dueOn ?? '9999'));
  const past = loans.filter((l) => l.returnedOn != null).sort((a, b) => b.returnedOn!.localeCompare(a.returnedOn!) || b.id - a.id);
  return { borrower, current, past };
}

export type DeleteBorrowerOutcome = 'deleted' | 'has-books-out' | 'missing';

/**
 * Deletes a borrower, first clearing their returned loans (the UI asks
 * before calling this). Refused while they still have a book out.
 */
export async function removeBorrower(db: Db, id: number): Promise<DeleteBorrowerOutcome> {
  return db.transaction(async (tx) => {
    const loans = await loansRepo.listLoansForBorrower(tx, id);
    if (loans.some((l) => l.returnedOn == null)) return 'has-books-out' as const;
    await loansRepo.deleteReturnedLoansForBorrower(tx, id);
    return (await loansRepo.deleteBorrower(tx, id)) ? ('deleted' as const) : ('missing' as const);
  });
}

export type RenameOutcome = { status: 'saved'; borrower: Borrower } | { status: 'duplicate'; other: Borrower } | { status: 'blank' } | { status: 'missing' };

/** Saves a borrower's name and contact; refuses a blank name or one another borrower already has. */
export async function saveBorrower(db: Db, id: number, name: string, contact: string): Promise<RenameOutcome> {
  if (!name.trim()) return { status: 'blank' };
  const other = await loansRepo.findBorrowerByName(db, name);
  if (other && other.id !== id) return { status: 'duplicate', other };
  const saved = await loansRepo.updateBorrower(db, id, { name, contact });
  return saved ? { status: 'saved', borrower: saved } : { status: 'missing' };
}

/** Borrower detail's data and actions; reloads when loans change. */
export function useBorrower(id: number | null) {
  const db = useDatabase();
  const [state, setState] = useState<BorrowerState>(id == null ? { status: 'missing' } : { status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (id == null) return;
    let active = true;
    loadBorrowerDetail(db, id)
      .then((detail) => active && setState(detail ? { status: 'ready', detail } : { status: 'missing' }))
      .catch((e) => {
        console.error('Could not load the borrower', e);
        if (active) setState({ status: 'missing' });
      });
    return () => {
      active = false;
    };
  }, [db, id, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useLibraryEvent(['loans-changed', 'library-changed'], reload);

  const save = useCallback(
    async (name: string, contact: string) => {
      const outcome = await saveBorrower(db, id!, name, contact);
      if (outcome.status === 'saved') emit('loans-changed');
      return outcome;
    },
    [db, id],
  );
  const remove = useCallback(async () => {
    const outcome = await removeBorrower(db, id!);
    if (outcome === 'deleted') emit('loans-changed');
    return outcome;
  }, [db, id]);

  return { ...(id == null ? { status: 'missing' as const } : state), reload, save, remove };
}
