import type { BookyMode } from '@/domain';

/**
 * Booky's backup reminder (P08-06), as a pure rule so the tips engine
 * (P07-02) can register it as is: with 10 or more books and no backup in
 * the last 30 days, Booky (concerned, gentle) suggests saving one. At most
 * once a week; "Later" snoozes it for 30 days.
 *
 * "Never backed up" counts from the first book added, so a library that
 * arrived all at once (a Goodreads import) is not nagged on day one.
 */

/** Muting this id ("Don't show tips like this", P07) turns the reminder off. */
export const BACKUP_TIP_KIND = 'backup-due';
export const BACKUP_MIN_BOOKS = 10;
export const BACKUP_DUE_DAYS = 30;
export const BACKUP_REMINDER_EVERY_DAYS = 7;
export const BACKUP_SNOOZE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupReminderInput {
  bookCount: number;
  /** When the first book was added (ISO-8601), null for an empty library. */
  firstAddedAt: string | null;
  /** `backup.lastAt`. */
  lastBackupAt: string | null;
  /** `backup.reminderShownAt`. */
  reminderShownAt: string | null;
  /** `backup.snoozedUntil`. */
  snoozedUntil: string | null;
  bookyMode: BookyMode;
  mutedTips: readonly string[];
  now: Date;
}

export type BackupReminderReason = 'due' | 'few-books' | 'recent-backup' | 'new-library' | 'shown-this-week' | 'snoozed' | 'booky-off' | 'muted';

const ms = (iso: string | null) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

/** Why the reminder does (`due`) or does not show now. Booky's Quiet mode still shows it: losing a library is the one thing worth interrupting for. */
export function backupReminderReason(input: BackupReminderInput): BackupReminderReason {
  const now = input.now.getTime();
  if (input.bookyMode === 'off') return 'booky-off';
  if (input.mutedTips.includes(BACKUP_TIP_KIND)) return 'muted';
  if (input.bookCount < BACKUP_MIN_BOOKS) return 'few-books';
  const last = ms(input.lastBackupAt);
  if (last != null && now - last < BACKUP_DUE_DAYS * DAY_MS) return 'recent-backup';
  const first = ms(input.firstAddedAt);
  if (last == null && first != null && now - first < BACKUP_DUE_DAYS * DAY_MS) return 'new-library';
  const snoozed = ms(input.snoozedUntil);
  if (snoozed != null && now < snoozed) return 'snoozed';
  const shown = ms(input.reminderShownAt);
  if (shown != null && now - shown < BACKUP_REMINDER_EVERY_DAYS * DAY_MS) return 'shown-this-week';
  return 'due';
}

export const isBackupDue = (input: BackupReminderInput) => backupReminderReason(input) === 'due';

/** `backup.snoozedUntil` for "Later". */
export function snoozeUntil(now: Date): string {
  return new Date(now.getTime() + BACKUP_SNOOZE_DAYS * DAY_MS).toISOString();
}
