import { useCallback } from 'react';

import { settingsRepo, useDatabase, type Db } from '@/db';
import { emit } from '@/features/events';

/** Marks the onboarding finished (or skipped) so it never shows again, and tells whoever cares (Booky's welcome tips). */
export async function finishOnboarding(db: Db): Promise<void> {
  await settingsRepo.setSetting(db, 'onboarding.done', true);
  emit('settings-changed');
}

export function useFinishOnboarding(): () => Promise<void> {
  const db = useDatabase();
  return useCallback(() => finishOnboarding(db), [db]);
}
