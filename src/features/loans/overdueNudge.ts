import { dayCount, daysOverdue, type BookyMode, type IsoDate, type LoanWithDetails } from '@/domain';

/**
 * Booky's overdue nudge (P05-10): "“Dune” was due back from Sam 3 days
 * ago." At most once per loan per day, only in Booky's Helpful mode, and
 * never when the user muted this kind of tip. Written as a pure rule so the
 * tips engine (P07-02) can register it as is.
 */

/** Muting this id ("Don't show tips like this", P07) turns the nudge off. */
export const OVERDUE_NUDGE_KIND = 'loan-overdue';

/** `loan-overdue:<loanId>:<date>`: one id per loan per day. */
export const overdueNudgeId = (loanId: number, today: IsoDate) => `${OVERDUE_NUDGE_KIND}:${loanId}:${today}`;

export function overdueNudgeMessage(loan: Pick<LoanWithDetails, 'bookTitle' | 'borrowerName' | 'dueOn' | 'returnedOn'>, today: IsoDate): string {
  const days = daysOverdue(loan, today);
  const when = days === 1 ? 'yesterday' : `${dayCount(days)} ago`;
  return `“${loan.bookTitle}” was due back from ${loan.borrowerName} ${when}.`;
}

export interface OverdueNudgeInput {
  /** Open loans past their due date. */
  overdue: readonly LoanWithDetails[];
  today: IsoDate;
  bookyMode: BookyMode;
  mutedTips: readonly string[];
  /** Nudge ids already shown (see `overdueNudgeId`). */
  shown: readonly string[];
}

export interface OverdueNudge {
  id: string;
  loan: LoanWithDetails;
  message: string;
}

/** The nudge to show now (the most overdue loan not nudged today), or null. */
export function pickOverdueNudge({ overdue, today, bookyMode, mutedTips, shown }: OverdueNudgeInput): OverdueNudge | null {
  if (bookyMode !== 'helpful' || mutedTips.includes(OVERDUE_NUDGE_KIND)) return null;
  const seen = new Set(shown);
  const candidates = overdue
    .filter((l) => l.returnedOn == null && daysOverdue(l, today) > 0 && !seen.has(overdueNudgeId(l.id, today)))
    .sort((a, b) => daysOverdue(b, today) - daysOverdue(a, today) || a.id - b.id);
  const loan = candidates[0];
  return loan ? { id: overdueNudgeId(loan.id, today), loan, message: overdueNudgeMessage(loan, today) } : null;
}

/** The shown-list after showing `id`: only today's ids are kept, so it never grows. */
export function markNudgeShown(shown: readonly string[], id: string, today: IsoDate): string[] {
  return [...shown.filter((s) => s.endsWith(`:${today}`) && s !== id), id];
}
