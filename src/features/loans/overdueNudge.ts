import type { BookyEvent } from '@/components/booky';
import { daysOverdue, type IsoDate, type LoanWithDetails } from '@/domain';
import { t } from '@/i18n';

/**
 * Booky's overdue nudge (P05-10): "“Dune” was due back from Sam 3 days
 * ago." The words are the `loan-overdue` tip in Booky's catalogue; the rules
 * (at most once per loan per day, only in Helpful mode, never when muted) are
 * the engine's (P07-02). This module turns overdue loans into events.
 */

/** "yesterday", "3 days ago". */
export function overdueWhen(loan: Pick<LoanWithDetails, 'dueOn' | 'returnedOn'>, today: IsoDate): string {
  const days = daysOverdue(loan, today);
  return days === 1 ? t('loans.overdue.yesterday') : t('loans.overdue.daysAgo', { count: days });
}

/** The nudge's words for one loan, as Booky's catalogue fills them in. */
export function overdueNudgeMessage(loan: Pick<LoanWithDetails, 'bookTitle' | 'borrowerName' | 'dueOn' | 'returnedOn'>, today: IsoDate): string {
  return t('loans.overdue.nudge', { title: loan.bookTitle, borrower: loan.borrowerName, when: overdueWhen(loan, today) });
}

/** Where an overdue loan is already on show (`topics.ts`): its book's page, its borrower's page and the Loans tab. */
export function overdueTopics(loan: Pick<LoanWithDetails, 'bookId' | 'borrowerId'>): string[] {
  return [`book:${loan.bookId}`, `borrower:${loan.borrowerId}`, 'loans'];
}

/**
 * One `loan-overdue` event per open overdue loan, most overdue first: the
 * engine shows the first it has not yet shown today (keyed by loan id) and
 * that is not on the screen in front already.
 */
export function overdueNudgeEvents(overdue: readonly LoanWithDetails[], today: IsoDate): BookyEvent[] {
  return overdue
    .filter((l) => l.returnedOn == null && daysOverdue(l, today) > 0)
    .sort((a, b) => daysOverdue(b, today) - daysOverdue(a, today) || a.id - b.id)
    .map((loan) => ({
      type: 'loan-overdue',
      key: loan.id,
      vars: { title: loan.bookTitle, borrower: loan.borrowerName, when: overdueWhen(loan, today) },
      // Not over a screen that already shows this loan with its "Mark returned": the book, the borrower, Loans.
      topics: overdueTopics(loan),
    }));
}
