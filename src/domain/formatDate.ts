import { formatDay, type MessageKey } from '@/i18n';

import { parseIsoDate, toIsoDate, type IsoDate } from './dates';

import type { DateFormat } from './settings';

/** The catalogue key naming each date format, for the Settings choice (P08-07). */
export const dateFormatLabels: Record<DateFormat, MessageKey> = {
  locale: 'dates.formats.locale',
  medium: 'dates.formats.medium',
  iso: 'dates.formats.iso',
};

let current: DateFormat = 'medium';

/**
 * Sets the format every `formatDate` call uses from now on. The app applies
 * the `dateFormat` setting at start-up and whenever it changes; held in
 * memory only, like the E2E clock.
 */
export function setDateFormat(format: DateFormat): void {
  current = format;
}

export function getDateFormat(): DateFormat {
  return current;
}

/**
 * A calendar date in the given format:
 * - `medium`: "12 Oct 2026" (the catalogue's style, see `formatDay`; the default)
 * - `iso`: "2026-10-12"
 * - `locale`: the phone's own medium style through `Intl.DateTimeFormat`
 *   ("Oct 12, 2026" in the US), falling back to `medium` without Intl.
 */
export function formatDateAs(value: IsoDate, format: DateFormat, locale?: string): string {
  const d = parseIsoDate(value);
  if (format === 'iso') return toIsoDate(d);
  if (format === 'locale' && typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    try {
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    } catch {
      // An unknown locale tag: fall through to the app's own style.
    }
  }
  return formatDay(d);
}

/**
 * "2026-10-12" in the user's chosen format ("12 Oct 2026" unless they picked
 * another). A stored value that is not a real date (a corrupt row) is shown
 * as it is rather than breaking the screen (P09-04).
 */
export function formatDate(value: IsoDate): string {
  try {
    return formatDateAs(value, current);
  } catch {
    return String(value);
  }
}
