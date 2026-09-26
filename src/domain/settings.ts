/** Booky's chattiness (PLAN §8): all tips, only essential ones, or hidden. */
export type BookyMode = 'helpful' | 'quiet' | 'off';

/** Every setting, with its type. Values are stored JSON-encoded in the settings table. */
export interface AppSettings {
  bookyMode: BookyMode;
  /** Tip ids the user asked Booky not to show again. */
  mutedTips: string[];
}

export type SettingKey = keyof AppSettings;

/** Defaults used whenever a setting is unset (or unreadable). */
export const settingDefaults: Readonly<AppSettings> = Object.freeze({
  bookyMode: 'helpful',
  mutedTips: [],
});
