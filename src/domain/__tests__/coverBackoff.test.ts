import { COVER_RETRY_DELAYS, coverRetryDelayMs, nextCoverRetryAt, type CoverAttemptResult } from '../coverBackoff';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('cover backfill backoff', () => {
  it.each<[CoverAttemptResult, number, number]>([
    ['none', 1, 1 * DAY],
    ['none', 2, 7 * DAY],
    ['none', 3, 30 * DAY],
    ['none', 4, 90 * DAY],
    ['none', 5, 90 * DAY],
    ['none', 50, 90 * DAY],
    ['error', 1, 1 * HOUR],
    ['error', 2, 6 * HOUR],
    ['error', 3, 1 * DAY],
    ['error', 4, 7 * DAY],
    ['error', 9, 7 * DAY],
    ['none', 0, 1 * DAY], // defensive: treated as the first attempt
    ['error', -3, 1 * HOUR],
  ])('%s after attempt %i waits %i ms', (result, attempts, expected) => {
    expect(coverRetryDelayMs(attempts, result)).toBe(expected);
  });

  it('never waits less after more attempts', () => {
    for (const delays of Object.values(COVER_RETRY_DELAYS)) {
      expect([...delays].sort((a, b) => a - b)).toEqual(delays);
    }
  });

  it('gives an ISO time', () => {
    expect(nextCoverRetryAt(2, 'none', Date.parse('2026-09-01T00:00:00.000Z'))).toBe('2026-09-08T00:00:00.000Z');
  });
});
