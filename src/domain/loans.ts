import { addDays, daysBetween, isIsoDate, today as todayOf, type IsoDate } from './dates';

import type { Loan } from './loan';

/**
 * Loan rules (P05-02). Every date is a local calendar date (`YYYY-MM-DD`) and
 * "today" is passed in, so the rules are pure and a due date never shifts
 * with the timezone or daylight saving: only the device's idea of today does.
 */

export type LoanStatus = 'on-loan' | 'due-soon' | 'overdue' | 'returned';

/** A loan due within this many days (today included) is "due soon". */
export const DUE_SOON_DAYS = 3;
/** Default loan length when the setting is unset or unusable. */
export const DEFAULT_LOAN_DAYS = 28;
/** Longest loan length the setting may hold (ten years). */
export const MAX_LOAN_DAYS = 3650;

type LoanDates = Pick<Loan, 'dueOn' | 'returnedOn'>;

/**
 * The due date, or null when there is none or it is not a real date (a
 * corrupt row, say, from an edited backup): such a loan counts as undated
 * rather than breaking every screen that shows it (P09-04).
 */
function dueDate(loan: LoanDates): IsoDate | null {
  return loan.dueOn != null && isIsoDate(loan.dueOn) ? loan.dueOn : null;
}

/**
 * `returned` once returned; `overdue` after the due date; `due-soon` from
 * three days before the due date up to and including the due date itself;
 * otherwise (or with no due date) `on-loan`.
 */
export function loanStatus(loan: LoanDates, today: IsoDate): LoanStatus {
  if (loan.returnedOn != null) return 'returned';
  const due = dueDate(loan);
  if (due == null) return 'on-loan';
  const left = daysBetween(today, due);
  if (left < 0) return 'overdue';
  return left <= DUE_SOON_DAYS ? 'due-soon' : 'on-loan';
}

/** `loanStatus` for the local calendar day of an instant (the injectable clock's `now`). */
export function loanStatusAt(loan: LoanDates, now: Date): LoanStatus {
  return loanStatus(loan, todayOf(now));
}

/** An open loan whose due date is before `today`. */
export function isOverdue(loan: LoanDates, today: IsoDate): boolean {
  return loanStatus(loan, today) === 'overdue';
}

/** Whole days past the due date for an open loan; 0 when not overdue. */
export function daysOverdue(loan: LoanDates, today: IsoDate): number {
  return isOverdue(loan, today) ? daysBetween(dueDate(loan)!, today) : 0;
}

/** Days until an open loan is due (0 = today, negative = overdue); null when returned or undated. */
export function daysUntilDue(loan: LoanDates, today: IsoDate): number | null {
  const due = dueDate(loan);
  if (loan.returnedOn != null || due == null) return null;
  return daysBetween(today, due);
}

/** How many days after its due date a returned loan came back; 0 when on time, open or undated. */
export function daysReturnedLate(loan: LoanDates): number {
  const due = dueDate(loan);
  if (loan.returnedOn == null || due == null || !isIsoDate(loan.returnedOn)) return 0;
  return Math.max(0, daysBetween(due, loan.returnedOn));
}

/** A usable loan length: whole days from 1 to MAX_LOAN_DAYS, else the default. */
export function normaliseLoanDays(days: number | null | undefined): number {
  return days != null && Number.isInteger(days) && days >= 1 && days <= MAX_LOAN_DAYS ? days : DEFAULT_LOAN_DAYS;
}

/** The due date offered when lending: `lentOn` plus the configured loan length. */
export function defaultDueDate(lentOn: IsoDate, loanDays: number | null = DEFAULT_LOAN_DAYS): IsoDate {
  return addDays(lentOn, normaliseLoanDays(loanDays));
}

export type LoanDateField = 'lentOn' | 'dueOn' | 'returnedOn';

export type LoanIssueCode =
  | 'invalid-date'
  | 'lent-in-future'
  | 'due-before-lent'
  | 'returned-before-lent'
  | 'returned-in-future';

export interface LoanIssue {
  field: LoanDateField;
  code: LoanIssueCode;
}

export interface LoanDatesInput {
  lentOn: IsoDate;
  dueOn?: IsoDate | null;
  returnedOn?: IsoDate | null;
}

/**
 * Problems with a loan's dates, empty when valid: each must be a real
 * `YYYY-MM-DD` date, due and returned dates cannot be before the lent date,
 * and, when `today` is given, neither lent nor returned dates can be in the
 * future. A due date may be in the past (recording an old loan) and a
 * return may come after the due date.
 */
export function validateLoanDates(input: LoanDatesInput, today?: IsoDate): LoanIssue[] {
  const issues: LoanIssue[] = [];
  const check = (field: LoanDateField, value: IsoDate | null | undefined): value is IsoDate => {
    if (value == null) return false;
    if (isIsoDate(value)) return true;
    issues.push({ field, code: 'invalid-date' });
    return false;
  };
  const lentOk = check('lentOn', input.lentOn);
  const dueOk = check('dueOn', input.dueOn);
  const returnedOk = check('returnedOn', input.returnedOn);
  if (lentOk && today != null && input.lentOn > today) issues.push({ field: 'lentOn', code: 'lent-in-future' });
  if (lentOk && dueOk && input.dueOn! < input.lentOn) issues.push({ field: 'dueOn', code: 'due-before-lent' });
  if (lentOk && returnedOk && input.returnedOn! < input.lentOn) issues.push({ field: 'returnedOn', code: 'returned-before-lent' });
  if (returnedOk && today != null && input.returnedOn! > today) issues.push({ field: 'returnedOn', code: 'returned-in-future' });
  return issues;
}

/** Thrown when loan dates break the rules in `validateLoanDates`. */
export class LoanValidationError extends Error {
  constructor(readonly issues: readonly LoanIssue[]) {
    super(`Invalid loan dates: ${issues.map((i) => `${i.field} ${i.code}`).join(', ')}`);
    this.name = 'LoanValidationError';
  }
}

/** Throws LoanValidationError unless `validateLoanDates` finds nothing. */
export function assertValidLoanDates(input: LoanDatesInput, today?: IsoDate): void {
  const issues = validateLoanDates(input, today);
  if (issues.length) throw new LoanValidationError(issues);
}
