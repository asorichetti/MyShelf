import type { BookyEvent } from '@/components/booky';
import { dayCount, daysOverdue, type IsoDate, type LoanWithDetails } from '@/domain';

/**
 * Booky's overdue nudge (P05-10): "“Dune” was due back from Sam 3 days
 * ago." The words are the `loan-overdue` tip in Booky's catalogue; the rules
 * (at most once per loan per day, only in Helpful mode, never when muted) are
 * the engine's (P07-02). This module turns overdue loans into events.
 */

/** Booky's tip id; muting it ("Don't show tips like this") turns the nudge off. */
export const OVERDUE_NUDGE_KIND = 'loan-overdue';

/** "yesterday", "3 days ago". */
export function overdueWhen(loan: Pick<LoanWithDetails, 'dueOn' | 'returnedOn'>, today: IsoDate): string {
  const days = daysOverdue(loan, today);
  return days === 1 ? 'yesterday' : `${dayCount(days)} ago`;
}

/** The nudge's words for one loan, as Booky's catalogue fills them in. */
export function overdueNudgeMessage(loan: Pick<LoanWithDetails, 'bookTitle' | 'borrowerName' | 'dueOn' | 'returnedOn'>, today: IsoDate): string {
  return `“${loan.bookTitle}” was due back from ${loan.borrowerName} ${overdueWhen(loan, today)}.`;
}

/**
 * One `loan-overdue` event per open overdue loan, most overdue first: the
 * engine shows the first it has not yet shown today (keyed by loan id).
 */
export function overdueNudgeEvents(overdue: readonly LoanWithDetails[], today: IsoDate): BookyEvent[] {
  return overdue
    .filter((l) => l.returnedOn == null && daysOverdue(l, today) > 0)
    .sort((a, b) => daysOverdue(b, today) - daysOverdue(a, today) || a.id - b.id)
    .map((loan) => ({ type: 'loan-overdue', key: loan.id, vars: { title: loan.bookTitle, borrower: loan.borrowerName, when: overdueWhen(loan, today) } }));
}
