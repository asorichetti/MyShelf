import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useBooky, type BookyTip } from '@/components/booky';
import { libraryRepo, settingsRepo, useDatabase, type Db } from '@/db';

import { BACKUP_REMINDER_MESSAGE, isBackupDue, snoozeUntil } from './backupReminder';

/** Whether Booky should suggest a backup now; records it as shown when so (at most weekly). */
export async function takeBackupReminder(db: Db, now: Date = new Date()): Promise<boolean> {
  const [stats, settings] = await Promise.all([libraryRepo.libraryStats(db), settingsRepo.getAllSettings(db)]);
  const due = isBackupDue({
    bookCount: stats.books,
    firstAddedAt: stats.firstAddedAt,
    lastBackupAt: settings['backup.lastAt'],
    reminderShownAt: settings['backup.reminderShownAt'],
    snoozedUntil: settings['backup.snoozedUntil'],
    bookyMode: settings.bookyMode,
    mutedTips: settings.mutedTips,
    now,
  });
  if (due) await settingsRepo.setSetting(db, 'backup.reminderShownAt', now.toISOString());
  return due;
}

/**
 * On start-up and on returning to the foreground, Booky gently suggests a
 * backup when one is due (P08-06). Never over another tip, never while the
 * E2E fixture loader is running, and never on the backup screens.
 */
export function useBackupReminder(): void {
  const db = useDatabase();
  const { tip, showTip } = useBooky();
  const tipRef = useRef(tip);
  const pathname = usePathname();
  const path = useRef(pathname);
  const busy = useRef(false);
  useEffect(() => {
    tipRef.current = tip;
    path.current = pathname;
  });

  const check = useCallback(() => {
    if (busy.current || tipRef.current || path.current.startsWith('/e2e') || path.current.startsWith('/settings/')) return;
    busy.current = true;
    takeBackupReminder(db)
      .then((due) => {
        if (!due || tipRef.current) return;
        const next: BookyTip = {
          title: 'A little safety net',
          message: BACKUP_REMINDER_MESSAGE,
          expression: 'concerned',
          actions: [
            { label: 'Back up', onPress: () => router.navigate('/settings/backup') },
            {
              label: 'Later',
              onPress: () => {
                settingsRepo.setSetting(db, 'backup.snoozedUntil', snoozeUntil(new Date())).catch(() => undefined);
              },
            },
          ],
        };
        showTip(next);
      })
      .catch((e) => console.warn('Could not check whether a backup is due', e))
      .finally(() => {
        busy.current = false;
      });
  }, [db, showTip]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);
}
