// Small helpers shared by journeys.

/** Matches a computed font-family that fell back to the browser's default serif. */
export const serifRe = /^\s*"?(Times|serif|-webkit-standard)/i;

/** Whether s (with spaces removed) contains every sub. */
export function containsAll(s: string, ...subs: string[]): boolean {
  const compact = s.replaceAll(' ', '');
  return subs.every((sub) => compact.includes(sub));
}
