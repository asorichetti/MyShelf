import { daysBetween, parseIsoDate, type IsoDate } from './dates';
import { daysOverdue, loanStatus, type LoanStatus } from './loans';

import type { Loan } from './loan';

/**
 * The words on a loan's rubber stamp and what a screen reader says for it
 * (P05-03, P05-05). The stamp always carries the status in text, so colour
 * is never the only cue.
 */

export type LoanStampTone = 'accent' | 'warn' | 'danger' | 'success';

export interface LoanStampInfo {
  status: LoanStatus;
  /** Terse stamp text, e.g. "Due 12 Oct" or "Overdue · 3 days" (shown in capitals). */
  label: string;
  tone: LoanStampTone;
  /** Full sentence for assistive tech, e.g. "Overdue by 3 days, it was due back on 12 Oct 2026". */
  description: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Oct", or "12 Oct 2027" when the date is not in `today`'s year. */
export function formatShortDate(value: IsoDate, today?: IsoDate): string {
  const d = parseIsoDate(value);
  const short = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return today != null && today.slice(0, 4) === value.slice(0, 4) ? short : `${short} ${d.getFullYear()}`;
}

/** "1 day", "3 days". */
export const dayCount = (n: number) => (n === 1 ? '1 day' : `${n} days`);

type StampLoan = Pick<Loan, 'dueOn' | 'returnedOn'>;

/**
 * The stamp for a loan on `today`: RETURNED 12 OCT (success), OVERDUE · 3 DAYS
 * (danger), DUE TODAY / DUE TOMORROW / DUE 12 OCT within three days (warn),
 * DUE 12 OCT later on (accent) and ON LOAN without a due date (accent).
 */
export function loanStamp(loan: StampLoan, today: IsoDate): LoanStampInfo {
  const status = loanStatus(loan, today);
  const long = (d: IsoDate) => formatShortDate(d, '0000');
  switch (status) {
    case 'returned':
      return {
        status,
        label: `Returned ${formatShortDate(loan.returnedOn!, today)}`,
        tone: 'success',
        description: `Returned on ${long(loan.returnedOn!)}`,
      };
    case 'overdue': {
      const days = dayCount(daysOverdue(loan, today));
      return { status, label: `Overdue · ${days}`, tone: 'danger', description: `Overdue by ${days}, it was due back on ${long(loan.dueOn!)}` };
    }
    case 'due-soon': {
      const left = daysBetween(today, loan.dueOn!);
      const label = left === 0 ? 'Due today' : left === 1 ? 'Due tomorrow' : `Due ${formatShortDate(loan.dueOn!, today)}`;
      const when = left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${dayCount(left)}`;
      return { status, label, tone: 'warn', description: `Due back ${when}, on ${long(loan.dueOn!)}` };
    }
    case 'on-loan':
      return loan.dueOn
        ? { status, label: `Due ${formatShortDate(loan.dueOn, today)}`, tone: 'accent', description: `Due back on ${long(loan.dueOn)}` }
        : { status, label: 'On loan', tone: 'accent', description: 'On loan, no due date' };
  }
}
