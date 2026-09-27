import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { onBookyEvent, useBooky } from '@/components/booky';
import { libraryRepo, settingsRepo, useDatabase, type Db } from '@/db';
import { inFixtureVisit } from '@/features/e2e/fixtureVisit';

import { isBackupDue, snoozeUntil } from './backupReminder';

/** Whether a backup reminder is due now (P08-06's rule: 10+ books, no backup in 30 days, at most weekly, not snoozed). */
export async function backupReminderDue(db: Db, now: Date = new Date()): Promise<boolean> {
  const [stats, settings] = await Promise.all([libraryRepo.libraryStats(db), settingsRepo.getAllSettings(db)]);
  return isBackupDue({
    bookCount: stats.books,
    firstAddedAt: stats.firstAddedAt,
    lastBackupAt: settings['backup.lastAt'],
    reminderShownAt: settings['backup.reminderShownAt'],
    snoozedUntil: settings['backup.snoozedUntil'],
    bookyMode: settings.bookyMode,
    mutedTips: settings.mutedTips,
    now,
  });
}

/**
 * On start-up and on returning to the foreground (Booky's `app-foreground`),
 * Booky gently suggests a backup when one is due (P08-06), through the tips
 * engine (`backup-due`: "Back up" or "Later", which snoozes 30 days). The
 * engine keeps it from covering another tip; it is recorded as shown only
 * when it actually shows. Never while the E2E fixture loader is running or for
 * the rest of a visit that started there (`fixtureVisit.ts`), and never on
 * the Settings screens.
 */
export function useBackupReminder(): void {
  const db = useDatabase();
  const { emit } = useBooky();
  const pathname = usePathname();
  const path = useRef(pathname);
  const busy = useRef(false);
  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(
    () =>
      onBookyEvent('app-foreground', () => {
        if (busy.current || inFixtureVisit() || path.current.startsWith('/e2e') || path.current.startsWith('/settings/')) return;
        busy.current = true;
        const now = new Date();
        backupReminderDue(db, now)
          .then(async (due) => {
            if (!due || inFixtureVisit()) return;
            const later = () => void settingsRepo.setSetting(db, 'backup.snoozedUntil', snoozeUntil(new Date())).catch(() => undefined);
            const shown = await emit({ type: 'backup-due', handlers: { 'backup-later': later } });
            if (shown) await settingsRepo.setSetting(db, 'backup.reminderShownAt', now.toISOString());
          })
          .catch((e) => console.warn('Could not check whether a backup is due', e))
          .finally(() => {
            busy.current = false;
          });
      }),
    [db, emit],
  );
}
