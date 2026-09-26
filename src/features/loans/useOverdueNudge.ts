import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useBooky, type BookyTip } from '@/components/booky';
import { loansRepo, settingsRepo, useDatabase, type Db } from '@/db';
import { today as todayOf, type IsoDate } from '@/domain';

import { markNudgeShown, pickOverdueNudge, type OverdueNudge } from './overdueNudge';

/** Picks today's next overdue nudge and records it as shown. Null when there is nothing to say. */
export async function takeOverdueNudge(db: Db, today: IsoDate): Promise<OverdueNudge | null> {
  const [overdue, settings] = await Promise.all([loansRepo.listOverdueLoans(db, today), settingsRepo.getAllSettings(db)]);
  const nudge = pickOverdueNudge({
    overdue,
    today,
    bookyMode: settings.bookyMode,
    mutedTips: settings.mutedTips,
    shown: settings.overdueNudgesShown,
  });
  if (nudge) await settingsRepo.setSetting(db, 'overdueNudgesShown', markNudgeShown(settings.overdueNudgesShown, nudge.id, today));
  return nudge;
}

/**
 * When the app starts or comes back to the foreground, Booky gently mentions
 * one overdue loan. The tip belongs to the screen it appeared on: moving to
 * another screen puts it away, so it never sits over that screen's actions
 * (a selection bar, a form's buttons). Not while the E2E fixture loader is
 * replacing the library (the auto test suite starts every journey there).
 */
export function useOverdueNudge(): void {
  const db = useDatabase();
  const { tip, showTip, dismissTip } = useBooky();
  const busy = useRef(false);
  const pathname = usePathname();
  const path = useRef(pathname);
  const shown = useRef<{ tip: BookyTip; path: string } | null>(null);
  useEffect(() => {
    path.current = pathname;
    if (shown.current && shown.current.path !== pathname) {
      if (tip === shown.current.tip) dismissTip();
      shown.current = null;
    }
  }, [pathname, tip, dismissTip]);

  const check = useCallback(() => {
    if (busy.current || path.current.startsWith('/e2e')) return;
    busy.current = true;
    takeOverdueNudge(db, todayOf())
      .then((nudge) => {
        if (!nudge) return;
        const next: BookyTip = {
          title: 'A gentle nudge',
          message: nudge.message,
          expression: 'concerned',
          actions: [{ label: 'Open loans', onPress: () => router.navigate('/loans') }],
        };
        shown.current = { tip: next, path: path.current };
        showTip(next);
      })
      .catch((e) => console.warn('Could not check for overdue loans', e))
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
