import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loansRepo, settingsRepo, useDatabase, type Db } from '@/db';
import { emit, useLibraryEvent } from '@/features/events';
import { reminderScheduler, syncReminders, type ReminderPermission, type ReminderScheduler, type SyncResult } from '@/services/reminders';

/** Reads the setting and the open loans, then brings the scheduled reminders in line. */
export async function syncLoanReminders(db: Db, scheduler: ReminderScheduler, now: Date = new Date()): Promise<SyncResult> {
  const [enabled, loans] = await Promise.all([settingsRepo.getSetting(db, 'loanReminders'), loansRepo.listOpenLoans(db)]);
  return syncReminders(scheduler, { enabled, loans, now });
}

/**
 * Keeps due-date reminders in step with the loans: on app start, when the
 * app comes back to the foreground, and after any lend, return or edit
 * (`loans-changed`) or settings change. Tapping a reminder opens its book.
 */
export function useReminderSync(scheduler: ReminderScheduler = reminderScheduler): void {
  const db = useDatabase();
  const running = useRef<Promise<unknown>>(Promise.resolve());

  const sync = useCallback(() => {
    if (!scheduler.supported) return;
    // One at a time, so two quick changes cannot schedule the same reminder twice.
    running.current = running.current
      .then(() => syncLoanReminders(db, scheduler))
      .catch((e) => console.warn('Could not update loan reminders', e));
  }, [db, scheduler]);

  useEffect(() => {
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [sync]);
  useLibraryEvent(['loans-changed', 'library-changed', 'settings-changed'], sync);

  useEffect(() => scheduler.onOpen((url) => router.navigate(url as Href)), [scheduler]);
}

export interface ReminderSetting {
  /** Null until read. */
  enabled: boolean | null;
  supported: boolean;
  /** The user said no to notifications (the switch stays off). */
  denied: boolean;
  busy: boolean;
  setEnabled: (on: boolean) => Promise<void>;
}

/**
 * The Settings switch. Turning it on asks for notification permission first
 * (only then, never at start-up); if the answer is no, the switch stays off
 * and `denied` explains why. Turning it off cancels every reminder.
 */
export function useReminderSetting(scheduler: ReminderScheduler = reminderScheduler): ReminderSetting {
  const db = useDatabase();
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    settingsRepo
      .getSetting(db, 'loanReminders')
      .then((on) => active && setEnabledState(scheduler.supported && on))
      .catch((e) => {
        console.warn('Could not read the reminder setting', e);
        if (active) setEnabledState(false);
      });
    return () => {
      active = false;
    };
  }, [db, scheduler]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (!scheduler.supported) return;
      setBusy(true);
      try {
        let permission: ReminderPermission = 'granted';
        if (on) {
          permission = await scheduler.getPermission();
          if (permission !== 'granted') permission = await scheduler.requestPermission();
        }
        const next = on && permission === 'granted';
        setDenied(on && !next);
        await settingsRepo.setSetting(db, 'loanReminders', next);
        setEnabledState(next);
        // useReminderSync (mounted at the root) schedules or cancels on this event.
        emit('settings-changed');
      } catch (e) {
        console.error('Could not change the reminder setting', e);
      } finally {
        setBusy(false);
      }
    },
    [db, scheduler],
  );

  return { enabled, supported: scheduler.supported, denied, busy, setEnabled };
}
