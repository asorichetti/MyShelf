/**
 * Calendar dates (loans) are local `YYYY-MM-DD` strings, so "due today" never
 * shifts across timezones; ISO strings of this shape also sort correctly.
 */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let frozenToday: IsoDate | null = null;

/**
 * Freezes "today" for the rest of the session (E2E fixtures pass
 * `&today=YYYY-MM-DD`), or unfreezes it with null. Held in memory only.
 */
export function setToday(value: IsoDate | null): void {
  if (value != null) parseIsoDate(value);
  frozenToday = value;
}

/** Today's local calendar date: the frozen date if one is set, else the clock. `now` is injectable for tests. */
export function today(now?: Date): IsoDate {
  if (now) return toIsoDate(now);
  return frozenToday ?? toIsoDate(new Date());
}

export function parseIsoDate(value: IsoDate): Date {
  const m = ISO_DATE.exec(value);
  if (!m) throw new Error(`Expected a YYYY-MM-DD date, got "${value}"`);
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (toIsoDate(date) !== value) throw new Error(`Not a real calendar date: "${value}"`);
  return date;
}

export function isIsoDate(value: string): boolean {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

/** Adds (or with a negative number, subtracts) whole calendar days. */
export function addDays(value: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(value);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Negative when a is earlier, 0 when equal, positive when later. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-12" -> "12 Oct 2026" (British order, short month). */
export function formatDate(value: IsoDate): string {
  const d = parseIsoDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
