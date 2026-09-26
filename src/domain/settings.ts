import type { ShelfSort } from './book';
import type { ShelfFilters } from './shelfFilters';
import type { ShelfGroupBy, ShelfViewMode } from './shelfView';

/** Booky's chattiness (PLAN §8): all tips, only essential ones, or hidden. */
export type BookyMode = 'helpful' | 'quiet' | 'off';

/** How full dates are shown (P08-07): the phone's own style, "12 Oct 2026" or "2026-10-12". */
export const dateFormats = ['locale', 'medium', 'iso'] as const;
export type DateFormat = (typeof dateFormats)[number];

/** The app's colours (P09-02): follow the phone's light or dark setting, or always one of them. */
export const appearances = ['system', 'light', 'dark'] as const;
export type Appearance = (typeof appearances)[number];

/**
 * Settings that describe this phone rather than the library (when it was
 * last backed up, Booky's backup reminder). Backups leave them out and a
 * restore keeps this phone's values.
 */
export const deviceSettingKeys = ['backup.lastAt', 'backup.reminderShownAt', 'backup.snoozedUntil'] as const;

/** Every setting, with its type. Values are stored JSON-encoded in the settings table. */
export interface AppSettings {
  bookyMode: BookyMode;
  /** Tip ids the user asked Booky not to show again. */
  mutedTips: string[];
  /** Tips Booky must not repeat (P07-02): `<tipId>[:<key>]` once-only, `<tipId>[:<key>]@<YYYY-MM-DD>` once a day. */
  'booky.seen': string[];
  /** First-run onboarding (P07-03): true once finished or skipped; null on a fresh install (never answered). */
  'onboarding.done': boolean | null;
  /** Ask Google Books as well as Open Library for book details (PLAN §6). Settings → Lookups (P08-05). */
  googleBooksEnabled: boolean;
  /** Days from lending to the default due date (P05-02); configurable in Settings (P08-07). */
  loanDays: number;
  /** Local notifications at 10:00 on each open loan's due date (P05-08). Off until the user turns it on. */
  loanReminders: boolean;
  /** The Shelf's sort order, remembered across restarts. */
  shelfSort: ShelfSort;
  /** Books whose auto-detected series the user said was wrong ("Not a series"): never re-added (P04-03). */
  'series.dismissedBookIds': number[];
  /** Books linked to a series from a low- or medium-confidence guess, awaiting "Is this Discworld #5?" (P04-03). */
  'series.pendingConfirmBookIds': number[];
  /** How the Shelf is split into sections (P06-01). */
  shelfGroupBy: ShelfGroupBy;
  /** List, covers or spines (P06-08). */
  shelfViewMode: ShelfViewMode;
  /** The Shelf's filters (P06-10). */
  shelfFilters: ShelfFilters;
  /** How full dates are shown (P08-07). */
  dateFormat: DateFormat;
  /** Light, dark or the phone's own setting (P09-02). */
  appearance: Appearance;
  /** Let the cover backfill download covers over mobile data (P08-07). Off means Wi-Fi only. */
  coversOnMobileData: boolean;
  /** When a backup was last exported (ISO-8601 UTC), or null for never (P08-02). */
  'backup.lastAt': string | null;
  /** When Booky last suggested a backup (ISO-8601 UTC), so the reminder is at most weekly (P08-06). */
  'backup.reminderShownAt': string | null;
  /** "Remind me later": no backup reminder before this time (ISO-8601 UTC) (P08-06). */
  'backup.snoozedUntil': string | null;
}

export type SettingKey = keyof AppSettings;

/** Defaults used whenever a setting is unset (or unreadable). */
export const settingDefaults: Readonly<AppSettings> = Object.freeze<AppSettings>({
  bookyMode: 'helpful',
  mutedTips: [],
  'booky.seen': [],
  'onboarding.done': null,
  googleBooksEnabled: true,
  loanDays: 28,
  loanReminders: false,
  shelfSort: { sort: 'title', direction: 'asc' },
  'series.dismissedBookIds': [],
  'series.pendingConfirmBookIds': [],
  shelfGroupBy: 'none',
  shelfViewMode: 'list',
  shelfFilters: { genreIds: [], formats: [], languages: [], loan: 'any', series: 'any', yearFrom: null, yearTo: null, minRating: null, recentlyAdded: false },
  dateFormat: 'medium',
  appearance: 'system',
  coversOnMobileData: true,
  'backup.lastAt': null,
  'backup.reminderShownAt': null,
  'backup.snoozedUntil': null,
});

/** Whether `key` is a setting this app knows. */
export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(settingDefaults, key);
}
