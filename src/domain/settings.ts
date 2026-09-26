import type { ShelfSort } from './book';

/** Booky's chattiness (PLAN §8): all tips, only essential ones, or hidden. */
export type BookyMode = 'helpful' | 'quiet' | 'off';

/** Every setting, with its type. Values are stored JSON-encoded in the settings table. */
export interface AppSettings {
  bookyMode: BookyMode;
  /** Tip ids the user asked Booky not to show again. */
  mutedTips: string[];
  /** Ask Google Books as well as Open Library for book details (PLAN §6). Settings → Lookups (P08-05). */
  googleBooksEnabled: boolean;
  /** Days from lending to the default due date (P05-02); configurable in Settings (P08-07). */
  loanDays: number;
  /** The Shelf's sort order, remembered across restarts. */
  shelfSort: ShelfSort;
  /** Books whose auto-detected series the user said was wrong ("Not a series"): never re-added (P04-03). */
  'series.dismissedBookIds': number[];
  /** Books linked to a series from a low- or medium-confidence guess, awaiting "Is this Discworld #5?" (P04-03). */
  'series.pendingConfirmBookIds': number[];
  /** Series Booky has already pointed out a gap in (tip id `series-gap:<seriesId>`), so the tip shows once per series (P04-07). */
  'series.gapTipSeriesIds': number[];
}

export type SettingKey = keyof AppSettings;

/** Defaults used whenever a setting is unset (or unreadable). */
export const settingDefaults: Readonly<AppSettings> = Object.freeze<AppSettings>({
  bookyMode: 'helpful',
  mutedTips: [],
  googleBooksEnabled: true,
  loanDays: 28,
  shelfSort: { sort: 'title', direction: 'asc' },
  'series.dismissedBookIds': [],
  'series.pendingConfirmBookIds': [],
  'series.gapTipSeriesIds': [],
});
