/**
 * How long each Shelf query takes, as a User Timing measure (P09-03): the
 * auto test suite's performance journeys read `performance.getEntriesByName`
 * to report search latency without guessing from the screen. Where the
 * platform has no `performance.measure` it costs a clock read and nothing more.
 */
export const SHELF_QUERY_MEASURE = 'myshelf:shelf-query';

/** Measures kept per name; older ones are dropped so a long session does not grow the timeline. */
const KEEP = 100;

type Perf = {
  now?: () => number;
  measure?: (name: string, options: { start: number; end: number; detail?: unknown }) => unknown;
  getEntriesByName?: (name: string) => unknown[];
  clearMeasures?: (name: string) => void;
};

const perf = (): Perf | undefined => (globalThis as { performance?: Perf }).performance;

export function timingStart(): number {
  return perf()?.now?.() ?? Date.now();
}

/** Records `name` from `start` (a `timingStart()` value) to now, with an optional detail. */
export function recordTiming(name: string, start: number, detail?: Record<string, unknown>): void {
  const p = perf();
  if (!p?.measure || !p.now) return;
  try {
    if ((p.getEntriesByName?.(name).length ?? 0) >= KEEP) p.clearMeasures?.(name);
    p.measure(name, { start, end: p.now(), detail });
  } catch {
    // Timing is best effort: an old engine without User Timing Level 3 simply records nothing.
  }
}
