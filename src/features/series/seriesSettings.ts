import { settingsRepo, type Db } from '@/db';

/** The settings that hold lists of ids for the series features. */
export type SeriesIdListKey = 'series.dismissedBookIds' | 'series.pendingConfirmBookIds' | 'series.gapTipSeriesIds';

export async function idListHas(db: Db, key: SeriesIdListKey, id: number): Promise<boolean> {
  return (await settingsRepo.getSetting(db, key)).includes(id);
}

export async function addToIdList(db: Db, key: SeriesIdListKey, id: number): Promise<void> {
  const ids = await settingsRepo.getSetting(db, key);
  if (!ids.includes(id)) await settingsRepo.setSetting(db, key, [...ids, id]);
}

export async function removeFromIdList(db: Db, key: SeriesIdListKey, id: number): Promise<void> {
  const ids = await settingsRepo.getSetting(db, key);
  if (ids.includes(id)) await settingsRepo.setSetting(db, key, ids.filter((x) => x !== id));
}
