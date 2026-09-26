import { formatDay, t } from '@/i18n';

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

/** "12 Oct", or "12 Oct 2027" when the date is not in `today`'s year; a value that is not a date as it is. */
export function formatShortDate(value: IsoDate, today?: IsoDate): string {
  let d: Date;
  try {
    d = parseIsoDate(value);
  } catch {
    return String(value);
  }
  return formatDay(d, { year: !(today != null && today.slice(0, 4) === value.slice(0, 4)) });
}

/** "1 day", "3 days". */
export const dayCount = (n: number) => t('common.days', { count: n });

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
        label: t('loanStamp.returned', { date: formatShortDate(loan.returnedOn!, today) }),
        tone: 'success',
        description: t('loanStamp.returnedDescription', { date: long(loan.returnedOn!) }),
      };
    case 'overdue': {
      const count = daysOverdue(loan, today);
      return {
        status,
        label: t('loanStamp.overdue', { count }),
        tone: 'danger',
        description: t('loanStamp.overdueDescription', { count, date: long(loan.dueOn!) }),
      };
    }
    case 'due-soon': {
      const left = daysBetween(today, loan.dueOn!);
      const date = long(loan.dueOn!);
      if (left === 0) return { status, label: t('loanStamp.dueToday'), tone: 'warn', description: t('loanStamp.dueTodayDescription', { date }) };
      if (left === 1) return { status, label: t('loanStamp.dueTomorrow'), tone: 'warn', description: t('loanStamp.dueTomorrowDescription', { date }) };
      return {
        status,
        label: t('loanStamp.due', { date: formatShortDate(loan.dueOn!, today) }),
        tone: 'warn',
        description: t('loanStamp.dueSoonDescription', { count: left, date }),
      };
    }
    case 'on-loan':
      return loan.dueOn
        ? { status, label: t('loanStamp.due', { date: formatShortDate(loan.dueOn, today) }), tone: 'accent', description: t('loanStamp.dueDescription', { date: long(loan.dueOn) }) }
        : { status, label: t('loanStamp.onLoan'), tone: 'accent', description: t('loanStamp.onLoanDescription') };
  }
}
