/** How a cover search ended when it found nothing to save. */
export type CoverAttemptResult =
  /** Every source answered and none has a usable cover. */
  | 'none'
  /** A source failed (rate limit, server error): worth trying sooner. */
  | 'error';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Waits before searching again, by attempt number (1 = the first failed
 * search). Covers do get added to Open Library and Google Books over time,
 * so a book is never given up for good, but after a few empty searches it
 * is only looked at every three months.
 */
export const COVER_RETRY_DELAYS: Record<CoverAttemptResult, readonly number[]> = {
  none: [1 * DAY, 7 * DAY, 30 * DAY, 90 * DAY],
  error: [1 * HOUR, 6 * HOUR, 1 * DAY, 7 * DAY],
};

/** Milliseconds to wait after the `attempts`-th unsuccessful search (the last delay repeats). */
export function coverRetryDelayMs(attempts: number, result: CoverAttemptResult): number {
  const delays = COVER_RETRY_DELAYS[result];
  const index = Math.min(Math.max(1, Math.floor(attempts)), delays.length) - 1;
  return delays[index];
}

/** ISO-8601 UTC time at which a book may be searched again. */
export function nextCoverRetryAt(attempts: number, result: CoverAttemptResult, now: number): string {
  return new Date(now + coverRetryDelayMs(attempts, result)).toISOString();
}
