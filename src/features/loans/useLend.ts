import { useCallback, useEffect, useState } from 'react';

import type { BorrowerChoice } from '@/components/loans/BorrowerPicker';
import {
  BookAlreadyOnLoanError,
  BookNotFoundError,
  BorrowerNotFoundError,
  loansRepo,
  settingsRepo,
  useDatabase,
  type Db,
} from '@/db';
import { normaliseLoanDays, settingDefaults, today as todayOf, validateLoanDates, type IsoDate, type Loan, type LoanIssue } from '@/domain';
import { emit } from '@/features/events';
import { t } from '@/i18n';

export interface LendInput {
  bookId: number;
  borrower: BorrowerChoice;
  lentOn: IsoDate;
  /** null for "No due date". */
  dueOn: IsoDate | null;
  note?: string | null;
}

export type LendOutcome =
  | { status: 'lent'; loan: Loan; borrowerName: string }
  | { status: 'invalid'; issues: LoanIssue[] }
  /** The book went out on another loan meanwhile; `current` is that loan (null if it could not be read). */
  | { status: 'already-on-loan'; current: (Loan & { borrowerName: string }) | null }
  | { status: 'borrower-missing' }
  | { status: 'book-missing' };

/**
 * Lends a book in one transaction: a new borrower is created first (so a
 * failed loan leaves no stray borrower), then `loansRepo.lendBook`. Dates are
 * checked with `validateLoanDates` against `today` first (the repository has
 * no clock, so "not in the future" is checked here).
 */
export async function lendToBorrower(db: Db, input: LendInput, today: IsoDate): Promise<LendOutcome> {
  const issues = validateLoanDates({ lentOn: input.lentOn, dueOn: input.dueOn }, today);
  if (issues.length) return { status: 'invalid', issues };
  const note = input.note?.trim() || null;
  try {
    return await db.transaction(async (tx) => {
      const borrower =
        input.borrower.kind === 'existing'
          ? input.borrower.borrower
          : await loansRepo.createBorrower(tx, input.borrower.name, input.borrower.contact);
      const loan = await loansRepo.lendBook(tx, { bookId: input.bookId, borrowerId: borrower.id, lentOn: input.lentOn, dueOn: input.dueOn, note });
      return { status: 'lent' as const, loan, borrowerName: borrower.name };
    });
  } catch (error) {
    if (error instanceof BookAlreadyOnLoanError) {
      const open = await loansRepo.getOpenLoanForBook(db, input.bookId).catch(() => null);
      const who = open ? await loansRepo.getBorrower(db, open.borrowerId).catch(() => null) : null;
      return { status: 'already-on-loan', current: open ? { ...open, borrowerName: who?.name ?? t('loans.someone') } : null };
    }
    if (error instanceof BorrowerNotFoundError) return { status: 'borrower-missing' };
    if (error instanceof BookNotFoundError) return { status: 'book-missing' };
    throw error;
  }
}

/** Plain words for a date problem in the lend or return sheet. */
export function loanIssueMessage(issue: LoanIssue): string {
  switch (issue.code) {
    case 'invalid-date':
      return issue.field === 'dueOn'
        ? t('lend.issues.invalidDue')
        : issue.field === 'returnedOn'
          ? t('lend.issues.invalidReturned')
          : t('lend.issues.invalidLent');
    case 'lent-in-future':
      return t('lend.issues.lentInFuture');
    case 'due-before-lent':
      return t('lend.issues.dueBeforeLent');
    case 'returned-before-lent':
      return t('lend.issues.returnedBeforeLent');
    case 'returned-in-future':
      return t('lend.issues.returnedInFuture');
  }
}

export interface UseLend {
  /** Days from lending to the default due date (the `loanDays` setting). */
  loanDays: number;
  lend: (input: LendInput) => Promise<LendOutcome>;
  searchBorrowers: (prefix: string) => ReturnType<typeof loansRepo.searchBorrowers>;
  findBorrowerByName: (name: string) => ReturnType<typeof loansRepo.findBorrowerByName>;
}

/** The lend sheet's data and action. A successful lend (or a clash) emits `loans-changed`. */
export function useLend(): UseLend {
  const db = useDatabase();
  const [loanDays, setLoanDays] = useState(settingDefaults.loanDays);

  useEffect(() => {
    let active = true;
    settingsRepo
      .getSetting(db, 'loanDays')
      .then((days) => active && setLoanDays(normaliseLoanDays(days)))
      .catch((e) => console.warn('Could not read the loan length; using the default', e));
    return () => {
      active = false;
    };
  }, [db]);

  const lend = useCallback(
    async (input: LendInput) => {
      const outcome = await lendToBorrower(db, input, todayOf());
      if (outcome.status === 'lent' || outcome.status === 'already-on-loan') emit('loans-changed');
      return outcome;
    },
    [db],
  );
  const searchBorrowers = useCallback((prefix: string) => loansRepo.searchBorrowers(db, prefix), [db]);
  const findBorrowerByName = useCallback((name: string) => loansRepo.findBorrowerByName(db, name), [db]);
  return { loanDays, lend, searchBorrowers, findBorrowerByName };
}
