import { seriesRepo, type Db } from '@/db';
import type { SeriesMatch } from '@/domain';

import { addToIdList, idListHas, removeFromIdList } from './seriesSettings';

export type DetectedSeriesResult = 'applied' | 'needs-confirmation' | 'dismissed' | 'none';

/**
 * Links a saved book to the series the metadata guessed (`extractSeries`,
 * P02-08). A high-confidence guess (a provider's series field with a
 * position) is applied directly, still editable; a medium or low one is
 * applied too but queued for "Is this Discworld #5?" on the book's page
 * (P04-03). A book the user already answered "Not a series" for is left
 * alone, so a later "Refresh details" never re-adds the series.
 *
 * The scan save path (`src/features/scan/useSaveCandidate.ts`, P03-09) and
 * "Refresh details" call this after saving the book (and before
 * `probe.finish`, see `seriesEvents.ts`).
 */
export async function applyDetectedSeries(db: Db, bookId: number, match: SeriesMatch | null): Promise<DetectedSeriesResult> {
  if (!match?.name.trim()) return 'none';
  if (await idListHas(db, 'series.dismissedBookIds', bookId)) return 'dismissed';
  const series = await seriesRepo.findOrCreateSeries(db, match.name);
  await seriesRepo.setBookSeries(db, bookId, series.id, match.position);
  if (match.confidence === 'high') {
    await removeFromIdList(db, 'series.pendingConfirmBookIds', bookId);
    return 'applied';
  }
  await addToIdList(db, 'series.pendingConfirmBookIds', bookId);
  return 'needs-confirmation';
}
