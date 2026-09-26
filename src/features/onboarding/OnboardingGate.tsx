import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { settingsRepo, useDatabase } from '@/db';
import { needsOnboarding } from '@/domain';
import { isE2eEnabled } from '@/features/e2e/e2eFlag';
import { useLibraryEvent } from '@/features/events';

/**
 * Sends a first launch to `/onboarding` (P07-03). Rechecks when settings
 * change (an E2E fixture asking for a first run) and on every route until
 * the onboarding is done. Never interrupts the fixture loader. Renders nothing.
 */
export function OnboardingGate() {
  const db = useDatabase();
  const pathname = usePathname();
  const [version, setVersion] = useState(0);
  const [done, setDone] = useState(false);
  useLibraryEvent('settings-changed', () => setVersion((v) => v + 1));

  useEffect(() => {
    if (done || pathname.startsWith('/e2e') || pathname === '/onboarding') return;
    let active = true;
    settingsRepo
      .getSetting(db, 'onboarding.done')
      .then((value) => {
        if (!active) return;
        if (value === true) setDone(true);
        else if (needsOnboarding(value, isE2eEnabled())) router.replace('/onboarding');
      })
      .catch((e) => console.warn('Could not check the onboarding', e));
    return () => {
      active = false;
    };
  }, [db, pathname, version, done]);

  return null;
}
