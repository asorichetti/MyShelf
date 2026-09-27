import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { onBookyEvent, useBooky, type BookyEvent } from '@/components/booky';
import { loansRepo, useDatabase, type Db } from '@/db';
import { today as todayOf, type IsoDate } from '@/domain';
import { inFixtureVisit } from '@/features/e2e/fixtureVisit';

import { overdueNudgeEvents } from './overdueNudge';

/** Today's overdue-nudge events, most overdue first (empty when nothing is overdue). */
export async function overdueEvents(db: Db, today: IsoDate): Promise<BookyEvent[]> {
  return overdueNudgeEvents(await loansRepo.listOverdueLoans(db, today), today);
}

/**
 * When the app starts or comes back to the foreground (Booky's
 * `app-foreground` event), Booky gently mentions one overdue loan. The tip
 * is screen-bound: moving to another screen puts it away, so it never sits
 * over that screen's actions. Not while the E2E fixture loader is replacing
 * the library, nor for the rest of a visit that started there (the auto test
 * suite and the Maestro flows start there; `fixtureVisit.ts`).
 */
export function useOverdueNudge(): void {
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
        if (busy.current || inFixtureVisit() || path.current.startsWith('/e2e')) return;
        busy.current = true;
        overdueEvents(db, todayOf())
          .then((events) => (events.length && !inFixtureVisit() ? emit(events) : null))
          .catch((e) => console.warn('Could not check for overdue loans', e))
          .finally(() => {
            busy.current = false;
          });
      }),
    [db, emit],
  );
}
