import type { BookyStore } from '@/components/booky';
import { settingsRepo, type Db } from '@/db';
import { welcomeTipsOn } from '@/domain';

/** Booky's memory in the settings table: `bookyMode`, `mutedTips`, `booky.seen` (and `onboarding.done` for welcome tips). */
export function settingsBookyStore(db: Db, e2e: boolean): BookyStore {
  return {
    load: async () => {
      const s = await settingsRepo.getAllSettings(db);
      return { mode: s.bookyMode, muted: s.mutedTips, seen: s['booky.seen'], welcome: welcomeTipsOn(s['onboarding.done'], e2e) };
    },
    save: async (patch) => {
      if (patch.mode !== undefined) await settingsRepo.setSetting(db, 'bookyMode', patch.mode);
      if (patch.muted !== undefined) await settingsRepo.setSetting(db, 'mutedTips', patch.muted);
      if (patch.seen !== undefined) await settingsRepo.setSetting(db, 'booky.seen', patch.seen);
    },
  };
}
