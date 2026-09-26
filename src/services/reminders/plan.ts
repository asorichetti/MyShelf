import { isIsoDate, parseIsoDate, type IsoDate, type LoanWithDetails } from '@/domain';

/**
 * Due-date reminders (P05-08): which local notifications should exist, and
 * how to get from what is scheduled now to that. Pure, so the rules are
 * tested without a device.
 */

/** Every reminder id starts with this; anything else scheduled is left alone. */
export const REMINDER_PREFIX = 'loan-due:';
/** Reminders go off at 10:00 local time on the due date. */
export const REMINDER_HOUR = 10;
/** The Android notification channel reminders are posted in. */
export const REMINDER_CHANNEL = 'loan-reminders';

export interface ReminderRequest {
  /** `loan-due:<loanId>:<dueOn>`: a new due date is a new id, so it replaces the old reminder. */
  id: string;
  loanId: number;
  bookId: number;
  title: string;
  body: string;
  /** Local 10:00 on the due date. */
  at: Date;
  /** Where tapping it goes: the loan's book. */
  url: string;
}

type ReminderLoan = Pick<LoanWithDetails, 'id' | 'bookId' | 'bookTitle' | 'borrowerName' | 'dueOn' | 'returnedOn'>;

export const reminderId = (loan: { id: number; dueOn: IsoDate }) => `${REMINDER_PREFIX}${loan.id}:${loan.dueOn}`;

/** 10:00 local time on a calendar date. */
export function reminderTime(dueOn: IsoDate): Date {
  const at = parseIsoDate(dueOn);
  at.setHours(REMINDER_HOUR, 0, 0, 0);
  return at;
}

/**
 * The reminders that should exist at `now`: one per open loan with a due
 * date whose 10:00 has not passed yet. Returned loans, loans without a due
 * date (or with one that is not a real date: a corrupt row) and times
 * already past get none (an overdue loan is Booky's nudge).
 */
export function planReminders(loans: readonly ReminderLoan[], now: Date): ReminderRequest[] {
  const out: ReminderRequest[] = [];
  for (const loan of loans) {
    if (loan.returnedOn != null || loan.dueOn == null || !isIsoDate(loan.dueOn)) continue;
    const at = reminderTime(loan.dueOn);
    if (at.getTime() <= now.getTime()) continue;
    out.push({
      id: reminderId({ id: loan.id, dueOn: loan.dueOn }),
      loanId: loan.id,
      bookId: loan.bookId,
      title: `“${loan.bookTitle}” is due back today`,
      body: `${loan.borrowerName} has it. A gentle reminder, no rush.`,
      at,
      url: `/book/${loan.bookId}`,
    });
  }
  return out;
}

export interface ReminderDiff {
  /** Scheduled reminder ids to cancel (loan returned, due date changed or removed). */
  cancel: string[];
  /** Reminders not scheduled yet. */
  schedule: ReminderRequest[];
}

/** Diffs by id: only ids with the reminder prefix are ours to cancel. */
export function diffReminders(scheduledIds: readonly string[], desired: readonly ReminderRequest[]): ReminderDiff {
  const want = new Set(desired.map((r) => r.id));
  const have = new Set(scheduledIds.filter((id) => id.startsWith(REMINDER_PREFIX)));
  return {
    cancel: [...have].filter((id) => !want.has(id)),
    schedule: desired.filter((r) => !have.has(r.id)),
  };
}
