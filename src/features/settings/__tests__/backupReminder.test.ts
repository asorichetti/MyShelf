import { backupReminderReason, BACKUP_TIP_KIND, snoozeUntil, type BackupReminderInput } from '../backupReminder';

const NOW = new Date('2026-06-20T10:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysOn = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const base: BackupReminderInput = {
  bookCount: 12,
  firstAddedAt: daysAgo(90),
  lastBackupAt: null,
  reminderShownAt: null,
  snoozedUntil: null,
  bookyMode: 'helpful',
  mutedTips: [],
  now: NOW,
};

describe('backup reminder rule', () => {
  it.each<[string, Partial<BackupReminderInput>, string]>([
    ['never backed up, library a few months old', {}, 'due'],
    ['last backup 31 days ago', { lastBackupAt: daysAgo(31) }, 'due'],
    ['last backup 29 days ago', { lastBackupAt: daysAgo(29) }, 'recent-backup'],
    ['exactly 10 books', { bookCount: 10 }, 'due'],
    ['9 books', { bookCount: 9 }, 'few-books'],
    ['never backed up, first book added 3 days ago (a fresh import)', { firstAddedAt: daysAgo(3) }, 'new-library'],
    ['never backed up, first book added 30 days ago', { firstAddedAt: daysAgo(30) }, 'due'],
    ['shown 3 days ago', { reminderShownAt: daysAgo(3) }, 'shown-this-week'],
    ['shown 8 days ago', { reminderShownAt: daysAgo(8) }, 'due'],
    ['snoozed for another 10 days', { snoozedUntil: daysOn(10) }, 'snoozed'],
    ['snooze ended yesterday', { snoozedUntil: daysAgo(1) }, 'due'],
    ['Booky off', { bookyMode: 'off' }, 'booky-off'],
    ['Booky quiet (still worth saying)', { bookyMode: 'quiet' }, 'due'],
    ['muted', { mutedTips: [BACKUP_TIP_KIND] }, 'muted'],
    ['an unreadable last backup date counts as never', { lastBackupAt: 'garbage' }, 'due'],
  ])('%s → %s', (_what, change, want) => {
    expect(backupReminderReason({ ...base, ...change })).toBe(want);
  });

  it('snoozes for 30 days', () => {
    expect(snoozeUntil(NOW)).toBe(daysOn(30));
  });
});
