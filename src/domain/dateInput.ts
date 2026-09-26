import { isIsoDate, type IsoDate } from './dates';

/**
 * Reading a date the user typed (the date field's typed fallback, P05-03).
 * British day-first order: "12/10/2026", "12-10-26", "12.10.2026",
 * "12 Oct 2026", "12 October 2026"; ISO "2026-10-12" also works. A two-digit
 * year means 20xx. Returns null for anything that is not a real date.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function build(y: number, m: number, d: number): IsoDate | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const year = y < 100 ? 2000 + y : y;
  if (year < 1000 || year > 9999) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

export function parseTypedDate(text: string): IsoDate | null {
  const s = text.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2}|\d{4})$/.exec(s);
  if (m) return build(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.? (\d{2}|\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS.findIndex((name) => m![2].startsWith(name) && name.startsWith(m![2].slice(0, 3)));
    return month < 0 ? null : build(Number(m[3]), month + 1, Number(m[1]));
  }
  return null;
}

/** The text a typed date field shows for a stored date: "12/10/2026". */
export function formatTypedDate(value: IsoDate): string {
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}
