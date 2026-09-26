import { useCallback } from 'react';

import { useSnackbar } from '@/components/ui';
import { BookAlreadyOnLoanError, loansRepo, useDatabase, type Db } from '@/db';
import { LoanValidationError, today as todayOf, validateLoanDates, type IsoDate, type Loan, type LoanIssue, type LoanWithDetails } from '@/domain';
import { emit } from '@/features/events';

import { loanIssueMessage } from './useLend';

export type ReturnOutcome = { status: 'returned'; loan: Loan } | { status: 'invalid'; issues: LoanIssue[] } | { status: 'not-open' };

/**
 * Marks a loan returned on `returnedOn`, checked against `today` first (no
 * return in the future, none before the lent date). `not-open` when the loan
 * is gone or was already returned.
 */
export async function markReturned(db: Db, loanId: number, returnedOn: IsoDate, today: IsoDate): Promise<ReturnOutcome> {
  const loan = await loansRepo.getLoan(db, loanId);
  if (!loan || loan.returnedOn != null) return { status: 'not-open' };
  const issues = validateLoanDates({ lentOn: loan.lentOn, dueOn: loan.dueOn, returnedOn }, today);
  if (issues.length) return { status: 'invalid', issues };
  try {
    const done = await loansRepo.returnLoan(db, loanId, returnedOn);
    return done ? { status: 'returned', loan: done } : { status: 'not-open' };
  } catch (error) {
    if (error instanceof LoanValidationError) return { status: 'invalid', issues: [...error.issues] };
    throw error;
  }
}

export type UndoReturnOutcome = 'reopened' | 'lent-again' | 'gone';

/** Undoes a return, unless the book has gone out on another loan since. */
export async function undoReturn(db: Db, loanId: number): Promise<UndoReturnOutcome> {
  try {
    return (await loansRepo.reopenLoan(db, loanId)) ? 'reopened' : 'gone';
  } catch (error) {
    if (error instanceof BookAlreadyOnLoanError) return 'lent-again';
    throw error;
  }
}

type ReturnableLoan = Pick<LoanWithDetails, 'id' | 'bookTitle'>;

/**
 * The return action shared by book detail, the Loans tab and borrower
 * detail. On success it emits `loans-changed` and shows "Welcome home,
 * “Dune”!" with Undo. Resolves with an error message for the sheet, or null.
 */
export function useReturn(): { returnLoan: (loan: ReturnableLoan, returnedOn: IsoDate) => Promise<string | null> } {
  const db = useDatabase();
  const { show } = useSnackbar();

  const returnLoan = useCallback(
    async (loan: ReturnableLoan, returnedOn: IsoDate) => {
      const outcome = await markReturned(db, loan.id, returnedOn, todayOf());
      if (outcome.status === 'invalid') return loanIssueMessage(outcome.issues[0]);
      emit('loans-changed');
      if (outcome.status === 'not-open') return null;
      show({
        message: `Welcome home, “${loan.bookTitle}”!`,
        action: {
          label: 'Undo',
          onPress: () => {
            undoReturn(db, loan.id)
              .then((result) => {
                emit('loans-changed');
                if (result === 'lent-again') show({ message: `“${loan.bookTitle}” has gone out on a new loan since, so I kept this one closed.` });
              })
              .catch((e) => {
                console.error('Could not undo the return', e);
                show({ message: 'Sorry, I couldn’t undo that.' });
              });
          },
        },
      });
      return null;
    },
    [db, show],
  );
  return { returnLoan };
}
